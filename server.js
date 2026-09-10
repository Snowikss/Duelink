const express = require("express");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const rooms = new Map();

const GAME_NAMES = {
  tictactoe: "Крестики-нолики",
  connect4: "Четыре в ряд",
  rps: "Камень, ножницы, бумага",
  battleship: "Морской бой",
  dotsboxes: "Точки и квадраты",
  bullscows: "Быки и коровы",
};

function makeRoomId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  do {
    id = Array.from({ length: 6 }, () => alphabet[crypto.randomInt(alphabet.length)]).join("");
  } while (rooms.has(id));
  return id;
}

function sanitizeName(value) {
  const name = String(value || "").trim().replace(/\s+/g, " ").slice(0, 20);
  return name || `Игрок-${crypto.randomInt(100, 999)}`;
}

function newToken() {
  return crypto.randomBytes(18).toString("hex");
}

function createGameState(game) {
  if (game === "tictactoe") {
    return { board: Array(9).fill(null), turn: 0, winner: null, draw: false, round: 1 };
  }
  if (game === "connect4") {
    return { board: Array.from({ length: 6 }, () => Array(7).fill(null)), turn: 0, winner: null, draw: false, round: 1 };
  }
  if (game === "rps") {
    return { choices: [null, null], score: [0, 0], roundWinner: null, message: "Сделайте выбор", round: 1 };
  }
  if (game === "battleship") {
    return {
      boards: [createBattleBoard(), createBattleBoard()],
      turn: 0,
      winner: null,
      round: 1
    };
  }
  if (game === "dotsboxes") {
    return {
      hEdges: Array.from({ length: 4 }, () => Array(3).fill(null)),
      vEdges: Array.from({ length: 3 }, () => Array(4).fill(null)),
      boxes: Array.from({ length: 3 }, () => Array(3).fill(null)),
      score: [0, 0],
      turn: 0,
      winner: null,
      draw: false,
      round: 1
    };
  }
  if (game === "bullscows") {
    return {
      secrets: [null, null],
      ready: [false, false],
      guesses: [],
      turn: 0,
      winner: null,
      round: 1
    };
  }
  throw new Error("Unknown game");
}

function createBattleBoard() {
  const size = 10;
  const ships = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];
  const board = Array.from({ length: size }, () => Array(size).fill(null));
  const fleet = [];
  let shipId = 0;

  for (const len of ships) {
    let placed = false;
    for (let attempt = 0; attempt < 500 && !placed; attempt++) {
      const horizontal = Math.random() < 0.5;
      const row = crypto.randomInt(size);
      const col = crypto.randomInt(size);
      const cells = [];

      for (let i = 0; i < len; i++) {
        const r = row + (horizontal ? 0 : i);
        const c = col + (horizontal ? i : 0);
        if (r >= size || c >= size) {
          cells.length = 0;
          break;
        }
        cells.push([r, c]);
      }
      if (!cells.length) continue;

      const blocked = cells.some(([r, c]) => {
        for (let rr = Math.max(0, r - 1); rr <= Math.min(size - 1, r + 1); rr++) {
          for (let cc = Math.max(0, c - 1); cc <= Math.min(size - 1, c + 1); cc++) {
            if (board[rr][cc] !== null) return true;
          }
        }
        return false;
      });
      if (blocked) continue;

      const id = shipId++;
      for (const [r, c] of cells) board[r][c] = id;
      fleet.push({ id, cells, hits: [] });
      placed = true;
    }
    if (!placed) return createBattleBoard();
  }

  return { ships: fleet, shots: Array.from({ length: size }, () => Array(size).fill(null)) };
}

function roomSummary(room) {
  return {
    roomId: room.id,
    game: room.game,
    gameName: GAME_NAMES[room.game],
    players: room.players.map(p => ({ name: p.name, connected: !!p.socketId })),
  };
}

function getPlayerIndex(room, socket) {
  return room.players.findIndex(p => p.socketId === socket.id);
}

function leaveCurrentRoom(socket, removePlayer = false) {
  const roomId = socket.data.roomId;
  if (!roomId) return;
  const room = rooms.get(roomId);
  socket.leave(roomId);
  socket.data.roomId = null;
  if (!room) return;

  const index = room.players.findIndex(p => p.socketId === socket.id);
  if (index < 0) return;

  if (removePlayer) {
    room.players.splice(index, 1);
    if (room.players.length === 0) {
      rooms.delete(roomId);
      return;
    }
    room.state = createGameState(room.game);
  } else {
    room.players[index].socketId = null;
  }
  room.lastActivity = Date.now();
  sendRoomState(room);
}

function sendRoomState(room) {
  room.players.forEach((player, index) => {
    if (!player.socketId) return;
    const socket = io.sockets.sockets.get(player.socketId);
    if (!socket) return;
    socket.emit("roomState", buildClientState(room, index));
  });
}

function buildClientState(room, me) {
  const common = {
    ...roomSummary(room),
    me,
    status: room.players.length < 2 ? "waiting" : "playing",
    gameState: null,
  };

  if (room.game === "battleship") {
    const enemy = me === 0 ? 1 : 0;
    const ownBoard = room.state.boards[me];
    const enemyBoard = room.state.boards[enemy];

    common.gameState = {
      turn: room.state.turn,
      winner: room.state.winner,
      round: room.state.round,
      own: {
        ships: ownBoard.ships,
        shots: ownBoard.shots,
      },
      enemy: {
        shots: enemyBoard.shots,
      }
    };
  } else if (room.game === "rps") {
    common.gameState = {
      score: room.state.score,
      round: room.state.round,
      roundWinner: room.state.roundWinner,
      message: room.state.message,
      myChoice: room.state.choices[me],
      opponentChosen: !!room.state.choices[me === 0 ? 1 : 0],
      reveal: room.state.choices[0] && room.state.choices[1] ? room.state.choices : null,
    };
  } else if (room.game === "bullscows") {
    common.gameState = {
      ready: room.state.ready,
      mySecret: room.state.secrets[me],
      opponentReady: room.state.ready[me === 0 ? 1 : 0],
      guesses: room.state.guesses,
      turn: room.state.turn,
      winner: room.state.winner,
      round: room.state.round,
      revealSecrets: room.state.winner !== null ? room.state.secrets : null,
    };
  } else {
    common.gameState = room.state;
  }

  return common;
}

function checkTicTacToe(board) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for (const [a,b,c] of lines) {
    if (board[a] !== null && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

function checkConnect4(board, player) {
  const rows = board.length, cols = board[0].length;
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c] !== player) continue;
      for (const [dr, dc] of dirs) {
        let ok = true;
        for (let k = 1; k < 4; k++) {
          const rr = r + dr*k, cc = c + dc*k;
          if (rr < 0 || rr >= rows || cc < 0 || cc >= cols || board[rr][cc] !== player) {
            ok = false; break;
          }
        }
        if (ok) return true;
      }
    }
  }
  return false;
}

function rpsWinner(a, b) {
  if (a === b) return -1;
  if (
    (a === "rock" && b === "scissors") ||
    (a === "scissors" && b === "paper") ||
    (a === "paper" && b === "rock")
  ) return 0;
  return 1;
}

function isValidSecret(value) {
  const secret = String(value || "");
  return /^\d{4}$/.test(secret) && new Set(secret).size === 4;
}

function bullsAndCows(secret, guess) {
  let bulls = 0;
  let cows = 0;
  for (let i = 0; i < 4; i++) {
    if (guess[i] === secret[i]) bulls++;
    else if (secret.includes(guess[i])) cows++;
  }
  return { bulls, cows };
}

function dotsBoxComplete(state, r, c) {
  return Boolean(
    state.hEdges[r][c] !== null &&
    state.hEdges[r + 1][c] !== null &&
    state.vEdges[r][c] !== null &&
    state.vEdges[r][c + 1] !== null
  );
}

function claimDotsBoxes(state, orientation, row, col, player) {
  const candidates = [];
  if (orientation === "h") {
    if (row > 0) candidates.push([row - 1, col]);
    if (row < 3) candidates.push([row, col]);
  } else {
    if (col > 0) candidates.push([row, col - 1]);
    if (col < 3) candidates.push([row, col]);
  }

  let claimed = 0;
  for (const [r, c] of candidates) {
    if (r < 0 || r > 2 || c < 0 || c > 2) continue;
    if (state.boxes[r][c] !== null) continue;
    if (dotsBoxComplete(state, r, c)) {
      state.boxes[r][c] = player;
      state.score[player]++;
      claimed++;
    }
  }
  return claimed;
}

function resetGame(room) {
  const oldRound = room.state.round || 1;
  room.state = createGameState(room.game);
  room.state.round = oldRound + 1;
}

app.use(express.static(path.join(__dirname, "public")));
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

io.on("connection", (socket) => {
  socket.on("createRoom", ({ game, name, token }, ack = () => {}) => {
    if (!GAME_NAMES[game]) return ack({ ok: false, error: "Неизвестная игра" });
    if (socket.data.roomId) leaveCurrentRoom(socket, true);

    const id = makeRoomId();
    const playerToken = token || newToken();
    const room = {
      id,
      game,
      players: [{ name: sanitizeName(name), token: playerToken, socketId: socket.id }],
      state: createGameState(game),
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };
    rooms.set(id, room);
    socket.join(id);
    socket.data.roomId = id;
    ack({ ok: true, roomId: id, token: playerToken, game });
    sendRoomState(room);
  });

  socket.on("joinRoom", ({ roomId, name, token }, ack = () => {}) => {
    const id = String(roomId || "").toUpperCase().trim();
    if (socket.data.roomId && socket.data.roomId !== id) leaveCurrentRoom(socket, true);
    const room = rooms.get(id);
    if (!room) return ack({ ok: false, error: "Комната не найдена или уже закрыта" });

    const existing = token ? room.players.find(p => p.token === token) : null;
    if (existing) {
      existing.socketId = socket.id;
      existing.name = sanitizeName(name || existing.name);
      socket.join(id);
      socket.data.roomId = id;
      room.lastActivity = Date.now();
      ack({ ok: true, roomId: id, token: existing.token, game: room.game, reconnected: true });
      sendRoomState(room);
      return;
    }

    if (room.players.length >= 2) return ack({ ok: false, error: "В комнате уже два игрока" });

    const playerToken = token || newToken();
    room.players.push({ name: sanitizeName(name), token: playerToken, socketId: socket.id });
    socket.join(id);
    socket.data.roomId = id;
    room.lastActivity = Date.now();
    ack({ ok: true, roomId: id, token: playerToken, game: room.game });
    sendRoomState(room);
  });

  socket.on("move", (payload, ack = () => {}) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return ack({ ok: false, error: "Комната не найдена" });
    if (room.players.length < 2) return ack({ ok: false, error: "Ждём второго игрока" });

    const me = getPlayerIndex(room, socket);
    if (me < 0) return ack({ ok: false, error: "Вы не участник этой комнаты" });
    room.lastActivity = Date.now();

    try {
      if (room.game === "tictactoe") {
        if (room.state.winner !== null || room.state.draw) throw new Error("Раунд уже завершён");
        if (room.state.turn !== me) throw new Error("Сейчас ход соперника");
        const index = Number(payload?.index);
        if (!Number.isInteger(index) || index < 0 || index > 8 || room.state.board[index] !== null) {
          throw new Error("Недопустимый ход");
        }
        room.state.board[index] = me;
        const winner = checkTicTacToe(room.state.board);
        if (winner !== null) room.state.winner = winner;
        else if (room.state.board.every(v => v !== null)) room.state.draw = true;
        else room.state.turn = me === 0 ? 1 : 0;
      }

      if (room.game === "connect4") {
        if (room.state.winner !== null || room.state.draw) throw new Error("Раунд уже завершён");
        if (room.state.turn !== me) throw new Error("Сейчас ход соперника");
        const col = Number(payload?.col);
        if (!Number.isInteger(col) || col < 0 || col > 6) throw new Error("Недопустимый столбец");

        let row = -1;
        for (let r = 5; r >= 0; r--) {
          if (room.state.board[r][col] === null) { row = r; break; }
        }
        if (row < 0) throw new Error("Этот столбец заполнен");
        room.state.board[row][col] = me;

        if (checkConnect4(room.state.board, me)) room.state.winner = me;
        else if (room.state.board.flat().every(v => v !== null)) room.state.draw = true;
        else room.state.turn = me === 0 ? 1 : 0;
      }

      if (room.game === "rps") {
        const choice = String(payload?.choice || "");
        if (!["rock", "paper", "scissors"].includes(choice)) throw new Error("Недопустимый выбор");
        if (room.state.choices[me]) throw new Error("Вы уже выбрали");
        room.state.choices[me] = choice;

        if (room.state.choices[0] && room.state.choices[1]) {
          const winner = rpsWinner(room.state.choices[0], room.state.choices[1]);
          room.state.roundWinner = winner;
          if (winner === -1) room.state.message = "Ничья";
          else {
            room.state.score[winner]++;
            room.state.message = `${room.players[winner].name} выигрывает раунд`;
          }
          sendRoomState(room);

          setTimeout(() => {
            const stillRoom = rooms.get(room.id);
            if (!stillRoom || stillRoom.state !== room.state) return;
            stillRoom.state.choices = [null, null];
            stillRoom.state.roundWinner = null;
            stillRoom.state.message = "Сделайте выбор";
            stillRoom.state.round++;
            sendRoomState(stillRoom);
          }, 1800);
          return ack({ ok: true });
        }
      }

      if (room.game === "battleship") {
        if (room.state.winner !== null) throw new Error("Раунд уже завершён");
        if (room.state.turn !== me) throw new Error("Сейчас ход соперника");
        const row = Number(payload?.row), col = Number(payload?.col);
        if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row > 9 || col < 0 || col > 9) {
          throw new Error("Недопустимая клетка");
        }
        const enemy = me === 0 ? 1 : 0;
        const target = room.state.boards[enemy];
        if (target.shots[row][col] !== null) throw new Error("Вы уже стреляли сюда");

        const shipId = target.ships.find(s => s.cells.some(([r,c]) => r === row && c === col))?.id;
        if (shipId === undefined) {
          target.shots[row][col] = "miss";
          room.state.turn = enemy;
        } else {
          target.shots[row][col] = "hit";
          const ship = target.ships.find(s => s.id === shipId);
          ship.hits.push([row, col]);
          const allSunk = target.ships.every(s => s.hits.length === s.cells.length);
          if (allSunk) room.state.winner = me;
        }
      }

      if (room.game === "dotsboxes") {
        if (room.state.winner !== null || room.state.draw) throw new Error("Раунд уже завершён");
        if (room.state.turn !== me) throw new Error("Сейчас ход соперника");

        const orientation = String(payload?.orientation || "");
        const row = Number(payload?.row);
        const col = Number(payload?.col);
        if (!["h", "v"].includes(orientation) || !Number.isInteger(row) || !Number.isInteger(col)) {
          throw new Error("Недопустимый ход");
        }

        const target = orientation === "h" ? room.state.hEdges : room.state.vEdges;
        const rowLimit = orientation === "h" ? 3 : 2;
        const colLimit = orientation === "h" ? 2 : 3;
        if (row < 0 || row > rowLimit || col < 0 || col > colLimit) throw new Error("Недопустимая линия");
        if (target[row][col] !== null) throw new Error("Эта линия уже занята");

        target[row][col] = me;
        const claimed = claimDotsBoxes(room.state, orientation, row, col, me);
        const claimedCount = room.state.score[0] + room.state.score[1];
        if (claimedCount === 9) {
          if (room.state.score[0] === room.state.score[1]) room.state.draw = true;
          else room.state.winner = room.state.score[0] > room.state.score[1] ? 0 : 1;
        } else if (claimed === 0) {
          room.state.turn = me === 0 ? 1 : 0;
        }
      }

      if (room.game === "bullscows") {
        if (room.state.winner !== null) throw new Error("Раунд уже завершён");
        const action = String(payload?.action || "");

        if (action === "setSecret") {
          const secret = String(payload?.secret || "");
          if (!isValidSecret(secret)) throw new Error("Нужно 4 разные цифры");
          if (room.state.ready[me]) throw new Error("Секрет уже сохранён");
          room.state.secrets[me] = secret;
          room.state.ready[me] = true;
        } else if (action === "guess") {
          if (!room.state.ready[0] || !room.state.ready[1]) throw new Error("Сначала оба игрока должны загадать числа");
          if (room.state.turn !== me) throw new Error("Сейчас ход соперника");
          const guess = String(payload?.guess || "");
          if (!isValidSecret(guess)) throw new Error("Нужно 4 разные цифры");
          const enemy = me === 0 ? 1 : 0;
          const result = bullsAndCows(room.state.secrets[enemy], guess);
          room.state.guesses.push({ by: me, guess, bulls: result.bulls, cows: result.cows });
          if (result.bulls === 4) room.state.winner = me;
          else room.state.turn = enemy;
        } else {
          throw new Error("Неизвестное действие");
        }
      }

      ack({ ok: true });
      sendRoomState(room);
    } catch (err) {
      ack({ ok: false, error: err.message || "Ошибка хода" });
    }
  });

  socket.on("restart", (ack = () => {}) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return ack({ ok: false, error: "Комната не найдена" });
    if (room.players.length < 2) return ack({ ok: false, error: "Ждём второго игрока" });

    resetGame(room);
    room.lastActivity = Date.now();
    ack({ ok: true });
    sendRoomState(room);
  });

  socket.on("leaveRoom", (ack = () => {}) => {
    leaveCurrentRoom(socket, true);
    ack({ ok: true });
  });

  socket.on("disconnect", () => {
    leaveCurrentRoom(socket, false);
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [id, room] of rooms) {
    const nobodyConnected = room.players.every(p => !p.socketId);
    if (nobodyConnected && now - room.lastActivity > 10 * 60 * 1000) rooms.delete(id);
  }
}, 60 * 1000);

server.listen(PORT, () => {
  console.log(`Duelink запущен: http://localhost:${PORT}`);
});

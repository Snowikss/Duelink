const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Server } = require('socket.io');

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer);
const PORT = process.env.PORT || 3000;
const rooms = new Map();

const GAME_NAMES = {
  tictactoe: 'Крестики-нолики',
  connect4: 'Четыре в ряд',
  rps: 'Камень, ножницы, бумага',
  battleship: 'Морской бой',
  dotsboxes: 'Точки и квадраты',
  bullscows: 'Быки и коровы',
  gomoku: 'Пять в ряд',
  reversi: 'Реверси',
};

const opposite = (index) => index === 0 ? 1 : 0;
const connectedCount = (room) => room.players.filter((p) => p.socketId).length;

function makeRoomId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id;
  do {
    id = Array.from({ length: 6 }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
  } while (rooms.has(id));
  return id;
}

function sanitizeName(value) {
  const name = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 20);
  return name || `Игрок-${crypto.randomInt(100, 999)}`;
}

function newToken() {
  return crypto.randomBytes(18).toString('hex');
}

function createBattleBoard() {
  const size = 10;
  const lengths = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];
  const occupied = Array.from({ length: size }, () => Array(size).fill(null));
  const ships = [];
  for (let id = 0; id < lengths.length; id++) {
    const length = lengths[id];
    let placed = false;
    for (let attempt = 0; attempt < 600 && !placed; attempt++) {
      const horizontal = Math.random() < 0.5;
      const row = crypto.randomInt(size);
      const col = crypto.randomInt(size);
      const cells = [];
      for (let i = 0; i < length; i++) {
        const r = row + (horizontal ? 0 : i);
        const c = col + (horizontal ? i : 0);
        if (r >= size || c >= size) { cells.length = 0; break; }
        cells.push([r, c]);
      }
      if (!cells.length) continue;
      const blocked = cells.some(([r, c]) => {
        for (let rr = Math.max(0, r - 1); rr <= Math.min(size - 1, r + 1); rr++) {
          for (let cc = Math.max(0, c - 1); cc <= Math.min(size - 1, c + 1); cc++) {
            if (occupied[rr][cc] !== null) return true;
          }
        }
        return false;
      });
      if (blocked) continue;
      cells.forEach(([r, c]) => { occupied[r][c] = id; });
      ships.push({ id, cells, hits: [] });
      placed = true;
    }
    if (!placed) return createBattleBoard();
  }
  return { ships, shots: Array.from({ length: size }, () => Array(size).fill(null)) };
}

function createReversiBoard() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  board[3][3] = 1; board[4][4] = 1;
  board[3][4] = 0; board[4][3] = 0;
  return board;
}

function createGameState(game) {
  switch (game) {
    case 'tictactoe': return { board: Array(9).fill(null), turn: 0, winner: null, draw: false, round: 1 };
    case 'connect4': return { board: Array.from({ length: 6 }, () => Array(7).fill(null)), turn: 0, winner: null, draw: false, round: 1 };
    case 'rps': return { choices: [null, null], score: [0, 0], roundWinner: null, message: 'Сделайте выбор', round: 1 };
    case 'battleship': return { boards: [createBattleBoard(), createBattleBoard()], turn: 0, winner: null, round: 1 };
    case 'dotsboxes': return { hEdges: Array.from({ length: 4 }, () => Array(3).fill(null)), vEdges: Array.from({ length: 3 }, () => Array(4).fill(null)), boxes: Array.from({ length: 3 }, () => Array(3).fill(null)), score: [0, 0], turn: 0, winner: null, draw: false, round: 1 };
    case 'bullscows': return { secrets: [null, null], ready: [false, false], guesses: [], turn: 0, winner: null, round: 1 };
    case 'gomoku': return { board: Array.from({ length: 11 }, () => Array(11).fill(null)), turn: 0, winner: null, draw: false, round: 1 };
    case 'reversi': return { board: createReversiBoard(), turn: 0, winner: null, draw: false, round: 1 };
    default: throw new Error('Unknown game');
  }
}

function roomSummary(room) {
  return { roomId: room.id, game: room.game, gameName: GAME_NAMES[room.game], players: room.players.map((p) => ({ name: p.name, connected: !!p.socketId })), ready: room.ready, phase: room.phase, hostIndex: 0, connectedCount: connectedCount(room), matchId: room.matchId };
}

function buildClientState(room, me) {
  const summary = roomSummary(room);
  const common = { ...summary, me, isHost: me === 0, status: summary.connectedCount < 2 ? 'waiting' : (room.phase === 'playing' ? 'playing' : 'lobby'), gameState: null };
  if (room.game === 'battleship') {
    const enemy = opposite(me);
    common.gameState = { turn: room.state.turn, winner: room.state.winner, round: room.state.round, own: room.state.boards[me], enemy: { shots: room.state.boards[enemy].shots } };
  } else if (room.game === 'rps') {
    common.gameState = { score: room.state.score, round: room.state.round, roundWinner: room.state.roundWinner, message: room.state.message, myChoice: room.state.choices[me], opponentChosen: !!room.state.choices[opposite(me)], reveal: room.state.choices[0] && room.state.choices[1] ? room.state.choices : null };
  } else if (room.game === 'bullscows') {
    common.gameState = { ready: room.state.ready, mySecret: room.state.secrets[me], opponentReady: room.state.ready[opposite(me)], guesses: room.state.guesses, turn: room.state.turn, winner: room.state.winner, round: room.state.round, revealSecrets: room.state.winner !== null ? room.state.secrets : null };
  } else if (room.game === 'reversi') {
    common.gameState = { board: room.state.board, turn: room.state.turn, winner: room.state.winner, draw: room.state.draw, round: room.state.round, score: reversiScore(room.state.board), validMoves: room.state.turn === me && room.state.winner === null && !room.state.draw ? reversiValidMoves(room.state.board, me).map(([r, c]) => [r, c]) : [] };
  } else {
    common.gameState = room.state;
  }
  return common;
}

function sendRoomState(room) {
  room.players.forEach((player, index) => {
    if (!player.socketId) return;
    io.sockets.sockets.get(player.socketId)?.emit('roomState', buildClientState(room, index));
  });
}

function playerIndex(room, socket) { return room.players.findIndex((p) => p.socketId === socket.id); }

function leaveCurrentRoom(socket, removePlayer = false) {
  const roomId = socket.data.roomId;
  if (!roomId) return;
  const room = rooms.get(roomId);
  socket.leave(roomId);
  socket.data.roomId = null;
  if (!room) return;
  const index = room.players.findIndex((p) => p.socketId === socket.id);
  if (index < 0) return;
  if (removePlayer) {
    room.players.splice(index, 1);
    room.ready.splice(index, 1);
    if (!room.players.length) { rooms.delete(roomId); return; }
    room.phase = 'lobby';
    room.ready = room.players.map(() => false);
    room.state = createGameState(room.game);
  } else room.players[index].socketId = null;
  room.lastActivity = Date.now();
  sendRoomState(room);
}

function checkTicTacToe(board) {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const [a,b,c] of lines) if (board[a] !== null && board[a] === board[b] && board[a] === board[c]) return board[a];
  return null;
}

function checkConnect4(board, player) {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
    if (board[r][c] !== player) continue;
    for (const [dr, dc] of dirs) {
      let ok = true;
      for (let k = 1; k < 4; k++) {
        const rr = r + dr * k, cc = c + dc * k;
        if (rr < 0 || rr >= 6 || cc < 0 || cc >= 7 || board[rr][cc] !== player) { ok = false; break; }
      }
      if (ok) return true;
    }
  }
  return false;
}

function checkGomoku(board, player, row, col) {
  for (const [dr, dc] of [[1,0],[0,1],[1,1],[1,-1]]) {
    let count = 1;
    for (const sign of [-1, 1]) {
      let r = row + dr * sign, c = col + dc * sign;
      while (r >= 0 && r < board.length && c >= 0 && c < board.length && board[r][c] === player) { count++; r += dr * sign; c += dc * sign; }
    }
    if (count >= 5) return true;
  }
  return false;
}

function rpsWinner(a, b) {
  if (a === b) return -1;
  return ((a === 'rock' && b === 'scissors') || (a === 'scissors' && b === 'paper') || (a === 'paper' && b === 'rock')) ? 0 : 1;
}

function validSecret(value) { const text = String(value || ''); return /^\d{4}$/.test(text) && new Set(text).size === 4; }
function bullsAndCows(secret, guess) { let bulls = 0, cows = 0; for (let i = 0; i < 4; i++) { if (guess[i] === secret[i]) bulls++; else if (secret.includes(guess[i])) cows++; } return { bulls, cows }; }
function dotsComplete(state, r, c) { return state.hEdges[r][c] !== null && state.hEdges[r + 1][c] !== null && state.vEdges[r][c] !== null && state.vEdges[r][c + 1] !== null; }
function claimDots(state, orientation, row, col, me) {
  const candidates = [];
  if (orientation === 'h') { if (row > 0) candidates.push([row - 1, col]); if (row < 3) candidates.push([row, col]); }
  else { if (col > 0) candidates.push([row, col - 1]); if (col < 3) candidates.push([row, col]); }
  let claimed = 0;
  for (const [r, c] of candidates) {
    if (r < 0 || r > 2 || c < 0 || c > 2 || state.boxes[r][c] !== null) continue;
    if (dotsComplete(state, r, c)) { state.boxes[r][c] = me; state.score[me]++; claimed++; }
  }
  return claimed;
}

const REVERSI_DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
function reversiFlips(board, player, row, col) {
  if (row < 0 || row >= 8 || col < 0 || col >= 8 || board[row][col] !== null) return [];
  const enemy = opposite(player), all = [];
  for (const [dr, dc] of REVERSI_DIRS) {
    let r = row + dr, c = col + dc;
    const line = [];
    while (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === enemy) { line.push([r, c]); r += dr; c += dc; }
    if (line.length && r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === player) all.push(...line);
  }
  return all;
}
function reversiValidMoves(board, player) {
  const moves = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (board[r][c] === null && reversiFlips(board, player, r, c).length) moves.push([r, c]);
  return moves;
}
function reversiScore(board) { const score = [0, 0]; for (const row of board) for (const cell of row) if (cell === 0 || cell === 1) score[cell]++; return score; }
function finishReversiIfNeeded(state) {
  const score = reversiScore(state.board);
  const full = score[0] + score[1] === 64;
  const noMoves = !reversiValidMoves(state.board, 0).length && !reversiValidMoves(state.board, 1).length;
  if (!full && !noMoves) return false;
  if (score[0] === score[1]) state.draw = true;
  else state.winner = score[0] > score[1] ? 0 : 1;
  return true;
}

function applyMove(room, me, payload) {
  const state = room.state;
  if (room.game === 'tictactoe') {
    if (state.winner !== null || state.draw) throw new Error('Раунд уже завершён');
    if (state.turn !== me) throw new Error('Сейчас ход соперника');
    const index = Number(payload?.index);
    if (!Number.isInteger(index) || index < 0 || index > 8 || state.board[index] !== null) throw new Error('Недопустимый ход');
    state.board[index] = me;
    const winner = checkTicTacToe(state.board);
    if (winner !== null) state.winner = winner; else if (state.board.every((v) => v !== null)) state.draw = true; else state.turn = opposite(me);
    return;
  }
  if (room.game === 'connect4') {
    if (state.winner !== null || state.draw) throw new Error('Раунд уже завершён');
    if (state.turn !== me) throw new Error('Сейчас ход соперника');
    const col = Number(payload?.col);
    if (!Number.isInteger(col) || col < 0 || col > 6) throw new Error('Недопустимый столбец');
    let row = -1; for (let r = 5; r >= 0; r--) if (state.board[r][col] === null) { row = r; break; }
    if (row < 0) throw new Error('Этот столбец заполнен');
    state.board[row][col] = me;
    if (checkConnect4(state.board, me)) state.winner = me; else if (state.board.flat().every((v) => v !== null)) state.draw = true; else state.turn = opposite(me);
    return;
  }
  if (room.game === 'rps') {
    const choice = String(payload?.choice || '');
    if (!['rock', 'paper', 'scissors'].includes(choice)) throw new Error('Недопустимый выбор');
    if (state.choices[me]) throw new Error('Вы уже выбрали');
    state.choices[me] = choice;
    if (state.choices[0] && state.choices[1]) {
      const winner = rpsWinner(state.choices[0], state.choices[1]);
      state.roundWinner = winner;
      if (winner === -1) state.message = 'Ничья'; else { state.score[winner]++; state.message = `${room.players[winner].name} выигрывает раунд`; }
      sendRoomState(room);
      const stateRef = state;
      setTimeout(() => {
        const liveRoom = rooms.get(room.id);
        if (!liveRoom || liveRoom.state !== stateRef || liveRoom.phase !== 'playing') return;
        stateRef.choices = [null, null]; stateRef.roundWinner = null; stateRef.message = 'Сделайте выбор'; stateRef.round++; sendRoomState(liveRoom);
      }, 1800);
      return 'already-sent';
    }
    return;
  }
  if (room.game === 'battleship') {
    if (state.winner !== null) throw new Error('Раунд уже завершён');
    if (state.turn !== me) throw new Error('Сейчас ход соперника');
    const row = Number(payload?.row), col = Number(payload?.col);
    if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row > 9 || col < 0 || col > 9) throw new Error('Недопустимая клетка');
    const enemy = opposite(me), target = state.boards[enemy];
    if (target.shots[row][col] !== null) throw new Error('Вы уже стреляли сюда');
    const ship = target.ships.find((s) => s.cells.some(([r, c]) => r === row && c === col));
    if (!ship) { target.shots[row][col] = 'miss'; state.turn = enemy; }
    else { target.shots[row][col] = 'hit'; ship.hits.push([row, col]); if (target.ships.every((s) => s.hits.length === s.cells.length)) state.winner = me; }
    return;
  }
  if (room.game === 'dotsboxes') {
    if (state.winner !== null || state.draw) throw new Error('Раунд уже завершён');
    if (state.turn !== me) throw new Error('Сейчас ход соперника');
    const orientation = String(payload?.orientation || ''), row = Number(payload?.row), col = Number(payload?.col);
    if (!['h', 'v'].includes(orientation) || !Number.isInteger(row) || !Number.isInteger(col)) throw new Error('Недопустимый ход');
    const target = orientation === 'h' ? state.hEdges : state.vEdges, maxRow = orientation === 'h' ? 3 : 2, maxCol = orientation === 'h' ? 2 : 3;
    if (row < 0 || row > maxRow || col < 0 || col > maxCol || target[row][col] !== null) throw new Error('Недопустимая линия');
    target[row][col] = me;
    const claimed = claimDots(state, orientation, row, col, me);
    if (state.score[0] + state.score[1] === 9) { if (state.score[0] === state.score[1]) state.draw = true; else state.winner = state.score[0] > state.score[1] ? 0 : 1; }
    else if (!claimed) state.turn = opposite(me);
    return;
  }
  if (room.game === 'bullscows') {
    if (state.winner !== null) throw new Error('Раунд уже завершён');
    const action = String(payload?.action || '');
    if (action === 'setSecret') {
      const secret = String(payload?.secret || '');
      if (!validSecret(secret)) throw new Error('Нужно 4 разные цифры');
      if (state.ready[me]) throw new Error('Секрет уже сохранён');
      state.secrets[me] = secret; state.ready[me] = true; return;
    }
    if (action === 'guess') {
      if (!state.ready[0] || !state.ready[1]) throw new Error('Сначала оба игрока должны загадать числа');
      if (state.turn !== me) throw new Error('Сейчас ход соперника');
      const guess = String(payload?.guess || '');
      if (!validSecret(guess)) throw new Error('Нужно 4 разные цифры');
      const result = bullsAndCows(state.secrets[opposite(me)], guess);
      state.guesses.push({ by: me, guess, ...result });
      if (result.bulls === 4) state.winner = me; else state.turn = opposite(me);
      return;
    }
    throw new Error('Неизвестное действие');
  }
  if (room.game === 'gomoku') {
    if (state.winner !== null || state.draw) throw new Error('Раунд уже завершён');
    if (state.turn !== me) throw new Error('Сейчас ход соперника');
    const row = Number(payload?.row), col = Number(payload?.col);
    if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row >= 11 || col < 0 || col >= 11) throw new Error('Недопустимая клетка');
    if (state.board[row][col] !== null) throw new Error('Клетка уже занята');
    state.board[row][col] = me;
    if (checkGomoku(state.board, me, row, col)) state.winner = me; else if (state.board.flat().every((v) => v !== null)) state.draw = true; else state.turn = opposite(me);
    return;
  }
  if (room.game === 'reversi') {
    if (state.winner !== null || state.draw) throw new Error('Раунд уже завершён');
    if (state.turn !== me) throw new Error('Сейчас ход соперника');
    const row = Number(payload?.row), col = Number(payload?.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) throw new Error('Недопустимый ход');
    const flips = reversiFlips(state.board, me, row, col);
    if (!flips.length) throw new Error('Сюда нельзя поставить фишку');
    state.board[row][col] = me; for (const [r, c] of flips) state.board[r][c] = me;
    if (finishReversiIfNeeded(state)) return;
    const enemy = opposite(me);
    if (reversiValidMoves(state.board, enemy).length) state.turn = enemy; else if (reversiValidMoves(state.board, me).length) state.turn = me; else finishReversiIfNeeded(state);
    return;
  }
}

const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir, { index: false }));
app.use((req, res) => {
  const baseHtml = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
  const html = baseHtml.replace('</head>', '  <link rel="stylesheet" href="/v2.css">\n</head>').replace('</body>', '  <script src="/v2.js"></script>\n</body>');
  res.type('html').send(html);
});

io.on('connection', (socket) => {
  socket.on('createRoom', ({ game, name, token }, ack = () => {}) => {
    if (!GAME_NAMES[game]) return ack({ ok: false, error: 'Неизвестная игра' });
    if (socket.data.roomId) leaveCurrentRoom(socket, true);
    const id = makeRoomId(), playerToken = token || newToken();
    const room = { id, game, phase: 'lobby', matchId: 0, players: [{ name: sanitizeName(name), token: playerToken, socketId: socket.id }], ready: [false], state: createGameState(game), lastActivity: Date.now() };
    rooms.set(id, room); socket.join(id); socket.data.roomId = id;
    ack({ ok: true, roomId: id, token: playerToken, game }); sendRoomState(room);
  });

  socket.on('joinRoom', ({ roomId, name, token }, ack = () => {}) => {
    const id = String(roomId || '').trim().toUpperCase();
    if (socket.data.roomId && socket.data.roomId !== id) leaveCurrentRoom(socket, true);
    const room = rooms.get(id);
    if (!room) return ack({ ok: false, error: 'Комната не найдена или уже закрыта' });
    const existing = token ? room.players.find((p) => p.token === token) : null;
    if (existing) {
      const previousSocketId = existing.socketId;
      if (previousSocketId && previousSocketId !== socket.id) io.sockets.sockets.get(previousSocketId)?.leave(id);
      existing.socketId = socket.id; existing.name = sanitizeName(name || existing.name); socket.join(id); socket.data.roomId = id; room.lastActivity = Date.now();
      ack({ ok: true, roomId: id, token: existing.token, game: room.game, reconnected: true }); sendRoomState(room); return;
    }
    if (room.players.length >= 2) return ack({ ok: false, error: 'В комнате уже два игрока' });
    const playerToken = token || newToken();
    room.players.push({ name: sanitizeName(name), token: playerToken, socketId: socket.id }); room.ready = room.players.map(() => false); room.phase = 'lobby'; socket.join(id); socket.data.roomId = id; room.lastActivity = Date.now();
    ack({ ok: true, roomId: id, token: playerToken, game: room.game }); sendRoomState(room);
  });

  socket.on('toggleReady', (ack = () => {}) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return ack({ ok: false, error: 'Комната не найдена' });
    const me = playerIndex(room, socket);
    if (me < 0) return ack({ ok: false, error: 'Вы не участник комнаты' });
    if (room.phase === 'playing') return ack({ ok: false, error: 'Матч уже идёт' });
    room.ready[me] = !room.ready[me]; room.lastActivity = Date.now(); ack({ ok: true, ready: room.ready[me] }); sendRoomState(room);
  });

  socket.on('selectGame', ({ game }, ack = () => {}) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return ack({ ok: false, error: 'Комната не найдена' });
    if (playerIndex(room, socket) !== 0) return ack({ ok: false, error: 'Игру выбирает создатель комнаты' });
    if (room.phase === 'playing') return ack({ ok: false, error: 'Сначала вернитесь в лобби' });
    if (!GAME_NAMES[game]) return ack({ ok: false, error: 'Неизвестная игра' });
    room.game = game; room.state = createGameState(game); room.ready = room.players.map(() => false); room.lastActivity = Date.now();
    ack({ ok: true, game, gameName: GAME_NAMES[game] }); sendRoomState(room);
  });

  socket.on('startMatch', (ack = () => {}) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return ack({ ok: false, error: 'Комната не найдена' });
    if (playerIndex(room, socket) !== 0) return ack({ ok: false, error: 'Матч запускает создатель комнаты' });
    if (connectedCount(room) < 2) return ack({ ok: false, error: 'Ждём второго игрока' });
    if (room.ready.length < 2 || !room.ready[0] || !room.ready[1]) return ack({ ok: false, error: 'Оба игрока должны нажать «Готов»' });
    room.state = createGameState(room.game); room.phase = 'playing'; room.matchId++; room.lastActivity = Date.now(); ack({ ok: true, matchId: room.matchId }); sendRoomState(room);
  });

  socket.on('move', (payload, ack = () => {}) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return ack({ ok: false, error: 'Комната не найдена' });
    if (connectedCount(room) < 2) return ack({ ok: false, error: 'Ждём второго игрока' });
    if (room.phase !== 'playing') return ack({ ok: false, error: 'Матч ещё не начался' });
    const me = playerIndex(room, socket);
    if (me < 0) return ack({ ok: false, error: 'Вы не участник комнаты' });
    try { const result = applyMove(room, me, payload); room.lastActivity = Date.now(); ack({ ok: true }); if (result !== 'already-sent') sendRoomState(room); }
    catch (error) { ack({ ok: false, error: error.message || 'Ошибка хода' }); }
  });

  socket.on('restart', (ack = () => {}) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return ack({ ok: false, error: 'Комната не найдена' });
    if (connectedCount(room) < 2) return ack({ ok: false, error: 'Ждём второго игрока' });
    if (room.phase !== 'playing') return ack({ ok: false, error: 'Сначала запусти матч из лобби' });
    const oldRound = room.state.round || 1; room.state = createGameState(room.game); room.state.round = oldRound + 1; room.lastActivity = Date.now(); ack({ ok: true }); sendRoomState(room);
  });

  socket.on('returnToLobby', (ack = () => {}) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return ack({ ok: false, error: 'Комната не найдена' });
    if (playerIndex(room, socket) !== 0) return ack({ ok: false, error: 'В лобби возвращает создатель комнаты' });
    room.phase = 'lobby'; room.ready = room.players.map(() => false); room.state = createGameState(room.game); room.lastActivity = Date.now(); ack({ ok: true }); sendRoomState(room);
  });

  socket.on('leaveRoom', (ack = () => {}) => { leaveCurrentRoom(socket, true); ack({ ok: true }); });
  socket.on('disconnect', () => leaveCurrentRoom(socket, false));
});

setInterval(() => {
  const now = Date.now();
  for (const [id, room] of rooms) if (room.players.every((p) => !p.socketId) && now - room.lastActivity > 10 * 60 * 1000) rooms.delete(id);
}, 60 * 1000);

httpServer.listen(PORT, () => console.log(`Duelink v2: http://localhost:${PORT}`));

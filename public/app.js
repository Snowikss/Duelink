const socket = io();

const $ = (sel) => document.querySelector(sel);
const homeView = $("#homeView");
const roomView = $("#roomView");
const joinRoomPanel = $("#joinRoomPanel");
const waitingPanel = $("#waitingPanel");
const gamePanel = $("#gamePanel");
const gameRoot = $("#gameRoot");
const statusBar = $("#statusBar");
const restartBtn = $("#restartBtn");

let currentRoom = null;
let currentGame = null;
let lastState = null;

const randomNames = [
  "SleepyFox", "PixelCat", "NeonBear", "TinyBoss", "CoffeeMage",
  "LuckyDuck", "NightOwl", "SoftDragon", "MoonWolf", "TurboSnail"
];

function randomName() {
  return randomNames[Math.floor(Math.random() * randomNames.length)] + Math.floor(10 + Math.random() * 90);
}

function getSavedName() {
  return localStorage.getItem("duelink_name") || "";
}
function saveName(name) {
  localStorage.setItem("duelink_name", name);
}
function roomTokenKey(roomId) {
  return `duelink_token_${roomId}`;
}
function getRoomToken(roomId) {
  return sessionStorage.getItem(roomTokenKey(roomId)) || "";
}
function saveRoomToken(roomId, token) {
  sessionStorage.setItem(roomTokenKey(roomId), token);
}

$("#nameInput").value = getSavedName() || randomName();
$("#joinNameInput").value = getSavedName() || randomName();

socket.on("connect", () => {
  $("#connectionDot").classList.add("online");
  $("#connectionText").textContent = "Онлайн";
  tryAutoReconnect();
});
socket.on("disconnect", () => {
  $("#connectionDot").classList.remove("online");
  $("#connectionText").textContent = "Переподключение...";
});

function showToast(message, error = false) {
  const t = $("#toast");
  t.textContent = message;
  t.classList.toggle("error", error);
  t.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => t.classList.remove("show"), 2200);
}

function normalizeName(input) {
  const value = String(input || "").trim().replace(/\s+/g, " ").slice(0, 20);
  return value || randomName();
}

function parseRoomFromPath() {
  const match = location.pathname.match(/^\/room\/([A-Za-z0-9]+)$/);
  return match ? match[1].toUpperCase() : null;
}

function updateRoomScaffold(roomId) {
  $("#roomTitle").textContent = `Комната ${roomId}`;
  $("#roomCodeBadge").textContent = roomId;
  $("#inviteUrl").textContent = `${location.origin}/room/${roomId}`;
}

function goHome() {
  if (currentRoom && socket.connected) socket.emit("leaveRoom");
  currentRoom = null;
  currentGame = null;
  lastState = null;
  history.pushState({}, "", "/");
  homeView.classList.remove("hidden");
  roomView.classList.add("hidden");
}

function showRoomShell(roomId) {
  currentRoom = roomId;
  homeView.classList.add("hidden");
  roomView.classList.remove("hidden");
  updateRoomScaffold(roomId);
}

function showJoinPanel(roomId) {
  showRoomShell(roomId);
  $("#roomStatusHint").textContent = "Ожидает вход";
  $("#playersCount").textContent = "0/2";
  $("#roundLabel").textContent = "—";
  joinRoomPanel.classList.remove("hidden");
  waitingPanel.classList.add("hidden");
  gamePanel.classList.add("hidden");
}

function enterRoom(roomId, game, token) {
  currentRoom = roomId;
  currentGame = game;
  if (token) saveRoomToken(roomId, token);
  history.pushState({}, "", `/room/${roomId}`);
  showRoomShell(roomId);
  joinRoomPanel.classList.add("hidden");
}

function createRoom(game) {
  const name = normalizeName($("#nameInput").value);
  saveName(name);
  socket.emit("createRoom", { game, name }, (res) => {
    if (!res?.ok) return showToast(res?.error || "Не удалось создать комнату", true);
    enterRoom(res.roomId, res.game, res.token);
  });
}

function joinRoom(roomId, name) {
  const cleanName = normalizeName(name);
  saveName(cleanName);
  const token = getRoomToken(roomId);
  socket.emit("joinRoom", { roomId, name: cleanName, token }, (res) => {
    if (!res?.ok) return showToast(res?.error || "Не удалось войти", true);
    enterRoom(res.roomId, res.game, res.token);
  });
}

function tryAutoReconnect() {
  const roomId = parseRoomFromPath();
  if (!roomId) return;
  const token = getRoomToken(roomId);
  const savedName = getSavedName();
  if (token) {
    socket.emit("joinRoom", { roomId, name: savedName, token }, (res) => {
      if (res?.ok) enterRoom(res.roomId, res.game, res.token);
      else showJoinPanel(roomId);
    });
  } else {
    showJoinPanel(roomId);
  }
}

document.querySelectorAll(".game-card").forEach(btn => {
  btn.addEventListener("click", () => createRoom(btn.dataset.game));
});

$("#randomNameBtn").addEventListener("click", () => {
  const name = randomName();
  $("#nameInput").value = name;
  $("#joinNameInput").value = name;
});

$("#joinForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const code = $("#roomCodeInput").value.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) return showToast("Нужен код из 6 символов", true);
  joinRoom(code, $("#nameInput").value);
});

$("#joinRoomForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!currentRoom) return;
  joinRoom(currentRoom, $("#joinNameInput").value);
});

$("#backBtn").addEventListener("click", goHome);
$("#brandBtn").addEventListener("click", goHome);
window.addEventListener("popstate", () => {
  const id = parseRoomFromPath();
  if (id) showJoinPanel(id);
  else goHome();
});

async function copyInvite() {
  if (!currentRoom) return;
  const url = `${location.origin}/room/${currentRoom}`;
  try {
    await navigator.clipboard.writeText(url);
    showToast("Ссылка скопирована");
  } catch {
    showToast(url);
  }
}
$("#copyBtn").addEventListener("click", copyInvite);
$("#copyInlineBtn").addEventListener("click", copyInvite);

restartBtn.addEventListener("click", () => {
  socket.emit("restart", (res) => {
    if (!res?.ok) showToast(res?.error || "Не удалось начать новый раунд", true);
  });
});

socket.on("roomState", (state) => {
  lastState = state;
  currentRoom = state.roomId;
  currentGame = state.game;

  $("#gameName").textContent = state.gameName;
  $("#gameShortName").textContent = state.gameName;
  updateRoomScaffold(state.roomId);
  updateMeta(state);

  joinRoomPanel.classList.add("hidden");
  renderPlayers(state);

  if (state.status === "waiting") {
    waitingPanel.classList.remove("hidden");
    gamePanel.classList.add("hidden");
    return;
  }

  waitingPanel.classList.add("hidden");
  gamePanel.classList.remove("hidden");
  renderGame(state);
});

function updateMeta(state) {
  $("#playersCount").textContent = `${state.players.length}/2`;
  $("#roomStatusHint").textContent = state.status === "waiting" ? "Ждём соперника" : "Матч идёт";
  const round = extractRound(state);
  $("#roundLabel").textContent = round ? `#${round}` : "—";
}

function extractRound(state) {
  if (!state?.gameState) return null;
  return state.gameState.round ?? null;
}

function renderPlayers(state) {
  [0, 1].forEach((i) => {
    const el = $(`#player${i}`);
    const p = state.players[i];
    if (!p) {
      el.className = "player";
      el.innerHTML = `<div class="player-avatar">?</div><div class="player-content"><div class="player-name">Свободный слот</div><div class="player-sub">Ожидает подключения</div></div>`;
      return;
    }

    const label = i === state.me ? "Ты" : "Соперник";
    const avatar = getPlayerAvatar(state.game, i);
    el.className = "player" + (i === state.me ? " me" : "");
    el.innerHTML = `<div class="player-avatar">${avatar}</div><div class="player-content"><div class="player-name">${escapeHtml(p.name)}</div><div class="player-sub">${label} · ${p.connected ? "онлайн" : "переподключается..."}</div></div>`;
  });
}

function getPlayerAvatar(game, index) {
  if (game === "tictactoe") return index === 0 ? "×" : "○";
  if (game === "connect4") return "●";
  if (game === "rps") return index === 0 ? "✊" : "✋";
  if (game === "battleship") return index === 0 ? "⚓" : "🛰";
  return index + 1;
}

function playerName(i) {
  return lastState?.players?.[i]?.name || `Игрок ${i + 1}`;
}

function setStatus(text) {
  statusBar.textContent = text;
}

function renderGame(state) {
  restartBtn.classList.add("hidden");
  updateMeta(state);
  if (state.game === "tictactoe") renderTicTacToe(state);
  if (state.game === "connect4") renderConnect4(state);
  if (state.game === "rps") renderRPS(state);
  if (state.game === "battleship") renderBattleship(state);
}

function renderTicTacToe(state) {
  const gs = state.gameState;
  if (gs.winner !== null) {
    setStatus(gs.winner === state.me ? "Ты победил 🎉" : `${playerName(gs.winner)} победил`);
    restartBtn.classList.remove("hidden");
  } else if (gs.draw) {
    setStatus("Ничья. Цивилизация выстояла.");
    restartBtn.classList.remove("hidden");
  } else {
    setStatus(gs.turn === state.me ? "Твой ход — выбери клетку" : `Сейчас ходит ${playerName(gs.turn)}`);
  }

  const wrap = document.createElement("div");
  wrap.className = "ttt";
  gs.board.forEach((value, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    if (value !== null) {
      btn.textContent = value === 0 ? "×" : "○";
      btn.classList.add(value === 0 ? "mark-x" : "mark-o");
    }
    btn.disabled = value !== null || gs.turn !== state.me || gs.winner !== null || gs.draw;
    btn.addEventListener("click", () => move({ index }));
    wrap.appendChild(btn);
  });
  gameRoot.replaceChildren(wrap);
}

function renderConnect4(state) {
  const gs = state.gameState;
  if (gs.winner !== null) {
    setStatus(gs.winner === state.me ? "Четыре в ряд. Ты победил 🎉" : `${playerName(gs.winner)} победил`);
    restartBtn.classList.remove("hidden");
  } else if (gs.draw) {
    setStatus("Поле заполнено. Ничья.");
    restartBtn.classList.remove("hidden");
  } else {
    setStatus(gs.turn === state.me ? "Твой ход — выбери столбец" : `Ходит ${playerName(gs.turn)}`);
  }

  const outer = document.createElement("div");
  outer.className = "connect-wrap";
  const board = document.createElement("div");
  board.className = "connect4";
  const cols = document.createElement("div");
  cols.className = "connect-cols";
  for (let c = 0; c < 7; c++) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = "▼";
    b.disabled = gs.turn !== state.me || gs.winner !== null || gs.draw || gs.board[0][c] !== null;
    b.addEventListener("click", () => move({ col: c }));
    cols.appendChild(b);
  }
  const grid = document.createElement("div");
  grid.className = "connect-grid";
  gs.board.flat().forEach((v) => {
    const d = document.createElement("div");
    d.className = "disc" + (v === 0 ? " p0" : v === 1 ? " p1" : "");
    grid.appendChild(d);
  });
  board.append(cols, grid);
  outer.appendChild(board);
  gameRoot.replaceChildren(outer);
}

function renderRPS(state) {
  const gs = state.gameState;
  setStatus(gs.message + (gs.myChoice ? " · выбор принят" : ""));
  const wrap = document.createElement("div");
  wrap.className = "rps";

  const score = document.createElement("div");
  score.className = "rps-score";
  score.innerHTML = `<div class="rps-score-pill"><small>${escapeHtml(playerName(0))}</small><strong>${gs.score[0]}</strong></div><div class="rps-center">VS</div><div class="rps-score-pill"><small>${escapeHtml(playerName(1))}</small><strong>${gs.score[1]}</strong></div>`;
  wrap.appendChild(score);

  const opts = document.createElement("div");
  opts.className = "rps-options";
  [["rock", "✊", "Камень"], ["scissors", "✌️", "Ножницы"], ["paper", "✋", "Бумага"]].forEach(([choice, emoji, label]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.innerHTML = `${emoji}<span>${label}</span>`;
    b.disabled = !!gs.myChoice;
    b.addEventListener("click", () => move({ choice }));
    opts.appendChild(b);
  });
  wrap.appendChild(opts);

  const icons = { rock: "✊", scissors: "✌️", paper: "✋" };
  if (gs.reveal) {
    const reveal = document.createElement("div");
    reveal.className = "rps-reveal";
    reveal.textContent = `${icons[gs.reveal[0]]}  VS  ${icons[gs.reveal[1]]}`;
    wrap.appendChild(reveal);
  } else if (gs.opponentChosen) {
    const reveal = document.createElement("div");
    reveal.className = "rps-reveal";
    reveal.textContent = "Соперник уже выбрал ✓";
    wrap.appendChild(reveal);
  }
  gameRoot.replaceChildren(wrap);
}

function renderBattleship(state) {
  const gs = state.gameState;
  if (gs.winner !== null) {
    setStatus(gs.winner === state.me ? "Флот соперника уничтожен. Победа 🚢" : `${playerName(gs.winner)} уничтожил твой флот`);
    restartBtn.classList.remove("hidden");
  } else {
    setStatus(gs.turn === state.me ? "Твой выстрел — выбери клетку на поле соперника" : `Сейчас стреляет ${playerName(gs.turn)}`);
  }

  const layout = document.createElement("div");
  layout.className = "battle-layout";

  const ownCard = document.createElement("div");
  ownCard.className = "battle-card";
  ownCard.innerHTML = "<h4>Твой флот</h4>";
  const ownGrid = document.createElement("div");
  ownGrid.className = "battle-grid";
  const ownShipCells = new Set(gs.own.ships.flatMap((s) => s.cells.map(([r, c]) => `${r},${c}`)));
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      const d = document.createElement("div");
      const shot = gs.own.shots[r][c];
      d.className = "cell" + (ownShipCells.has(`${r},${c}`) ? " ship" : "") + (shot === "hit" ? " hit" : shot === "miss" ? " miss" : "");
      ownGrid.appendChild(d);
    }
  }
  ownCard.appendChild(ownGrid);
  const ownNote = document.createElement("div");
  ownNote.className = "battle-note";
  ownNote.textContent = "Корабли расставлены автоматически";
  ownCard.appendChild(ownNote);

  const enemyCard = document.createElement("div");
  enemyCard.className = "battle-card";
  enemyCard.innerHTML = "<h4>Поле соперника</h4>";
  const enemyGrid = document.createElement("div");
  enemyGrid.className = "battle-grid";
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      const b = document.createElement("button");
      b.type = "button";
      const shot = gs.enemy.shots[r][c];
      b.className = "cell" + (shot === "hit" ? " hit" : shot === "miss" ? " miss" : "");
      b.disabled = gs.turn !== state.me || gs.winner !== null || shot !== null;
      b.setAttribute("aria-label", `Стрелять: ${String.fromCharCode(65 + c)}${r + 1}`);
      b.addEventListener("click", () => move({ row: r, col: c }));
      enemyGrid.appendChild(b);
    }
  }
  enemyCard.appendChild(enemyGrid);
  const enemyNote = document.createElement("div");
  enemyNote.className = "battle-note";
  enemyNote.textContent = "Попадание сохраняет твой ход";
  enemyCard.appendChild(enemyNote);

  layout.append(ownCard, enemyCard);
  gameRoot.replaceChildren(layout);
}

function move(payload) {
  socket.emit("move", payload, (res) => {
    if (!res?.ok) showToast(res?.error || "Ход не принят", true);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[ch]);
}

const initialRoom = parseRoomFromPath();
if (initialRoom) showJoinPanel(initialRoom);

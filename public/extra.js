// Duelink UI/game extension: sounds, result banners and extra games.
const extraResultBanner = document.querySelector("#resultBanner");
const extraResultIcon = document.querySelector("#resultIcon");
const extraResultLabel = document.querySelector("#resultLabel");
const extraResultTitle = document.querySelector("#resultTitle");
const extraResultSubtitle = document.querySelector("#resultSubtitle");
const extraResultRestartBtn = document.querySelector("#resultRestartBtn");
const extraSoundToggle = document.querySelector("#soundToggle");
const extraSoundIcon = document.querySelector("#soundIcon");

let duelinkSoundEnabled = localStorage.getItem("duelink_sound") !== "off";
let duelinkAudioCtx = null;
let duelinkLastResultKey = null;
let duelinkLastRpsKey = null;
let duelinkLastPlayerCount = 0;

function duelinkUpdateSoundButton() {
  if (!extraSoundToggle || !extraSoundIcon) return;
  extraSoundToggle.setAttribute("aria-pressed", String(duelinkSoundEnabled));
  extraSoundToggle.classList.toggle("muted", !duelinkSoundEnabled);
  extraSoundIcon.textContent = duelinkSoundEnabled ? "🔊" : "🔇";
}

function duelinkAudioContext() {
  if (!duelinkSoundEnabled) return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!duelinkAudioCtx) duelinkAudioCtx = new AudioCtx();
  if (duelinkAudioCtx.state === "suspended") duelinkAudioCtx.resume().catch(() => {});
  return duelinkAudioCtx;
}

function duelinkTone(freq, duration = .1, type = "sine", volume = .03, delay = 0) {
  const ctx = duelinkAudioContext();
  if (!ctx) return;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const start = ctx.currentTime + delay;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + .015);
  gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + .03);
}

function duelinkPlaySound(kind) {
  if (!duelinkSoundEnabled) return;
  if (kind === "move") {
    duelinkTone(360, .08, "sine", .025);
    duelinkTone(520, .06, "sine", .016, .035);
  } else if (kind === "join") {
    duelinkTone(520, .09, "sine", .025);
    duelinkTone(740, .12, "sine", .028, .08);
  } else if (kind === "win") {
    duelinkTone(523, .16, "triangle", .035);
    duelinkTone(659, .16, "triangle", .035, .10);
    duelinkTone(784, .20, "triangle", .04, .20);
    duelinkTone(1046, .28, "sine", .024, .31);
  } else if (kind === "lose") {
    duelinkTone(392, .16, "triangle", .03);
    duelinkTone(330, .18, "triangle", .027, .12);
    duelinkTone(247, .28, "triangle", .024, .24);
  } else if (kind === "draw") {
    duelinkTone(440, .14, "sine", .024);
    duelinkTone(494, .14, "sine", .024, .12);
    duelinkTone(440, .18, "sine", .022, .24);
  } else if (kind === "error") {
    duelinkTone(180, .12, "square", .016);
  }
}

duelinkUpdateSoundButton();
extraSoundToggle?.addEventListener("click", () => {
  duelinkSoundEnabled = !duelinkSoundEnabled;
  localStorage.setItem("duelink_sound", duelinkSoundEnabled ? "on" : "off");
  duelinkUpdateSoundButton();
  if (duelinkSoundEnabled) duelinkPlaySound("join");
});

extraResultRestartBtn?.addEventListener("click", () => {
  socket.emit("restart", (res) => {
    if (!res?.ok) showToast(res?.error || "Не удалось начать новый раунд", true);
  });
});

function duelinkOutcome(state) {
  const gs = state?.gameState;
  if (!gs) return null;
  const finalGames = ["tictactoe", "connect4", "battleship", "dotsboxes", "bullscows"];
  if (!finalGames.includes(state.game)) return null;

  if (gs.winner !== null && gs.winner !== undefined) {
    const won = gs.winner === state.me;
    let subtitle;
    if (state.game === "dotsboxes") {
      subtitle = `Финальный счёт ${gs.score[0]}:${gs.score[1]}. ${won ? "Квадраты сегодня были на твоей стороне." : `${playerName(gs.winner)} забрал больше квадратов.`}`;
    } else if (state.game === "bullscows") {
      subtitle = won ? "Ты первым раскрыл секретное число соперника." : `${playerName(gs.winner)} первым раскрыл твоё число.`;
    } else {
      subtitle = won ? `Ты выиграл матч в игре «${state.gameName}».` : `${playerName(gs.winner)} выиграл матч в игре «${state.gameName}».`;
    }
    return {
      type: won ? "win" : "lose",
      icon: won ? "🏆" : "☄",
      label: "Матч завершён",
      title: won ? "Победа!" : "Поражение",
      subtitle,
    };
  }

  if (gs.draw) {
    return {
      type: "draw",
      icon: "✦",
      label: "Матч завершён",
      title: "Ничья",
      subtitle: "Силы оказались равны. Новый раунд решит спор лучше любой дискуссии.",
    };
  }
  return null;
}

function duelinkConfetti(type) {
  if (!extraResultBanner) return;
  extraResultBanner.querySelectorAll(".confetti-piece").forEach((el) => el.remove());
  if (type !== "win") return;
  for (let i = 0; i < 20; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.setProperty("--x", `${7 + Math.random() * 86}%`);
    piece.style.setProperty("--delay", `${Math.random() * .32}s`);
    piece.style.setProperty("--drift", `${-50 + Math.random() * 100}px`);
    piece.style.setProperty("--spin", `${140 + Math.random() * 460}deg`);
    extraResultBanner.appendChild(piece);
  }
}

function duelinkShowOutcome(state) {
  const outcome = duelinkOutcome(state);
  if (!outcome) {
    extraResultBanner?.classList.add("hidden");
    duelinkLastResultKey = null;
    return;
  }

  extraResultBanner.className = `result-banner ${outcome.type}`;
  extraResultIcon.textContent = outcome.icon;
  extraResultLabel.textContent = outcome.label;
  extraResultTitle.textContent = outcome.title;
  extraResultSubtitle.textContent = outcome.subtitle;
  restartBtn.classList.add("hidden");

  const key = `${state.roomId}:${state.game}:${state.gameState?.round}:${outcome.type}`;
  if (key !== duelinkLastResultKey) {
    duelinkLastResultKey = key;
    duelinkPlaySound(outcome.type);
    duelinkConfetti(outcome.type);
  }
}

const duelinkOriginalGetPlayerAvatar = getPlayerAvatar;
getPlayerAvatar = function(game, index) {
  if (game === "dotsboxes") return index === 0 ? "◆" : "◇";
  if (game === "bullscows") return index === 0 ? "4" : "?";
  return duelinkOriginalGetPlayerAvatar(game, index);
};

const duelinkOriginalRenderPlayers = renderPlayers;
renderPlayers = function(state) {
  duelinkOriginalRenderPlayers(state);
  const outcome = duelinkOutcome(state);
  if (state.players.length === 2 && duelinkLastPlayerCount < 2) duelinkPlaySound("join");
  duelinkLastPlayerCount = state.players.length;

  [0, 1].forEach((index) => {
    const el = document.querySelector(`#player${index}`);
    if (!el || !state.players[index]) return;
    el.classList.remove("winner", "loser", "draw-state");
    if (!outcome) return;
    if (outcome.type === "draw") el.classList.add("draw-state");
    else if (index === state.me) el.classList.add(outcome.type === "win" ? "winner" : "loser");
    else el.classList.add(outcome.type === "win" ? "loser" : "winner");
  });
};

const duelinkOriginalUpdateMeta = updateMeta;
updateMeta = function(state) {
  duelinkOriginalUpdateMeta(state);
  const outcome = duelinkOutcome(state);
  if (outcome?.type === "win") document.querySelector("#roomStatusHint").textContent = "Ты победил";
  else if (outcome?.type === "lose") document.querySelector("#roomStatusHint").textContent = "Поражение";
  else if (outcome?.type === "draw") document.querySelector("#roomStatusHint").textContent = "Ничья";
};

const duelinkOriginalMove = move;
move = function(payload) {
  duelinkAudioContext();
  socket.emit("move", payload, (res) => {
    if (!res?.ok) {
      duelinkPlaySound("error");
      showToast(res?.error || "Ход не принят", true);
      return;
    }
    duelinkPlaySound("move");
  });
};

const duelinkOriginalRenderGame = renderGame;
renderGame = function(state) {
  if (state.game === "dotsboxes") {
    restartBtn.classList.add("hidden");
    updateMeta(state);
    duelinkRenderDotsBoxes(state);
  } else if (state.game === "bullscows") {
    restartBtn.classList.add("hidden");
    updateMeta(state);
    duelinkRenderBullsCows(state);
  } else {
    duelinkOriginalRenderGame(state);
  }

  duelinkShowOutcome(state);

  if (state.game === "rps" && state.gameState?.reveal) {
    const gs = state.gameState;
    const key = `${state.roomId}:rps:${gs.round}:${gs.roundWinner}`;
    if (key !== duelinkLastRpsKey) {
      duelinkLastRpsKey = key;
      if (gs.roundWinner === -1) duelinkPlaySound("draw");
      else duelinkPlaySound(gs.roundWinner === state.me ? "win" : "lose");
    }
  }
};

function duelinkRenderDotsBoxes(state) {
  const gs = state.gameState;
  if (gs.winner !== null) {
    setStatus(gs.winner === state.me ? `Победа · ${gs.score[0]}:${gs.score[1]}` : `${playerName(gs.winner)} победил · ${gs.score[0]}:${gs.score[1]}`);
  } else if (gs.draw) {
    setStatus(`Ничья · ${gs.score[0]}:${gs.score[1]}`);
  } else {
    setStatus(gs.turn === state.me ? `Твой ход · счёт ${gs.score[0]}:${gs.score[1]}` : `Ходит ${playerName(gs.turn)} · счёт ${gs.score[0]}:${gs.score[1]}`);
  }

  const wrap = document.createElement("div");
  wrap.className = "dots-wrap";
  const score = document.createElement("div");
  score.className = "dots-score";
  score.innerHTML = `<div><span class="p-dot p0"></span><span>${escapeHtml(playerName(0))}</span><strong>${gs.score[0]}</strong></div><div><span class="p-dot p1"></span><span>${escapeHtml(playerName(1))}</span><strong>${gs.score[1]}</strong></div>`;
  wrap.appendChild(score);

  const board = document.createElement("div");
  board.className = "dots-board";
  for (let rr = 0; rr < 7; rr++) {
    for (let cc = 0; cc < 7; cc++) {
      if (rr % 2 === 0 && cc % 2 === 0) {
        const dot = document.createElement("div");
        dot.className = "dots-point";
        board.appendChild(dot);
      } else if (rr % 2 === 0 && cc % 2 === 1) {
        const row = rr / 2;
        const col = (cc - 1) / 2;
        const owner = gs.hEdges[row][col];
        const edge = document.createElement("button");
        edge.type = "button";
        edge.className = `dots-edge dots-edge-h${owner === 0 ? " p0" : owner === 1 ? " p1" : ""}`;
        edge.disabled = owner !== null || gs.turn !== state.me || gs.winner !== null || gs.draw;
        edge.setAttribute("aria-label", "Поставить горизонтальную линию");
        edge.addEventListener("click", () => move({ orientation: "h", row, col }));
        board.appendChild(edge);
      } else if (rr % 2 === 1 && cc % 2 === 0) {
        const row = (rr - 1) / 2;
        const col = cc / 2;
        const owner = gs.vEdges[row][col];
        const edge = document.createElement("button");
        edge.type = "button";
        edge.className = `dots-edge dots-edge-v${owner === 0 ? " p0" : owner === 1 ? " p1" : ""}`;
        edge.disabled = owner !== null || gs.turn !== state.me || gs.winner !== null || gs.draw;
        edge.setAttribute("aria-label", "Поставить вертикальную линию");
        edge.addEventListener("click", () => move({ orientation: "v", row, col }));
        board.appendChild(edge);
      } else {
        const row = (rr - 1) / 2;
        const col = (cc - 1) / 2;
        const owner = gs.boxes[row][col];
        const box = document.createElement("div");
        box.className = `dots-box${owner === 0 ? " p0" : owner === 1 ? " p1" : ""}`;
        box.textContent = owner === null ? "" : owner === 0 ? "◆" : "◇";
        board.appendChild(box);
      }
    }
  }
  wrap.appendChild(board);
  const help = document.createElement("p");
  help.className = "game-help";
  help.textContent = "Замкни квадрат — он станет твоим, а ход останется у тебя.";
  wrap.appendChild(help);
  gameRoot.replaceChildren(wrap);
}

function duelinkRenderBullsCows(state) {
  const gs = state.gameState;
  const wrap = document.createElement("div");
  wrap.className = "bc-wrap";

  const head = document.createElement("div");
  head.className = "bc-head";
  head.innerHTML = `<div><span>Твоё секретное число</span><strong>${gs.mySecret ? escapeHtml(gs.mySecret) : "••••"}</strong></div><div><span>Соперник</span><strong>${gs.opponentReady ? "ГОТОВ" : "ДУМАЕТ"}</strong></div>`;
  wrap.appendChild(head);

  if (!gs.ready[state.me]) {
    setStatus("Загадай число из четырёх разных цифр");
    const setup = document.createElement("div");
    setup.className = "bc-setup";
    setup.innerHTML = `<div class="bc-symbol">🔐</div><h3>Загадай секрет</h3><p>Четыре разные цифры. Соперник их не увидит — секрет хранится на сервере.</p>`;
    const form = document.createElement("form");
    form.className = "bc-form";
    form.innerHTML = `<input maxlength="4" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="Например, 4271" aria-label="Секретное число"><button class="primary-btn" type="submit">Загадать число</button>`;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const secret = form.querySelector("input").value.replace(/\D/g, "").slice(0, 4);
      move({ action: "setSecret", secret });
    });
    setup.appendChild(form);
    wrap.appendChild(setup);
    gameRoot.replaceChildren(wrap);
    return;
  }

  if (!gs.ready[0] || !gs.ready[1]) {
    setStatus("Твоё число сохранено · ждём секрет соперника");
    const waiting = document.createElement("div");
    waiting.className = "bc-waiting";
    waiting.innerHTML = `<div class="bc-symbol">✓</div><h3>Секрет сохранён</h3><p>Теперь ждём, пока соперник загадает своё число.</p>`;
    wrap.appendChild(waiting);
    gameRoot.replaceChildren(wrap);
    return;
  }

  if (gs.winner !== null) {
    const secrets = document.createElement("div");
    secrets.className = "bc-reveal";
    secrets.innerHTML = `<div><span>${escapeHtml(playerName(0))}</span><strong>${escapeHtml(gs.revealSecrets?.[0] || "••••")}</strong></div><div><span>${escapeHtml(playerName(1))}</span><strong>${escapeHtml(gs.revealSecrets?.[1] || "••••")}</strong></div>`;
    wrap.appendChild(secrets);
    setStatus(gs.winner === state.me ? "Ты раскрыл секрет соперника" : `${playerName(gs.winner)} раскрыл твой секрет`);
  } else {
    setStatus(gs.turn === state.me ? "Твоя попытка — введи 4 разные цифры" : `Сейчас угадывает ${playerName(gs.turn)}`);
    const form = document.createElement("form");
    form.className = "bc-form bc-guess-form";
    form.innerHTML = `<input maxlength="4" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="Твоя попытка" aria-label="Попытка"><button class="primary-btn" type="submit">Проверить</button>`;
    form.querySelector("input").disabled = gs.turn !== state.me;
    form.querySelector("button").disabled = gs.turn !== state.me;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const guess = form.querySelector("input").value.replace(/\D/g, "").slice(0, 4);
      move({ action: "guess", guess });
    });
    wrap.appendChild(form);
  }

  const history = document.createElement("div");
  history.className = "bc-history";
  const mine = gs.guesses.filter((g) => g.by === state.me).slice().reverse();
  const theirs = gs.guesses.filter((g) => g.by !== state.me).slice().reverse();
  history.innerHTML = `<div class="bc-column"><h4>Твои попытки</h4>${duelinkGuessList(mine)}</div><div class="bc-column"><h4>Попытки соперника</h4>${duelinkGuessList(theirs)}</div>`;
  wrap.appendChild(history);
  gameRoot.replaceChildren(wrap);
}

function duelinkGuessList(items) {
  if (!items.length) return '<div class="bc-empty">Пока пусто</div>';
  return items.map((g) => `<div class="bc-guess"><strong>${escapeHtml(g.guess)}</strong><span class="bull">🐂 ${g.bulls}</span><span class="cow">🐄 ${g.cows}</span></div>`).join("");
}

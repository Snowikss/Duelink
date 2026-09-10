// Duelink v2: two extra games, desktop fixes helpers and extended rules.
(() => {
  const V2_GAMES = {
    gomoku: {
      icon: '✦', title: 'Пять в ряд', subtitle: 'Собери линию из пяти фишек на поле 11×11', time: '4–10 мин', level: 'Средне', tone: 'red',
      summary: 'Тактическая дуэль на большом поле. Игроки по очереди ставят фишки и пытаются первыми собрать непрерывную линию из пяти.',
      steps: [['Поставь фишку', 'На своём ходу выбери любую свободную клетку поля 11×11.'], ['Собери пять', 'Побеждает непрерывная линия из пяти твоих фишек по горизонтали, вертикали или диагонали.'], ['Блокируй угрозы', 'Если у соперника уже четыре фишки в линии, почти всегда пора закрывать пятую клетку.']],
      example: 'Четыре фишки подряд ещё не победа. Пятая должна продолжить ту же прямую линию.'
    },
    reversi: {
      icon: '◐', title: 'Реверси', subtitle: 'Зажимай фишки соперника и переворачивай их', time: '8–15 мин', level: 'Сложнее', tone: 'teal',
      summary: 'Стратегия на поле 8×8. Каждый ход должен зажать одну или несколько фишек соперника между новой и уже стоящей своей фишкой. Зажатые фишки переходят на твою сторону.',
      steps: [['Найди подсвеченный ход', 'Ставить фишку можно только туда, где она захватит хотя бы одну фишку соперника.'], ['Зажми соперника', 'Фишки между двумя твоими по прямой линии переворачиваются и становятся твоими.'], ['Забери большинство', 'Когда ходов больше нет, выигрывает игрок, у которого на поле осталось больше фишек.']],
      example: 'Если между двумя твоими фишками по горизонтали стоят три фишки соперника, закрывающий ход перевернёт сразу все три.'
    }
  };

  let lastState = null;
  let lastAutoGuide = null;
  const safe = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[ch]);
  const playerLabel = (index) => { try { return playerName(index); } catch { return `Игрок ${index + 1}`; } };

  function extendHome() {
    const grid = document.querySelector('.games');
    if (!grid) return;
    Object.entries(V2_GAMES).forEach(([key, meta]) => {
      if (grid.querySelector(`[data-game="${key}"]`)) return;
      const card = document.createElement('button');
      card.className = 'game-card v2-game-card';
      card.dataset.game = key;
      card.type = 'button';
      card.innerHTML = `<span class="game-card-top"></span><span class="game-icon">${meta.icon}</span><span class="game-copy"><b>${safe(meta.title)}</b><small>${safe(meta.subtitle)}</small></span><span class="game-meta-row"><span class="game-meta-chip">⏱ ${safe(meta.time)}</span><span class="game-meta-chip">◆ ${safe(meta.level)}</span></span><span class="game-card-footer"><span class="game-action">Создать комнату</span><span class="game-guide-chip v2-guide-chip" role="button" tabindex="0">? Правила</span></span>`;
      card.addEventListener('click', () => createRoom(key));
      const rule = card.querySelector('.v2-guide-chip');
      const open = (event) => { event.preventDefault(); event.stopPropagation(); showGuide(key); };
      rule.addEventListener('click', open);
      rule.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') open(event); });
      grid.appendChild(card);
    });
    const firstKpi = document.querySelector('.hero-kpi strong');
    if (firstKpi) firstKpi.textContent = '8';
  }

  function extendLobby() {
    const grid = document.querySelector('#ngGameGrid');
    if (!grid) return;
    Object.entries(V2_GAMES).forEach(([key, meta]) => {
      if (grid.querySelector(`[data-game="${key}"]`)) return;
      const btn = document.createElement('button');
      btn.className = `ng-game-choice tone-${meta.tone} v2-lobby-game`;
      btn.type = 'button';
      btn.dataset.game = key;
      btn.innerHTML = `<span class="ng-choice-icon">${meta.icon}</span><span class="ng-choice-copy"><b>${safe(meta.title)}</b><small>${safe(meta.subtitle)}</small></span><span class="ng-choice-check">✓</span>`;
      btn.addEventListener('click', () => {
        if (!lastState?.isHost) return showToast('Игру выбирает создатель комнаты', true);
        if (lastState.game === key) return;
        try { if (navigator.vibrate) navigator.vibrate(10); } catch {}
        socket.emit('selectGame', { game: key }, (res) => { if (!res?.ok) showToast(res?.error || 'Не удалось сменить игру', true); });
      });
      grid.appendChild(btn);
    });
  }

  function syncV2Lobby(state) {
    const meta = V2_GAMES[state.game];
    document.querySelectorAll('.v2-lobby-game').forEach((btn) => {
      const selected = btn.dataset.game === state.game;
      btn.classList.toggle('selected', selected);
      btn.disabled = !state.isHost || selected;
      btn.setAttribute('aria-pressed', String(selected));
    });
    if (!meta) return;
    const icon = document.querySelector('#ngSelectedIcon');
    const title = document.querySelector('#ngSelectedTitle');
    const subtitle = document.querySelector('#ngSelectedSubtitle');
    const countdown = document.querySelector('#ngCountdownGame');
    if (icon) icon.textContent = meta.icon;
    if (title) title.textContent = meta.title;
    if (subtitle) subtitle.textContent = meta.subtitle;
    if (countdown) countdown.textContent = meta.title;
  }

  function buildGuide() {
    if (document.querySelector('#v2GuideBackdrop')) return;
    const root = document.createElement('div');
    root.id = 'v2GuideBackdrop';
    root.className = 'guide-backdrop hidden';
    root.innerHTML = `<section class="guide-modal" role="dialog" aria-modal="true" aria-labelledby="v2GuideTitle"><header class="guide-head"><div class="guide-icon" id="v2GuideIcon">?</div><div class="guide-head-copy"><small>Как играть</small><h2 id="v2GuideTitle">Правила</h2></div><button class="guide-close" id="v2GuideClose" type="button" aria-label="Закрыть">×</button></header><div class="guide-body"><p class="guide-summary" id="v2GuideSummary"></p><div class="guide-meta" id="v2GuideMeta"></div><ol class="guide-steps" id="v2GuideSteps"></ol><div class="guide-example"><small>Пример</small><p id="v2GuideExample"></p></div></div><footer class="guide-footer"><span class="guide-footer-note">Правила можно открыть снова в любой момент.</span><button class="guide-primary" id="v2GuideOk" type="button">Понятно, играть</button></footer></section>`;
    document.body.appendChild(root);
    const close = () => { root.classList.add('hidden'); document.body.style.overflow = ''; };
    root.addEventListener('click', (event) => { if (event.target === root) close(); });
    root.querySelector('#v2GuideClose').addEventListener('click', close);
    root.querySelector('#v2GuideOk').addEventListener('click', close);
  }

  function showGuide(game, auto = false) {
    const meta = V2_GAMES[game];
    if (!meta) return;
    buildGuide();
    const root = document.querySelector('#v2GuideBackdrop');
    root.querySelector('#v2GuideIcon').textContent = meta.icon;
    root.querySelector('#v2GuideTitle').textContent = meta.title;
    root.querySelector('#v2GuideSummary').textContent = meta.summary;
    root.querySelector('#v2GuideMeta').innerHTML = `<div><span>Время</span><strong>${safe(meta.time)}</strong></div><div><span>Сложность</span><strong>${safe(meta.level)}</strong></div><div><span>Формат</span><strong>1 на 1</strong></div>`;
    root.querySelector('#v2GuideSteps').innerHTML = meta.steps.map(([title, text], i) => `<li class="guide-step"><span class="guide-step-num">${i + 1}</span><div><b>${safe(title)}</b><p>${safe(text)}</p></div></li>`).join('');
    root.querySelector('#v2GuideExample').textContent = meta.example;
    root.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    if (auto) localStorage.setItem(`duelink_guide_seen_${game}`, '1');
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('#ngRulesButton,#ngGameRules,#roomRulesBtn,#roomHelpFab');
    if (!button || !V2_GAMES[currentGame]) return;
    event.preventDefault(); event.stopImmediatePropagation(); showGuide(currentGame);
  }, true);

  const originalAvatar = getPlayerAvatar;
  getPlayerAvatar = function(game, index) {
    if (game === 'gomoku') return index === 0 ? '✦' : '✧';
    if (game === 'reversi') return index === 0 ? '●' : '○';
    return originalAvatar(game, index);
  };

  if (typeof duelinkOutcome === 'function') {
    const baseOutcome = duelinkOutcome;
    duelinkOutcome = function(state) {
      const gs = state?.gameState;
      if (!gs || !V2_GAMES[state.game]) return baseOutcome(state);
      if (gs.winner !== null && gs.winner !== undefined) {
        const won = gs.winner === state.me;
        let subtitle = won ? `Ты выиграл матч в игре «${state.gameName}».` : `${playerLabel(gs.winner)} выиграл матч в игре «${state.gameName}».`;
        if (state.game === 'reversi' && gs.score) subtitle = `Финальный счёт ${gs.score[0]}:${gs.score[1]}. ${won ? 'Поле осталось за тобой.' : `${playerLabel(gs.winner)} забрал большинство фишек.`}`;
        return { type: won ? 'win' : 'lose', icon: won ? '🏆' : '☄', label: 'Матч завершён', title: won ? 'Победа!' : 'Поражение', subtitle };
      }
      if (gs.draw) return { type: 'draw', icon: '✦', label: 'Матч завершён', title: 'Ничья', subtitle: 'Идеальный баланс сил. Придётся играть ещё один раунд.' };
      return null;
    };
  }

  function renderGomoku(state) {
    const gs = state.gameState;
    if (gs.winner !== null) setStatus(gs.winner === state.me ? 'Пять в ряд. Ты победил ✦' : `${playerLabel(gs.winner)} собрал пять в ряд`);
    else if (gs.draw) setStatus('Поле заполнено. Ничья.');
    else setStatus(gs.turn === state.me ? 'Твой ход — собери пять фишек в линию' : `Ходит ${playerLabel(gs.turn)}`);
    const wrap = document.createElement('div'); wrap.className = 'gomoku-wrap';
    const legend = document.createElement('div'); legend.className = 'pro-scorebar'; legend.innerHTML = `<div><i class="pro-dot p0"></i><span>${safe(playerLabel(0))}</span><b>✦</b></div><div><i class="pro-dot p1"></i><span>${safe(playerLabel(1))}</span><b>✧</b></div>`; wrap.appendChild(legend);
    const board = document.createElement('div'); board.className = 'gomoku-board';
    for (let r = 0; r < 11; r++) for (let c = 0; c < 11; c++) {
      const value = gs.board[r][c], btn = document.createElement('button'); btn.type = 'button'; btn.className = `gomoku-cell${value === 0 ? ' p0' : value === 1 ? ' p1' : ''}`; btn.disabled = value !== null || gs.turn !== state.me || gs.winner !== null || gs.draw; btn.setAttribute('aria-label', `Клетка ${r + 1}, ${c + 1}`); btn.addEventListener('click', () => move({ row: r, col: c })); board.appendChild(btn);
    }
    wrap.appendChild(board); const help = document.createElement('p'); help.className = 'game-help'; help.textContent = 'Пять фишек подряд по горизонтали, вертикали или диагонали — победа.'; wrap.appendChild(help); gameRoot.replaceChildren(wrap);
  }

  function renderReversi(state) {
    const gs = state.gameState, score = gs.score || [0, 0];
    if (gs.winner !== null) setStatus(gs.winner === state.me ? `Победа · ${score[0]}:${score[1]}` : `${playerLabel(gs.winner)} победил · ${score[0]}:${score[1]}`);
    else if (gs.draw) setStatus(`Ничья · ${score[0]}:${score[1]}`);
    else setStatus(gs.turn === state.me ? `Твой ход · ${score[0]}:${score[1]}` : `Ходит ${playerLabel(gs.turn)} · ${score[0]}:${score[1]}`);
    const valid = new Set((gs.validMoves || []).map(([r, c]) => `${r}:${c}`));
    const wrap = document.createElement('div'); wrap.className = 'reversi-wrap';
    const scorebar = document.createElement('div'); scorebar.className = 'pro-scorebar reversi-scorebar'; scorebar.innerHTML = `<div><i class="pro-dot p0"></i><span>${safe(playerLabel(0))}</span><b>${score[0]}</b></div><div><i class="pro-dot p1"></i><span>${safe(playerLabel(1))}</span><b>${score[1]}</b></div>`; wrap.appendChild(scorebar);
    const board = document.createElement('div'); board.className = 'reversi-board';
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const value = gs.board[r][c], isValid = valid.has(`${r}:${c}`), btn = document.createElement('button'); btn.type = 'button'; btn.className = `reversi-cell${isValid ? ' valid' : ''}`; btn.disabled = !isValid || gs.turn !== state.me || gs.winner !== null || gs.draw;
      if (value === 0 || value === 1) { const disc = document.createElement('span'); disc.className = `reversi-disc p${value}`; btn.appendChild(disc); }
      else if (isValid) { const hint = document.createElement('span'); hint.className = 'reversi-hint'; btn.appendChild(hint); }
      btn.addEventListener('click', () => move({ row: r, col: c })); board.appendChild(btn);
    }
    wrap.appendChild(board); const help = document.createElement('p'); help.className = 'game-help'; help.textContent = 'Подсвечены только допустимые ходы. Зажатые фишки соперника переворачиваются.'; wrap.appendChild(help); gameRoot.replaceChildren(wrap);
  }

  const baseRenderGame = renderGame;
  renderGame = function(state) {
    if (state.game === 'gomoku') { restartBtn.classList.add('hidden'); updateMeta(state); renderGomoku(state); if (typeof duelinkShowOutcome === 'function') duelinkShowOutcome(state); return; }
    if (state.game === 'reversi') { restartBtn.classList.add('hidden'); updateMeta(state); renderReversi(state); if (typeof duelinkShowOutcome === 'function') duelinkShowOutcome(state); return; }
    baseRenderGame(state);
  };

  buildGuide(); extendHome(); extendLobby();
  socket.on('roomState', (state) => {
    lastState = state; extendLobby(); syncV2Lobby(state);
    if (V2_GAMES[state.game] && state.status === 'playing') {
      const key = `${state.roomId}:${state.game}:${state.matchId}`;
      const seen = localStorage.getItem(`duelink_guide_seen_${state.game}`) === '1';
      if (!seen && key !== lastAutoGuide) { lastAutoGuide = key; setTimeout(() => showGuide(state.game, true), 2800); }
    }
  });
})();

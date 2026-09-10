(() => {
  const GAME_META = {
    tictactoe: { icon: '✕○', title: 'Крестики-нолики', subtitle: 'Быстрая классика 3×3', tone: 'violet' },
    connect4: { icon: '●●', title: 'Четыре в ряд', subtitle: 'Тактика на поле 7×6', tone: 'cyan' },
    rps: { icon: '✊', title: 'Камень · Ножницы · Бумага', subtitle: 'Скрытый выбор и быстрые раунды', tone: 'amber' },
    battleship: { icon: '⚓', title: 'Морской бой', subtitle: 'Охота за флотом 10×10', tone: 'blue' },
    dotsboxes: { icon: '▦', title: 'Точки и квадраты', subtitle: 'Замыкай клетки и забирай очки', tone: 'pink' },
    bullscows: { icon: '🔢', title: 'Быки и коровы', subtitle: 'Логическая дуэль с секретным числом', tone: 'green' },
  };

  let previousLobbyState = null;
  let previousStatus = null;
  let lastCountdownMatchId = null;
  let uiBuilt = false;

  const safe = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[ch]);

  function sound(kind) {
    try {
      if (typeof duelinkPlaySound === 'function') duelinkPlaySound(kind);
      else if (typeof playSound === 'function') playSound(kind);
    } catch {}
  }

  function buzz(pattern = 14) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch {}
  }

  function ensureUi() {
    if (uiBuilt) return;
    uiBuilt = true;

    const waitingPanel = document.querySelector('#waitingPanel');
    const gamePanel = document.querySelector('#gamePanel');
    const roomMain = document.querySelector('.room-main');
    if (!roomMain || !gamePanel) return;

    const lobby = document.createElement('section');
    lobby.id = 'nextgenLobby';
    lobby.className = 'ng-lobby hidden';
    lobby.innerHTML = `
      <div class="ng-lobby-hero">
        <div class="ng-lobby-beam beam-a"></div>
        <div class="ng-lobby-beam beam-b"></div>
        <div class="ng-selected-game">
          <div class="ng-selected-icon" id="ngSelectedIcon">✕○</div>
          <div class="ng-selected-copy">
            <div class="ng-kicker">Текущая игра</div>
            <h2 id="ngSelectedTitle">Крестики-нолики</h2>
            <p id="ngSelectedSubtitle">Быстрая классика 3×3</p>
          </div>
          <button id="ngRulesButton" class="ng-icon-action" type="button" title="Правила игры">?</button>
        </div>
        <div class="ng-lobby-status" id="ngLobbyStatus">
          <span class="ng-status-dot"></span>
          <span>Подготовка лобби</span>
        </div>
      </div>

      <div class="ng-lobby-grid">
        <section class="ng-panel ng-players-panel">
          <div class="ng-panel-head">
            <div><span class="ng-kicker">Команда комнаты</span><h3>Игроки</h3></div>
            <span class="ng-mini-chip" id="ngPlayersCount">1 / 2</span>
          </div>
          <div class="ng-player-stack">
            <article class="ng-player-slot" id="ngPlayer0"></article>
            <div class="ng-vs-line"><span></span><b>VS</b><span></span></div>
            <article class="ng-player-slot" id="ngPlayer1"></article>
          </div>
          <div class="ng-ready-controls">
            <button id="ngReadyButton" class="ng-ready-button" type="button"><span class="ng-ready-icon">✓</span><span id="ngReadyText">Я готов</span></button>
            <button id="ngStartButton" class="ng-start-button" type="button"><span>Запустить матч</span><i>→</i></button>
          </div>
          <p class="ng-control-note" id="ngControlNote">Оба игрока должны подтвердить готовность.</p>
        </section>

        <section class="ng-panel ng-games-panel">
          <div class="ng-panel-head">
            <div><span class="ng-kicker">Игровая станция</span><h3>Выбор игры</h3></div>
            <span class="ng-host-chip" id="ngHostChip">HOST</span>
          </div>
          <p class="ng-games-note" id="ngGamesNote">Создатель комнаты может менять игру, ссылка при этом остаётся прежней.</p>
          <div class="ng-game-grid" id="ngGameGrid"></div>
        </section>
      </div>

      <section class="ng-panel ng-lobby-footer">
        <div class="ng-lobby-footer-copy">
          <span class="ng-kicker">Одна комната, много раундов</span>
          <strong>Больше не нужно отправлять новую ссылку после каждой игры.</strong>
        </div>
        <div class="ng-room-flow"><span>Комната</span><i>→</i><span>Выбор</span><i>→</i><span>Готовность</span><i>→</i><span>Матч</span></div>
      </section>
    `;
    roomMain.insertBefore(lobby, gamePanel);

    const gameGrid = lobby.querySelector('#ngGameGrid');
    Object.entries(GAME_META).forEach(([key, game]) => {
      const btn = document.createElement('button');
      btn.className = `ng-game-choice tone-${game.tone}`;
      btn.type = 'button';
      btn.dataset.game = key;
      btn.innerHTML = `<span class="ng-choice-icon">${game.icon}</span><span class="ng-choice-copy"><b>${safe(game.title)}</b><small>${safe(game.subtitle)}</small></span><span class="ng-choice-check">✓</span>`;
      btn.addEventListener('click', () => selectGame(key));
      gameGrid.appendChild(btn);
    });

    lobby.querySelector('#ngReadyButton').addEventListener('click', toggleReady);
    lobby.querySelector('#ngStartButton').addEventListener('click', startMatch);
    lobby.querySelector('#ngRulesButton').addEventListener('click', openRules);

    const gameShell = document.querySelector('.game-shell');
    if (gameShell && !document.querySelector('#ngGameToolbar')) {
      const toolbar = document.createElement('div');
      toolbar.id = 'ngGameToolbar';
      toolbar.className = 'ng-game-toolbar';
      toolbar.innerHTML = `
        <div class="ng-live-pill"><span></span> LIVE MATCH</div>
        <div class="ng-game-toolbar-actions">
          <button id="ngGameRules" type="button">? Правила</button>
          <button id="ngReturnLobby" type="button">← В лобби</button>
        </div>`;
      gameShell.insertBefore(toolbar, gameShell.firstChild);
      toolbar.querySelector('#ngGameRules').addEventListener('click', openRules);
      toolbar.querySelector('#ngReturnLobby').addEventListener('click', returnToLobby);
    }

    if (!document.querySelector('#ngCountdown')) {
      const overlay = document.createElement('div');
      overlay.id = 'ngCountdown';
      overlay.className = 'ng-countdown hidden';
      overlay.innerHTML = `
        <div class="ng-countdown-grid"></div>
        <div class="ng-countdown-ring ring-one"></div>
        <div class="ng-countdown-ring ring-two"></div>
        <div class="ng-countdown-core">
          <span class="ng-countdown-kicker">MATCH STARTING</span>
          <strong id="ngCountdownValue">3</strong>
          <p id="ngCountdownGame">DUELINK</p>
        </div>`;
      document.body.appendChild(overlay);
    }

    if (waitingPanel) enhanceWaiting(waitingPanel);
  }

  function enhanceWaiting(panel) {
    if (panel.dataset.nextgen === '1') return;
    panel.dataset.nextgen = '1';
    panel.classList.add('ng-waiting-panel');
    const loader = panel.querySelector('.loader');
    if (loader) {
      loader.classList.add('ng-orbit-loader');
      loader.innerHTML = '<span></span><span></span><span></span>';
    }
    const title = panel.querySelector('h3');
    const text = panel.querySelector('p');
    if (title) title.textContent = 'Комната готова';
    if (text) text.textContent = 'Пригласи второго игрока. Когда он подключится, вы попадёте в общее лобби и сможете менять игры без новой ссылки.';
  }

  function openRules() {
    try {
      if (typeof openGuide === 'function' && currentGame) return openGuide(currentGame, false);
    } catch {}
    const fallback = document.querySelector('#roomRulesBtn');
    if (fallback) fallback.click();
  }

  function selectGame(game) {
    if (!previousLobbyState?.isHost) return showToast?.('Игру выбирает создатель комнаты', true);
    if (previousLobbyState.game === game) return;
    buzz(10);
    sound('move');
    socket.emit('selectGame', { game }, (res) => {
      if (!res?.ok) showToast?.(res?.error || 'Не удалось сменить игру', true);
    });
  }

  function toggleReady() {
    buzz(12);
    socket.emit('toggleReady', (res) => {
      if (!res?.ok) return showToast?.(res?.error || 'Не удалось изменить готовность', true);
      sound(res.ready ? 'join' : 'move');
    });
  }

  function startMatch() {
    buzz([18, 40, 18]);
    socket.emit('startMatch', (res) => {
      if (!res?.ok) return showToast?.(res?.error || 'Матч пока нельзя запустить', true);
    });
  }

  function returnToLobby() {
    socket.emit('returnToLobby', (res) => {
      if (!res?.ok) return showToast?.(res?.error || 'Не удалось вернуться в лобби', true);
      sound('move');
    });
  }

  function playerCard(state, index) {
    const player = state.players[index];
    const ready = !!state.ready?.[index];
    const isHost = index === state.hostIndex;
    const isMe = index === state.me;
    const connected = !!player?.connected;
    if (!player) {
      return `
        <div class="ng-player-avatar waiting"><span>+</span></div>
        <div class="ng-player-info"><b>Свободное место</b><small>Ждём второго игрока</small></div>
        <span class="ng-player-state waiting">WAITING</span>`;
    }
    const initial = safe(player.name.slice(0, 1).toUpperCase());
    const label = [isHost ? 'Создатель' : 'Гость', isMe ? 'это ты' : null].filter(Boolean).join(' · ');
    return `
      <div class="ng-player-avatar ${ready ? 'ready' : ''}"><span>${initial}</span><i>${ready ? '✓' : '•'}</i></div>
      <div class="ng-player-info"><b>${safe(player.name)}</b><small>${safe(label)} · ${connected ? 'онлайн' : 'переподключается'}</small></div>
      <span class="ng-player-state ${ready ? 'ready' : connected ? 'not-ready' : 'offline'}">${ready ? 'ГОТОВ' : connected ? 'НЕ ГОТОВ' : 'OFFLINE'}</span>`;
  }

  function renderLobby(state) {
    ensureUi();
    previousLobbyState = state;
    const lobby = document.querySelector('#nextgenLobby');
    if (!lobby) return;

    const meta = GAME_META[state.game] || GAME_META.tictactoe;
    document.querySelector('#ngSelectedIcon').textContent = meta.icon;
    document.querySelector('#ngSelectedTitle').textContent = meta.title;
    document.querySelector('#ngSelectedSubtitle').textContent = meta.subtitle;
    document.querySelector('#ngPlayersCount').textContent = `${state.connectedCount ?? state.players.filter(p => p.connected).length} / 2`;

    const p0 = document.querySelector('#ngPlayer0');
    const p1 = document.querySelector('#ngPlayer1');
    p0.innerHTML = playerCard(state, 0);
    p1.innerHTML = playerCard(state, 1);
    p0.className = `ng-player-slot ${state.ready?.[0] ? 'ready' : ''}`;
    p1.className = `ng-player-slot ${state.ready?.[1] ? 'ready' : ''}`;

    const myReady = !!state.ready?.[state.me];
    const readyButton = document.querySelector('#ngReadyButton');
    readyButton.classList.toggle('active', myReady);
    readyButton.querySelector('#ngReadyText').textContent = myReady ? 'Готов ✓' : 'Я готов';

    const bothReady = state.ready?.length >= 2 && state.ready[0] && state.ready[1];
    const bothOnline = (state.connectedCount ?? 0) >= 2;
    const start = document.querySelector('#ngStartButton');
    start.disabled = !state.isHost || !bothReady || !bothOnline;
    start.classList.toggle('armed', !!(state.isHost && bothReady && bothOnline));

    const hostChip = document.querySelector('#ngHostChip');
    hostChip.textContent = state.isHost ? 'ТЫ HOST' : 'HOST У СОПЕРНИКА';
    hostChip.classList.toggle('guest', !state.isHost);

    const note = document.querySelector('#ngControlNote');
    if (!bothOnline) note.textContent = 'Ждём, пока второй игрок снова будет онлайн.';
    else if (!bothReady) note.textContent = 'Оба игрока нажимают «Готов». После этого создатель запускает матч.';
    else if (state.isHost) note.textContent = 'Все готовы. Можно запускать матч.';
    else note.textContent = 'Все готовы. Ждём запуска матча создателем комнаты.';

    const status = document.querySelector('#ngLobbyStatus');
    status.className = `ng-lobby-status ${bothReady && bothOnline ? 'armed' : ''}`;
    status.innerHTML = `<span class="ng-status-dot"></span><span>${bothReady && bothOnline ? 'Все готовы' : bothOnline ? 'Подготовка к матчу' : 'Ожидаем игрока'}</span>`;

    document.querySelectorAll('.ng-game-choice').forEach((btn) => {
      const selected = btn.dataset.game === state.game;
      btn.classList.toggle('selected', selected);
      btn.disabled = !state.isHost || selected;
      btn.setAttribute('aria-pressed', String(selected));
    });
    document.querySelector('#ngGamesNote').textContent = state.isHost
      ? 'Выбирай игру свободно. Готовность игроков сбросится, но ссылка комнаты останется прежней.'
      : 'Игру выбирает создатель комнаты. Тебе не придётся переходить по новой ссылке.';
  }

  function syncPanels(state) {
    ensureUi();
    const lobby = document.querySelector('#nextgenLobby');
    const waiting = document.querySelector('#waitingPanel');
    const game = document.querySelector('#gamePanel');
    const result = document.querySelector('#resultBanner');
    const statusHint = document.querySelector('#roomStatusHint');

    if (state.status === 'waiting') {
      lobby?.classList.add('hidden');
      game?.classList.add('hidden');
      waiting?.classList.remove('hidden');
      if (statusHint) statusHint.textContent = 'Ждём игрока';
      return;
    }

    if (state.status === 'lobby') {
      waiting?.classList.add('hidden');
      game?.classList.add('hidden');
      result?.classList.add('hidden');
      lobby?.classList.remove('hidden');
      if (statusHint) statusHint.textContent = 'Лобби';
      renderLobby(state);
      return;
    }

    lobby?.classList.add('hidden');
    waiting?.classList.add('hidden');
    game?.classList.remove('hidden');
    if (statusHint) statusHint.textContent = 'Матч идёт';

    const returnBtn = document.querySelector('#ngReturnLobby');
    if (returnBtn) {
      returnBtn.hidden = !state.isHost;
      returnBtn.title = state.isHost ? 'Вернуться в лобби и выбрать другую игру' : '';
    }
  }

  function animateLobbyDiff(state) {
    if (!previousLobbyState) return;
    if (previousLobbyState.game !== state.game) {
      const selected = document.querySelector('.ng-game-choice.selected');
      selected?.classList.remove('ng-choice-pop');
      void selected?.offsetWidth;
      selected?.classList.add('ng-choice-pop');
      const hero = document.querySelector('.ng-lobby-hero');
      hero?.classList.remove('ng-hero-pulse');
      void hero?.offsetWidth;
      hero?.classList.add('ng-hero-pulse');
      sound('move');
    }
    [0, 1].forEach((i) => {
      if (!!previousLobbyState.ready?.[i] !== !!state.ready?.[i]) {
        const slot = document.querySelector(`#ngPlayer${i}`);
        slot?.classList.remove('ng-ready-pop');
        void slot?.offsetWidth;
        slot?.classList.add('ng-ready-pop');
      }
    });
  }

  function runCountdown(state) {
    if (!state?.matchId || state.matchId === lastCountdownMatchId) return;
    if (previousStatus === null) {
      lastCountdownMatchId = state.matchId;
      return;
    }
    lastCountdownMatchId = state.matchId;
    const overlay = document.querySelector('#ngCountdown');
    const value = document.querySelector('#ngCountdownValue');
    const gameName = document.querySelector('#ngCountdownGame');
    if (!overlay || !value) return;
    gameName.textContent = (GAME_META[state.game] || {}).title || 'DUELINK';
    overlay.classList.remove('hidden');
    overlay.classList.add('active');

    const sequence = [['3', 0], ['2', 650], ['1', 1300], ['GO!', 1950]];
    sequence.forEach(([text, delay], idx) => {
      setTimeout(() => {
        value.textContent = text;
        value.classList.remove('tick');
        void value.offsetWidth;
        value.classList.add('tick');
        buzz(idx === 3 ? [18, 35, 30] : 10);
        if (idx < 3) {
          try {
            if (typeof duelinkTone === 'function') duelinkTone(420 + idx * 130, .12, 'triangle', .035);
          } catch {}
        } else sound('join');
      }, delay);
    });
    setTimeout(() => {
      overlay.classList.remove('active');
      setTimeout(() => overlay.classList.add('hidden'), 300);
    }, 2600);
  }

  ensureUi();

  socket.on('roomState', (state) => {
    const before = previousLobbyState;
    syncPanels(state);
    if (state.status === 'lobby') {
      const justRendered = previousLobbyState;
      previousLobbyState = before;
      animateLobbyDiff(state);
      previousLobbyState = justRendered;
    }
    if (state.status === 'playing' && previousStatus !== 'playing') runCountdown(state);
    previousStatus = state.status;
  });
})();

// Duelink portfolio experience: onboarding, game guides, sharing and presentation polish.
(() => {
  const GAME_GUIDES = {
    tictactoe: {
      icon: "✕○", title: "Крестики-нолики", time: "1–3 мин", level: "Легко", style: "Тактика",
      short: "Собери три своих символа в линию раньше соперника.",
      summary: "Знакомая дуэль на поле 3×3. Игроки по очереди ставят X и O, а победа достаётся тому, кто первым соберёт линию из трёх символов.",
      steps: [
        ["Выбери клетку", "На своём ходу нажми на любую свободную клетку поля."],
        ["Собери линию", "Нужно поставить три своих символа подряд: по горизонтали, вертикали или диагонали."],
        ["Не дай сопернику", "Иногда лучший ход не атакует, а перекрывает почти готовую линию противника."]
      ],
      example: "Если у тебя уже стоят X в левом верхнем и центральном квадратах, X в правом нижнем завершит диагональ и принесёт победу."
    },
    connect4: {
      icon: "●●", title: "Четыре в ряд", time: "3–7 мин", level: "Средне", style: "Тактика",
      short: "Бросай фишки в столбцы и первым собери четыре в ряд.",
      summary: "Игроки по очереди опускают фишки в семь столбцов. Фишка всегда падает на самое нижнее свободное место, поэтому приходится думать сразу на несколько ходов вперёд.",
      steps: [
        ["Выбери столбец", "Нажми стрелку над столбцом. Твоя фишка упадёт вниз."],
        ["Собери четыре", "Подойдут горизонтальная, вертикальная и обе диагональные линии."],
        ["Строй ловушки", "Особенно сильны позиции, где следующий ход может завершить сразу две линии."]
      ],
      example: "Три фишки подряд ещё не победа. Нужна четвёртая, причём линия может идти и по диагонали."
    },
    rps: {
      icon: "✊", title: "Камень · Ножницы · Бумага", time: "30 сек", level: "Легко", style: "Быстрая",
      short: "Сделай скрытый выбор и попробуй прочитать соперника.",
      summary: "Оба игрока делают выбор скрытно. Сервер показывает варианты только после того, как определились оба, поэтому подсмотреть решение соперника через интерфейс нельзя.",
      steps: [
        ["Выбери знак", "Камень, ножницы или бумага. После выбора изменить решение уже нельзя."],
        ["Жди соперника", "Ты увидишь только то, что соперник уже выбрал, но не увидишь что именно."],
        ["Получите результат", "Камень бьёт ножницы, ножницы режут бумагу, бумага накрывает камень."]
      ],
      example: "✊ побеждает ✌️, ✌️ побеждает ✋, а ✋ побеждает ✊. Одинаковый выбор означает ничью."
    },
    battleship: {
      icon: "⚓", title: "Морской бой", time: "7–15 мин", level: "Средне", style: "Стратегия",
      short: "Найди и уничтожь весь флот соперника раньше него.",
      summary: "У каждого игрока собственное поле 10×10 и скрытый флот. В текущей версии корабли расставляются автоматически, чтобы матч начинался сразу после подключения второго игрока.",
      steps: [
        ["Стреляй по клеткам", "На своём ходу выбери любую ещё не проверенную клетку поля соперника."],
        ["Следи за попаданиями", "Красная отметка означает попадание, синяя точка — промах."],
        ["Добей весь флот", "При попадании ты сохраняешь ход. Побеждает тот, кто первым уничтожит все корабли."]
      ],
      example: "Если попал в корабль, разумно проверить соседние клетки по горизонтали и вертикали: корабль продолжается только по прямой."
    },
    dotsboxes: {
      icon: "▦", title: "Точки и квадраты", time: "4–8 мин", level: "Средне", style: "Захват",
      short: "Соединяй точки, замыкай квадраты и забирай их себе.",
      summary: "Игроки по очереди проводят одну линию между соседними точками. Тот, кто проводит четвёртую сторону квадрата, захватывает его и получает дополнительный ход.",
      steps: [
        ["Проведи линию", "Нажми на свободный отрезок между двумя соседними точками."],
        ["Замкни квадрат", "Если твоя линия стала четвёртой стороной клетки, квадрат засчитывается тебе."],
        ["Забери большинство", "После заполнения всего поля выигрывает игрок с большим количеством квадратов."]
      ],
      example: "Если у квадрата уже нарисованы три стороны, поставив четвёртую ты получишь очко и сразу сделаешь ещё один ход."
    },
    bullscows: {
      icon: "🔢", title: "Быки и коровы", time: "5–12 мин", level: "Средне", style: "Логика",
      short: "Загадай 4 разные цифры и первым вычисли секрет соперника.",
      summary: "Каждый игрок тайно задаёт четырёхзначное число без повторяющихся цифр. После каждой попытки игра сообщает только количество быков и коров, а само число соперника остаётся скрытым на сервере.",
      steps: [
        ["Загадай секрет", "Введи четыре разные цифры, например 4271. Соперник их не увидит."],
        ["Делай попытки", "По очереди вводите варианты секретного числа другого игрока."],
        ["Читай подсказки", "🐂 Бык — правильная цифра на правильном месте. 🐄 Корова — цифра есть, но стоит не там."]
      ],
      example: "Секрет 4271, попытка 4725: цифра 4 стоит правильно, а 7 и 2 присутствуют, но поменялись местами. Результат: 1 бык и 2 коровы."
    }
  };

  let guideGame = null;
  let guideAutoOpen = false;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[ch]);
  }

  function buildModal() {
    if (document.querySelector("#gameGuideBackdrop")) return;
    const backdrop = document.createElement("div");
    backdrop.id = "gameGuideBackdrop";
    backdrop.className = "guide-backdrop hidden";
    backdrop.innerHTML = `
      <section class="guide-modal" role="dialog" aria-modal="true" aria-labelledby="guideTitle">
        <header class="guide-head">
          <div class="guide-icon" id="guideIcon">?</div>
          <div class="guide-head-copy"><small>Как играть</small><h2 id="guideTitle">Правила</h2></div>
          <button class="guide-close" id="guideClose" type="button" aria-label="Закрыть">×</button>
        </header>
        <div class="guide-body">
          <p class="guide-summary" id="guideSummary"></p>
          <div class="guide-meta" id="guideMeta"></div>
          <ol class="guide-steps" id="guideSteps"></ol>
          <div class="guide-example"><small>Пример</small><p id="guideExample"></p></div>
        </div>
        <footer class="guide-footer">
          <span class="guide-footer-note">Правила всегда можно открыть снова кнопкой «? Правила».</span>
          <button class="guide-primary" id="guideGotIt" type="button">Понятно, играть</button>
        </footer>
      </section>`;
    document.body.appendChild(backdrop);

    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closeGuide();
    });
    document.querySelector("#guideClose").addEventListener("click", closeGuide);
    document.querySelector("#guideGotIt").addEventListener("click", closeGuide);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !backdrop.classList.contains("hidden")) closeGuide();
    });
  }

  function openGuide(game, auto = false) {
    const guide = GAME_GUIDES[game];
    if (!guide) return;
    buildModal();
    guideGame = game;
    guideAutoOpen = auto;
    document.querySelector("#guideIcon").textContent = guide.icon;
    document.querySelector("#guideTitle").textContent = guide.title;
    document.querySelector("#guideSummary").textContent = guide.summary;
    document.querySelector("#guideMeta").innerHTML = `
      <div><span>Время</span><strong>${escapeHtml(guide.time)}</strong></div>
      <div><span>Сложность</span><strong>${escapeHtml(guide.level)}</strong></div>
      <div><span>Тип</span><strong>${escapeHtml(guide.style)}</strong></div>`;
    document.querySelector("#guideSteps").innerHTML = guide.steps.map(([title, text], index) => `
      <li class="guide-step"><span class="guide-step-num">${index + 1}</span><div><b>${escapeHtml(title)}</b><p>${escapeHtml(text)}</p></div></li>`).join("");
    document.querySelector("#guideExample").textContent = guide.example;
    const backdrop = document.querySelector("#gameGuideBackdrop");
    backdrop.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    setTimeout(() => document.querySelector("#guideGotIt")?.focus(), 80);
  }

  function closeGuide() {
    const backdrop = document.querySelector("#gameGuideBackdrop");
    if (!backdrop) return;
    backdrop.classList.add("hidden");
    document.body.style.overflow = "";
    if (guideGame && guideAutoOpen) localStorage.setItem(`duelink_guide_seen_${guideGame}`, "1");
    guideAutoOpen = false;
  }

  function enhanceGameCards() {
    document.querySelectorAll(".game-card[data-game]").forEach((card) => {
      if (card.dataset.portfolioEnhanced === "1") return;
      const game = card.dataset.game;
      const guide = GAME_GUIDES[game];
      if (!guide) return;
      card.dataset.portfolioEnhanced = "1";

      const small = card.querySelector(".game-copy small");
      if (small) small.textContent = guide.short;

      const meta = document.createElement("span");
      meta.className = "game-meta-row";
      meta.innerHTML = `<span class="game-meta-chip">⏱ ${escapeHtml(guide.time)}</span><span class="game-meta-chip">◆ ${escapeHtml(guide.level)}</span>`;
      card.querySelector(".game-copy")?.insertAdjacentElement("afterend", meta);

      const action = card.querySelector(".game-action");
      if (action) {
        const footer = document.createElement("span");
        footer.className = "game-card-footer";
        action.replaceWith(footer);
        footer.appendChild(action);
        const guideButton = document.createElement("span");
        guideButton.className = "game-guide-chip";
        guideButton.setAttribute("role", "button");
        guideButton.setAttribute("tabindex", "0");
        guideButton.textContent = "? Правила";
        const show = (event) => {
          event.preventDefault();
          event.stopPropagation();
          openGuide(game, false);
        };
        guideButton.addEventListener("click", show);
        guideButton.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") show(event);
        });
        footer.appendChild(guideButton);
      }
    });
  }

  function addHeroStats() {
    const heroCopy = document.querySelector(".hero-copy");
    if (!heroCopy || heroCopy.querySelector(".hero-kpis")) return;
    const badges = heroCopy.querySelector(".hero-badges");
    if (badges) badges.remove();
    const stats = document.createElement("div");
    stats.className = "hero-kpis";
    stats.innerHTML = `
      <div class="hero-kpi"><strong>6</strong><span>готовых игр</span></div>
      <div class="hero-kpi"><strong>2</strong><span>игрока в комнате</span></div>
      <div class="hero-kpi"><strong>0</strong><span>регистраций</span></div>`;
    heroCopy.appendChild(stats);
  }

  function addHowItWorks() {
    const home = document.querySelector("#homeView");
    if (!home || document.querySelector("#howItWorks")) return;
    const section = document.createElement("section");
    section.id = "howItWorks";
    section.className = "portfolio-section page-enter";
    section.innerHTML = `
      <div class="portfolio-section-head">
        <div><div class="eyebrow">три действия до матча</div><h2>Никакого лаунчера. Никакой регистрации.</h2></div>
        <p>Duelink специально сделан так, чтобы второй человек мог быть хоть с телефона в другой стране. Нужна только ссылка.</p>
      </div>
      <div class="how-grid">
        <article class="how-card"><div class="how-number">01</div><h3>Выбери игру</h3><p>Введи ник и нажми на любую игру. Сервер сразу создаст приватную комнату.</p></article>
        <article class="how-card"><div class="how-number">02</div><h3>Отправь ссылку</h3><p>Друг открывает приглашение в обычном браузере на телефоне, планшете или компьютере.</p></article>
        <article class="how-card"><div class="how-number">03</div><h3>Играйте</h3><p>Ходы синхронизируются в реальном времени. Третьего игрока в приватную комнату сервер не пустит.</p></article>
      </div>`;
    home.appendChild(section);
  }

  function addTopNavigation() {
    const right = document.querySelector(".topbar-right");
    if (!right || document.querySelector(".topbar-nav")) return;
    const nav = document.createElement("nav");
    nav.className = "topbar-nav";
    nav.innerHTML = `<button type="button" data-scroll="games">Игры</button><button type="button" data-scroll="how">Как это работает</button>`;
    right.parentElement.insertBefore(nav, right);
    nav.querySelector('[data-scroll="games"]').addEventListener("click", () => document.querySelector(".catalog-card")?.scrollIntoView({behavior:"smooth", block:"start"}));
    nav.querySelector('[data-scroll="how"]').addEventListener("click", () => document.querySelector("#howItWorks")?.scrollIntoView({behavior:"smooth", block:"center"}));
  }

  async function shareRoom() {
    if (!window.currentRoom && typeof currentRoom === "undefined") return;
    const roomId = typeof currentRoom !== "undefined" ? currentRoom : window.currentRoom;
    if (!roomId) return;
    const url = `${location.origin}/room/${roomId}`;
    try {
      if (navigator.share) {
        await navigator.share({title:"Duelink", text:"Залетай в мою комнату в Duelink", url});
      } else {
        await navigator.clipboard.writeText(url);
        showToast("Ссылка скопирована");
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        try { await navigator.clipboard.writeText(url); showToast("Ссылка скопирована"); } catch {}
      }
    }
  }

  function addRoomActions() {
    const copy = document.querySelector("#copyBtn");
    if (!copy || document.querySelector(".room-sidebar-actions")) return;
    const actions = document.createElement("div");
    actions.className = "room-sidebar-actions";
    actions.innerHTML = `<button id="roomRulesBtn" class="secondary-action" type="button">? Правила</button><button id="roomShareBtn" class="secondary-action" type="button">↗ Поделиться</button>`;
    copy.insertAdjacentElement("afterend", actions);
    document.querySelector("#roomRulesBtn").addEventListener("click", () => {
      if (typeof currentGame !== "undefined" && currentGame) openGuide(currentGame, false);
    });
    document.querySelector("#roomShareBtn").addEventListener("click", shareRoom);
  }

  function addFloatingHelp() {
    if (document.querySelector("#roomHelpFab")) return;
    const button = document.createElement("button");
    button.id = "roomHelpFab";
    button.className = "room-help-fab hidden";
    button.type = "button";
    button.title = "Правила текущей игры";
    button.setAttribute("aria-label", "Открыть правила текущей игры");
    button.textContent = "?";
    button.addEventListener("click", () => {
      if (typeof currentGame !== "undefined" && currentGame) openGuide(currentGame, false);
    });
    document.body.appendChild(button);

    const roomView = document.querySelector("#roomView");
    const sync = () => button.classList.toggle("hidden", !roomView || roomView.classList.contains("hidden"));
    sync();
    if (roomView) new MutationObserver(sync).observe(roomView, {attributes:true, attributeFilter:["class"]});
  }

  function improveConnectionIndicator() {
    const text = document.querySelector("#connectionText");
    const pill = text?.closest(".connection-pill");
    if (!text || !pill) return;
    const sync = () => pill.classList.toggle("offline", text.textContent !== "Онлайн");
    sync();
    new MutationObserver(sync).observe(text, {childList:true, characterData:true, subtree:true});
  }

  function maybeAutoGuide(state) {
    if (!state?.game || !GAME_GUIDES[state.game]) return;
    const key = `duelink_guide_seen_${state.game}`;
    if (localStorage.getItem(key) === "1") return;
    if (document.querySelector("#gameGuideBackdrop:not(.hidden)")) return;
    setTimeout(() => {
      if (localStorage.getItem(key) !== "1") openGuide(state.game, true);
    }, 320);
  }

  function installRenderHook() {
    if (typeof renderGame !== "function" || renderGame.__portfolioWrapped) return;
    const original = renderGame;
    const wrapped = function(state) {
      original(state);
      maybeAutoGuide(state);
    };
    wrapped.__portfolioWrapped = true;
    renderGame = wrapped;
  }

  function addSubtleHaptics() {
    if (typeof move !== "function" || move.__portfolioHaptic) return;
    const original = move;
    const wrapped = function(payload) {
      if (navigator.vibrate) navigator.vibrate(12);
      return original(payload);
    };
    wrapped.__portfolioHaptic = true;
    move = wrapped;
  }

  function markEntrance() {
    [".hero-card", ".catalog-card", ".side-stack"].forEach((selector, index) => {
      const el = document.querySelector(selector);
      if (!el) return;
      el.classList.add("page-enter");
      el.style.animationDelay = `${index * 70}ms`;
    });
  }

  function init() {
    buildModal();
    enhanceGameCards();
    addHeroStats();
    addHowItWorks();
    addTopNavigation();
    addRoomActions();
    addFloatingHelp();
    improveConnectionIndicator();
    installRenderHook();
    addSubtleHaptics();
    markEntrance();
  }

  init();
})();

document.documentElement.classList.add('js-ready');

const modalBackdrop = document.querySelector('.market-modal-backdrop');
const modalCloseButton = document.querySelector('.market-modal__close');
const productCards = document.querySelectorAll('.market-card');

if (modalBackdrop) {
  const setModalOpen = (isOpen) => {
    modalBackdrop.hidden = !isOpen;
    modalBackdrop.style.display = isOpen ? 'flex' : 'none';
    modalBackdrop.setAttribute('aria-hidden', String(!isOpen));
    document.body.classList.toggle('modal-open', isOpen);
  };

  setModalOpen(false);

  modalCloseButton?.addEventListener('click', () => setModalOpen(false));

  productCards.forEach((card) => {
    card.addEventListener('click', () => setModalOpen(true));
  });

  modalBackdrop.addEventListener('click', (event) => {
    if (event.target === modalBackdrop) {
      setModalOpen(false);
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modalBackdrop.hidden) {
      setModalOpen(false);
    }
  });
}

const chatTabs = document.querySelectorAll('.chat-tab');
const chatPanels = document.querySelectorAll('.chat-panel');

chatTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.chatTab;

    chatTabs.forEach((item) => {
      const active = item === tab;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-selected', String(active));
    });

    chatPanels.forEach((panel) => {
      const active = panel.dataset.chatPanel === target;
      panel.classList.toggle('is-active', active);
    });
  });
});

const searchInput = document.querySelector('[data-search-input]');
const searchBtn = document.querySelector('[data-search-btn]');
const searchResult = document.querySelector('[data-search-result]');
const searchClear = document.querySelector('.chat-search-field__clear');

if (searchInput && searchBtn && searchResult && searchClear) {
  searchBtn.addEventListener('click', () => {
    const value = searchInput.value.trim();

    if (!value) {
      searchInput.focus();
      return;
    }

    searchResult.hidden = false;
    searchResult.classList.add('is-visible');
    searchResult.querySelector('[data-user-name]').setAttribute('data-user-id', value);
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchInput.focus();
  });
}

const conversationRow = document.querySelector('[data-open-conversation]');
const dialogPanel = document.querySelector('[data-chat-panel="dialog"]');
const generalPanel = document.querySelector('[data-chat-panel="general"]');
const searchPanel = document.querySelector('[data-chat-panel="search"]');
const dialogName = document.querySelector('[data-dialog-name]');
const dialogMeta = document.querySelector('[data-dialog-meta]');
const backButton = document.querySelector('.chat-dialog-header__back');

if (conversationRow && dialogPanel && generalPanel && searchPanel && dialogName && dialogMeta && backButton) {
  conversationRow.addEventListener('click', () => {
    const name = conversationRow.dataset.userName || 'Dima';
    const id = conversationRow.dataset.userId || '1847';
    const role = conversationRow.dataset.userRole || 'Администратор';

    dialogName.textContent = name;
    dialogMeta.textContent = `#${id} · ${role}`;

    generalPanel.classList.remove('is-active');
    searchPanel.classList.remove('is-active');
    dialogPanel.classList.add('is-active');

    const tabButtons = document.querySelectorAll('.chat-tab');
    tabButtons.forEach((tab) => {
      tab.classList.remove('is-active');
      tab.setAttribute('aria-selected', 'false');
    });
  });

  backButton.addEventListener('click', () => {
    dialogPanel.classList.remove('is-active');
    generalPanel.classList.add('is-active');

    const generalTab = document.querySelector('[data-chat-tab="general"]');
    if (generalTab) {
      generalTab.classList.add('is-active');
      generalTab.setAttribute('aria-selected', 'true');
    }
  });
}

const gameTabs = document.querySelectorAll('.game-tab');
const gameJobs = document.querySelectorAll('.job-card');
const playerLevel = 13;

const gameOrder = [
  'farm',
  'mine',
  'factory',
  'courier',
  'bus',
  'thief',
  'treasure',
  'fish',
  'garbage',
  'mechanic',
  'hunter',
  'gas',
  'pickup',
  'warehouse',
  'trucker',
  'electrician',
  'collector',
  'diver'
];

const gameMeta = {
  farm: { title: 'ФЕРМА', label: 'Сбор урожая', reward: 1200, xp: 18 },
  mine: { title: 'ШАХТА', label: 'Добыча руды', reward: 1350, xp: 18 },
  factory: { title: 'ЗАВОД', label: 'Сборка деталей', reward: 1500, xp: 22 },
  courier: { title: 'КУРЬЕР', label: 'Выбор маршрута', reward: 1800, xp: 24 },
  bus: { title: 'ВОДИТЕЛЬ АВТОБУСА', label: 'Удерживайте полосу', reward: 1850, xp: 26 },
  thief: { title: 'УГОНЩИК ТРАНСПОРТНЫХ СРЕДСТВ', label: 'Взлом системы', reward: 2200, xp: 30 },
  treasure: { title: 'КЛАДОИСКАТЕЛЬ', label: 'Поиск клада', reward: 2100, xp: 28 },
  fish: { title: 'РЫБАЛКА', label: 'Ловите рыбу', reward: 1700, xp: 24 },
  garbage: { title: 'ВОДИТЕЛЬ МУСОРОВОЗА', label: 'Сортировка мусора', reward: 1900, xp: 26 },
  mechanic: { title: 'АВТОМЕХАНИК', label: 'Ремонт автомобиля', reward: 2400, xp: 30 },
  hunter: { title: 'ОХОТНИК', label: 'Целься правильно', reward: 2100, xp: 28 },
  gas: { title: 'ГАЗОВЩИК', label: 'Соедините трубы', reward: 2600, xp: 34 },
  pickup: { title: 'КУРЬЕР ПВЗ', label: 'Сортировка посылок', reward: 2500, xp: 32 },
  warehouse: { title: 'СКЛАДСКОЙ РАБОТНИК', label: 'Сбор заказа', reward: 2800, xp: 36 },
  trucker: { title: 'ДАЛЬНОБОЙЩИК', label: 'Держите полосу', reward: 3200, xp: 42 },
  electrician: { title: 'ЭЛЕКТРИК', label: 'Подключите провода', reward: 3400, xp: 46 },
  collector: { title: 'ИНКАССАТОР', label: 'Доставка груза', reward: 3600, xp: 48 },
  diver: { title: 'ВОДОЛАЗ', label: 'Поиск объекта', reward: 3900, xp: 52 }
};

const gameView = document.getElementById('jobGameView');
const gameTitle = document.getElementById('gameTitle');
const gameInstruction = document.getElementById('gameInstruction');
const gameActions = document.getElementById('gameActions');
const gameArena = document.getElementById('gameArena');
const gameTimer = document.getElementById('gameTimer');
const gameBackButton = document.getElementById('gameBackButton');

const gameState = {
  currentKey: null,
  timer: 15,
  timerId: null,
  score: 0,
  attempts: 0,
  success: 0,
  failed: 0,
  active: null,
  result: null
};

function showListView() {
  if (!gameView) return;

  gameView.classList.add('is-hidden');
  gameArena.innerHTML = '';
  gameActions.innerHTML = '';
  gameState.currentKey = null;
  gameState.active = null;

  if (gameJobs.length) {
    gameJobs.forEach((job) => {
      job.style.display = '';
    });
  }
}

function showGameView() {
  if (!gameView) return;

  gameView.classList.remove('is-hidden');
  if (gameJobs.length) {
    gameJobs.forEach((job) => {
      job.style.display = 'none';
    });
  }
}

function updateTimerDisplay() {
  const sec = Math.max(0, gameState.timer);
  const mins = String(Math.floor(sec / 60)).padStart(2, '0');
  const secs = String(sec % 60).padStart(2, '0');
  gameTimer.textContent = `${mins}:${secs}`;
}

function beginTimer(duration) {
  if (gameState.timerId) {
    clearInterval(gameState.timerId);
  }

  gameState.timer = duration;
  updateTimerDisplay();

  gameState.timerId = setInterval(() => {
    if (!gameState.currentKey) {
      clearInterval(gameState.timerId);
      return;
    }

    gameState.timer -= 1;
    updateTimerDisplay();

    if (gameState.timer <= 0) {
      clearInterval(gameState.timerId);
      finishJob(false, 'Время вышло');
    }
  }, 1000);
}

function setInstruction(message) {
  if (gameInstruction) {
    gameInstruction.textContent = message;
  }
}

function getJobKeyByCard(card) {
  const index = [...gameJobs].indexOf(card);
  return gameOrder[index] || 'farm';
}

function getActiveJob() {
  return gameMeta[gameState.currentKey] || null;
}

function getRewardValue() {
  const job = getActiveJob();
  if (!job) return 0;
  return Math.max(1000, Math.round(job.reward * (gameState.success / Math.max(1, gameState.success + gameState.failed + 1))));
}

function buildResultScreen(successMessage, won) {
  const job = getActiveJob();
  const reward = getRewardValue();
  const xp = job ? job.xp : 18;
  const efficiency = gameState.success > 0 || gameState.failed > 0
    ? Math.max(10, Math.round((gameState.success / Math.max(1, gameState.success + gameState.failed)) * 100))
    : 0;

  gameArena.innerHTML = `
    <div class="result-screen">
      <div class="result-badge">${won ? 'УСПЕХ' : 'ПОПРОБУЙТЕ ЕЩЁ'}</div>
      <h3>${job ? job.title : 'РАБОТА'}</h3>
      <div class="result-stats">
        <div>
          <span>ЭФФЕКТИВНОСТЬ</span>
          <strong>${efficiency}%</strong>
        </div>
        <div>
          <span>СОБРАНО</span>
          <strong>${gameState.success}</strong>
        </div>
      </div>
      <div class="result-line">
        <span>НАГРАДА</span>
        <strong>+${reward.toLocaleString('ru-RU')} ₽</strong>
      </div>
      <div class="result-line result-line--muted">
        <span>XP</span>
        <strong>+${xp}</strong>
      </div>
    </div>
  `;

  gameInstruction.textContent = successMessage || 'Работа завершена.';
  gameActions.innerHTML = `
    <button class="game-action primary" type="button" data-action="repeat">ПОВТОРИТЬ</button>
    <button class="game-action" type="button" data-action="back">К РАБОТАМ</button>
  `;

  gameActions.querySelector('[data-action="repeat"]').addEventListener('click', () => startJobByKey(gameState.currentKey));
  gameActions.querySelector('[data-action="back"]').addEventListener('click', () => {
    clearInterval(gameState.timerId);
    showListView();
  });
}

function finishJob(won, reason) {
  if (!gameState.currentKey) return;

  clearInterval(gameState.timerId);
  gameState.result = { won, reason, efficiency: Math.max(10, Math.round((gameState.success / Math.max(1, gameState.success + gameState.failed)) * 100)) };
  buildResultScreen(reason, won);
}

function buildPlantArena() {
  const plants = [
    { ready: true, index: 0 },
    { ready: false, index: 1 },
    { ready: true, index: 2 },
    { ready: true, index: 3 },
    { ready: false, index: 4 },
    { ready: true, index: 5 }
  ];

  gameArena.innerHTML = `
    <div class="mini-scene mini-scene--farm">
      <div class="farm-scene">
        <div class="farm-sky"></div>
        <div class="farm-ground"></div>
        ${plants.map((plant, index) => `
          <button class="crop ${plant.ready ? 'is-ready' : ''}" type="button" data-index="${index}" aria-label="Растение ${index + 1}">
            <span class="crop-stem"></span>
            <span class="crop-leaf leaf-a"></span>
            <span class="crop-leaf leaf-b"></span>
            <span class="crop-fruit"></span>
          </button>
        `).join('')}
      </div>
    </div>
  `;

  gameArena.querySelectorAll('.crop').forEach((cell) => {
    cell.addEventListener('click', () => {
      const isReady = cell.classList.contains('is-ready');
      if (isReady) {
        gameState.success += 1;
        cell.classList.add('is-collected');
        cell.classList.remove('is-ready');
        setInstruction('Урожай собран.');
      } else {
        gameState.failed += 1;
        cell.classList.add('is-empty');
        setInstruction('Это поле уже собрано.');
      }

      if (gameState.success >= 4) {
        finishJob(true, 'Работа завершена');
      }
    });
  });
}

function buildMineArena() {
  gameArena.innerHTML = `
    <div class="mini-scene mini-scene--mine">
      <div class="mine-scene">
        <div class="mine-wall"></div>
        <div class="mine-lamp mine-lamp--left"></div>
        <div class="mine-lamp mine-lamp--right"></div>
        <div class="ore-grid">
          ${Array.from({ length: 6 }, (_, index) => `
            <button class="ore-node" type="button" data-index="${index}" aria-label="Руда ${index + 1}">
              <span class="ore-core"></span>
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  gameArena.querySelectorAll('.ore-node').forEach((node) => {
    node.addEventListener('click', () => {
      if (node.classList.contains('is-hit')) {
        gameState.failed += 1;
        setInstruction('Залежь уже пробита.');
        return;
      }

      node.classList.add('is-hit');
      gameState.success += 1;
      setInstruction('Руда добыта.');

      if (gameState.success >= 4) {
        finishJob(true, 'Залежи исчерпаны');
      }
    });
  });
}

function buildFactoryArena() {
  gameArena.innerHTML = `
    <div class="mini-scene mini-scene--factory">
      <div class="factory-scene">
        <div class="factory-belt"></div>
        <div class="factory-parts">
          <button class="part-chip part-chip--a" type="button" data-part="a">A</button>
          <button class="part-chip part-chip--b" type="button" data-part="b">B</button>
          <button class="part-chip part-chip--c" type="button" data-part="c">C</button>
        </div>
        <div class="assembly-box">
          <div class="assembly-slot" data-slot="a">A</div>
          <div class="assembly-slot" data-slot="b">B</div>
          <div class="assembly-slot" data-slot="c">C</div>
        </div>
      </div>
    </div>
  `;

  const sequence = ['a', 'b', 'c'];
  const selected = [];

  gameArena.querySelectorAll('.part-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const part = chip.dataset.part;
      selected.push(part);
      const matchIndex = selected.length - 1;
      const expected = sequence[matchIndex];

      if (part === expected) {
        gameState.success += 1;
        const slot = gameArena.querySelector(`[data-slot="${part}"]`);
        slot.classList.add('is-filled');
        setInstruction('Деталь установлена.');
      } else {
        gameState.failed += 1;
        setInstruction('Неверная деталь.');
      }

      if (gameState.success >= 3) {
        finishJob(true, 'Линия запущена');
      }
    });
  });
}

function buildCourierArena() {
  gameArena.innerHTML = `
    <div class="mini-scene mini-scene--courier">
      <div class="city-map">
        <div class="map-road map-road--horizontal"></div>
        <div class="map-road map-road--vertical"></div>
        <div class="map-block map-block--1"></div>
        <div class="map-block map-block--2"></div>
        <div class="map-block map-block--3"></div>
        <button class="route-point route-point--start" type="button" data-route="start">Склад</button>
        <button class="route-point route-point--target" type="button" data-route="target">Клиент</button>
        <button class="route-path route-path--safe" type="button" data-route="safe">Маршрут</button>
        <button class="route-path route-path--fast" type="button" data-route="fast">Скоростной</button>
      </div>
    </div>
  `;

  gameArena.querySelectorAll('.route-path').forEach((route) => {
    route.addEventListener('click', () => {
      const safe = route.dataset.route === 'safe';
      if (safe) {
        gameState.success += 1;
        setInstruction('Маршрут выбран: безопасный.');
      } else {
        gameState.failed += 1;
        setInstruction('Скоростной маршрут рискован.');
      }
      finishJob(safe, safe ? 'Доставка подтверждена' : 'Маршрут отменён');
    });
  });
}

function buildBusArena() {
  gameArena.innerHTML = `
    <div class="mini-scene mini-scene--bus">
      <div class="bus-road" id="busRoad">
        <div class="road-traffic road-traffic--left"></div>
        <div class="road-traffic road-traffic--right"></div>
        <div class="bus-vehicle" id="busVehicle">
          <span class="bus-window"></span>
          <span class="bus-door"></span>
        </div>
      </div>
    </div>
  `;

  const busRoad = document.getElementById('busRoad');
  const busVehicle = document.getElementById('busVehicle');
  let x = 42;
  let holdTimer = null;

  const moveBus = (direction) => {
    x += direction * 12;
    x = Math.max(16, Math.min(72, x));
    busVehicle.style.left = `${x}%`;

    const safe = x >= 34 && x <= 58;
    if (safe) {
      gameState.success += 1;
      setInstruction('Полоса удержана.');
    } else {
      gameState.failed += 1;
      setInstruction('Двигались слишком близко к препятствиям.');
    }

    if (gameState.success >= 5) {
      finishJob(true, 'Маршрут завершён');
    }
  };

  busRoad.addEventListener('pointerdown', () => {
    holdTimer = setInterval(() => moveBus(1), 180);
  });

  busRoad.addEventListener('pointerup', () => {
    clearInterval(holdTimer);
  });

  busRoad.addEventListener('pointerleave', () => {
    clearInterval(holdTimer);
  });

  busRoad.addEventListener('click', (event) => {
    const rect = busRoad.getBoundingClientRect();
    const percent = ((event.clientX - rect.left) / rect.width) * 100;
    const direction = percent > 50 ? 1 : -1;
    moveBus(direction);
  });
}

function buildVehicleArena() {
  gameArena.innerHTML = `
    <div class="mini-scene mini-scene--vehicle">
      <div class="vehicle-panel">
        <div class="vehicle-panel__header">
          <span>LOCK</span>
          <span class="panel-led"></span>
        </div>
        <div class="vehicle-console">
          <button class="control-node control-node--1" type="button" data-node="1">1</button>
          <button class="control-node control-node--2" type="button" data-node="2">2</button>
          <button class="control-node control-node--3" type="button" data-node="3">3</button>
          <button class="control-node control-node--4" type="button" data-node="4">4</button>
        </div>
        <div class="vehicle-car">
          <span class="car-body"></span>
          <span class="car-wheel wheel--front"></span>
          <span class="car-wheel wheel--rear"></span>
        </div>
      </div>
    </div>
  `;

  const sequence = ['1', '3', '2'];
  let step = 0;

  gameArena.querySelectorAll('.control-node').forEach((button) => {
    button.addEventListener('click', () => {
      const val = button.dataset.node;
      if (val === sequence[step]) {
        gameState.success += 1;
        step += 1;
        button.classList.add('is-activated');
        setInstruction('Система распознана.');
        if (step >= sequence.length) {
          finishJob(true, 'Авто запущено');
        }
      } else {
        gameState.failed += 1;
        setInstruction('Неверный ключ.');
        finishJob(false, 'Система не распознана');
      }
    });
  });
}

function buildTimingArena(label, targetMin, targetMax, buttonLabel) {
  gameArena.innerHTML = `
    <div class="mini-game mini-game--timing">
      <div class="timing-track">
        <div class="timing-zone" style="left:${targetMin}%; width:${targetMax - targetMin}%"></div>
        <div id="timingIndicator" class="timing-indicator"></div>
      </div>
      <button class="timing-hit" type="button">${buttonLabel}</button>
    </div>
  `;

  const indicator = document.getElementById('timingIndicator');
  let pos = 8;
  let dir = 1;

  const tick = () => {
    pos += dir * 2.2;
    if (pos >= 92 || pos <= 6) dir *= -1;
    indicator.style.left = `${pos}%`;
  };

  const interval = setInterval(tick, 90);

  gameArena.querySelector('.timing-hit').addEventListener('click', () => {
    const value = Number.parseFloat(indicator.style.left || '8%');
    const hit = value >= targetMin && value <= targetMax;
    if (hit) {
      gameState.success += 1;
      setInstruction('Точный удар.');
    } else {
      gameState.failed += 1;
      setInstruction('Слишком рано или поздно.');
    }

    if (gameState.success + gameState.failed >= 4) {
      clearInterval(interval);
      finishJob(true, 'Результат подсчитан');
    }
  });
}

function buildSequenceArena(sequence) {
  gameArena.innerHTML = `
    <div class="mini-game mini-game--sequence">
      <div class="sequence-row">
        ${sequence.map((n, index) => `<button class="sequence-btn" type="button" data-seq="${index}">${n}</button>`).join('')}
      </div>
    </div>
  `;

  let currentStep = 0;
  gameArena.querySelectorAll('.sequence-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const expected = currentStep + 1;
      const clicked = Number(button.textContent.trim());
      if (clicked === expected) {
        gameState.success += 1;
        button.classList.add('is-hit');
        currentStep += 1;
        setInstruction('Правильная последовательность.');
        if (currentStep >= sequence.length) {
          finishJob(true, 'Производство завершено');
        }
      } else {
        gameState.failed += 1;
        button.classList.add('is-miss');
        setInstruction('Ошибка. Повторите порядок.');
      }
    });
  });
}

function buildChoiceButtons(options, correctIndex) {
  gameArena.innerHTML = `
    <div class="mini-game mini-game--choices">
      ${options.map((label, index) => `<button class="route-btn" type="button" data-index="${index}">${label}</button>`).join('')}
    </div>
  `;

  gameArena.querySelectorAll('.route-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const selected = Number(button.dataset.index);
      if (selected === correctIndex) {
        gameState.success += 1;
        setInstruction('Оптимальный маршрут выбран.');
        finishJob(true, 'Маршрут подтверждён');
      } else {
        gameState.failed += 1;
        setInstruction('Маршрут не оптимален.');
        finishJob(false, 'Неудачный маршрут');
      }
    });
  });
}

function buildHoldArena() {
  gameArena.innerHTML = `
    <div class="mini-game mini-game--hold">
      <div class="hold-track">
        <div class="hold-zone"></div>
        <div id="holdMarker" class="hold-marker"></div>
      </div>
      <button id="holdBtn" class="hold-btn" type="button">УДЕРЖИВАТЬ</button>
    </div>
  `;

  const marker = document.getElementById('holdMarker');
  const button = document.getElementById('holdBtn');
  let active = false;
  let x = 52;

  const move = () => {
    if (!active) return;
    x += (Math.random() > 0.5 ? 1 : -1) * 5;
    x = Math.min(88, Math.max(12, x));
    marker.style.left = `${x}%`;
    const inZone = x >= 36 && x <= 64;
    if (inZone) {
      gameState.success += 1;
      setInstruction('Полоса удержана.');
    }
    if (gameState.success >= 8) {
      finishJob(true, 'Полоса удержана');
    }
  };

  button.addEventListener('pointerdown', () => {
    active = true;
    setInstruction('Удерживайте индикатор в зоне.');
    const holdTimer = setInterval(move, 150);
    button.addEventListener('pointerup', () => {
      active = false;
      clearInterval(holdTimer);
      if (gameState.success < 2) {
        gameState.failed += 1;
      }
    }, { once: true });
  });
}

function buildSequenceButtons(sequence) {
  gameArena.innerHTML = `
    <div class="mini-game mini-game--quicktime">
      <div class="quicktime-row">
        ${sequence.map((label) => `<button class="sequence-key" type="button">${label}</button>`).join('')}
      </div>
    </div>
  `;

  let idx = 0;
  gameArena.querySelectorAll('.sequence-key').forEach((button) => {
    button.addEventListener('click', () => {
      const expected = sequence[idx];
      const clicked = button.textContent.trim();
      if (clicked === expected) {
        idx += 1;
        gameState.success += 1;
        button.classList.add('is-hit');
        if (idx >= sequence.length) {
          finishJob(true, 'Система вскрыта');
        }
      } else {
        gameState.failed += 1;
        setInstruction('Неверная последовательность.');
        finishJob(false, 'Сбой');
      }
    });
  });
}

function buildTreasureGrid() {
  const cells = Array.from({ length: 9 }, (_, index) => `<button class="treasure-cell" type="button" data-index="${index}"></button>`).join('');
  gameArena.innerHTML = `<div class="mini-game mini-game--treasure">${cells}</div>`;

  const treasureIndex = Math.floor(Math.random() * 9);
  let attempts = 0;

  gameArena.querySelectorAll('.treasure-cell').forEach((cell) => {
    cell.addEventListener('click', () => {
      attempts += 1;
      const index = Number(cell.dataset.index);
      if (index === treasureIndex) {
        gameState.success += 1;
        cell.classList.add('is-hit');
        setInstruction('Клад найден.');
        finishJob(true, 'Клад найден');
      } else {
        gameState.failed += 1;
        cell.classList.add('is-miss');
        setInstruction('Мимо. Осталось попыток: ' + (3 - attempts));
        if (attempts >= 3) {
          finishJob(false, 'Попытки закончились');
        }
      }
    });
  });
}

function buildGridSort(type) {
  const bins = type === 'garbage'
    ? ['ПЛАСТИК', 'БУМАГА', 'ОРГАНИКА']
    : ['A1', 'A2', 'A3'];

  const items = type === 'garbage'
    ? ['Бутылка', 'Коробка', 'Банка']
    : ['A1', 'A2', 'A3'];

  gameArena.innerHTML = `
    <div class="mini-game mini-game--sort">
      <div class="sort-items">
        ${items.map((item) => `<button class="sort-item" type="button">${item}</button>`).join('')}
      </div>
      <div class="sort-bins">
        ${bins.map((bin) => `<button class="sort-bin" type="button">${bin}</button>`).join('')}
      </div>
    </div>
  `;

  const selected = { item: null };
  gameArena.querySelectorAll('.sort-item').forEach((button) => {
    button.addEventListener('click', () => {
      selected.item = button.textContent.trim();
      button.classList.add('is-selected');
      setInstruction('Выберите контейнер.');
    });
  });

  gameArena.querySelectorAll('.sort-bin').forEach((button) => {
    button.addEventListener('click', () => {
      if (!selected.item) {
        return;
      }
      const valid = selected.item.includes(button.textContent.trim()) || button.textContent.trim() === 'ПЛАСТИК' && selected.item === 'Бутылка';
      if (valid) {
        gameState.success += 1;
        setInstruction('Правильно распределено.');
      } else {
        gameState.failed += 1;
        setInstruction('Неверный контейнер.');
      }
      if (gameState.success >= 3) {
        finishJob(true, 'Сортировка завершена');
      }
    });
  });
}

function buildChecklist(items) {
  gameArena.innerHTML = `
    <div class="mini-game mini-game--checklist">
      ${items.map((item, index) => `<button class="check-item" type="button" data-index="${index}">${item}</button>`).join('')}
    </div>
  `;

  let step = 0;
  gameArena.querySelectorAll('.check-item').forEach((button) => {
    button.addEventListener('click', () => {
      const clicked = Number(button.dataset.index);
      if (clicked === step) {
        gameState.success += 1;
        button.classList.add('is-hit');
        step += 1;
        setInstruction('Шаг выполнен.');
        if (step >= items.length) {
          finishJob(true, 'Проверка завершена');
        }
      } else {
        gameState.failed += 1;
        setInstruction('Сначала выполните предыдущий шаг.');
      }
    });
  });
}

function buildTargetArena() {
  gameArena.innerHTML = `
    <div class="mini-game mini-game--target">
      <div class="target-field"></div>
    </div>
  `;

  const field = gameArena.querySelector('.target-field');
  for (let i = 0; i < 6; i += 1) {
    const target = document.createElement('button');
    target.type = 'button';
    target.className = 'target-bullet';
    target.style.left = `${10 + Math.random() * 75}%`;
    target.style.top = `${15 + Math.random() * 60}%`;
    target.addEventListener('click', () => {
      gameState.success += 1;
      target.remove();
      setInstruction('Точное попадание.');
      if (gameState.success >= 4) {
        finishJob(true, 'Цель поражена');
      }
    });
    field.appendChild(target);
  }
}

function buildPipeArena() {
  const cells = Array.from({ length: 6 }, (_, index) => `<button class="pipe-segment" type="button" data-index="${index}">${index + 1}</button>`).join('');
  gameArena.innerHTML = `<div class="mini-game mini-game--pipes">${cells}</div>`;

  gameArena.querySelectorAll('.pipe-segment').forEach((button) => {
    button.addEventListener('click', () => {
      const next = Number(button.textContent.trim()) % 4;
      button.textContent = next === 0 ? 4 : next;
      gameState.success += 1;
      if (gameState.success >= 4) {
        finishJob(true, 'Трубопровод восстановлен');
      }
    });
  });
}

function buildDriveArena() {
  gameArena.innerHTML = `
    <div class="mini-game mini-game--drive">
      <div class="drive-road">
        <div class="drive-truck"></div>
      </div>
      <div class="drive-controls">
        <button class="drive-btn" type="button" data-dir="left">←</button>
        <button class="drive-btn" type="button" data-dir="right">→</button>
      </div>
    </div>
  `;

  const truck = gameArena.querySelector('.drive-truck');
  let offset = 50;

  gameArena.querySelectorAll('.drive-btn').forEach((button) => {
    button.addEventListener('click', () => {
      offset += button.dataset.dir === 'left' ? -10 : 10;
      offset = Math.min(82, Math.max(18, offset));
      truck.style.left = `${offset}%`;
      if (offset >= 68 || offset <= 32) {
        gameState.failed += 1;
      } else {
        gameState.success += 1;
      }
      if (gameState.success >= 6) {
        finishJob(true, 'Дорога пройдена');
      }
    });
  });
}

function buildWireArena() {
  const left = ['L1', 'L2', 'L3'];
  const right = ['R1', 'R2', 'R3'];
  gameArena.innerHTML = `
    <div class="mini-game mini-game--wire">
      <div class="wire-side">${left.map((item) => `<button class="wire-node" type="button">${item}</button>`).join('')}</div>
      <div class="wire-side">${right.map((item) => `<button class="wire-node" type="button">${item}</button>`).join('')}</div>
    </div>
  `;

  let start = null;
  gameArena.querySelectorAll('.wire-node').forEach((button) => {
    button.addEventListener('click', () => {
      if (start === null) {
        start = button;
        button.classList.add('is-selected');
      } else {
        const success = start.textContent.trim() !== button.textContent.trim();
        if (success) {
          gameState.success += 1;
          setInstruction('Соединение установлено.');
        } else {
          gameState.failed += 1;
        }
        start.classList.remove('is-selected');
        start = null;
        if (gameState.success >= 3) {
          finishJob(true, 'Сеть подключена');
        }
      }
    });
  });
}

function buildEventChoice() {
  gameArena.innerHTML = `
    <div class="mini-game mini-game--event">
      <button class="event-btn" type="button" data-choice="secure">ПРОВЕРИТЬ МАРШРУТ</button>
      <button class="event-btn" type="button" data-choice="risk">ПРИНЯТЬ РИСК</button>
      <button class="event-btn" type="button" data-choice="safe">ДОСТАВИТЬ</button>
    </div>
  `;

  gameArena.querySelectorAll('.event-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const choice = button.dataset.choice;
      if (choice === 'secure') {
        gameState.success += 1;
        finishJob(true, 'Маршрут подтверждён');
      } else {
        gameState.failed += 1;
        finishJob(false, 'Выбор оказался рискованным');
      }
    });
  });
}

function buildDiverGame() {
  const cells = Array.from({ length: 9 }, (_, index) => `<button class="diver-cell" type="button" data-index="${index}"></button>`).join('');
  gameArena.innerHTML = `<div class="mini-game mini-game--diver">${cells}</div>`;
  const targetIndex = Math.floor(Math.random() * 9);
  let oxygen = 100;

  gameArena.querySelectorAll('.diver-cell').forEach((cell) => {
    cell.addEventListener('click', () => {
      const index = Number(cell.dataset.index);
      oxygen = Math.max(10, oxygen - 13);
      if (index === targetIndex) {
        gameState.success += 1;
        setInstruction('Объект найден.');
        finishJob(true, 'Объект найден');
      } else if (oxygen <= 10) {
        finishJob(false, 'Кислород закончился');
      } else {
        setInstruction(`O₂ ${oxygen}%`);
      }
    });
  });
}

function startJobByKey(key) {
  const job = gameMeta[key];
  if (!job) return;

  gameState.currentKey = key;
  gameState.score = 0;
  gameState.success = 0;
  gameState.failed = 0;
  gameState.result = null;
  gameTitle.textContent = job.title;
  showGameView();
  setInstruction(job.label);
  gameActions.innerHTML = '';
  beginTimer(15);

  switch (key) {
    case 'farm':
      buildPlantArena();
      break;
    case 'mine':
      buildTimingArena('Поймай момент', 38, 62, 'УДАР');
      break;
    case 'factory':
      buildSequenceArena([1, 2, 3, 4]);
      break;
    case 'courier':
      buildChoiceButtons(['Склад → Центр → Клиент', 'Склад → Переезд → Клиент', 'Склад → Мост → Клиент'], 0);
      break;
    case 'bus':
      buildHoldArena();
      break;
    case 'thief':
      buildSequenceButtons(['A', 'B', 'A', 'C']);
      break;
    case 'treasure':
      buildTreasureGrid();
      break;
    case 'fish':
      buildTimingArena('Поймай рыбу', 44, 60, 'ПОПЫТКА');
      break;
    case 'garbage':
      buildGridSort('garbage');
      break;
    case 'mechanic':
      buildChecklist(['Диагностика', 'Замена детали', 'Установка', 'Проверка']);
      break;
    case 'hunter':
      buildTargetArena();
      break;
    case 'gas':
      buildPipeArena();
      break;
    case 'pickup':
      buildGridSort('pickup');
      break;
    case 'warehouse':
      buildChecklist(['Коробка', 'Деталь', 'Инструмент']);
      break;
    case 'trucker':
      buildDriveArena();
      break;
    case 'electrician':
      buildWireArena();
      break;
    case 'collector':
      buildEventChoice();
      break;
    case 'diver':
      buildDiverGame();
      break;
    default:
      break;
  }
}

if (gameTabs.length && gameJobs.length) {
  const updateGameJobs = (filter) => {
    gameJobs.forEach((job) => {
      const level = Number(job.dataset.level || 0);
      const isAvailable = level <= playerLevel;
      const isSoon = !isAvailable;
      const isHighIncome = job.dataset.income === 'high';

      let shouldShow = true;

      if (filter === 'available') {
        shouldShow = isAvailable;
      }

      if (filter === 'soon') {
        shouldShow = isSoon;
      }

      if (filter === 'high') {
        shouldShow = isHighIncome;
      }

      job.style.display = shouldShow ? '' : 'none';
    });
  };

  gameTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const filter = tab.dataset.gameFilter || 'all';
      gameTabs.forEach((item) => item.classList.toggle('is-active', item === tab));
      updateGameJobs(filter);
    });
  });

  updateGameJobs('all');
}

if (gameJobs.length) {
  gameJobs.forEach((job) => {
    const button = job.querySelector('.job-card__cta');
    if (!button) return;

    button.addEventListener('click', () => {
      const key = getJobKeyByCard(job);
      if (key && button.disabled !== true) {
        startJobByKey(key);
      }
    });
  });
}

if (gameBackButton) {
  gameBackButton.addEventListener('click', () => {
    clearInterval(gameState.timerId);
    showListView();
  });
}

if (gameActions) {
  gameActions.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]');
    if (!action) return;

    if (action.dataset.action === 'repeat') {
      startJobByKey(gameState.currentKey);
    }

    if (action.dataset.action === 'back') {
      clearInterval(gameState.timerId);
      showListView();
    }
  });
}

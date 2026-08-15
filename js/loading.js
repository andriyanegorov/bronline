const LoadingManager = (() => {
  const state = {
    isStarted: false,
    isFinished: false,
    currentProgress: 0,
    currentStatus: 'Подключение к серверу...',
  };

  let root = null;
  let logo = null;
  let status = null;
  let bar = null;
  let fill = null;
  let percent = null;

  const getElements = () => {
    if (!root) {
      root = document.getElementById('loading-screen');
      logo = document.querySelector('#loading-screen .loading-logo');
      status = document.querySelector('#loading-screen .loading-status');
      bar = document.querySelector('#loading-screen .loading-bar');
      fill = document.querySelector('#loading-screen .loading-bar__fill');
      percent = document.querySelector('#loading-screen .loading-percent');
    }
    return { root, logo, status, bar, fill, percent };
  };

  const updateProgress = (value) => {
    const { fill, percent } = getElements();
    if (!fill || !percent) return;

    const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
    state.currentProgress = safeValue;
    fill.style.width = `${safeValue}%`;
    percent.textContent = `${Math.round(safeValue)}%`;
  };

  const updateStatus = (nextStatus) => {
    const { status } = getElements();
    if (!status) return;

    state.currentStatus = nextStatus || state.currentStatus;

    status.classList.remove('is-visible');
    status.classList.add('is-hiding');

    window.setTimeout(() => {
      status.textContent = state.currentStatus;
      status.classList.remove('is-hiding');
      window.setTimeout(() => status.classList.add('is-visible'), 40);
    }, 180);
  };

  const start = () => {
    const { root, logo, status, fill, percent } = getElements();
    if (!root || !status || !fill || !percent) return;

    state.isStarted = true;
    state.isFinished = false;

    root.style.display = 'flex';
    root.classList.remove('is-hidden');
    root.setAttribute('aria-hidden', 'false');

    if (logo) {
      logo.style.opacity = '0';
      logo.style.transform = 'scale(0.96)';
      window.setTimeout(() => {
        logo.style.transition = 'opacity 800ms ease, transform 800ms ease';
        logo.style.opacity = '1';
        logo.style.transform = 'scale(1)';
      }, 40);
    }

    status.classList.remove('is-visible', 'is-hiding');
    status.textContent = 'Подключение к серверу...';
    status.classList.add('is-visible');

    fill.style.width = '0%';
    percent.textContent = '0%';
    state.currentProgress = 0;
  };

  const finish = () => {
    const { root, logo, status, fill, percent } = getElements();
    if (!root) return;

    updateProgress(100);
    updateStatus('Добро пожаловать');

    if (logo) {
      logo.style.transform = 'scale(1.03)';
      logo.style.opacity = '1';
    }

    window.setTimeout(() => {
      root.classList.add('is-hidden');
      root.setAttribute('aria-hidden', 'true');
      window.setTimeout(() => {
        if (root) root.style.display = 'none';
      }, 700);
    }, 500);

    state.isFinished = true;
    state.isStarted = false;

    if (fill) fill.style.transition = 'width 550ms ease';
    if (percent) percent.textContent = '100%';
    if (status) status.classList.add('is-visible');
  };

  return {
    start,
    updateStatus,
    updateProgress,
    finish,
    get currentProgress() {
      return state.currentProgress;
    },
    get currentStatus() {
      return state.currentStatus;
    },
  };
})();

if (typeof window !== 'undefined') {
  window.LoadingManager = LoadingManager;
}

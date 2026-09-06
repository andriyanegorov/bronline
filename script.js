// JavaScript для Telegram Mini-App

(function() {

const SUPABASE_CONFIG = {
    url: 'https://kvtosrmtuhqsoimfbicw.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2dG9zcm10dWhxc29pbWZiaWN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NTkxNDAsImV4cCI6MjEwNDAzNTE0MH0.3WP0FB4tT0uecJyHpwUQ1PjOWEta8zcsX8b4_hv7ads'
};

const supabase = window.supabase && SUPABASE_CONFIG.url && SUPABASE_CONFIG.url !== 'PASTE_SUPABASE_URL_HERE'
    ? window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey)
    : null;
let currentProfileId = null;

if (!supabase) {
    console.warn('Supabase not connected yet. Paste URL and anon key into SUPABASE_CONFIG in script.js');
}

function getTelegramUser() {
    const telegramApp = window.Telegram && window.Telegram.WebApp;
    return telegramApp && telegramApp.initDataUnsafe && telegramApp.initDataUnsafe.user
        ? telegramApp.initDataUnsafe.user
        : null;
}

function normalizeTelegramName(user) {
    if (!user) return 'Player';
    if (user.username) return user.username;
    const parts = [user.first_name, user.last_name].filter(Boolean);
    return parts.length ? parts.join(' ') : `player_${user.id || 'anon'}`;
}

function getTelegramAvatar(user) {
    if (!user) return './data/assets/profile.png';
    return user.photo_url || './data/assets/profile.png';
}

function safeText(element, value, fallback = 'Player') {
    if (!element) return;
    element.textContent = value || fallback;
}

function applyTelegramProfileToUI(user) {
    if (!user) return;

    const headerName = document.querySelector('.player-name');
    const headerStatus = document.querySelector('.player-status');
    const headerAvatar = document.querySelector('.header .avatar img');
    const balanceAmount = document.querySelector('.balance-amount');
    const profileName = document.querySelector('.profile-player-name');
    const profileAvatar = document.querySelector('.profile-avatar-circle img');
    const profileBadge = document.querySelector('.profile-premium-badge');
    const profileStatusText = document.querySelector('.profile-rating span:last-child');
    const profileAvatarGlow = document.querySelector('.profile-avatar-glow');
    const profileElements = document.querySelectorAll('.win-player-name, .seller-name, .top-player-name, .top-list-player-name');
    const avatarElements = document.querySelectorAll('.win-avatar, .shop-item-seller img, .top-list-avatar img');

    const displayName = normalizeTelegramName(user);
    const avatarUrl = getTelegramAvatar(user);

    safeText(headerName, displayName);
    safeText(headerStatus, user.is_bot ? 'Bot account' : 'Обычный игрок');
    if (balanceAmount) {
        balanceAmount.textContent = balanceAmount.textContent && Number(balanceAmount.textContent.replace(/\s+/g, '')) ? balanceAmount.textContent : '0';
    }
    if (headerAvatar) {
        headerAvatar.src = avatarUrl;
        headerAvatar.alt = displayName;
    }

    profileElements.forEach(element => {
        element.textContent = displayName;
    });

    avatarElements.forEach(element => {
        element.src = avatarUrl;
        element.alt = displayName;
    });

    if (profileName) {
        profileName.textContent = displayName;
    }

    if (profileAvatar) {
        profileAvatar.src = avatarUrl;
        profileAvatar.alt = displayName;
    }

    if (profileBadge) {
        profileBadge.textContent = user.is_premium ? 'PREMIUM' : 'PLAYER';
    }

    if (profileStatusText) {
        profileStatusText.textContent = 'Онлайн';
    }

    if (profileAvatarGlow) {
        profileAvatarGlow.style.boxShadow = user.is_premium
            ? '0 0 22px rgba(255, 187, 0, 0.4)'
            : '0 0 18px rgba(255, 255, 255, 0.15)';
    }
}

async function syncTelegramProfileToSupabase(user) {
    if (!supabase) {
        console.error('Профиль не сохранен: Supabase SDK или конфигурация недоступны.');
        return;
    }

    if (!user) {
        console.error('Профиль не сохранен: Telegram user не найден. Откройте приложение через Telegram Mini App, а не через обычную ссылку.');
        return;
    }

    const telegramId = Number(user.id);
    const username = normalizeTelegramName(user);
    const avatarUrl = getTelegramAvatar(user);

    try {
        const { data: existingProfile, error: selectError } = await supabase
            .from('profiles')
            .select('id, balance, username')
            .eq('telegram_id', telegramId)
            .maybeSingle();

        if (selectError) {
            console.error('Supabase не прочитал профиль:', {
                code: selectError.code,
                message: selectError.message,
                details: selectError.details,
                hint: selectError.hint
            });
            return;
        }

        const profileData = {
            avatar_url: avatarUrl,
            first_name: user.first_name || null,
            last_name: user.last_name || null,
            premium: Boolean(user.is_premium),
            updated_at: new Date().toISOString()
        };

        let saveResult;
        if (existingProfile) {
            currentProfileId = existingProfile.id;
            saveResult = await supabase
                .from('profiles')
                .update(profileData)
                .eq('telegram_id', telegramId);
        } else {
            saveResult = await supabase
                .from('profiles')
                .insert({
                    telegram_id: telegramId,
                    username,
                    balance: 0,
                    ...profileData,
                    created_at: new Date().toISOString()
                })
                .select('id')
                .single();
            currentProfileId = saveResult.data?.id || null;
        }

        if (saveResult.error) {
            console.error('Supabase не сохранил профиль:', {
                code: saveResult.error.code,
                message: saveResult.error.message,
                details: saveResult.error.details,
                hint: saveResult.error.hint
            });
            return;
        }

        const balanceAmount = document.querySelector('.balance-amount');
        if (balanceAmount) {
            balanceAmount.textContent = Number(existingProfile ? existingProfile.balance || 0 : 0).toLocaleString('ru-RU');
        }
        console.log('Профиль Telegram успешно сохранен:', telegramId, existingProfile ? '(ник из Supabase сохранен)' : '(создан)');
    } catch (error) {
        console.error('syncTelegramProfileToSupabase failed:', error);
    }
}

async function loadCurrentUserProfile() {
    const telegramUser = getTelegramUser();
    if (!supabase || !telegramUser) return;

    const telegramId = Number(telegramUser.id);

    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, balance, username, avatar_url, premium')
            .eq('telegram_id', telegramId)
            .maybeSingle();

        if (error) {
            console.error('Supabase load profile error:', error);
            return;
        }

        currentProfileId = data?.id || currentProfileId;

        const balanceAmount = document.querySelector('.balance-amount');
        if (data && balanceAmount) {
            balanceAmount.textContent = Number(data.balance || 0).toLocaleString('ru-RU');
        }

        if (data && data.username) {
            const displayName = data.username;
            document.querySelectorAll('.player-name, .profile-player-name, .win-player-name, .seller-name, .top-player-name, .top-list-player-name').forEach(element => {
                element.textContent = displayName;
            });

            const avatarUrl = data.avatar_url || getTelegramAvatar(telegramUser);
            document.querySelectorAll('.header .avatar img, .profile-avatar-circle img, .win-avatar, .shop-item-seller img, .top-list-avatar img').forEach(element => {
                element.src = avatarUrl;
                element.alt = displayName;
            });
        }
    } catch (error) {
        console.error('loadCurrentUserProfile failed:', error);
    }
}

function inventoryRarityClass(rarity) {
    return ({ mythical: 'red', legendary: 'gold', epic: 'purple', rare: 'blue', uncommon: 'green', common: 'deepblue' })[rarity] || 'deepblue';
}

function renderInventory(items) {
    const container = document.querySelector('.profile-collection-grid');
    if (!container) return;
    if (!items?.length) {
        container.innerHTML = '<p class="profile-inventory-status">Инвентарь пока пуст</p>';
        return;
    }
    const rarityNames = { common: 'ШИРП', uncommon: 'ОБЫЧНЫЙ', rare: 'РЕДКИЙ', epic: 'ЭПИЧНЫЙ', legendary: 'ЗОЛОТОЙ', mythical: 'КРАСНЫЙ' };
    container.innerHTML = items.map(item => `<article class="profile-item-card profile-item-card--${inventoryRarityClass(item.rarity)}"><button class="profile-item-sell" type="button" aria-label="Продать предмет"><img src="./data/assets/sell.svg" alt="Продать" class="profile-item-sell-icon"></button><div class="profile-item-price"><span>${Number(item.item_value || 0).toLocaleString('ru-RU')}</span><span class="profile-item-coin">◌</span></div><div class="profile-item-visual profile-item-visual--${inventoryRarityClass(item.rarity)}"><img src="${item.image_url || './data/assets/items/m5f90.png'}" alt="${item.item_name || 'Предмет'}" class="profile-item-image"></div><div class="profile-item-info"><div class="profile-item-name">${item.item_name || 'Без названия'}</div><span class="profile-item-badge rarity-badge ${item.rarity || 'common'}">${rarityNames[item.rarity] || item.rarity || 'ПРЕДМЕТ'}</span></div></article>`).join('');
}

async function loadInventory() {
    if (!supabase || !currentProfileId) return;
    const { data, error } = await supabase
        .from('inventory')
        .select('id, item_name, rarity, item_value, image_url, quantity, created_at')
        .eq('user_id', currentProfileId)
        .order('created_at', { ascending: false });
    if (error) {
        console.error('Supabase inventory load error:', error);
        renderInventory([]);
        return;
    }
    renderInventory(data);
}

async function saveDropToInventory(drop) {
    if (!supabase || !currentProfileId || !drop) {
        return { error: new Error('Профиль игрока не найден. Откройте приложение через Telegram.') };
    }
    const { error } = await supabase.from('inventory').insert({
        user_id: currentProfileId,
        item_name: drop.name,
        rarity: drop.rarity,
        item_value: Number(drop.price) || 0,
        image_url: drop.image || null,
        quantity: 1
    });
    if (!error) await loadInventory();
    return { error };
}

async function initTelegramAuth() {
    const telegramApp = window.Telegram && window.Telegram.WebApp;
    if (telegramApp) {
        telegramApp.ready();
        telegramApp.expand();
    } else {
        console.error('Telegram WebApp SDK не найден. Проверьте подключение telegram-web-app.js.');
    }

    const telegramUser = getTelegramUser();
    console.log('Telegram user:', telegramUser || 'не найден');
    applyTelegramProfileToUI(telegramUser);
    await syncTelegramProfileToSupabase(telegramUser);
    await loadCurrentUserProfile();
    await loadInventory();
}

document.addEventListener('DOMContentLoaded', function() {
    const btnAdd = document.querySelector('.btn-add');
    const btnNotification = document.querySelector('.btn-notification');
    const donateAddButton = document.querySelector('.nav-item-add');

    if (btnAdd) {
        btnAdd.addEventListener('click', function() {
            showPage('donate');
        });
    }

    if (donateAddButton) {
        donateAddButton.addEventListener('click', function() {
            showPage('donate');
        });
    }

    if (btnNotification) {
        btnNotification.addEventListener('click', function() {
            console.log('Notifications clicked');
        });
    }

    const topupOptions = document.querySelectorAll('.topup-option');
    topupOptions.forEach(option => {
        option.addEventListener('click', function() {
            topupOptions.forEach(item => {
                item.classList.remove('selected');
                item.setAttribute('aria-pressed', 'false');
            });

            this.classList.add('selected');
            this.setAttribute('aria-pressed', 'true');
        });
    });

    const premiumPlans = document.querySelectorAll('.premium-plan');
    premiumPlans.forEach(plan => {
        plan.addEventListener('click', function() {
            premiumPlans.forEach(item => {
                item.classList.remove('selected');
                item.setAttribute('aria-pressed', 'false');
            });

            this.classList.add('selected');
            this.setAttribute('aria-pressed', 'true');
        });
    });

    const casesContainer = document.querySelector('.cases-container');
    const caseCards = document.querySelectorAll('.case-card');
    const openCaseButtons = document.querySelectorAll('.btn-open');
    const caseDetailBack = document.querySelector('.case-back-btn');
    const openCounts = document.querySelectorAll('.open-count');
    const quickToggle = document.querySelector('.quick-toggle');
    const openingOverlay = document.querySelector('.case-opening-overlay');
    const openCaseButton = document.querySelector('.open-case-btn');
    const openingClose = document.querySelector('.opening-close');
    const reelWindow = document.querySelector('.reel-window');
    const reelTrack = document.querySelector('.reel-track');
    let reelAnimationFrame;
    let reelPosition = 0;
    let reelVelocity = 0;
    let reelLastTime = 0;
    let reelDragging = false;
    let reelPointerX = 0;
    let reelPointerTime = 0;
    let reelStartTime = 0;
    let reelStartPosition = 0;
    let reelTargetPosition = 0;
    let reelIsRunning = false;
    let reelPrepared = false;
    let reelInertiaFrame;
    const openingProgress = document.querySelector('.opening-progress span');
    const openingStatus = document.querySelector('.opening-status');
    const dropResultModal = document.querySelector('.drop-result-modal');
    const dropResultClose = document.querySelector('.drop-result-close');
    const dropResultImage = document.getElementById('drop-result-image');
    const dropResultName = document.getElementById('drop-result-name');
    const dropResultPrice = document.getElementById('drop-result-price');
    const dropResultSell = document.querySelector('.drop-sell-btn');
    let reelDrops = [];
    const casesById = new Map();
    let selectedCase = null;
    let resultDrop = null;

    const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
    const rarityClass = rarity => ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical'].includes(rarity) ? rarity : 'common';
    const rarityLabel = rarity => ({ common: 'ШИРП', uncommon: 'ОБЫЧНЫЙ', rare: 'РЕДКИЙ', epic: 'ЭПИЧНЫЙ', legendary: 'ЗОЛОТОЙ', mythical: 'КРАСНЫЙ' }[rarity] || rarity || 'ПРЕДМЕТ');

    function renderCases(cases) {
        if (!casesContainer) return;
        if (!cases.length) { casesContainer.innerHTML = '<p class="cases-loading">Активных кейсов пока нет</p>'; return; }
        casesContainer.innerHTML = cases.map(item => `<article class="case-card" data-case-id="${item.id}"><h3 class="case-card-title">${escapeHtml(item.name)}</h3><div class="case-card-image"><img src="${escapeHtml(item.image_url || './data/case_logo/free.png')}" alt="${escapeHtml(item.name)}"></div><div class="case-card-price"><img src="./data/assets/coin.png" alt="Монеты" class="price-coin"><span>${Number(item.price || 0).toLocaleString('ru-RU')}</span></div><button class="btn-open" type="button">ОТКРЫТЬ</button></article>`).join('');
        casesContainer.querySelectorAll('.case-card').forEach(card => card.addEventListener('click', openCaseDetail));
    }

    async function loadCases() {
        if (!supabase || !casesContainer) return;
        const { data, error } = await supabase.from('cases').select('id, name, price, image_url, active, case_items(id, item_name, rarity, chance, item_value, image_url)').eq('active', true).order('created_at', { ascending: false });
        if (error) { casesContainer.innerHTML = '<p class="cases-loading">Не удалось загрузить кейсы</p>'; console.error('Не удалось загрузить кейсы:', error); return; }
        casesById.clear();
        data.forEach(item => casesById.set(String(item.id), item));
        renderCases(data);
    }

    function renderCaseDetail(caseData) {
        const items = caseData.case_items || [];
        document.querySelector('.case-detail-toolbar h1').textContent = caseData.name;
        const detailImage = document.querySelector('.detail-case-image');
        detailImage.src = caseData.image_url || './data/case_logo/free.png';
        detailImage.alt = caseData.name;
        document.querySelector('.open-case-btn').textContent = `ОТКРЫТЬ ЗА ${Number(caseData.price || 0).toLocaleString('ru-RU')} BC`;
        const contents = document.querySelector('.case-contents-grid');
        contents.innerHTML = items.length ? items.map(item => `<article class="case-content-item rarity-${rarityClass(item.rarity)}"><span class="drop-chance">${Number(item.chance || 0).toLocaleString('ru-RU')}%</span><img src="${escapeHtml(item.image_url || './data/assets/items/m5f90.png')}" alt="${escapeHtml(item.item_name)}"><strong>${escapeHtml(item.item_name)}</strong><em>${Number(item.item_value || 0).toLocaleString('ru-RU')} BC</em></article>`).join('') : '<p class="cases-loading">В этом кейсе пока нет предметов</p>';
        reelDrops = items.map(item => ({ name: item.item_name, price: item.item_value, image: item.image_url || './data/assets/items/m5f90.png', alt: item.item_name, rarity: rarityClass(item.rarity), chance: Number(item.chance) || 0 }));
        const openButton = document.querySelector('.open-case-btn');
        openButton.disabled = !reelDrops.length;
        openButton.textContent = reelDrops.length ? `ОТКРЫТЬ ЗА ${Number(caseData.price || 0).toLocaleString('ru-RU')} BC` : 'В КЕЙСЕ НЕТ ПРЕДМЕТОВ';
    }

    function openCaseDetail(event) {
        event.preventDefault();
        const card = event.currentTarget.closest('.case-card');
        selectedCase = card && casesById.get(card.dataset.caseId);
        if (!selectedCase) return;
        renderCaseDetail(selectedCase);
        showPage('case-detail');
    }

    caseCards.forEach(card => card.addEventListener('click', openCaseDetail));
    openCaseButtons.forEach(button => button.addEventListener('click', openCaseDetail));

    if (caseDetailBack) {
        caseDetailBack.addEventListener('click', function() {
            showPage('home');
        });
    }

    openCounts.forEach(count => {
        count.addEventListener('click', function() {
            openCounts.forEach(item => {
                item.classList.remove('selected');
                item.setAttribute('aria-pressed', 'false');
            });

            this.classList.add('selected');
            this.setAttribute('aria-pressed', 'true');
        });
    });

    if (quickToggle) {
        quickToggle.addEventListener('click', function() {
            const isPressed = this.getAttribute('aria-pressed') === 'true';
            this.setAttribute('aria-pressed', String(!isPressed));
        });
    }

    function setReelPosition(position) {
        reelPosition = position;
        reelTrack.style.transform = `translate3d(${position}px, 0, 0)`;
    }

    function showResultModal(drop) {
        if (!drop || !dropResultModal || !dropResultImage || !dropResultName || !dropResultPrice) return;

        dropResultImage.src = drop.image;
        dropResultImage.alt = drop.alt;
        dropResultName.textContent = drop.name;
        dropResultPrice.textContent = `${Number(drop.price).toLocaleString('ru-RU')} BC`;

        if (dropResultSell) {
            dropResultSell.textContent = `ПРОДАТЬ ЗА ${Number(drop.price).toLocaleString('ru-RU')} BC`;
        }

        dropResultModal.classList.add('active');
        dropResultModal.setAttribute('aria-hidden', 'false');
    }

    function hideResultModal() {
        if (!dropResultModal) return;
        dropResultModal.classList.remove('active');
        dropResultModal.setAttribute('aria-hidden', 'true');
    }

    function prepareReel() {
        if (!reelDrops.length) return false;
        const sourceItems = reelDrops.map(drop => {
            const item = document.createElement('article');
            item.className = `reel-item rarity-${drop.rarity}`;
            item.innerHTML = `<span>${Number(drop.chance).toLocaleString('ru-RU')}%</span><img src="${escapeHtml(drop.image)}" alt="${escapeHtml(drop.alt)}"><strong>${escapeHtml(drop.name)}</strong><small>${Number(drop.price || 0).toLocaleString('ru-RU')} BC</small>`;
            return item;
        });
        reelTrack.replaceChildren();

        const totalChance = reelDrops.reduce((total, drop) => total + drop.chance, 0);
        let randomChance = Math.random() * (totalChance || reelDrops.length);
        let winnerIndex = reelDrops.findIndex(drop => { randomChance -= drop.chance || (totalChance ? 0 : 1); return randomChance <= 0; });
        if (winnerIndex < 0) winnerIndex = reelDrops.length - 1;
        resultDrop = reelDrops[winnerIndex];

        const winnerRepeat = 14;
        const repeatCount = 18;
        for (let repeat = 0; repeat < repeatCount; repeat += 1) {
            sourceItems.forEach((sourceItem, itemIndex) => {
                const item = sourceItem.cloneNode(true);
                item.classList.remove('reel-winner');
                if (repeat === winnerRepeat && itemIndex === winnerIndex) item.classList.add('reel-winner');
                reelTrack.appendChild(item);
            });
        }

        reelPrepared = true;
        return true;
    }

    function reelEase(progress) {
        const clampedProgress = Math.max(0, Math.min(progress, 1));
        const accelerationEnd = 2.8 / 6.8;
        const cruiseEnd = 5.1 / 6.8;
        const accelerationLength = accelerationEnd;
        const cruiseLength = cruiseEnd - accelerationEnd;
        const decelerationLength = 1 - cruiseEnd;
        const totalDistance = (accelerationLength + decelerationLength) / 2 + cruiseLength;
        const rampIntegral = value => value ** 3 - value ** 4 / 2;
        let travelled;

        if (clampedProgress <= accelerationEnd) {
            const rampProgress = clampedProgress / accelerationLength;
            travelled = accelerationLength * rampIntegral(rampProgress);
        } else if (clampedProgress <= cruiseEnd) {
            travelled = accelerationLength / 2 + clampedProgress - accelerationEnd;
        } else {
            const rampProgress = (clampedProgress - cruiseEnd) / decelerationLength;
            travelled = accelerationLength / 2 + cruiseLength + decelerationLength * (rampProgress - rampIntegral(rampProgress));
        }

        return travelled / totalDistance;
    }

    async function animateReel(time) {
        const duration = 6800;
        const progress = Math.min((time - reelStartTime) / duration, 1);
        const easedProgress = reelEase(progress);
        const position = reelStartPosition + (reelTargetPosition - reelStartPosition) * easedProgress;
        const previousPosition = reelPosition;
        setReelPosition(position);
        reelVelocity = (position - previousPosition) / Math.max((time - (reelLastTime || time - 16)) / 1000, 0.001);
        reelLastTime = time;

        if (progress < 1) {
            reelAnimationFrame = requestAnimationFrame(animateReel);
            return;
        }

        reelIsRunning = false;
        reelVelocity = 0;
        const { error: inventoryError } = await saveDropToInventory(resultDrop);
        if (openingStatus) openingStatus.textContent = inventoryError ? 'Предмет выпал, но не сохранён' : 'Открытие завершено';
        showResultModal(resultDrop);
    }

    function clampReelPosition(position) {
        const minPosition = Math.min(0, reelWindow.clientWidth - reelTrack.scrollWidth);
        return Math.min(0, Math.max(minPosition, position));
    }

    function animateReelInertia(time) {
        const elapsed = Math.max(time - reelLastTime, 0);
        reelLastTime = time;
        const decay = Math.exp(-elapsed / 430);
        const nextVelocity = reelVelocity * decay;
        const nextPosition = clampReelPosition(reelPosition + reelVelocity * (elapsed / 1000));
        setReelPosition(nextPosition);
        reelVelocity = nextVelocity;

        if (Math.abs(reelVelocity) > 8 && nextPosition !== 0 && nextPosition !== Math.min(0, reelWindow.clientWidth - reelTrack.scrollWidth)) {
            reelInertiaFrame = requestAnimationFrame(animateReelInertia);
            return;
        }
        reelVelocity = 0;
    }

    function startReelOpening() {
        if (!openingOverlay || !reelWindow) return;
        hideResultModal();
        reelPrepared = false;
        if (!prepareReel()) return;
        const winner = reelTrack.querySelector('.reel-winner');
        if (!winner) return;
        void reelTrack.offsetWidth;
        reelTargetPosition = reelWindow.clientWidth / 2 - (winner.offsetLeft + winner.offsetWidth / 2);
        const reelItems = [...reelTrack.children];
        const winnerIndex = reelItems.indexOf(winner);
        const cyclesBeforeWinner = 10;
        const leadIndex = Math.max(0, winnerIndex - (reelDrops.length * cyclesBeforeWinner) - 4);
        const leadItem = reelItems[leadIndex];
        const leadCenter = leadItem.offsetLeft + leadItem.offsetWidth / 2;
        const winnerCenter = winner.offsetLeft + winner.offsetWidth / 2;
        const visibleCardDistance = winnerCenter - leadCenter;
        reelStartPosition = Math.min(0, reelTargetPosition + visibleCardDistance);
        reelStartPosition = clampReelPosition(reelStartPosition);

        cancelAnimationFrame(reelAnimationFrame);
        cancelAnimationFrame(reelInertiaFrame);
        if (openingProgress) {
            openingProgress.style.animation = 'none';
            void openingProgress.offsetWidth;
            openingProgress.style.animation = '';
        }
        if (openingStatus) openingStatus.textContent = 'Открывается...';
        setReelPosition(reelStartPosition);
        reelStartTime = performance.now();
        reelLastTime = reelStartTime;
        reelIsRunning = true;
        reelAnimationFrame = requestAnimationFrame(animateReel);
    }

    if (openCaseButton) {
        openCaseButton.addEventListener('click', function() {
            openingOverlay.classList.add('active');
            openingOverlay.setAttribute('aria-hidden', 'false');
            document.body.classList.add('case-opening-active');
            startReelOpening();
        });
    }

    if (openingClose) {
        openingClose.addEventListener('click', function() {
            openingOverlay.classList.remove('active');
            openingOverlay.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('case-opening-active');
            hideResultModal();
            cancelAnimationFrame(reelAnimationFrame);
            cancelAnimationFrame(reelInertiaFrame);
            reelIsRunning = false;
        });
    }

    if (dropResultClose) {
        dropResultClose.addEventListener('click', function() {
            hideResultModal();
            openingOverlay.classList.remove('active');
            openingOverlay.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('case-opening-active');
            cancelAnimationFrame(reelAnimationFrame);
            cancelAnimationFrame(reelInertiaFrame);
            reelIsRunning = false;
        });
    }

    if (reelWindow) {
        reelWindow.addEventListener('pointerdown', function(event) {
            if (reelIsRunning) return;
            reelDragging = true;
            reelPointerX = event.clientX;
            reelPointerTime = performance.now();
            reelVelocity = 0;
            cancelAnimationFrame(reelInertiaFrame);
            cancelAnimationFrame(reelAnimationFrame);
            reelWindow.setPointerCapture(event.pointerId);
        });

        reelWindow.addEventListener('pointermove', function(event) {
            if (!reelDragging) return;
            const now = performance.now();
            const elapsed = Math.max(now - reelPointerTime, 1);
            const movement = event.clientX - reelPointerX;
            reelVelocity = movement / (elapsed / 1000);
            setReelPosition(reelPosition + movement);
            reelPointerX = event.clientX;
            reelPointerTime = now;
        });

        reelWindow.addEventListener('pointerup', function(event) {
            if (!reelDragging) return;
            reelDragging = false;
            reelWindow.releasePointerCapture(event.pointerId);
            reelLastTime = performance.now();
            if (Math.abs(reelVelocity) > 8) reelInertiaFrame = requestAnimationFrame(animateReelInertia);
        });
    }

    loadCases();

    const pages = document.querySelectorAll('.page');
    const navItems = document.querySelectorAll('.nav-item');

    function showPage(pageName) {
        pages.forEach(page => {
            const isActive = page.dataset.page === pageName;
            page.classList.toggle('active', isActive);
        });

        navItems.forEach(item => {
            const label = item.querySelector('.nav-label')?.textContent?.trim();
            const isActive = pageNameMap[label] === pageName;
            item.classList.toggle('active', isActive);
        });
    }

    const donateNav = document.querySelector('.nav-item-add');
    if (donateNav) {
        donateNav.addEventListener('click', function(e) {
            e.preventDefault();
            showPage('donate');
        });
    }

    const pageNameMap = {
        'Главная': 'home',
        'Витрина': 'shop',
        'Топ': 'top',
        'Профиль': 'profile'
    };

    navItems.forEach(item => {
        if (item.classList.contains('nav-item-add')) return;

        item.addEventListener('click', function(e) {
            e.preventDefault();
            const label = this.querySelector('.nav-label')?.textContent?.trim();
            const pageName = pageNameMap[label] || 'home';

            navItems.forEach(nav => {
                if (!nav.classList.contains('nav-item-add')) {
                    nav.classList.remove('active');
                }
            });
            this.classList.add('active');

            showPage(pageName);
        });
    });

    showPage('home');
    initTelegramAuth();
});

})();

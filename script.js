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
let currentProfileUsername = '';

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
            currentProfileUsername = existingProfile.username || '';
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
            currentProfileUsername = username;
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
        currentProfileUsername = data?.username || currentProfileUsername;

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

function updateDisplayedUsername(username) {
    document.querySelectorAll('.player-name, .profile-player-name, .win-player-name, .seller-name, .top-player-name, .top-list-player-name').forEach(element => {
        element.textContent = username;
    });
}

function openNicknameModal() {
    const modal = document.querySelector('#nickname-modal');
    const input = document.querySelector('#nickname-input');
    if (!modal || !input) return;
    input.value = currentProfileUsername.slice(0, 12);
    document.querySelector('#nickname-counter').textContent = input.value.length;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => input.focus(), 0);
}

function setupNicknamePrompt(telegramUser) {
    const modal = document.querySelector('#nickname-modal');
    const form = document.querySelector('#nickname-form');
    const input = document.querySelector('#nickname-input');
    const counter = document.querySelector('#nickname-counter');
    const status = document.querySelector('#nickname-status');
    if (!modal || !form || !input || !telegramUser || !currentProfileId) return;
    const storageKey = `nickname-created-${telegramUser.id}`;
    let alreadyCompleted = false;
    try { alreadyCompleted = localStorage.getItem(storageKey) === 'true'; } catch (error) { console.warn('Не удалось проверить первый вход:', error); }
    if (alreadyCompleted) return;
    openNicknameModal();
    input.addEventListener('input', () => { input.value = input.value.slice(0, 12); counter.textContent = input.value.length; });
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const nickname = input.value.trim();
        if (nickname.length < 2 || nickname.length > 12) { status.textContent = 'Ник должен содержать от 2 до 12 символов.'; return; }
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        status.textContent = 'Сохраняем...';
        const { error } = await supabase.from('profiles').update({ username: nickname, updated_at: new Date().toISOString() }).eq('id', currentProfileId);
        button.disabled = false;
        if (error) { status.textContent = `Не удалось сохранить ник: ${error.message}`; return; }
        currentProfileUsername = nickname;
        updateDisplayedUsername(nickname);
        try { localStorage.setItem(storageKey, 'true'); } catch (storageError) { console.warn('Не удалось запомнить первый вход:', storageError); }
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
    });
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

function escapeLeaderboardText(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function renderLeaderboard(profiles) {
    const podium = document.querySelector('.top-ranking-grid');
    const list = document.querySelector('.top-players-list');
    if (!podium || !list) return;
    if (!profiles.length) {
        podium.innerHTML = '<p class="top-loading">Игроков в рейтинге пока нет</p>';
        list.innerHTML = '';
        return;
    }
    const podiumClasses = { 1: 'first', 2: 'second', 3: 'third' };
    podium.innerHTML = profiles.slice(0, 3).map((profile, index) => {
        const place = index + 1;
        const name = profile.username || [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Игрок';
        const avatar = profile.avatar_url || './data/assets/profile.png';
        return `<article class="top-player-card ${podiumClasses[place]}"><div class="top-place">${place}</div><div class="top-avatar-wrap"><div class="top-avatar ${place === 1 ? 'crowned' : 'masked'}"><img src="${escapeLeaderboardText(avatar)}" alt="${escapeLeaderboardText(name)}"><div class="avatar-visor"></div></div></div><div class="top-player-name">${escapeLeaderboardText(name)}</div><div class="top-player-balance">${Number(profile.balance || 0).toLocaleString('ru-RU')} <img src="./data/assets/coin.png" alt="Монеты" class="top-coin-icon"></div></article>`;
    }).join('');
    list.innerHTML = profiles.slice(3).map((profile, index) => {
        const place = index + 4;
        const name = profile.username || [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Игрок';
        const avatar = profile.avatar_url || './data/assets/profile.png';
        return `<div class="top-list-item"><div class="top-list-place">${place}</div><div class="top-list-avatar"><img src="${escapeLeaderboardText(avatar)}" alt="${escapeLeaderboardText(name)}"></div><div class="top-list-info"><div class="top-list-player-name">${escapeLeaderboardText(name)}</div><div class="top-list-badge">${profile.premium ? 'PREMIUM' : 'PLAYER'}</div></div><div class="top-list-score"><span>${Number(profile.balance || 0).toLocaleString('ru-RU')}</span><img src="./data/assets/coin.png" alt="Монеты" class="list-coin-icon"></div><button class="top-list-arrow" type="button" aria-label="Открыть профиль">›</button></div>`;
    }).join('');
}

async function loadLeaderboard() {
    if (!supabase) return;
    const { data, error } = await supabase
        .from('profiles')
        .select('id, username, first_name, last_name, avatar_url, balance, premium')
        .order('balance', { ascending: false })
        .limit(10);
    if (error) {
        console.error('Supabase leaderboard load error:', error);
        renderLeaderboard([]);
        return;
    }
    renderLeaderboard(data || []);
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
    await loadLeaderboard();
    setupNicknamePrompt(telegramUser);
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
    const reelStage = document.querySelector('#reel-stage');
    let reelAnimationFrame;
    let reelInstances = [];
    let reelIsRunning = false;
    let reelInertiaFrames = [];
    const openingProgress = document.querySelector('.opening-progress span');
    const openingStatus = document.querySelector('.opening-status');
    const dropResultModal = document.querySelector('.drop-result-modal');
    const dropResultClose = document.querySelector('.drop-result-close');
    const dropResultsList = document.getElementById('drop-results-list');
    const dropSaveButton = document.querySelector('.drop-save-btn');
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

    function updateOpenCasePrice() {
        if (!openCaseButton || !selectedCase) return;
        const count = Number(document.querySelector('.open-count.selected')?.textContent.replace('x', '')) || 1;
        openCaseButton.textContent = reelDrops.length
            ? `ОТКРЫТЬ ЗА ${(Number(selectedCase.price || 0) * count).toLocaleString('ru-RU')} BC`
            : 'В КЕЙСЕ НЕТ ПРЕДМЕТОВ';
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
            updateOpenCasePrice();
        });
    });

    if (quickToggle) {
        quickToggle.addEventListener('click', function() {
            const isPressed = this.getAttribute('aria-pressed') === 'true';
            this.setAttribute('aria-pressed', String(!isPressed));
        });
    }

    function showResultModal(drops) {
        if (!drops?.length || !dropResultModal || !dropResultsList) return;
        dropResultsList.innerHTML = drops.map((drop, index) => `<label class="drop-result-item"><input type="checkbox" checked data-result-index="${index}"><span class="drop-result-check">✓</span><span class="drop-result-image-wrap"><img src="${escapeHtml(drop.image)}" alt="${escapeHtml(drop.alt)}"></span><span class="drop-result-info"><strong>${escapeHtml(drop.name)}</strong><small>${Number(drop.price || 0).toLocaleString('ru-RU')} BC</small></span></label>`).join('');
        if (dropSaveButton) dropSaveButton.textContent = `СОХРАНИТЬ ВЫБРАННЫЕ (${drops.length})`;
        if (dropResultSell) dropResultSell.textContent = 'ПРОДАТЬ ВЫБРАННЫЕ';

        dropResultModal.classList.add('active');
        dropResultModal.setAttribute('aria-hidden', 'false');
    }

    function hideResultModal() {
        if (!dropResultModal) return;
        dropResultModal.classList.remove('active');
        dropResultModal.setAttribute('aria-hidden', 'true');
    }

    function chooseDrop() {
        const totalChance = reelDrops.reduce((total, drop) => total + drop.chance, 0);
        let randomChance = Math.random() * (totalChance || reelDrops.length);
        let winnerIndex = reelDrops.findIndex(drop => { randomChance -= drop.chance || (totalChance ? 0 : 1); return randomChance <= 0; });
        if (winnerIndex < 0) winnerIndex = reelDrops.length - 1;
        return { drop: reelDrops[winnerIndex], winnerIndex };
    }

    function createReelInstance(windowElement) {
        const track = windowElement.querySelector('.reel-track');
        const sourceItems = reelDrops.map(drop => {
            const item = document.createElement('article');
            item.className = `reel-item rarity-${drop.rarity}`;
            item.innerHTML = `<span>${Number(drop.chance).toLocaleString('ru-RU')}%</span><img src="${escapeHtml(drop.image)}" alt="${escapeHtml(drop.alt)}"><strong>${escapeHtml(drop.name)}</strong><small>${Number(drop.price || 0).toLocaleString('ru-RU')} BC</small>`;
            return item;
        });
        track.replaceChildren();
        const selection = chooseDrop();
        const winnerRepeat = 14;
        for (let repeat = 0; repeat < 18; repeat += 1) {
            sourceItems.forEach((sourceItem, itemIndex) => {
                const item = sourceItem.cloneNode(true);
                item.dataset.dropIndex = String(itemIndex);
                if (repeat === winnerRepeat && itemIndex === selection.winnerIndex) item.classList.add('reel-winner');
                track.appendChild(item);
            });
        }
        const winnerElement = track.querySelector('.reel-winner');
        return { window: windowElement, track, drop: selection.drop, winnerElement, position: 0, velocity: 0, startPosition: 0, targetPosition: 0, duration: 5800 + Math.random() * 1400, animationFrame: 0, inertiaFrame: 0, dragging: false, pointerX: 0, pointerTime: 0 };
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

    function animateReel(instance, time) {
        const progress = Math.min((time - instance.startTime) / instance.duration, 1);
        const easedProgress = reelEase(progress);
        const position = instance.startPosition + (instance.targetPosition - instance.startPosition) * easedProgress;
        const previousPosition = instance.position;
        instance.position = position;
        instance.track.style.transform = `translate3d(${position}px, 0, 0)`;
        instance.velocity = (position - previousPosition) / Math.max((time - (instance.lastTime || time - 16)) / 1000, 0.001);
        instance.lastTime = time;

        if (progress < 1) {
            instance.animationFrame = requestAnimationFrame(nextTime => animateReel(instance, nextTime));
            return;
        }
        instance.velocity = 0;
        instance.finished = true;
        if (reelInstances.every(item => item.finished)) finishMultiOpening();
    }

    function clampReelPosition(instance, position) {
        const minPosition = Math.min(0, instance.window.clientWidth - instance.track.scrollWidth);
        return Math.min(0, Math.max(minPosition, position));
    }

    function animateReelInertia(instance, time) {
        const elapsed = Math.max(time - instance.lastTime, 0);
        instance.lastTime = time;
        const decay = Math.exp(-elapsed / 430);
        const nextVelocity = instance.velocity * decay;
        const nextPosition = clampReelPosition(instance, instance.position + instance.velocity * (elapsed / 1000));
        instance.position = nextPosition;
        instance.track.style.transform = `translate3d(${nextPosition}px, 0, 0)`;
        instance.velocity = nextVelocity;

        if (Math.abs(instance.velocity) > 8 && nextPosition !== 0 && nextPosition !== Math.min(0, instance.window.clientWidth - instance.track.scrollWidth)) {
            instance.inertiaFrame = requestAnimationFrame(nextTime => animateReelInertia(instance, nextTime));
            return;
        }
        instance.velocity = 0;
    }

    async function finishMultiOpening() {
        reelIsRunning = false;
        const results = reelInstances.map(instance => {
            const winnerIndex = Number(instance.winnerElement?.dataset.dropIndex);
            return reelDrops[winnerIndex] || instance.drop;
        });
        resultDrop = results[0];
        if (openingStatus) openingStatus.textContent = 'Открытие завершено';
        showResultModal(results);
    }

    function attachReelDrag(instance) {
        instance.window.addEventListener('pointerdown', event => {
            if (reelIsRunning) return;
            instance.dragging = true;
            instance.pointerX = event.clientX;
            instance.pointerTime = performance.now();
            instance.velocity = 0;
            cancelAnimationFrame(instance.inertiaFrame);
            instance.window.setPointerCapture(event.pointerId);
        });
        instance.window.addEventListener('pointermove', event => {
            if (!instance.dragging) return;
            const now = performance.now();
            const elapsed = Math.max(now - instance.pointerTime, 1);
            const movement = event.clientX - instance.pointerX;
            instance.velocity = movement / (elapsed / 1000);
            instance.position = clampReelPosition(instance, instance.position + movement);
            instance.track.style.transform = `translate3d(${instance.position}px, 0, 0)`;
            instance.pointerX = event.clientX;
            instance.pointerTime = now;
        });
        instance.window.addEventListener('pointerup', event => {
            if (!instance.dragging) return;
            instance.dragging = false;
            instance.window.releasePointerCapture(event.pointerId);
            instance.lastTime = performance.now();
            if (Math.abs(instance.velocity) > 8) instance.inertiaFrame = requestAnimationFrame(time => animateReelInertia(instance, time));
        });
    }

    function startReelOpening() {
        if (!openingOverlay || !reelStage || !reelDrops.length) return;
        hideResultModal();
        const selectedCount = Number(document.querySelector('.open-count.selected')?.textContent.replace('x', '')) || 1;
        reelStage.replaceChildren();
        const compact = selectedCount >= 5;
        const rows = selectedCount === 1 ? [1] : selectedCount === 2 ? [1, 1] : selectedCount === 3 ? [1, 1, 1] : selectedCount === 5 ? [2, 2, 1] : [2, 2, 2, 2, 2];
        reelStage.className = `reel-stage opening-count-${selectedCount}`;
        reelInstances = [];
        rows.forEach(width => { const row = document.createElement('div'); row.className = `reel-row${width === 2 ? ' compact-row' : ''}`; reelStage.appendChild(row); for (let index = 0; index < width; index += 1) { const windowElement = document.createElement('div'); windowElement.className = `reel-window${width === 2 ? ' compact-reel' : ''}`; windowElement.innerHTML = '<div class="reel-pointer"></div><div class="reel-track"></div>'; row.appendChild(windowElement); const instance = createReelInstance(windowElement); reelInstances.push(instance); attachReelDrag(instance); } });
        reelInstances.forEach(instance => {
            void instance.track.offsetWidth;
            const winner = instance.track.querySelector('.reel-winner');
            const windowWidth = instance.window.clientWidth;
            const winnerWidth = winner.offsetWidth;
            const centerTarget = windowWidth / 2 - (winner.offsetLeft + winnerWidth / 2);
            const edgePadding = Math.min(18, windowWidth * 0.08);
            const minimumTarget = windowWidth - edgePadding - winner.offsetLeft - winnerWidth;
            const maximumTarget = edgePadding - winner.offsetLeft;
            const randomOffset = (Math.random() - 0.5) * windowWidth * 0.45;
            instance.targetPosition = Math.max(minimumTarget, Math.min(maximumTarget, centerTarget + randomOffset));
            const reelItems = [...instance.track.children];
            const winnerIndex = reelItems.indexOf(winner);
        const cyclesBeforeWinner = 10;
        const leadIndex = Math.max(0, winnerIndex - (reelDrops.length * cyclesBeforeWinner) - 4);
        const leadItem = reelItems[leadIndex];
        const leadCenter = leadItem.offsetLeft + leadItem.offsetWidth / 2;
        const winnerCenter = winner.offsetLeft + winner.offsetWidth / 2;
        const visibleCardDistance = winnerCenter - leadCenter;
            instance.startPosition = clampReelPosition(instance, Math.min(0, instance.targetPosition + visibleCardDistance));
        });
        reelInstances.forEach(instance => { cancelAnimationFrame(instance.animationFrame); cancelAnimationFrame(instance.inertiaFrame); instance.position = instance.startPosition; instance.track.style.transform = `translate3d(${instance.startPosition}px, 0, 0)`; instance.startTime = performance.now(); instance.lastTime = instance.startTime; instance.finished = false; });
        if (openingProgress) {
            openingProgress.style.animation = 'none';
            void openingProgress.offsetWidth;
            openingProgress.style.animation = '';
        }
        if (openingStatus) openingStatus.textContent = 'Открывается...';
        reelIsRunning = true;
        reelInstances.forEach(instance => { instance.animationFrame = requestAnimationFrame(time => animateReel(instance, time)); });
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
            reelInstances.forEach(instance => { cancelAnimationFrame(instance.animationFrame); cancelAnimationFrame(instance.inertiaFrame); });
            reelIsRunning = false;
        });
    }

    function getSelectedResultDrops() {
        return [...(dropResultsList?.querySelectorAll('[data-result-index]:checked') || [])]
            .map(input => reelInstances[Number(input.dataset.resultIndex)]?.drop)
            .filter(Boolean);
    }

    function closeResultFlow() {
        hideResultModal();
        openingOverlay.classList.remove('active');
        openingOverlay.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('case-opening-active');
    }

    async function sellResultDrops(drops) {
        if (!supabase || !currentProfileId || !drops.length) return new Error('Не выбраны предметы или профиль не найден.');
        const total = drops.reduce((sum, drop) => sum + (Number(drop.price) || 0), 0);
        const { data: profile, error: readError } = await supabase.from('profiles').select('balance').eq('id', currentProfileId).single();
        if (readError) return readError;
        const { error } = await supabase.from('profiles').update({ balance: Number(profile.balance || 0) + total, updated_at: new Date().toISOString() }).eq('id', currentProfileId);
        if (!error) {
            const balanceAmount = document.querySelector('.balance-amount');
            if (balanceAmount) balanceAmount.textContent = (Number(profile.balance || 0) + total).toLocaleString('ru-RU');
        }
        return error;
    }

    if (dropSaveButton) {
        dropSaveButton.addEventListener('click', async () => {
            const drops = getSelectedResultDrops();
            if (!drops.length) return;
            dropSaveButton.disabled = true;
            const results = await Promise.all(drops.map(drop => saveDropToInventory(drop)));
            const error = results.find(result => result.error)?.error;
            dropSaveButton.disabled = false;
            if (error) { dropSaveButton.textContent = `Ошибка сохранения: ${error.message}`; return; }
            dropSaveButton.textContent = 'СОХРАНЕНО';
            closeResultFlow();
        });
    }

    if (dropResultSell) {
        dropResultSell.addEventListener('click', async () => {
            const drops = getSelectedResultDrops();
            if (!drops.length) return;
            dropResultSell.disabled = true;
            const error = await sellResultDrops(drops);
            dropResultSell.disabled = false;
            if (error) { dropResultSell.textContent = `Ошибка продажи: ${error.message}`; return; }
            dropResultSell.textContent = 'ПРОДАНО';
            closeResultFlow();
        });
    }

    if (dropResultClose) {
        dropResultClose.addEventListener('click', function() {
            hideResultModal();
            openingOverlay.classList.remove('active');
            openingOverlay.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('case-opening-active');
            reelInstances.forEach(instance => { cancelAnimationFrame(instance.animationFrame); cancelAnimationFrame(instance.inertiaFrame); });
            reelIsRunning = false;
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

// JavaScript для Telegram Mini-App

const SUPABASE_CONFIG = {
    url: 'https://kvtosrmtuhqsoimfbicw.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2dG9zcm10dWhxc29pbWZiaWN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0NTkxNDAsImV4cCI6MjEwNDAzNTE0MH0.3WP0FB4tT0uecJyHpwUQ1PjOWEta8zcsX8b4_hv7ads'
};

const supabase = window.supabase && SUPABASE_CONFIG.url && SUPABASE_CONFIG.url !== 'PASTE_SUPABASE_URL_HERE'
    ? window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey)
    : null;

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
    if (!supabase || !user) return;

    const telegramId = Number(user.id);
    const username = normalizeTelegramName(user);
    const avatarUrl = getTelegramAvatar(user);

    try {
        const { data: existingProfile, error: selectError } = await supabase
            .from('profiles')
            .select('*')
            .eq('telegram_id', telegramId)
            .maybeSingle();

        if (selectError && !String(selectError.message).includes('does not exist')) {
            console.error('Supabase select profile error:', selectError);
            return;
        }

        if (existingProfile) {
            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    username,
                    avatar_url: avatarUrl,
                    first_name: user.first_name || null,
                    last_name: user.last_name || null,
                    premium: Boolean(user.is_premium),
                    updated_at: new Date().toISOString()
                })
                .eq('telegram_id', telegramId);

            if (updateError) {
                console.error('Supabase update profile error:', updateError);
            }

            const balanceAmount = document.querySelector('.balance-amount');
            if (balanceAmount && typeof existingProfile.balance === 'number') {
                balanceAmount.textContent = Number(existingProfile.balance).toLocaleString('ru-RU');
            }
            return;
        }

        const { error: insertError } = await supabase
            .from('profiles')
            .insert({
                telegram_id: telegramId,
                username,
                avatar_url: avatarUrl,
                first_name: user.first_name || null,
                last_name: user.last_name || null,
                balance: 0,
                premium: Boolean(user.is_premium),
                created_at: new Date().toISOString()
            });

        if (insertError) {
            console.error('Supabase insert profile error:', insertError);
        }

        const balanceAmount = document.querySelector('.balance-amount');
        if (balanceAmount) {
            balanceAmount.textContent = '0';
        }
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
            .select('balance, username, avatar_url, premium')
            .eq('telegram_id', telegramId)
            .maybeSingle();

        if (error) {
            console.error('Supabase load profile error:', error);
            return;
        }

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

async function initTelegramAuth() {
    const telegramApp = window.Telegram && window.Telegram.WebApp;
    if (telegramApp) {
        telegramApp.ready();
        telegramApp.expand();
    }

    const telegramUser = getTelegramUser();
    applyTelegramProfileToUI(telegramUser);
    await syncTelegramProfileToSupabase(telegramUser);
    await loadCurrentUserProfile();
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
    const openingProgress = document.querySelector('.opening-progress span');
    const openingStatus = document.querySelector('.opening-status');
    const dropResultModal = document.querySelector('.drop-result-modal');
    const dropResultClose = document.querySelector('.drop-result-close');
    const dropResultImage = document.getElementById('drop-result-image');
    const dropResultName = document.getElementById('drop-result-name');
    const dropResultPrice = document.getElementById('drop-result-price');
    const dropResultSell = document.querySelector('.drop-sell-btn');
    const reelDrops = [
        { name: 'BMW M5 F90', price: 12500, image: './data/assets/items/m5f90.png', alt: 'BMW M5 F90', rarity: 'red' },
        { name: 'M9 Bayonet Crimson Web', price: 8750, image: './data/assets/items/m5f90.png', alt: 'M9 Bayonet Crimson Web', rarity: 'red' },
        { name: 'Sport Gloves Blood Pressure', price: 7250, image: './data/assets/items/m5f90.png', alt: 'Sport Gloves Blood Pressure', rarity: 'red' },
        { name: 'AK-47 Bloodsport', price: 3250, image: './data/assets/items/m5f90.png', alt: 'AK-47 Bloodsport', rarity: 'orange' },
        { name: 'AWP Redline', price: 2750, image: './data/assets/items/m5f90.png', alt: 'AWP Redline', rarity: 'purple' }
    ];
    let resultDrop = null;

    function openCaseDetail(event) {
        event.preventDefault();
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
        const sourceItems = Array.from(reelTrack.children).map(item => item.cloneNode(true));
        reelTrack.replaceChildren();

        const winnerIndex = Math.floor(Math.random() * Math.min(sourceItems.length, reelDrops.length));
        resultDrop = reelDrops[winnerIndex];

        for (let repeat = 0; repeat < 5; repeat += 1) {
            sourceItems.forEach((sourceItem, itemIndex) => {
                const item = sourceItem.cloneNode(true);
                item.classList.remove('reel-winner');
                if (repeat === 2 && itemIndex === winnerIndex) item.classList.add('reel-winner');
                reelTrack.appendChild(item);
            });
        }

        reelPrepared = true;
    }

    function animateReel(time) {
        const elapsed = Math.min((time - reelStartTime) / 1000, 9.8);
        const accelerationTime = 0.9;
        const cruiseTime = 3.1;
        const decelerationTime = 4.2;
        const distance = reelStartPosition - reelTargetPosition;
        const maxVelocity = distance / (accelerationTime * 0.55 + cruiseTime + decelerationTime * 0.5);
        let travelled;

        if (elapsed < accelerationTime) {
            travelled = 0.5 * (maxVelocity / accelerationTime) * elapsed ** 2;
        } else if (elapsed < accelerationTime + cruiseTime) {
            travelled = maxVelocity * (accelerationTime * 0.55 + elapsed - accelerationTime);
        } else {
            const slowingTime = Math.min(elapsed - accelerationTime - cruiseTime, decelerationTime);
            travelled = maxVelocity * (accelerationTime * 0.55 + cruiseTime + slowingTime - (slowingTime ** 2 / (2 * decelerationTime)));
        }

        reelVelocity = elapsed < accelerationTime ? maxVelocity * elapsed / accelerationTime : maxVelocity;
        setReelPosition(reelStartPosition - travelled);

        if (elapsed < 9.8) {
            reelAnimationFrame = requestAnimationFrame(animateReel);
            return;
        }

        reelIsRunning = false;
        reelVelocity = 0;
        setReelPosition(reelTargetPosition);
        if (openingStatus) openingStatus.textContent = 'Открытие завершено';
        showResultModal(resultDrop);
    }

    function startReelOpening() {
        if (!openingOverlay || !reelWindow) return;
        hideResultModal();
        reelPrepared = false;
        prepareReel();
        const winner = reelTrack.querySelector('.reel-winner');
        reelTargetPosition = reelWindow.clientWidth / 2 - (winner.offsetLeft + winner.offsetWidth / 2);

        const trackWidth = reelTrack.scrollWidth || 0;
        const startOffset = Math.min(Math.max(trackWidth * 0.75, 2600), 4300);
        reelStartPosition = reelTargetPosition + startOffset;

        cancelAnimationFrame(reelAnimationFrame);
        if (openingProgress) {
            openingProgress.style.animation = 'none';
            void openingProgress.offsetWidth;
            openingProgress.style.animation = '';
        }
        if (openingStatus) openingStatus.textContent = 'Открывается...';
        setReelPosition(reelStartPosition);
        reelStartTime = performance.now();
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
            reelLastTime = 0;
            requestAnimationFrame(animateReel);
        });
    }

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

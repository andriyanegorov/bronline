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
async function logPlayerAction(action, details = {}) {
    if (!supabase || currentProfileId === null) return null;

    try {
const payload = {
    ...details,
    username: currentProfileUsername || null,
    page: document.querySelector('.page.active')?.dataset?.page || null,
    url: window.location.href,
    client_time: new Date().toISOString()
};

        const { data, error } = await supabase.rpc('log_player_action', {
            p_user_id: Number(currentProfileId),
            p_action: action,
            p_details: payload
        });

        if (error) {
            console.error('[PLAYER LOG]', action, error);
            return null;
        }

        return data;
    } catch (error) {
        console.error('[PLAYER LOG CRASH]', action, error);
        return null;
    }
}
let currentProfilePremium = false;
let currentProfileAdmin = false;
let currentProfileBanned = false;
let profileBanChannel = null;
let profileBanPollTimer = null;
const leaderboardProfiles = new Map();
let leaderboardInventoryRequest = 0;
let showcaseRecords = [];
let activeShowcaseId = null;
let showcaseManagerItems = [];
let showcaseSort = 'value';
let showcaseSettings = { background: 'standard', frame: 'standard', styleLevel: 1 };
let selectedShowcaseInventoryId = null;
let upgraderItems = [];
let upgraderCatalogItems = [];
let upgraderMultiplier = 1.2;
let selectedUpgraderItem = null;
let selectedUpgraderTarget = null;
let upgraderSpinTimers = [];
let upgraderWheelRotation = 0;
const upgraderDebug = (...args) => console.debug('[UPGRADER DEBUG]', ...args);

function setBanState(value) {
    currentProfileBanned = value === true || value === 'true';
    const banScreen = document.querySelector('#ban-screen');
    if (!banScreen) return;
    banScreen.classList.toggle('active', currentProfileBanned);
    banScreen.setAttribute('aria-hidden', String(!currentProfileBanned));
}

function subscribeToProfileBan() {
    if (!supabase || currentProfileId === null) return;
    if (profileBanChannel) supabase.removeChannel(profileBanChannel);
    if (profileBanPollTimer) clearInterval(profileBanPollTimer);
    profileBanChannel = supabase
        .channel(`profile-ban-${currentProfileId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${currentProfileId}` }, payload => {
            setBanState(payload.new?.ban);
        })
        .subscribe(status => {
            if (status === 'CHANNEL_ERROR') console.error('Не удалось подписаться на изменения бана профиля.');
        });
    profileBanPollTimer = setInterval(async () => {
        const { data, error } = await supabase.from('profiles').select('ban').eq('id', currentProfileId).maybeSingle();
        if (!error && data) setBanState(data.ban);
    }, 3000);
}

const showcaseCustomizationOptions = {
    backgrounds: [
        { id: 'standard', label: 'Стандарт' },
        { id: 'dark', label: 'Тёмный' },
        { id: 'red', label: 'Красный' },
        { id: 'gold', label: 'Золотой' },
        { id: 'neon', label: 'Неоновый', premium: true },
        { id: 'premium', label: 'Premium', premium: true },
        { id: 'limited', label: 'Limited', premium: true }
    ],
    frames: [
        { id: 'standard', label: 'Standard' },
        { id: 'silver', label: 'Silver' },
        { id: 'red', label: 'Red' },
        { id: 'gold', label: 'Gold' },
        { id: 'dark', label: 'Dark' },
        { id: 'premium-gold', label: 'Premium Gold', premium: true },
        { id: 'premium-red', label: 'Premium Red', premium: true },
        { id: 'premium-neon', label: 'Premium Neon', premium: true },
        { id: 'premium-diamond', label: 'Premium Diamond', premium: true },
        { id: 'premium-limited', label: 'Premium Limited', premium: true }
    ]
};

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

function getReferralStartParam() {
    const telegramApp = window.Telegram && window.Telegram.WebApp;
    const telegramStartParam = telegramApp?.initDataUnsafe?.start_param;
    if (telegramStartParam) return telegramStartParam;
    const params = new URLSearchParams(window.location.search);
    return params.get('start') || params.get('startapp') || '';
}

function getReferralBotUsername() {
    return 'blackdrop_robot';
}

let freeCaseTimer = null;
let freeCaseOpening = false;
let freeCaseForcedDrop = null;
let freeCaseClaimId = null;
let casesById = new Map();
let selectedCase = null;

function formatFreeCaseCountdown(value) {
    const milliseconds = Math.max(0, new Date(value).getTime() - Date.now());
    const totalHours = Math.floor(milliseconds / 3600000);
    const minutes = Math.floor((milliseconds % 3600000) / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${String(totalHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function freeCaseRarityClass(rarity) {
    return ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical'].includes(rarity) ? rarity : 'common';
}

function renderFreeCaseState(state = {}) {
    const counter = document.querySelector('#free-case-counter');
    const timer = document.querySelector('#free-case-timer');
    const button = document.querySelector('#free-case-claim');
    const remaining = Math.max(0, Number(state.daily_limit || 0) - Number(state.claimed_count || 0));
    if (counter) counter.textContent = `${remaining} / ${Number(state.daily_limit || 0)}`;
    if (button) {
        const claimed = Boolean(state.claimed);
        button.disabled = claimed || remaining <= 0 || !Number(state.items_count);
        button.classList.toggle('free-case-claimed', claimed);
        button.textContent = claimed ? 'Вы уже открыли бесплатный кейс' : 'ЗАБРАТЬ КЕЙС';
    }
    clearInterval(freeCaseTimer);
    if (timer && state.reset_at) {
        const updateTimer = () => {
            timer.textContent = `Сброс через ${formatFreeCaseCountdown(state.reset_at)}`;
        };
        updateTimer();
        freeCaseTimer = setInterval(updateTimer, 1000);
    }
}

async function loadFreeCaseState() {
    if (!supabase) return;
    const { data, error } = await supabase.rpc('get_free_case_state', { p_user_id: currentProfileId ? Number(currentProfileId) : null });
    if (error) {
        console.error('Supabase free case state error:', error);
        return;
    }
    renderFreeCaseState(data || {});
}

async function claimFreeCase() {
    const button = document.querySelector('#free-case-claim');
    if (!supabase || currentProfileId === null || !button || button.disabled || document.body.classList.contains('case-opening-active')) return;
    button.disabled = true;
    button.textContent = 'ПОЛУЧЕНИЕ...';
    const [claimResult, itemsResult] = await Promise.all([
        supabase.rpc('claim_free_case', { p_user_id: Number(currentProfileId) }),
        supabase.rpc('get_free_case_items')
    ]);
    const data = claimResult.data;
    const error = claimResult.error;
    if (error || !data?.claimed) {
        const reason = data?.reason === 'already_claimed'
            ? 'Ты уже получил бесплатный кейс в этом цикле.'
            : data?.reason === 'limit_reached'
                ? 'Лимит бесплатных кейсов на сегодня исчерпан.'
                : 'Не удалось получить бесплатный кейс.';
        showPromoResultToast('FREE CASE', reason, true);
        await loadFreeCaseState();
        return;
    }
    await logPlayerAction('free_case_claimed', {
    claim_id: data.claim_id,
    item_id: data.item_id,
    item_name: data.item_name,
    rarity: data.rarity,
    item_value: Number(data.item_value || 0)
});
    const freeCaseItems = Array.isArray(itemsResult.data) ? itemsResult.data : [];
    const forcedDrop = {
        name: data.item_name,
        price: Number(data.item_value || 0),
        image: data.image_url || './data/assets/items/m5f90.png',
        alt: data.item_name,
        rarity: freeCaseRarityClass(data.rarity),
        chance: 0,
        itemId: data.item_id
    };
    freeCaseClaimId = data.claim_id;
    const freeCaseDrops = freeCaseItems.map(item => ({
        name: item.name,
        price: Number(item.item_value || 0),
        image: item.image_url || './data/assets/items/m5f90.png',
        alt: item.name,
        rarity: freeCaseRarityClass(item.rarity),
        chance: Number(item.chance || 0),
        itemId: item.id
    }));
    if (!freeCaseDrops.some(item => String(item.itemId) === String(forcedDrop.itemId))) freeCaseDrops.push(forcedDrop);
    window.startFreeCaseReel?.(forcedDrop, freeCaseDrops);
}

function getReferralAppShortName() {
    return 'referral';
}

function renderReferralStats(stats = {}) {
    const referralUrl = document.querySelector('#referral-url');
    const referralCount = document.querySelector('#referral-count');
    const referralEarned = document.querySelector('#referral-earned');
    const code = stats.referral_code || (currentProfileId ? `ref_${currentProfileId}` : '');
    if (referralUrl && code) referralUrl.textContent = `https://t.me/${getReferralBotUsername()}/${getReferralAppShortName()}?startapp=${code}`;
    if (referralCount) referralCount.textContent = Number(stats.referrals_count || 0).toLocaleString('ru-RU');
    if (referralEarned) referralEarned.textContent = `${Number(stats.earned_amount || 0).toLocaleString('ru-RU')} BC`;
}

async function processIncomingReferral() {
    const referralCode = getReferralStartParam();
    if (!supabase || currentProfileId === null || !referralCode) return;
    const { data, error } = await supabase.rpc('claim_referral', {
        p_referred_user_id: Number(currentProfileId),
        p_referral_code: referralCode,
        p_reward_amount: 100
    });
    if (error) {
        console.error('Supabase referral claim error:', error);
        return;
    }
if (data?.claimed) {
    await logPlayerAction('referral_claimed', {
        referral_code: referralCode,
        reward_amount: Number(data.reward_amount || 0)
    });

    console.log('Реферальный бонус начислен:', data.reward_amount);
}
}

async function loadReferralStats() {
    if (!supabase || currentProfileId === null) return;
    const { data, error } = await supabase.rpc('get_referral_stats', { p_user_id: Number(currentProfileId) });
    if (error) {
        console.error('Supabase referral stats error:', error);
        return;
    }
    renderReferralStats(data || {});
}

async function shareReferralLink() {
    const referralUrl = document.querySelector('#referral-url')?.textContent;
    if (!referralUrl || referralUrl === 'Загрузка ссылки...') return;
    const shareText = 'Присоединяйся к BR Online и получай бонусы!';
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralUrl)}&text=${encodeURIComponent(shareText)}`;
    const telegramApp = window.Telegram && window.Telegram.WebApp;
    if (telegramApp?.openTelegramLink) {
        telegramApp.openTelegramLink(shareUrl);
        return;
    }
    if (navigator.share) {
        await navigator.share({ title: 'BR Online', text: shareText, url: referralUrl });
        return;
    }
    await navigator.clipboard?.writeText(referralUrl);
}

function safeText(element, value, fallback = 'Player') {
    if (!element) return;
    element.textContent = value || fallback;
}

function updateHeaderPremiumStatus(isPremium, isAdmin = false) {
    const headerStatus = document.querySelector('.player-status');
    const headerBadge = document.querySelector('.header-premium-badge');
    if (headerStatus) headerStatus.textContent = isAdmin ? 'Администратор' : isPremium ? 'PREMIUM' : 'Обычный игрок';
    if (headerBadge) {
        headerBadge.innerHTML = isPremium
            ? '<img src="./data/assets/premium.svg" alt="Premium">'
            : '';
    }
}

function renderAdminBadge(element, isAdmin) {
    if (!element) return;
    element.innerHTML = isAdmin ? '<img src="./data/assets/verify.svg" alt="Администратор">' : '';
}

function renderProfileBadges({ premium = false, admin = false } = {}) {
    renderAdminBadge(document.querySelector('.header-admin-badge'), admin);
    renderAdminBadge(document.querySelector('.profile-admin-badge'), admin);
    const premiumBadge = document.querySelector('.profile-premium-badge');
    if (premiumBadge) premiumBadge.innerHTML = premium ? '<img src="./data/assets/premium.svg" alt="Premium">' : '';
}

function applyTelegramProfileToUI(user) {
    if (!user) return;

    const headerName = document.querySelector('.player-name');
    const headerAvatar = document.querySelector('.header .avatar img');
    const balanceAmount = document.querySelector('.balance-amount');
    const profileName = document.querySelector('.profile-player-name');
    const profileAvatar = document.querySelector('.profile-avatar-circle img');
    const profileBadge = document.querySelector('.profile-premium-badge');
    const profileStatusText = document.querySelector('.profile-rating span:last-child');
    const profileAvatarGlow = document.querySelector('.profile-avatar-glow');
    const profileElements = document.querySelectorAll('.seller-name, .top-player-name, .top-list-player-name');
    const avatarElements = document.querySelectorAll('.top-list-avatar img');

    const displayName = normalizeTelegramName(user);
    const avatarUrl = getTelegramAvatar(user);

    safeText(headerName, displayName);
    updateHeaderPremiumStatus(Boolean(user.is_premium), false);
    renderProfileBadges({ premium: Boolean(user.is_premium), admin: false });
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
        profileBadge.innerHTML = user.is_premium
            ? '<img src="./data/assets/premium.svg" alt="Premium">'
            : '';
    }

    if (profileStatusText) {
        profileStatusText.textContent = 'Онлайн';
    }

    if (profileAvatarGlow) profileAvatarGlow.style.boxShadow = 'none';
}

async function syncTelegramProfileToSupabase(user) {
    if (!supabase) {
        console.error('Профиль не сохранен: Supabase SDK или конфигурация недоступны.');
        return;
    }

    if (!user) {
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
    if (!supabase) return;

    try {
        let profileQuery = supabase
            .from('profiles')
            .select('id, balance, username, avatar_url, premium, admin, showcase_background, ban');

        profileQuery = telegramUser
            ? profileQuery.eq('telegram_id', Number(telegramUser.id))
            : profileQuery.eq('id', 0);

        const { data, error } = await profileQuery.maybeSingle();

        if (error) {
            console.error('Supabase load profile error:', error);
            return;
        }

        currentProfileId = data?.id ?? currentProfileId;
        currentProfileUsername = data?.username || currentProfileUsername;
        currentProfilePremium = Boolean(data?.premium);
        currentProfileAdmin = Boolean(data?.admin);
        window.refreshCasePriceUI?.();
        setBanState(data?.ban);
        subscribeToProfileBan();
        showcaseSettings.background = data?.showcase_background || 'standard';

        const balanceAmount = document.querySelector('.balance-amount');
        if (data && balanceAmount) {
            balanceAmount.textContent = Number(data.balance || 0).toLocaleString('ru-RU');
        }

        await loadProfileStats();

        renderProfileBadges({ premium: Boolean(data?.premium), admin: currentProfileAdmin });
        updateHeaderPremiumStatus(Boolean(data?.premium), currentProfileAdmin);

        if (data && data.username) {
            const displayName = data.username;
            document.querySelectorAll('.player-name, .profile-player-name').forEach(element => {
                element.textContent = displayName;
            });

            const avatarUrl = data.avatar_url || getTelegramAvatar(telegramUser);
            document.querySelectorAll('.header .avatar img, .profile-avatar-circle img').forEach(element => {
                element.src = avatarUrl;
                element.alt = displayName;
            });
        }
    } catch (error) {
        console.error('loadCurrentUserProfile failed:', error);
    }
}

function updateDisplayedUsername(username) {
    document.querySelectorAll('.player-name, .profile-player-name').forEach(element => {
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

function renderInventory(items, showcasedIds = new Set()) {
    const container = document.querySelector('.profile-collection-grid');
    if (!container) return;
    if (!items?.length) {
        container.innerHTML = '<p class="profile-inventory-status">Инвентарь пока пуст</p>';
        return;
    }
    const rarityNames = { common: 'ШИРП', uncommon: 'ОБЫЧНЫЙ', rare: 'РЕДКИЙ', epic: 'ЭПИЧНЫЙ', legendary: 'ЗОЛОТОЙ', mythical: 'КРАСНЫЙ' };
    container.innerHTML = items.map(item => {
        const isShowcased = showcasedIds.has(String(item.id));
        const escapedName = escapeLeaderboardText(item.item_name || 'Предмет');
        return `<article class="profile-item-card profile-item-card--${inventoryRarityClass(item.rarity)}${isShowcased ? ' profile-item-card--showcased' : ''}"><button class="profile-item-sell" type="button" data-inventory-id="${item.id}" aria-label="Продать предмет"${isShowcased ? ' disabled title="Взаимодействие запрещено, пока предмет на витрине"' : ''}><img src="./data/assets/sell.svg" alt="Продать" class="profile-item-sell-icon"></button><div class="profile-item-price"><span>${Number(item.item_value || 0).toLocaleString('ru-RU')}</span><span class="profile-item-coin">◌</span></div><div class="profile-item-visual profile-item-visual--${inventoryRarityClass(item.rarity)}"><img src="${escapeLeaderboardText(item.image_url || './data/assets/items/m5f90.png')}" alt="${escapedName}" class="profile-item-image"></div><div class="profile-item-info"><div class="profile-item-name">${escapedName}</div><span class="profile-item-badge rarity-badge ${item.rarity || 'common'}">${rarityNames[item.rarity] || item.rarity || 'ПРЕДМЕТ'}</span></div>${isShowcased ? '<div class="profile-item-showcased-overlay"><strong>ВИТРИНА</strong><span>Взаимодействие запрещено</span></div>' : ''}</article>`;
    }).join('');
}

async function toggleShowcaseItem(inventoryId, button) {
    if (!supabase || currentProfileId === null) return;
    button.disabled = true;
    const isPublished = showcaseRecords.some(record => String(record.inventory_id) === String(inventoryId) && String(record.user_id) === String(currentProfileId));
    const { error } = await supabase.rpc(isPublished ? 'unpublish_showcase_item' : 'publish_showcase_item', {
        p_inventory_id: Number(inventoryId),
        p_user_id: Number(currentProfileId)
    });
    if (error) {
        console.error('Supabase showcase toggle error:', error);
        button.disabled = false;
        return;
    }
    await logPlayerAction(
    isPublished
        ? 'showcase_item_removed'
        : 'showcase_item_added',
    {
        inventory_id: Number(inventoryId)
    }
);
    await loadInventory();
    await loadUpgraderInventory();
    await loadShowcase();
    renderShowcaseManager();
}

function isPremiumCustomization(option) {
    return option?.premium && !currentProfilePremium;
}

function applyShowcasePreview() {
    const grid = document.querySelector('#showcase-grid');
    if (grid) grid.dataset.showcaseBackground = showcaseSettings.background;
    const selectedRecord = showcaseRecords.find(record => String(record.inventory_id) === String(selectedShowcaseInventoryId));
    if (selectedRecord) {
        selectedRecord.settings = { frame: showcaseSettings.frame, styleLevel: showcaseSettings.styleLevel };
        renderShowcase(showcaseRecords);
    }
    document.querySelectorAll('.showcase-option').forEach(option => {
        const isBackground = option.dataset.optionGroup === 'background';
        const selected = isBackground
            ? option.dataset.optionId === showcaseSettings.background
            : option.dataset.optionId === showcaseSettings.frame;
        option.classList.toggle('selected', selected);
    });
    document.querySelectorAll('.showcase-level-option').forEach(option => option.classList.toggle('selected', Number(option.dataset.level) === Number(showcaseSettings.styleLevel)));
    renderCustomizationPreview();
}

function renderCustomizationPreview() {
    const preview = document.querySelector('#showcase-customization-preview');
    if (!preview) return;
    const record = showcaseRecords.find(item => String(item.inventory_id) === String(selectedShowcaseInventoryId));
    if (!record) {
        preview.innerHTML = '<p class="showcase-customization-empty">Выберите выставленный предмет.</p>';
        return;
    }
    const item = showcaseInventory(record) || {};
    const rarity = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical'].includes(item.rarity) ? item.rarity : 'common';
    preview.innerHTML = `<div class="showcase-preview-label">ПРЕДПРОСМОТР</div><article class="shop-item-card ${rarity} showcase-frame-${escapeLeaderboardText(showcaseSettings.frame)} showcase-style-${Number(showcaseSettings.styleLevel) || 1}"><div class="shop-item-visual"><img src="${escapeLeaderboardText(item.image_url || './data/assets/items/m5f90.png')}" alt="${escapeLeaderboardText(item.item_name || 'Предмет')}"></div><div class="shop-item-rarity">${rarity.toUpperCase()}</div><h3 class="shop-item-name">${escapeLeaderboardText(item.item_name || 'Без названия')}</h3></article>`;
}

function renderCustomizationOptions() {
    const backgrounds = document.querySelector('#showcase-background-options');
    const frames = document.querySelector('#showcase-frame-options');
    const levels = document.querySelector('#showcase-level-options');
    if (!backgrounds || !frames || !levels) return;
    const renderOption = (option, group) => `<button class="showcase-option showcase-asset-option showcase-asset-option--${group} showcase-asset-${option.id}${isPremiumCustomization(option) ? ' premium-locked' : ''}" type="button" data-option-group="${group}" data-option-id="${option.id}"><span class="showcase-asset-preview" aria-hidden="true"></span><span class="showcase-asset-label">${escapeLeaderboardText(option.label)}</span>${option.premium ? '<small class="showcase-premium-mark">PREMIUM</small>' : ''}</button>`;
    backgrounds.innerHTML = showcaseCustomizationOptions.backgrounds.map(option => renderOption(option, 'background')).join('');
    frames.innerHTML = showcaseCustomizationOptions.frames.map(option => renderOption(option, 'frame')).join('');
    const selectedRecord = showcaseRecords.find(record => String(record.inventory_id) === String(selectedShowcaseInventoryId));
    const selectedItem = showcaseInventory(selectedRecord) || {};
    const selectedImage = escapeLeaderboardText(selectedItem.image_url || './data/assets/items/m5f90.png');
    levels.innerHTML = [1, 2, 3, 4, 5].map(level => `<button class="showcase-level-option showcase-level-asset showcase-style-${level}${level >= 4 ? ' premium-locked' : ''}" type="button" data-level="${level}"><span class="showcase-level-preview"><img src="${selectedImage}" alt=""></span><span>УРОВЕНЬ ${level}</span>${level >= 4 ? '<small class="showcase-premium-mark">PREMIUM</small>' : ''}</button>`).join('');
    applyShowcasePreview();
}

function renderCustomizationItems() {
    const container = document.querySelector('#showcase-customization-items');
    if (!container) return;
    const ownRecords = showcaseRecords.filter(record => String(record.user_id) === String(currentProfileId));
    if (!ownRecords.length) {
        container.innerHTML = '<p class="showcase-customization-empty">Сначала выставьте предмет в «Моя витрина».</p>';
        return;
    }
    container.innerHTML = `<strong>ПРЕДМЕТ ДЛЯ ОФОРМЛЕНИЯ</strong><div class="showcase-customization-item-list">${ownRecords.map(record => {
        const item = showcaseInventory(record) || {};
        return `<button class="showcase-customization-item${String(record.inventory_id) === String(selectedShowcaseInventoryId) ? ' selected' : ''}" type="button" data-customization-inventory-id="${record.inventory_id}"><img src="${escapeLeaderboardText(item.image_url || './data/assets/items/m5f90.png')}" alt="${escapeLeaderboardText(item.item_name || 'Предмет')}"><span>${escapeLeaderboardText(item.item_name || 'Без названия')}</span></button>`;
    }).join('')}</div>`;
}

async function saveShowcaseCustomization() {
    if (!supabase || currentProfileId === null) return;
    const saveButton = document.querySelector('#showcase-customization-save');
    if (saveButton) saveButton.disabled = true;
    const { error: profileError } = await supabase.rpc('save_showcase_profile_settings', {
        p_user_id: Number(currentProfileId),
        p_background: showcaseSettings.background
    });
    let itemError = null;
    const selectedRecord = showcaseRecords.find(record => String(record.inventory_id) === String(selectedShowcaseInventoryId));
    if (!profileError && selectedRecord) {
        const { error } = await supabase.rpc('save_showcase_item_settings', {
            p_showcase_id: Number(selectedRecord.id),
            p_user_id: Number(currentProfileId),
            p_frame: showcaseSettings.frame,
            p_style_level: Number(showcaseSettings.styleLevel)
        });
        itemError = error;
    }
    if (profileError || itemError) console.error('Showcase customization save error:', profileError || itemError);
    if (saveButton) saveButton.disabled = false;
    await loadShowcase();
    renderShowcaseManager();
}

function renderShowcaseManager() {
    const grid = document.querySelector('#showcase-manager-grid');
    if (!grid) return;
    const limitMessage = document.querySelector('#showcase-manager-limit');
    if (!showcaseManagerItems.length) {
        grid.innerHTML = '<p class="showcase-state">Инвентарь пока пуст</p>';
        return;
    }
    const showcasedIds = new Set(showcaseRecords.filter(record => String(record.user_id) === String(currentProfileId)).map(record => String(record.inventory_id)));
    const showcaseLimitReached = !currentProfilePremium && showcasedIds.size >= 2;
    if (limitMessage) limitMessage.textContent = currentProfilePremium
        ? 'Premium: можно выставлять любое количество предметов.'
        : `Выставлено ${showcasedIds.size} из 2 предметов. Premium снимает ограничение.`;
    showcaseManagerItems.forEach(item => { item.isShowcased = showcasedIds.has(String(item.id)); });
    showcaseManagerItems.forEach(item => {
        const record = showcaseRecords.find(showcase => String(showcase.inventory_id) === String(item.id));
        item.showcaseSettings = record?.settings || { frame: 'standard', styleLevel: 1 };
    });
    const rarityNames = { common: 'ШИРП', uncommon: 'ОБЫЧНЫЙ', rare: 'РЕДКИЙ', epic: 'ЭПИЧНЫЙ', legendary: 'ЗОЛОТОЙ', mythical: 'КРАСНЫЙ' };
    grid.innerHTML = showcaseManagerItems.map(item => {
        const rarity = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical'].includes(item.rarity) ? item.rarity : 'common';
        const publishDisabled = !item.isShowcased && showcaseLimitReached;
        return `<article class="showcase-manager-item ${rarity}${item.isShowcased ? ' is-showcased' : ''}${String(item.id) === String(selectedShowcaseInventoryId) ? ' customization-selected' : ''}" data-customization-inventory-id="${item.id}"><div class="showcase-manager-item-visual showcase-frame-${escapeLeaderboardText(item.showcaseSettings.frame)} showcase-style-${Number(item.showcaseSettings.styleLevel) || 1}"><img src="${escapeLeaderboardText(item.image_url || './data/assets/items/m5f90.png')}" alt="${escapeLeaderboardText(item.item_name || 'Предмет')}"></div><div class="showcase-manager-item-rarity shop-item-rarity">${rarityNames[rarity]}</div><div class="showcase-manager-item-info"><strong>${escapeLeaderboardText(item.item_name || 'Без названия')}</strong><span>${Number(item.item_value || 0).toLocaleString('ru-RU')} BC</span></div>${item.isShowcased ? `<button class="showcase-manager-customize" type="button" data-customize-inventory-id="${item.id}">КАСТОМ</button>` : ''}<button class="showcase-manager-toggle" type="button" data-showcase-inventory-id="${item.id}"${publishDisabled ? ' disabled title="Обычный игрок может выставить только 2 предмета"' : ''}>${item.isShowcased ? 'СНЯТЬ' : 'ВЫСТАВИТЬ'}</button></article>`;
    }).join('');
}

async function openShowcaseManager() {
    const modal = document.querySelector('#showcase-manager-modal');
    const grid = document.querySelector('#showcase-manager-grid');
    if (!modal || !grid) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    grid.innerHTML = '<p class="showcase-state">Загрузка инвентаря...</p>';
    if (!supabase || currentProfileId === null) return;
    const { data, error } = await supabase.from('inventory').select('id, item_name, rarity, item_value, image_url, quantity, created_at').eq('user_id', currentProfileId).order('created_at', { ascending: false });
    if (error) {
        console.error('Supabase showcase manager inventory error:', error);
        grid.innerHTML = '<p class="showcase-state">Не удалось загрузить инвентарь</p>';
        return;
    }
    showcaseManagerItems = data || [];
    selectedShowcaseInventoryId = showcaseManagerItems.find(item => showcaseRecords.some(record => String(record.inventory_id) === String(item.id)))?.id || showcaseManagerItems[0]?.id || null;
    const selectedRecord = showcaseRecords.find(record => String(record.inventory_id) === String(selectedShowcaseInventoryId));
    showcaseSettings.frame = selectedRecord?.settings?.frame || 'standard';
    showcaseSettings.styleLevel = Number(selectedRecord?.settings?.styleLevel || 1);
    renderCustomizationOptions();
    renderShowcaseManager();
}

function closeShowcaseManager() {
    const modal = document.querySelector('#showcase-manager-modal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
}

function openShowcaseCustomization(inventoryId = null) {
    const modal = document.querySelector('#showcase-customization-modal');
    if (!modal) return;
    const ownRecords = showcaseRecords.filter(record => String(record.user_id) === String(currentProfileId));
    selectedShowcaseInventoryId = inventoryId || selectedShowcaseInventoryId || ownRecords[0]?.inventory_id || null;
    const selectedRecord = ownRecords.find(record => String(record.inventory_id) === String(selectedShowcaseInventoryId));
    showcaseSettings.frame = selectedRecord?.settings?.frame || 'standard';
    showcaseSettings.styleLevel = Number(selectedRecord?.settings?.styleLevel || 1);
    renderCustomizationItems();
    renderCustomizationOptions();
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
}

function closeShowcaseCustomization() {
    const modal = document.querySelector('#showcase-customization-modal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
}

async function sellInventoryItem(inventoryId, button) {
    if (!supabase || currentProfileId === null) return;
    button.disabled = true;
    const { data, error } = await supabase.rpc('sell_inventory_item', {
        p_inventory_id: Number(inventoryId),
        p_user_id: currentProfileId
    });
    if (error) {
        console.error('Supabase inventory sell error:', error);
        button.disabled = false;
        return;
    }

await logPlayerAction('inventory_item_sold', {
    inventory_id: Number(inventoryId),
    balance_after: Number(data || 0)
});

    const balanceAmount = document.querySelector('.balance-amount');
    if (balanceAmount) balanceAmount.textContent = Number(data || 0).toLocaleString('ru-RU');
    await loadInventory();
    await loadProfileStats();
    showSaleToast();
}

function closeSellAllConfirmation() {
    const confirmation = document.querySelector('#sell-all-confirm');
    if (!confirmation) return;
    confirmation.classList.remove('open');
    confirmation.setAttribute('aria-hidden', 'true');
}

function showSellAllConfirmation() {
    const confirmation = document.querySelector('#sell-all-confirm');
    if (!confirmation) return;
    confirmation.classList.add('open');
    confirmation.setAttribute('aria-hidden', 'false');
}

async function sellAllInventory() {
    if (!supabase || currentProfileId === null) return;
    const submitButton = document.querySelector('.sell-all-submit');
    if (submitButton) submitButton.disabled = true;

    const [inventoryResult, showcaseResult] = await Promise.all([
        supabase.from('inventory').select('id').eq('user_id', currentProfileId),
        supabase.from('showcase_items').select('inventory_id').eq('user_id', currentProfileId)
    ]);
    if (inventoryResult.error || showcaseResult.error) {
        console.error('Supabase sell all inventory load error:', inventoryResult.error || showcaseResult.error);
        if (submitButton) submitButton.disabled = false;
        return;
    }

    const showcasedIds = new Set((showcaseResult.data || []).map(item => String(item.inventory_id)));
    const inventoryToSell = (inventoryResult.data || []).filter(item => !showcasedIds.has(String(item.id)));
    if (!inventoryToSell.length) {
        closeSellAllConfirmation();
        if (submitButton) submitButton.disabled = false;
        return;
    }

    try {
        const { data: balance, error } = await supabase.rpc('sell_inventory_items', {
            p_user_id: Number(currentProfileId),
            p_inventory_ids: inventoryToSell.map(item => Number(item.id))
        });

        if (error) {
            console.error('Supabase bulk sell all inventory error:', error);
            if (submitButton) submitButton.disabled = false;
            return;
        }

        await logPlayerAction('inventory_bulk_sold', {
    inventory_ids: inventoryToSell.map(item => Number(item.id)),
    count: inventoryToSell.length,
    balance_after: Number(balance || 0)
});

        const balanceAmount = document.querySelector('.balance-amount');
        if (balanceAmount && balance !== null && balance !== undefined) {
            balanceAmount.textContent = Number(balance).toLocaleString('ru-RU');
        }

        closeSellAllConfirmation();
        await loadInventory();
        await loadProfileStats();
        showSaleToast();
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
}

let saleToastTimer = null;
let premiumToastTimer = null;
let adminToastTimer = null;
let errorToastTimer = null;
let showcaseDevelopmentToastTimer = null;
let promoResultToastTimer = null;

function showSaleToast() {
    const toast = document.querySelector('#sale-toast');
    const closeButton = toast?.querySelector('.sale-toast-close');
    const progress = toast?.querySelector('.sale-toast-progress');
    if (!toast) return;

    clearTimeout(saleToastTimer);
    toast.classList.remove('open');
    void toast.offsetWidth;
    if (progress) progress.style.animation = 'none';
    void toast.offsetWidth;
    if (progress) progress.style.animation = '';
    toast.classList.add('open');
    toast.setAttribute('aria-hidden', 'false');

    const closeToast = () => {
        toast.classList.remove('open');
        toast.setAttribute('aria-hidden', 'true');
    };

    if (closeButton) closeButton.onclick = closeToast;
    saleToastTimer = setTimeout(closeToast, 3000);
}

function showPremiumToast(playerName = '') {
    const toast = document.querySelector('#premium-toast');
    const closeButton = toast?.querySelector('.premium-toast-close');
    const title = toast?.querySelector('#premium-toast-title');
    const message = toast?.querySelector('#premium-toast-message');
    if (!toast) return;

    clearTimeout(premiumToastTimer);
    if (title) title.textContent = playerName ? `Игрок ${playerName} — обладатель PREMIUM` : 'Вы обладатель PREMIUM';
    if (message) message.textContent = 'Чтобы приобрести или узнать подробнее о статусе, перейдите в раздел «Донат»';
    toast.classList.add('open');
    toast.setAttribute('aria-hidden', 'false');

    const closeToast = () => {
        toast.classList.remove('open');
        toast.setAttribute('aria-hidden', 'true');
    };

    if (closeButton) closeButton.onclick = closeToast;
    premiumToastTimer = setTimeout(closeToast, 4000);
}

function showAdminToast(playerName = '') {
    const toast = document.querySelector('#admin-toast');
    const closeButton = toast?.querySelector('.admin-toast-close');
    const title = toast?.querySelector('#admin-toast-title');
    if (!toast) return;

    clearTimeout(adminToastTimer);
    if (title) title.textContent = playerName
        ? `${playerName} — официальный пользователь`
        : 'Официальный пользователь';
    toast.classList.add('open');
    toast.setAttribute('aria-hidden', 'false');

    const closeToast = () => {
        toast.classList.remove('open');
        toast.setAttribute('aria-hidden', 'true');
    };
    if (closeButton) closeButton.onclick = closeToast;
    adminToastTimer = setTimeout(closeToast, 4500);
}

function showInsufficientFundsToast(message = 'Пополните баланс, чтобы открыть кейс.') {
    const toast = document.querySelector('#error-toast');
    const closeButton = toast?.querySelector('.error-toast-close');
    const messageElement = toast?.querySelector('#error-toast-message');
    const progress = toast?.querySelector('.error-toast-progress');
    if (!toast) return;

    clearTimeout(errorToastTimer);
    if (messageElement) messageElement.textContent = message;
    toast.classList.remove('open');
    void toast.offsetWidth;
    if (progress) progress.style.animation = 'none';
    void toast.offsetWidth;
    if (progress) progress.style.animation = '';
    toast.classList.add('open');
    toast.setAttribute('aria-hidden', 'false');

    const closeToast = () => {
        toast.classList.remove('open');
        toast.setAttribute('aria-hidden', 'true');
    };
    if (closeButton) closeButton.onclick = closeToast;
    errorToastTimer = setTimeout(closeToast, 4000);
}

function showShowcaseDevelopmentToast() {
    const toast = document.querySelector('#showcase-development-toast');
    const closeButton = toast?.querySelector('.showcase-development-toast-close');
    if (!toast) return;

    clearTimeout(showcaseDevelopmentToastTimer);
    toast.classList.remove('open');
    void toast.offsetWidth;
    toast.classList.add('open');
    toast.setAttribute('aria-hidden', 'false');

    const closeToast = () => {
        toast.classList.remove('open');
        toast.setAttribute('aria-hidden', 'true');
    };
    if (closeButton) closeButton.onclick = closeToast;
    showcaseDevelopmentToastTimer = setTimeout(closeToast, 5000);
}

function showPromoResultToast(title, message, isError = false) {
    const toast = document.querySelector('#promo-result-toast');
    if (!toast) return;
    clearTimeout(promoResultToastTimer);
    toast.classList.toggle('error', isError);
    toast.querySelector('#promo-result-title').textContent = title;
    toast.querySelector('#promo-result-message').textContent = message;
    toast.classList.remove('open');
    void toast.offsetWidth;
    toast.classList.add('open');
    toast.setAttribute('aria-hidden', 'false');
    const closeToast = () => { toast.classList.remove('open'); toast.setAttribute('aria-hidden', 'true'); };
    toast.querySelector('#promo-result-close').onclick = closeToast;
    promoResultToastTimer = setTimeout(closeToast, 4500);
}

document.addEventListener('click', event => {
    const sellAllButton = event.target.closest('.profile-sell-all-btn');
    if (sellAllButton) {
        showSellAllConfirmation();
        return;
    }

    if (event.target.closest('.sell-all-cancel')) {
        closeSellAllConfirmation();
        return;
    }

    if (event.target.closest('.sell-all-submit')) {
        sellAllInventory();
        return;
    }

    const sortButton = event.target.closest('#showcase-sort-btn');
    if (sortButton) {
        const menu = document.querySelector('#showcase-sort-menu');
        const isOpen = menu && !menu.hidden;
        if (menu) menu.hidden = isOpen;
        sortButton.setAttribute('aria-expanded', String(!isOpen));
        return;
    }

    const sortOption = event.target.closest('[data-showcase-sort]');
    if (sortOption) {
        showcaseSort = sortOption.dataset.showcaseSort;
        const label = document.querySelector('#showcase-sort-label');
        const menu = document.querySelector('#showcase-sort-menu');
        const sortButtonElement = document.querySelector('#showcase-sort-btn');
        if (label) label.textContent = sortOption.textContent;
        document.querySelectorAll('[data-showcase-sort]').forEach(option => option.setAttribute('aria-selected', String(option === sortOption)));
        if (menu) menu.hidden = true;
        if (sortButtonElement) sortButtonElement.setAttribute('aria-expanded', 'false');
        renderShowcase(showcaseRecords);
        return;
    }

    const sortMenu = document.querySelector('#showcase-sort-menu');
    if (sortMenu && !sortMenu.hidden && !event.target.closest('.shop-sort-wrap')) {
        sortMenu.hidden = true;
        document.querySelector('#showcase-sort-btn')?.setAttribute('aria-expanded', 'false');
    }

    const customizationTab = event.target.closest('.showcase-customization-tab');
    if (customizationTab) {
        const panelName = customizationTab.dataset.customizationPanel;
        document.querySelectorAll('.showcase-customization-tab').forEach(tab => {
            const selected = tab === customizationTab;
            tab.classList.toggle('active', selected);
            tab.setAttribute('aria-selected', String(selected));
        });
        document.querySelectorAll('.customization-panel').forEach(panel => {
            const selected = panel.dataset.customizationPanelContent === panelName;
            panel.hidden = !selected;
            panel.classList.toggle('active', selected);
        });
        return;
    }

    const customizationOption = event.target.closest('.showcase-option');
    if (customizationOption) {
        const option = [...showcaseCustomizationOptions.backgrounds, ...showcaseCustomizationOptions.frames].find(item => item.id === customizationOption.dataset.optionId);
        if (isPremiumCustomization(option)) {
            showPremiumToast();
            return;
        }
        if (customizationOption.dataset.optionGroup === 'background') showcaseSettings.background = customizationOption.dataset.optionId;
        if (customizationOption.dataset.optionGroup === 'frame') showcaseSettings.frame = customizationOption.dataset.optionId;
        applyShowcasePreview();
        renderShowcaseManager();
        if (customizationOption.dataset.optionGroup === 'background') saveShowcaseCustomization();
        return;
    }

    const levelOption = event.target.closest('.showcase-level-option');
    if (levelOption) {
        const level = Number(levelOption.dataset.level);
        if (!currentProfilePremium && level >= 4) {
            showPremiumToast();
            return;
        }
        showcaseSettings.styleLevel = level;
        applyShowcasePreview();
        renderShowcaseManager();
        return;
    }

    const customizeButton = event.target.closest('.showcase-manager-customize');
    if (customizeButton) {
        event.stopPropagation();
        showShowcaseDevelopmentToast();
        return;
    }

    const customizationItem = event.target.closest('[data-customization-inventory-id]');
    if (customizationItem && !event.target.closest('.showcase-manager-toggle')) {
        selectedShowcaseInventoryId = customizationItem.dataset.customizationInventoryId;
        const selectedRecord = showcaseRecords.find(record => String(record.inventory_id) === String(selectedShowcaseInventoryId));
        showcaseSettings.frame = selectedRecord?.settings?.frame || 'standard';
        showcaseSettings.styleLevel = Number(selectedRecord?.settings?.styleLevel || 1);
        applyShowcasePreview();
        renderCustomizationItems();
        renderShowcaseManager();
        return;
    }

    if (event.target.closest('#showcase-customization-save')) {
        saveShowcaseCustomization();
        return;
    }

    const showcaseLikeButton = event.target.closest('.showcase-like-button, .showcase-dialog-like');
    if (showcaseLikeButton) {
        event.stopPropagation();
        toggleShowcaseLike(showcaseLikeButton.dataset.showcaseLikeId);
        return;
    }

    const commentLikeButton = event.target.closest('.showcase-comment-like');
    if (commentLikeButton) {
        event.stopPropagation();
        toggleShowcaseCommentLike(commentLikeButton.dataset.commentLikeId);
        return;
    }

    const showcaseCard = event.target.closest('[data-showcase-id]');
    if (showcaseCard) {
        openShowcaseModal(showcaseCard.dataset.showcaseId);
        return;
    }

    const showcaseModal = document.querySelector('#showcase-modal');
    if (showcaseModal && (event.target === showcaseModal || event.target.closest('.showcase-dialog-close'))) {
        closeShowcaseModal();
        return;
    }

    const showcaseManagerToggle = event.target.closest('.showcase-manager-toggle');
    if (showcaseManagerToggle && !showcaseManagerToggle.disabled) {
        toggleShowcaseItem(showcaseManagerToggle.dataset.showcaseInventoryId, showcaseManagerToggle);
        return;
    }

    const showcaseManagerModal = document.querySelector('#showcase-manager-modal');
    if (showcaseManagerModal && (event.target === showcaseManagerModal || event.target.closest('.showcase-manager-close'))) {
        closeShowcaseManager();
        return;
    }

    const showcaseCustomizationModal = document.querySelector('#showcase-customization-modal');
    if (showcaseCustomizationModal && (event.target === showcaseCustomizationModal || event.target.closest('#showcase-customization-modal .showcase-manager-close'))) {
        closeShowcaseCustomization();
        return;
    }

    const showcaseButton = event.target.closest('.profile-item-showcase');
    if (showcaseButton && !showcaseButton.disabled) {
        toggleShowcaseItem(showcaseButton.dataset.showcaseInventoryId, showcaseButton);
        return;
    }

    const sellButton = event.target.closest('.profile-item-sell');
    if (sellButton && !sellButton.disabled) {
        sellInventoryItem(sellButton.dataset.inventoryId, sellButton);
        return;
    }

    const premiumBadge = event.target.closest('.top-player-badge');
    if (premiumBadge) {
        showPremiumToast(premiumBadge.dataset.premiumPlayer || 'Игрок');
        return;
    }

    const adminBadge = event.target.closest('.header-admin-badge, .profile-admin-badge, .top-admin-badge, .seller-admin-tag, .leaderboard-profile-admin');
    if (adminBadge) {
        showAdminToast(adminBadge.dataset.adminPlayer || '');
        return;
    }

    const topPlayer = event.target.closest('[data-profile-id]');
    if (topPlayer) {
        openLeaderboardProfile(topPlayer.dataset.profileId);
        return;
    }

    const profileModal = document.querySelector('#leaderboard-profile-modal');
    if (profileModal && (event.target === profileModal || event.target.closest('.leaderboard-profile-close'))) {
        closeLeaderboardProfile();
    }
});

async function loadInventory() {
    if (!supabase || currentProfileId === null) return;
    const [inventoryResult, showcaseResult] = await Promise.all([
        supabase
            .from('inventory')
            .select('id, item_name, rarity, item_value, image_url, quantity, created_at')
            .eq('user_id', currentProfileId)
            .order('created_at', { ascending: false }),
        supabase
            .from('showcase_items')
            .select('inventory_id')
            .eq('user_id', currentProfileId)
    ]);
    if (inventoryResult.error) {
        console.error('Supabase inventory load error:', inventoryResult.error);
        renderInventory([]);
        return;
    }
    if (showcaseResult.error) console.error('Supabase showcase ownership load error:', showcaseResult.error);
    renderInventory(inventoryResult.data, new Set((showcaseResult.data || []).map(item => String(item.inventory_id))));
}

function resetUpgraderChanceUI() {
    const wrap = document.querySelector('.upgrader-chance-wrap');
    const info = document.querySelector('.upgrader-chance-info');
    const status = document.querySelector('#upgrader-chance-status');
    const page = document.querySelector('.upgrader-page');
    if (wrap) {
        wrap.classList.remove('is-upgrading', 'is-showing-wait', 'is-showing-result', 'is-status-visible');
    }
    page?.classList.remove('is-upgrader-spinning');
    if (info) {
        info.style.opacity = '1';
        info.style.transform = 'translateY(0)';
    }
    if (status) {
        status.textContent = '';
        status.classList.remove('is-success', 'is-fail');
        status.style.opacity = '0';
    }
}

function setUpgraderChanceStatus(mode) {
    const wrap = document.querySelector('.upgrader-chance-wrap');
    const info = document.querySelector('.upgrader-chance-info');
    const status = document.querySelector('#upgrader-chance-status');
    if (!wrap || !status) return;

    wrap.classList.remove('is-showing-wait', 'is-showing-result', 'is-status-visible');
    status.classList.remove('is-success', 'is-fail');
    status.textContent = '';

    if (!mode) {
        status.style.opacity = '0';
        if (info) {
            info.style.opacity = '1';
            info.style.transform = 'translateY(0)';
        }
        return;
    }

    if (mode === 'wait') {
        status.textContent = 'Ждите';
        status.style.opacity = '1';
        wrap.classList.add('is-showing-wait', 'is-status-visible');
        if (info) {
            info.style.opacity = '0';
            info.style.transform = 'translateY(-10px)';
        }
        return;
    }

    status.textContent = mode === 'success' ? 'Успех' : 'Провал';
    status.classList.add(mode === 'success' ? 'is-success' : 'is-fail');
    status.style.opacity = '1';
    wrap.classList.add('is-showing-result', 'is-status-visible');
    if (info) {
        info.style.opacity = '0';
        info.style.transform = 'translateY(-10px)';
    }
}

function spinUpgraderChance(resultSuccess, onComplete) {
    const wrap = document.querySelector('.upgrader-chance-wrap');
    const ring = document.querySelector('.upgrader-chance-ring');
    if (!wrap || !ring) return;

    upgraderSpinTimers.forEach(timer => clearTimeout(timer));
    upgraderSpinTimers = [];

    const value = document.querySelector('#upgrader-chance-value');
    const chance = Number(value?.textContent?.replace('%', '') || 100);
    const fastMode = document.querySelector('.upgrader-fast-toggle')?.getAttribute('aria-pressed') === 'true';
    const totalDuration = fastMode ? 2000 : 5000;
    const waitDelay = 250;
    const resultDelay = totalDuration;
    const resultStayDuration = 1000;
    const baseTurns = fastMode ? 12 : 16;
    const redArc = Math.max(0, Math.min(100, chance)) * 3.6;
    const grayArc = 360 - redArc;
    const nearBoundary = Math.random() < 0.3;
    const edgeInset = Math.max(1, Math.min(4, Math.min(redArc, grayArc) * 0.08));
    const targetCenter = resultSuccess
        ? nearBoundary
            ? Math.max(0.5, redArc - edgeInset)
            : redArc * (0.2 + Math.random() * 0.6)
        : nearBoundary
            ? redArc + edgeInset
            : redArc + grayArc * (0.2 + Math.random() * 0.6);
    const currentAngle = upgraderWheelRotation % 360;
    const spinDelta = (baseTurns * 360) + (360 - targetCenter) - currentAngle;
    const nextRotation = upgraderWheelRotation + spinDelta;
    upgraderWheelRotation = nextRotation;

    document.querySelector('.upgrader-page')?.classList.add('is-upgrader-spinning');
    wrap.classList.add('is-upgrading');
    wrap.classList.remove('is-showing-wait', 'is-showing-result');
    ring.style.transition = `transform ${totalDuration}ms cubic-bezier(0.12, 0.6, 0.22, 1)`;
    ring.style.transform = `rotate(${nextRotation}deg)`;

    const waitTimer = setTimeout(() => {
        setUpgraderChanceStatus('wait');
    }, waitDelay);

    const resultTimer = setTimeout(() => {
        wrap.classList.add('is-showing-result');
        setUpgraderChanceStatus(resultSuccess ? 'success' : 'fail');
    }, resultDelay);

    const clearTimer = setTimeout(async () => {
        resetUpgraderChanceUI();
        if (typeof onComplete === 'function') {
            await onComplete();
        }
    }, resultDelay + resultStayDuration);

    upgraderSpinTimers = [waitTimer, resultTimer, clearTimer];
}

function animateUpgraderChanceValue(nextChance) {
    const value = document.querySelector('#upgrader-chance-value');
    const label = document.querySelector('#upgrader-chance-label');
    if (!value || !label) return;

    value.style.opacity = '0';
    value.style.transform = 'translateY(-8px)';
    label.style.opacity = '0';
    label.style.transform = 'translateY(-8px)';

    setTimeout(() => {
        value.textContent = `${nextChance}%`;
        label.textContent = 'Шанс успеха';
        value.style.opacity = '1';
        value.style.transform = 'translateY(0)';
        label.style.opacity = '1';
        label.style.transform = 'translateY(0)';
    }, 220);
}

function renderUpgraderState() {
    const sourceValue = document.querySelector('.upgrader-source-value');
    const sourcePrice = document.querySelector('.upgrader-source-price');
    const sourceName = document.querySelector('.upgrader-source-name');
    const sourceImage = document.querySelector('#upgrader-source-image');
    const sourceCard = document.querySelector('.upgrader-source-card');
    const targetCard = document.querySelector('.upgrader-target-card');
    const targetImage = document.querySelector('#upgrader-target-image');
    const targetName = document.querySelector('.upgrader-target-name');
    const targetValue = document.querySelector('#upgrader-target-value');
    const chanceValue = document.querySelector('#upgrader-chance-value');
    const chanceRing = document.querySelector('.upgrader-chance-ring');
    const submitButton = document.querySelector('.upgrader-submit');
    if (!sourceValue || !chanceValue) return;
    const rarity = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical'].includes(selectedUpgraderItem?.rarity)
        ? selectedUpgraderItem.rarity
        : 'common';
    if (sourceCard) {
        sourceCard.classList.remove('rarity-common', 'rarity-uncommon', 'rarity-rare', 'rarity-epic', 'rarity-legendary', 'rarity-mythical');
        sourceCard.classList.add(`rarity-${rarity}`);
    }
    if (!selectedUpgraderItem) {
        sourceValue.textContent = 'Выберите предмет';
        if (sourcePrice) sourcePrice.textContent = '0';
        sourceImage.src = './data/assets/items/m5f90.png';
        sourceImage.alt = 'Выберите предмет';
        targetValue.textContent = '0';
        if (targetName) targetName.textContent = 'Выберите шанс, чтобы появился предмет для апгрейда';
        if (targetImage) {
            targetImage.hidden = true;
            targetImage.src = './data/assets/items/m5f90.png';
        }
        targetCard?.classList.remove('rarity-common', 'rarity-uncommon', 'rarity-rare', 'rarity-epic', 'rarity-legendary', 'rarity-mythical');
        targetCard?.classList.add('rarity-common');
        targetCard?.classList.remove('target-selected');
        const previousChance = Number(chanceValue.dataset.currentChance || 0);
        const nextChance = 100;
        chanceValue.dataset.currentChance = String(nextChance);
        if (previousChance !== nextChance) {
            animateUpgraderChanceValue(nextChance);
        } else {
            chanceValue.textContent = `${nextChance}%`;
        }
        if (chanceRing) chanceRing.style.setProperty('--chance', '100%');
        submitButton.disabled = true;
        return;
    }
    const itemValue = Number(selectedUpgraderItem.item_value || 0);
    const expectedTargetValue = Math.round(itemValue * upgraderMultiplier);
    const actualTargetValue = Number(selectedUpgraderTarget?.item_value || expectedTargetValue);
    const multiplierChance = Math.max(5, Math.min(95, Math.round(100 / Math.max(1.2, upgraderMultiplier))));
    const valueChance = actualTargetValue > 0
        ? Math.min(95, Math.round(itemValue / actualTargetValue * 100))
        : multiplierChance;
    const chance = Math.min(95, Math.max(multiplierChance, valueChance));
    sourceValue.textContent = selectedUpgraderItem.item_name || 'Предмет';
    if (sourcePrice) sourcePrice.textContent = itemValue.toLocaleString('ru-RU');
    sourceImage.src = selectedUpgraderItem.image_url || './data/assets/items/m5f90.png';
    sourceImage.alt = selectedUpgraderItem.item_name || 'Предмет';
    targetValue.textContent = actualTargetValue.toLocaleString('ru-RU');
    if (targetName) targetName.textContent = selectedUpgraderTarget?.name || 'Нажмите на шанс';
    if (targetImage) {
        targetImage.hidden = !selectedUpgraderTarget;
        targetImage.src = selectedUpgraderTarget?.image_url || './data/assets/items/m5f90.png';
        targetImage.alt = selectedUpgraderTarget?.name || 'Выберите предмет';
    }
    if (targetCard) {
        const targetRarity = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical'].includes(selectedUpgraderTarget?.rarity)
            ? selectedUpgraderTarget.rarity
            : 'common';
        targetCard.classList.remove('rarity-common', 'rarity-uncommon', 'rarity-rare', 'rarity-epic', 'rarity-legendary', 'rarity-mythical');
        targetCard.classList.add(`rarity-${targetRarity}`);
    }
    const previousChance = Number(chanceValue.dataset.currentChance || 0);
    const nextChance = Number(chance);
    chanceValue.dataset.currentChance = String(nextChance);
    if (previousChance !== nextChance) {
        animateUpgraderChanceValue(nextChance);
    } else {
        chanceValue.textContent = `${nextChance}%`;
    }
    if (chanceRing) chanceRing.style.setProperty('--chance', `${chance}%`);
    submitButton.disabled = false;
}

function renderUpgraderInventory() {
    const grid = document.querySelector('#upgrader-inventory-grid');
    if (!grid) return;
    if (!upgraderItems.length) {
        grid.innerHTML = '<p>Инвентарь пока пуст</p>';
        renderUpgraderState();
        return;
    }
    grid.innerHTML = upgraderItems.map(item => {
        const rarity = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical'].includes(item.rarity) ? item.rarity : 'common';
        const isSelected = String(item.id) === String(selectedUpgraderItem?.id);
        return `
            <div class="upgrader-inventory-cell${isSelected ? ' selected' : ''}">
                <button class="upgrader-inventory-item rarity-${rarity}${isSelected ? ' selected' : ''}" type="button" data-upgrader-item-id="${item.id}">
                    <img src="${escapeLeaderboardText(item.image_url || './data/assets/items/m5f90.png')}" alt="${escapeLeaderboardText(item.item_name || 'Предмет')}">
                </button>
                <div class="upgrader-inventory-meta">
                    <strong class="upgrader-inventory-name">${escapeLeaderboardText(item.item_name || 'Предмет')}</strong>
                    <span class="upgrader-inventory-price">${Number(item.item_value || 0).toLocaleString('ru-RU')} BC</span>
                </div>
            </div>
        `;
    }).join('');
    renderUpgraderState();
}

async function loadUpgraderInventory() {
    const grid = document.querySelector('#upgrader-inventory-grid');
    if (!grid || !supabase || currentProfileId === null) return;
    const { data, error } = await supabase.from('inventory').select('id, item_name, item_value, image_url, rarity, created_at').eq('user_id', currentProfileId).order('created_at', { ascending: false });
    if (error) {
        console.error('Supabase upgrader inventory error:', error);
        grid.innerHTML = '<p>Не удалось загрузить инвентарь</p>';
        return;
    }
    upgraderItems = data || [];
    selectedUpgraderItem = upgraderItems[0] || null;
    renderUpgraderInventory();
}

async function loadUpgraderCatalog() {
    upgraderDebug('catalog: start', { cachedItems: upgraderCatalogItems.length, supabase: Boolean(supabase) });
    if (!supabase || upgraderCatalogItems.length) {
        upgraderDebug('catalog: skipped', { reason: !supabase ? 'supabase unavailable' : 'already cached' });
        return;
    }
    const { data, error } = await supabase.from('items').select('id, name, rarity, item_value, image_url').order('item_value', { ascending: true });
    if (!error && data?.length) {
        upgraderCatalogItems = data;
        upgraderDebug('catalog: loaded from items', { count: data.length, first: data[0] });
        return;
    }
    if (error) console.error('[UPGRADER DEBUG] catalog items error:', error);
    else upgraderDebug('catalog: items table returned no rows');

    const fallback = await supabase
        .from('cases')
        .select('case_items(item_id, item_name, rarity, item_value, image_url)')
        .eq('active', true);
    if (fallback.error) {
        console.error('[UPGRADER DEBUG] catalog fallback error:', fallback.error);
        return;
    }
    const uniqueItems = new Map();
    (fallback.data || []).forEach(caseRecord => {
        (caseRecord.case_items || []).forEach(item => {
            const itemId = item.item_id || `${item.item_name}-${item.item_value}`;
            if (!uniqueItems.has(itemId)) {
                uniqueItems.set(itemId, {
                    id: itemId,
                    name: item.item_name,
                    rarity: item.rarity,
                    item_value: item.item_value,
                    image_url: item.image_url
                });
            }
        });
    });
    upgraderCatalogItems = [...uniqueItems.values()].sort((first, second) => Number(first.item_value) - Number(second.item_value));
    upgraderDebug('catalog: loaded from case_items fallback', { count: upgraderCatalogItems.length, first: upgraderCatalogItems[0] });
}

async function chooseUpgraderTarget() {
    upgraderDebug('chance click', { source: selectedUpgraderItem, multiplier: upgraderMultiplier, catalogCount: upgraderCatalogItems.length });
    try {
        if (!upgraderCatalogItems.length) await loadUpgraderCatalog();
        if (!selectedUpgraderItem) {
            upgraderDebug('target: skipped, source item is not selected');
            return;
        }
        if (!upgraderCatalogItems.length) {
            upgraderDebug('target: skipped, catalog is empty');
            return;
        }
        const expectedValue = Number(selectedUpgraderItem.item_value || 0) * upgraderMultiplier;
        selectedUpgraderTarget = upgraderCatalogItems.reduce((closest, item) => {
            const distance = Math.abs(Number(item.item_value) - expectedValue);
            return !closest || distance < closest.distance ? { item, distance } : closest;
        }, null)?.item || null;
        upgraderDebug('target: selected nearest item', {
            expectedValue,
            target: selectedUpgraderTarget,
            targetDistance: selectedUpgraderTarget
                ? Math.abs(Number(selectedUpgraderTarget.item_value) - expectedValue)
                : null
        });
        renderUpgraderState();
    } catch (error) {
        console.error('[UPGRADER DEBUG] target selection crashed:', error);
    }
}

function showcaseProfile(record) {
    return Array.isArray(record?.profiles) ? record.profiles[0] : record?.profiles;
}

function showcaseInventory(record) {
    return Array.isArray(record?.inventory) ? record.inventory[0] : record?.inventory;
}

function renderShowcase(records) {
    const grid = document.querySelector('#showcase-grid');
    if (!grid) return;
    grid.dataset.showcaseBackground = showcaseSettings.background;
    if (!records.length) {
        grid.innerHTML = '<p class="showcase-state">Витрина пока пуста</p>';
        return;
    }

    const rarityNames = { common: 'ШИРП', uncommon: 'ОБЫЧНЫЙ', rare: 'РЕДКИЙ', epic: 'ЭПИЧНЫЙ', legendary: 'ЗОЛОТОЙ', mythical: 'КРАСНЫЙ' };
    const rarityOrder = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythical: 6 };
    const sortedRecords = [...records].sort((first, second) => {
        const firstItem = showcaseInventory(first) || {};
        const secondItem = showcaseInventory(second) || {};
        if (showcaseSort === 'likes') return Number(second.likeCount || 0) - Number(first.likeCount || 0);
        if (showcaseSort === 'rarity') return (rarityOrder[secondItem.rarity] || 0) - (rarityOrder[firstItem.rarity] || 0);
        if (showcaseSort === 'newest') return new Date(second.created_at).getTime() - new Date(first.created_at).getTime();
        if (showcaseSort === 'oldest') return new Date(first.created_at).getTime() - new Date(second.created_at).getTime();
        return Number(secondItem.item_value || 0) - Number(firstItem.item_value || 0);
    });
    grid.innerHTML = sortedRecords.map(record => {
        const item = showcaseInventory(record) || {};
        const profile = showcaseProfile(record) || {};
        const name = profile.username || [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Игрок';
        const rarity = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical'].includes(item.rarity) ? item.rarity : 'common';
        const itemSettings = record.settings || { frame: 'standard', styleLevel: 1 };
        return `<article class="shop-item-card ${rarity} showcase-frame-${escapeLeaderboardText(itemSettings.frame)} showcase-style-${Number(itemSettings.styleLevel) || 1}" data-showcase-id="${record.id}"><div class="shop-item-price"><span>${Number(item.item_value || 0).toLocaleString('ru-RU')}</span><img src="./data/assets/coin.png" alt="Монеты" class="shop-coin-icon"></div><div class="shop-item-visual"><img src="${escapeLeaderboardText(item.image_url || './data/assets/items/m5f90.png')}" alt="${escapeLeaderboardText(item.item_name || 'Предмет')}"></div><div class="shop-item-rarity">${rarityNames[rarity]}</div><h3 class="shop-item-name">${escapeLeaderboardText(item.item_name || 'Без названия')}</h3><div class="shop-item-seller"><img src="${escapeLeaderboardText(profile.avatar_url || './data/assets/profile.png')}" alt="${escapeLeaderboardText(name)}"><div class="shop-seller-meta"><div class="seller-line"><span class="seller-name">${escapeLeaderboardText(name)}</span>${profile.premium ? '<span class="seller-tag"><img src="./data/assets/premium.svg" alt="Premium"></span>' : ''}${profile.admin ? '<span class="seller-admin-tag"><img src="./data/assets/verify.svg" alt="Администратор"></span>' : ''}</div><span class="shop-seller-rank">${record.likeCount || 0} лайков</span></div></div><button class="showcase-like-button${record.likedByCurrentUser ? ' liked' : ''}" type="button" data-showcase-like-id="${record.id}" aria-label="Лайкнуть витрину">❤ <span>${record.likeCount || 0}</span></button></article>`;
    }).join('');
}

async function loadShowcase() {
    const grid = document.querySelector('#showcase-grid');
    if (!supabase || !grid) return;
    grid.innerHTML = '<p class="showcase-state">Загрузка витрины...</p>';
    const { data, error } = await supabase
        .from('showcase_items')
        .select('id, inventory_id, user_id, created_at, inventory(item_name, rarity, item_value, image_url, quantity), profiles(username, first_name, last_name, avatar_url, premium, admin)')
        .order('created_at', { ascending: false });
    if (error) {
        console.error('Supabase showcase load error:', error);
        grid.innerHTML = '<p class="showcase-state">Не удалось загрузить витрину</p>';
        return;
    }
    const records = data || [];
    if (!records.length) {
        showcaseRecords = [];
        renderShowcase([]);
        return;
    }
    const ids = records.map(record => record.id);
    const [likesResult, commentsResult, settingsResult] = await Promise.all([
        supabase.from('showcase_likes').select('showcase_id, user_id').in('showcase_id', ids),
        supabase.from('showcase_comments').select('id, showcase_id, user_id, content, created_at, profiles(username, avatar_url, admin)').in('showcase_id', ids).order('created_at', { ascending: true }),
        supabase.from('showcase_item_settings').select('showcase_id, frame, style_level').in('showcase_id', ids)
    ]);
    const likes = likesResult.data || [];
    const comments = commentsResult.data || [];
    const commentIds = comments.map(comment => comment.id);
    const commentLikesResult = commentIds.length
        ? await supabase.from('showcase_comment_likes').select('comment_id, user_id').in('comment_id', commentIds)
        : { data: [] };
    const commentLikes = commentLikesResult.data || [];
    const itemSettings = settingsResult.data || [];
    showcaseRecords = records.map(record => {
        const recordLikes = likes.filter(like => String(like.showcase_id) === String(record.id));
        const recordComments = comments.filter(comment => String(comment.showcase_id) === String(record.id)).map(comment => ({
            ...comment,
            likeCount: commentLikes.filter(like => String(like.comment_id) === String(comment.id)).length,
            likedByCurrentUser: commentLikes.some(like => String(like.comment_id) === String(comment.id) && String(like.user_id) === String(currentProfileId))
        }));
        return { ...record, settings: itemSettings.find(settings => String(settings.showcase_id) === String(record.id)) || { frame: 'standard', styleLevel: 1 }, likeCount: recordLikes.length, likedByCurrentUser: recordLikes.some(like => String(like.user_id) === String(currentProfileId)), comments: recordComments };
    });
    renderShowcase(showcaseRecords);
}

function renderShowcaseModal(record) {
    const content = document.querySelector('#showcase-dialog-content');
    const comments = document.querySelector('#showcase-comments');
    const count = document.querySelector('#showcase-comments-count');
    if (!content || !comments || !record) return;
    const item = showcaseInventory(record) || {};
    const profile = showcaseProfile(record) || {};
    const name = profile.username || [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Игрок';
    const rarity = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical'].includes(item.rarity) ? item.rarity : 'common';
    const rarityNames = { common: 'ШИРП', uncommon: 'ОБЫЧНЫЙ', rare: 'РЕДКИЙ', epic: 'ЭПИЧНЫЙ', legendary: 'ЗОЛОТОЙ', mythical: 'КРАСНЫЙ' };
    content.innerHTML = `<div class="showcase-dialog-item ${rarity}"><div class="showcase-dialog-visual"><img src="${escapeLeaderboardText(item.image_url || './data/assets/items/m5f90.png')}" alt="${escapeLeaderboardText(item.item_name || 'Предмет')}"></div><div class="showcase-dialog-item-info"><span>${escapeLeaderboardText(name)}</span><strong>${escapeLeaderboardText(item.item_name || 'Без названия')}</strong><em>${rarityNames[rarity]}</em><small>${Number(item.item_value || 0).toLocaleString('ru-RU')} BC</small></div><button class="showcase-dialog-like${record.likedByCurrentUser ? ' liked' : ''}" type="button" data-showcase-like-id="${record.id}">❤ ${record.likeCount || 0}</button></div>`;
    if (count) count.textContent = String(record.comments?.length || 0);
    comments.innerHTML = record.comments?.length ? record.comments.map(comment => {
        const commentProfile = Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles;
        const commentName = commentProfile?.username || 'Игрок';
        return `<article class="showcase-comment"><img src="${escapeLeaderboardText(commentProfile?.avatar_url || './data/assets/profile.png')}" alt="${escapeLeaderboardText(commentName)}"><div class="showcase-comment-body"><strong>${escapeLeaderboardText(commentName)}${commentProfile?.admin ? ' <span class="seller-admin-tag"><img src="./data/assets/verify.svg" alt="Администратор"></span>' : ''}</strong><p>${escapeLeaderboardText(comment.content)}</p><button class="showcase-comment-like${comment.likedByCurrentUser ? ' liked' : ''}" type="button" data-comment-like-id="${comment.id}">❤ ${comment.likeCount || 0}</button></div></article>`;
    }).join('') : '<p class="showcase-state">Комментариев пока нет</p>';
}

function openShowcaseModal(showcaseId) {
    const record = showcaseRecords.find(item => String(item.id) === String(showcaseId));
    const modal = document.querySelector('#showcase-modal');
    if (!record || !modal) return;
    activeShowcaseId = record.id;
    renderShowcaseModal(record);
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
}

function closeShowcaseModal() {
    const modal = document.querySelector('#showcase-modal');
    if (!modal) return;
    activeShowcaseId = null;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
}

async function toggleShowcaseLike(showcaseId) {
    if (!supabase || currentProfileId === null) return;
    const existing = await supabase.from('showcase_likes').select('id').eq('showcase_id', showcaseId).eq('user_id', currentProfileId).maybeSingle();
    const result = existing.data
        ? await supabase.from('showcase_likes').delete().eq('id', existing.data.id)
        : await supabase.from('showcase_likes').insert({ showcase_id: showcaseId, user_id: currentProfileId });
    if (result.error) console.error('Supabase showcase like error:', result.error);
    if (!result.error) {
    await logPlayerAction(
        existing.data ? 'showcase_unliked' : 'showcase_liked',
        {
            showcase_id: Number(showcaseId)
        }
    );
}
    await loadShowcase();
    if (activeShowcaseId) openShowcaseModal(activeShowcaseId);
}

async function toggleShowcaseCommentLike(commentId) {
    if (!supabase || currentProfileId === null) return;
    const existing = await supabase.from('showcase_comment_likes').select('id').eq('comment_id', commentId).eq('user_id', currentProfileId).maybeSingle();
    const result = existing.data
        ? await supabase.from('showcase_comment_likes').delete().eq('id', existing.data.id)
        : await supabase.from('showcase_comment_likes').insert({ comment_id: commentId, user_id: currentProfileId });
    if (result.error) console.error('Supabase comment like error:', result.error);
    if (!result.error) {
    await logPlayerAction(
        existing.data
            ? 'showcase_comment_unliked'
            : 'showcase_comment_liked',
        {
            comment_id: Number(commentId)
        }
    );
}
    await loadShowcase();
    if (activeShowcaseId) openShowcaseModal(activeShowcaseId);
}

async function loadProfileStats() {
    if (!supabase || currentProfileId === null) return;

    const [inventoryResult, openingsResult] = await Promise.all([
        supabase
            .from('inventory')
            .select('item_value, quantity')
            .eq('user_id', currentProfileId),
        supabase
            .from('case_openings')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', currentProfileId)
    ]);

    if (inventoryResult.error) {
        console.error('Supabase profile stats inventory error:', inventoryResult.error);
        return;
    }
    if (openingsResult.error) {
        console.error('Supabase profile stats openings error:', openingsResult.error);
        return;
    }

    const inventoryItems = inventoryResult.data || [];
    const totalValue = inventoryItems.reduce((sum, item) => sum + Number(item.item_value || 0) * Number(item.quantity || 0), 0);
    const itemCount = inventoryItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const totalValueElement = document.querySelector('#profile-total-value');
    const itemCountElement = document.querySelector('#profile-item-count');
    const caseCountElement = document.querySelector('#profile-case-count');

    if (totalValueElement) totalValueElement.textContent = totalValue.toLocaleString('ru-RU');
    if (itemCountElement) itemCountElement.textContent = itemCount.toLocaleString('ru-RU');
    if (caseCountElement) caseCountElement.textContent = Number(openingsResult.count || 0).toLocaleString('ru-RU');
}

let recentWinsRendered = false;
let recentWinsIds = [];
let recentWinsAnimationTimer = null;
let recentWinsReloadTimer = null;
let recentWinsPollTimer = null;
let recentWinsLoading = false;

function formatWinTime(value) {
    const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
    if (elapsedMinutes < 1) return 'только что';
    if (elapsedMinutes < 60) return `${elapsedMinutes} мин. назад`;
    const elapsedHours = Math.floor(elapsedMinutes / 60);
    return elapsedHours < 24 ? `${elapsedHours} ч. назад` : `${Math.floor(elapsedHours / 24)} дн. назад`;
}

async function loadRecentWins() {
    const container = document.querySelector('.wins-list');
    if (!supabase || !container || recentWinsLoading) return;
    recentWinsLoading = true;

    const [regularResult, freeCaseResult] = await Promise.all([
        supabase
            .from('case_openings')
            .select('id, item_name, rarity, item_value, opened_at, case_id, user_id, cases(name, image_url, case_items(item_name, image_url)), profiles(username, avatar_url, premium, admin)')
            .order('opened_at', { ascending: false })
            .limit(5),
        supabase.rpc('get_recent_free_case_wins', { p_limit: 5 })
    ]);
    if (regularResult.error || freeCaseResult.error) {
        console.error('Supabase recent wins load error:', regularResult.error || freeCaseResult.error);
        container.innerHTML = '<p class="wins-loading">Не удалось загрузить выигрыши</p>';
        recentWinsLoading = false;
        return;
    }
    const freeCaseWins = (Array.isArray(freeCaseResult.data) ? freeCaseResult.data : []).map(win => ({
        id: `free-${win.id}`,
        item_name: win.item_name,
        rarity: win.rarity,
        item_value: win.item_value,
        opened_at: win.opened_at,
        user_id: win.user_id,
        profiles: { username: win.username, avatar_url: win.avatar_url, premium: win.premium, admin: win.admin },
        cases: { name: win.case_name, image_url: win.case_image, case_items: [{ item_name: win.item_name, image_url: win.item_image }] }
    }));
    const data = [...(regularResult.data || []), ...freeCaseWins]
        .sort((first, second) => new Date(second.opened_at).getTime() - new Date(first.opened_at).getTime())
        .slice(0, 5);
    if (!data?.length) {
        container.innerHTML = '<p class="wins-loading">Выигрышей пока нет</p>';
        recentWinsLoading = false;
        return;
    }

    const rarityNames = { common: 'ШИРП', uncommon: 'ОБЫЧНЫЙ', rare: 'РЕДКИЙ', epic: 'ЭПИЧНЫЙ', legendary: 'ЗОЛОТОЙ', mythical: 'КРАСНЫЙ' };
    const markup = data.map(win => {
        const profile = Array.isArray(win.profiles) ? win.profiles[0] : win.profiles;
        const caseData = Array.isArray(win.cases) ? win.cases[0] : win.cases;
        const name = profile?.username || 'Игрок';
        const image = profile?.avatar_url || './data/assets/profile.png';
        const caseItems = caseData?.case_items || [];
        const itemImage = caseItems.find(item => item.item_name === win.item_name)?.image_url || './data/assets/items/m5f90.png';
        const caseName = caseData?.name || 'Кейс';
        const caseImage = caseData?.image_url || './data/case_logo/free.png';
        return `<button class="win-item" type="button" data-win-id="${win.id}" data-case-name="${escapeLeaderboardText(caseName)}" data-case-image="${escapeLeaderboardText(caseImage)}"><span class="win-left"><img src="${escapeLeaderboardText(image)}" alt="${escapeLeaderboardText(name)}" class="win-avatar"><span class="win-info"><span class="win-player-name">${escapeLeaderboardText(name)}${profile?.premium ? ' <span class="seller-tag"><img src="./data/assets/premium.svg" alt="Premium"></span>' : ''}${profile?.admin ? ' <span class="seller-admin-tag"><img src="./data/assets/verify.svg" alt="Администратор"></span>' : ''}</span><span class="win-item-name">${escapeLeaderboardText(win.item_name)}</span></span></span><span class="win-middle"><img src="${itemImage}" alt="${escapeLeaderboardText(win.item_name)}" class="win-item-image"></span><span class="win-right"><span class="rarity-badge ${escapeLeaderboardText(win.rarity || 'common')}">${rarityNames[win.rarity] || win.rarity || 'ПРЕДМЕТ'}</span><span class="win-time">${formatWinTime(win.opened_at)}</span></span></button>`;
    }).join('');

    clearTimeout(recentWinsAnimationTimer);
    const previousPositions = recentWinsRendered
        ? new Map([...container.querySelectorAll('.win-item[data-win-id]')].map(item => [item.dataset.winId, item.getBoundingClientRect().top]))
        : new Map();
    const currentIds = data.map(win => String(win.id));
    const newCount = recentWinsRendered
        ? currentIds.filter(id => !recentWinsIds.includes(id)).length
        : 0;
    recentWinsIds = currentIds;

    const renderUpdatedWins = () => {
        container.innerHTML = markup;
        const nextItems = [...container.querySelectorAll('.win-item[data-win-id]')];
        nextItems.forEach(item => {
            const previousTop = previousPositions.get(item.dataset.winId);
            if (previousTop === undefined) {
                item.classList.add('win-item-new');
                return;
            }
            const offset = previousTop - item.getBoundingClientRect().top;
            if (Math.abs(offset) < 1) return;
            item.style.transition = 'none';
            item.style.transform = `translateY(${offset}px)`;
        });

        requestAnimationFrame(() => {
            nextItems.forEach(item => {
                item.style.transition = '';
                item.style.transform = '';
                item.classList.remove('win-item-new');
            });
        });
    };

    if (recentWinsRendered && newCount > 0 && container.firstElementChild) {
        [...container.querySelectorAll('.win-item')].slice(0, Math.min(newCount, 5)).forEach(item => item.classList.add('win-item-exit'));
        recentWinsAnimationTimer = setTimeout(() => {
            renderUpdatedWins();
        }, 420);
    } else {
        renderUpdatedWins();
    }
    recentWinsRendered = true;
    recentWinsLoading = false;
}

function setupRecentWinsRealtime() {
    if (!supabase) return;
    clearInterval(recentWinsPollTimer);
    recentWinsPollTimer = setInterval(() => loadRecentWins(), 5000);
    supabase
        .channel('recent-wins-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'case_openings' }, () => {
            clearTimeout(recentWinsReloadTimer);
            recentWinsReloadTimer = setTimeout(() => loadRecentWins(), 180);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'free_case_claims' }, () => {
            clearTimeout(recentWinsReloadTimer);
            recentWinsReloadTimer = setTimeout(() => loadRecentWins(), 180);
        })
        .subscribe();
}

async function saveDropToInventory(drop) {
    if (!supabase || currentProfileId === null || !drop) {
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
    if (!error) {
        await logPlayerAction('inventory_item_received', {
    item_id: drop.itemId || null,
    item_name: drop.name,
    rarity: drop.rarity,
    item_value: Number(drop.price || 0)
});
        await loadInventory();
        await loadProfileStats();
    }
    return { error };
}

function escapeLeaderboardText(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

async function openLeaderboardProfile(profileId) {
    const profile = leaderboardProfiles.get(String(profileId));
    const modal = document.querySelector('#leaderboard-profile-modal');
    if (!profile || !modal) return;

    const name = profile.username || [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Игрок';
    const avatar = profile.avatar_url || './data/assets/profile.png';
    const avatarElement = document.querySelector('#leaderboard-profile-avatar');
    const nameElement = document.querySelector('#leaderboard-profile-name');
    const premiumElement = document.querySelector('#leaderboard-profile-premium');
    const adminElement = document.querySelector('#leaderboard-profile-admin');
    const balanceElement = document.querySelector('#leaderboard-profile-balance');
    const spentElement = document.querySelector('#leaderboard-profile-spent');
    const inventoryElement = document.querySelector('#leaderboard-profile-inventory');
    const inventoryCountElement = document.querySelector('#leaderboard-profile-inventory-count');

    if (avatarElement) {
        avatarElement.src = avatar;
        avatarElement.alt = name;
    }
    if (nameElement) nameElement.textContent = name;
    if (premiumElement) premiumElement.hidden = !profile.premium;
    if (adminElement) adminElement.hidden = !profile.admin;
    if (balanceElement) balanceElement.textContent = `${Number(profile.balance || 0).toLocaleString('ru-RU')} BC`;
    if (spentElement) spentElement.textContent = `${Number(profile.total_spent || 0).toLocaleString('ru-RU')} BC`;
    if (inventoryElement) inventoryElement.innerHTML = '<p class="leaderboard-profile-inventory-state">Загрузка инвентаря...</p>';
    if (inventoryCountElement) inventoryCountElement.textContent = 'Загрузка...';
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');

    const requestId = ++leaderboardInventoryRequest;
    if (!supabase || !inventoryElement) return;

    const { data, error } = await supabase
        .from('inventory')
        .select('item_name, item_value, image_url, quantity, rarity')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });
    if (requestId !== leaderboardInventoryRequest) return;
    if (error) {
        console.error('Supabase leaderboard profile inventory error:', error);
        inventoryElement.innerHTML = '<p class="leaderboard-profile-inventory-state">Не удалось загрузить инвентарь</p>';
        if (inventoryCountElement) inventoryCountElement.textContent = 'Ошибка загрузки';
        return;
    }

    const inventory = data || [];
    const itemCount = inventory.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    if (inventoryCountElement) inventoryCountElement.textContent = `${itemCount.toLocaleString('ru-RU')} предметов`;
    if (!inventory.length) {
        inventoryElement.innerHTML = '<p class="leaderboard-profile-inventory-state">Инвентарь пуст</p>';
        return;
    }

    inventoryElement.innerHTML = inventory.map(item => {
        const rarity = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical'].includes(item.rarity) ? item.rarity : 'common';
        return `<article class="leaderboard-profile-inventory-item rarity-${rarity}"><div class="leaderboard-profile-inventory-visual"><img src="${escapeLeaderboardText(item.image_url || './data/assets/items/m5f90.png')}" alt="${escapeLeaderboardText(item.item_name || 'Предмет')}"></div><strong class="leaderboard-profile-inventory-name">${escapeLeaderboardText(item.item_name || 'Без названия')}${Number(item.quantity || 0) > 1 ? ` ×${Number(item.quantity)}` : ''}</strong><span class="leaderboard-profile-inventory-value">${Number(item.item_value || 0).toLocaleString('ru-RU')} BC</span></article>`;
    }).join('');
}

function closeLeaderboardProfile() {
    const modal = document.querySelector('#leaderboard-profile-modal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
}

function renderLeaderboard(profiles, metric = 'balance') {
    const podium = document.querySelector('.top-ranking-grid');
    const list = document.querySelector('.top-players-list');
    if (!podium || !list) return;
    leaderboardProfiles.clear();
    profiles.forEach(profile => leaderboardProfiles.set(String(profile.id), profile));
    if (!profiles.length) {
        podium.innerHTML = '<p class="top-loading">Игроков в рейтинге пока нет</p>';
        list.innerHTML = '';
        return;
    }
    const podiumClasses = { 1: 'first', 2: 'second', 3: 'third' };
    const valueLabel = metric === 'total_spent'
        ? 'Затраты игрока'
        : metric === 'inventory_value'
            ? 'Стоимость инвентаря игрока'
            : 'Баланс игрока';
    const getValue = profile => Number(profile[metric] || 0);
    const formatValue = profile => getValue(profile).toLocaleString('ru-RU');
    const premiumBadge = profile => profile.premium
        ? `<span class="top-player-badge" data-premium-player="${escapeLeaderboardText(profile.username || [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Игрок')}" role="button" tabindex="0" aria-label="Premium игрок"><img src="./data/assets/premium.svg" alt="Premium"></span>`
        : '';
    const adminBadge = profile => profile.admin
        ? '<span class="top-admin-badge" aria-label="Администратор"><img src="./data/assets/verify.svg" alt="Администратор"></span>'
        : '';
    podium.innerHTML = profiles.slice(0, 3).map((profile, index) => {
        const place = index + 1;
        const name = profile.username || [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Игрок';
        const avatar = profile.avatar_url || './data/assets/profile.png';
        return `<article class="top-player-card ${podiumClasses[place]}" data-profile-id="${escapeLeaderboardText(profile.id)}"><div class="top-place">${place}</div><div class="top-avatar-wrap"><div class="top-avatar ${place === 1 ? 'crowned' : 'masked'}"><img src="${escapeLeaderboardText(avatar)}" alt="${escapeLeaderboardText(name)}"><div class="avatar-visor"></div></div></div><div class="top-player-name-row"><div class="top-player-name">${escapeLeaderboardText(name)}</div>${premiumBadge(profile)}${adminBadge(profile)}</div><div class="top-player-balance">${formatValue(profile)} <img src="./data/assets/coin.png" alt="Монеты" class="top-coin-icon"></div></article>`;
    }).join('');
    list.innerHTML = profiles.slice(3).map((profile, index) => {
        const place = index + 4;
        const name = profile.username || [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Игрок';
        const avatar = profile.avatar_url || './data/assets/profile.png';
        const badge = premiumBadge(profile);
        return `<div class="top-list-item" data-profile-id="${escapeLeaderboardText(profile.id)}"><div class="top-list-place">${place}</div><div class="top-list-avatar"><img src="${escapeLeaderboardText(avatar)}" alt="${escapeLeaderboardText(name)}"></div><div class="top-list-info"><div class="top-list-player-name">${escapeLeaderboardText(name)}</div><div class="top-list-badge">${badge}${adminBadge(profile)}</div></div><div class="top-list-score"><span>${formatValue(profile)}</span><img src="./data/assets/coin.png" alt="Монеты" class="list-coin-icon"></div><button class="top-list-arrow" type="button" aria-label="Открыть профиль">›</button></div>`;
    }).join('');
    const subtitle = document.querySelector('.top-subtitle');
    if (subtitle) subtitle.textContent = valueLabel;
}

async function loadLeaderboard(metric = 'balance') {
    if (!supabase) return;
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, username, first_name, last_name, avatar_url, balance, premium, admin, total_spent');
    if (error) {
        console.error('Supabase leaderboard load error:', error);
        renderLeaderboard([]);
        return;
    }

    const rankedProfiles = (profiles || []).map(profile => ({
        ...profile,
        [metric]: metric === 'total_spent' ? Number(profile.total_spent || 0) : Number(profile[metric] || 0)
    }));

    if (metric === 'inventory_value' && rankedProfiles.length) {
        const { data: inventory, error: inventoryError } = await supabase
            .from('inventory')
            .select('user_id, item_value, quantity');
        if (inventoryError) {
            console.error('Supabase inventory leaderboard load error:', inventoryError);
            renderLeaderboard([]);
            return;
        }

        const inventoryTotals = (inventory || []).reduce((totals, item) => {
            const userId = String(item.user_id);
            totals[userId] = (totals[userId] || 0) + Number(item.item_value || 0) * Number(item.quantity || 0);
            return totals;
        }, {});
        rankedProfiles.forEach(profile => {
            profile.inventory_value = inventoryTotals[String(profile.id)] || 0;
        });
    }

    rankedProfiles.sort((first, second) => Number(second[metric] || 0) - Number(first[metric] || 0));
    renderLeaderboard(rankedProfiles.slice(0, 10), metric);
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
    await processIncomingReferral();
    await loadReferralStats();
    await loadFreeCaseState();
    await loadInventory();
    await loadShowcase();
    await loadLeaderboard();
    setupNicknamePrompt(telegramUser);
}

document.addEventListener('DOMContentLoaded', function() {
    const showcaseGrid = document.querySelector('#showcase-grid');
    if (showcaseGrid) showcaseGrid.innerHTML = '<p class="showcase-state">Загрузка витрины...</p>';

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

    const promoInput = document.querySelector('.promo-input');
    const promoButton = document.querySelector('.promo-btn');
    promoButton?.addEventListener('click', async () => {
        const code = promoInput?.value.trim().toUpperCase();
        if (!code) {
            showPromoResultToast('Введите промокод', 'Поле промокода не может быть пустым.', true);
            return;
        }
        if (!supabase || currentProfileId === null) {
            showPromoResultToast('Промокод недоступен', 'Откройте приложение через Telegram.', true);
            return;
        }
        promoButton.disabled = true;
        const { data, error } = await supabase.rpc('apply_promo_code', { p_user_id: Number(currentProfileId), p_code: code });
        promoButton.disabled = false;
        if (error) {
            console.error('Supabase promo apply error:', error);
            showPromoResultToast('Не удалось применить промокод', error.message, true);
            return;
        }
        await logPlayerAction('promo_used', {
    code: code,
    reward_type: data?.reward_type || null,
    reward_value: Number(data?.reward_value || 0),
    balance_after: data?.balance != null
        ? Number(data.balance)
        : null
});
        if (promoInput) promoInput.value = '';
        if (data?.reward_type === 'coins') {
            const balanceAmount = document.querySelector('.balance-amount');
            if (balanceAmount && data.balance !== null) balanceAmount.textContent = Number(data.balance).toLocaleString('ru-RU');
            showPromoResultToast('Промокод применён', `Начислено ${Number(data.reward_value || 0).toLocaleString('ru-RU')} BC.`);
        } else {
            currentProfilePremium = true;
            window.refreshCasePriceUI?.();
            updateHeaderPremiumStatus(true, currentProfileAdmin);
            document.querySelector('.profile-premium-badge')?.replaceChildren(Object.assign(document.createElement('img'), { src: './data/assets/premium.svg', alt: 'Premium' }));
            showPromoResultToast('Промокод применён', 'Premium-статус активирован.');
        }
    });

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
    let openingFinishTimer = null;
    const openingProgress = document.querySelector('.opening-progress span');
    const openingStatus = document.querySelector('.opening-status');
    const dropResultModal = document.querySelector('.drop-result-modal');
    const dropResultClose = document.querySelector('.drop-result-close');
    const dropResultsList = document.getElementById('drop-results-list');
    const dropResultTotal = document.getElementById('drop-result-total-value');
    const dropSaveButton = document.querySelector('.drop-save-btn');
    const dropResultSell = document.querySelector('.drop-sell-btn');
    let reelDrops = [];
    let activeResultDrops = [];
    let resultActionCompleted = false;
    let resultDrop = null;
    let openingInProgress = false;

    const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
    const rarityClass = rarity => ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical'].includes(rarity) ? rarity : 'common';
    const rarityLabel = rarity => ({ common: 'ШИРП', uncommon: 'ОБЫЧНЫЙ', rare: 'РЕДКИЙ', epic: 'ЭПИЧНЫЙ', legendary: 'ЗОЛОТОЙ', mythical: 'КРАСНЫЙ' }[rarity] || rarity || 'ПРЕДМЕТ');

    function getPremiumMultiplier() {
        return currentProfilePremium ? 0.9 : 1;
    }

    function getCasePriceInfo(price, quantity = 1) {
        const basePrice = Number(price || 0) * Number(quantity || 1);
        const premiumMultiplier = getPremiumMultiplier();
        const discountedPrice = basePrice > 0 ? basePrice * premiumMultiplier : 0;
        return {
            basePrice,
            discountedPrice,
            hasPremiumDiscount: Boolean(currentProfilePremium && basePrice > 0)
        };
    }

    function getAdjustedChance(chance) {
        return Number((Number(chance || 0) * getPremiumMultiplier()).toFixed(4));
    }

    function refreshCasePriceUI() {
        if (!casesContainer) return;
        if (casesById.size) {
            renderCases(getOrderedCases([...casesById.values()]));
        }
        if (selectedCase && casesById.has(String(selectedCase.id))) {
            const refreshedCase = casesById.get(String(selectedCase.id));
            if (refreshedCase) {
                selectedCase = refreshedCase;
                renderCaseDetail(refreshedCase);
            }
        }
    }
    window.refreshCasePriceUI = refreshCasePriceUI;

    function getOrderedCases(cases) {
        return [...cases].sort((first, second) => {
            const firstCreated = new Date(first.created_at || 0).getTime();
            const secondCreated = new Date(second.created_at || 0).getTime();
            return firstCreated - secondCreated;
        });
    }

    function renderCaseCard(item) {
        const { basePrice, discountedPrice, hasPremiumDiscount } = getCasePriceInfo(item.price);
        return `<article class="case-card${hasPremiumDiscount ? ' case-card--premium' : ''}" data-case-id="${item.id}"><h3 class="case-card-title">${escapeHtml(item.name)}</h3><div class="case-card-image"><img src="${escapeHtml(item.image_url || './data/case_logo/free.png')}" alt="${escapeHtml(item.name)}"></div><div class="case-card-price${hasPremiumDiscount ? ' case-card-price--premium' : ''}"><img src="./data/assets/coin.png" alt="Монеты" class="price-coin">${hasPremiumDiscount ? `<span class="case-card-price-old">${basePrice.toLocaleString('ru-RU')}</span><span class="case-card-price-new">${discountedPrice.toLocaleString('ru-RU')}</span>` : `<span>${basePrice.toLocaleString('ru-RU')}</span>`}</div><button class="btn-open" type="button">ОТКРЫТЬ</button></article>`;
    }

    function bindCaseCardEvents(container) {
        container?.querySelectorAll('.case-card').forEach(card => card.addEventListener('click', openCaseDetail));
    }

    function renderAllCasesModal(cases) {
        const modalGrid = document.querySelector('#all-cases-grid');
        if (!modalGrid) return;
        modalGrid.innerHTML = cases.map(renderCaseCard).join('');
        bindCaseCardEvents(modalGrid);
    }

    function openAllCasesModal() {
        const modal = document.querySelector('#all-cases-modal');
        if (!modal) return;
        renderAllCasesModal(getOrderedCases([...casesById.values()]));
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
    }

    function closeAllCasesModal() {
        const modal = document.querySelector('#all-cases-modal');
        if (!modal) return;
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
    }

    function renderCases(cases) {
        if (!casesContainer) return;
        if (!cases.length) { casesContainer.innerHTML = '<p class="cases-loading">Активных кейсов пока нет</p>'; return; }
        casesContainer.innerHTML = cases.map(renderCaseCard).join('');
        bindCaseCardEvents(casesContainer);
    }

    async function loadCases() {
        if (!supabase || !casesContainer) return;
        const { data, error } = await supabase.from('cases').select('id, name, price, image_url, active, case_items(id, item_name, rarity, chance, item_value, image_url)').eq('active', true).order('created_at', { ascending: false });
        if (error) { casesContainer.innerHTML = '<p class="cases-loading">Не удалось загрузить кейсы</p>'; console.error('Не удалось загрузить кейсы:', error); return; }
        casesById.clear();
        data.forEach(item => casesById.set(String(item.id), item));
        renderCases(getOrderedCases(data).slice(0, 3));
        renderAllCasesModal(getOrderedCases(data));
    }

    function renderCaseDetail(caseData) {
        const items = [...(caseData.case_items || [])].sort((first, second) => Number(second.item_value || 0) - Number(first.item_value || 0));
        const basePrice = Number(caseData.price || 0);
        const { discountedPrice, hasPremiumDiscount } = getCasePriceInfo(basePrice);
        const openButton = document.querySelector('.open-case-btn');
        document.querySelector('.case-detail-toolbar h1').textContent = caseData.name;
        const detailImage = document.querySelector('.detail-case-image');
        detailImage.src = caseData.image_url || './data/case_logo/free.png';
        detailImage.alt = caseData.name;
        const contents = document.querySelector('.case-contents-grid');
        contents.innerHTML = items.length ? items.map(item => `<article class="case-content-item rarity-${rarityClass(item.rarity)}"><img src="${escapeHtml(item.image_url || './data/assets/items/m5f90.png')}" alt="${escapeHtml(item.item_name)}"><strong>${escapeHtml(item.item_name)}</strong><em>${Number(item.item_value || 0).toLocaleString('ru-RU')} BC</em></article>`).join('') : '<p class="cases-loading">В этом кейсе пока нет предметов</p>';
        reelDrops = items.map(item => ({ name: item.item_name, price: item.item_value, image: item.image_url || './data/assets/items/m5f90.png', alt: item.item_name, rarity: rarityClass(item.rarity), chance: getAdjustedChance(item.chance), caseId: caseData.id }));
        if (openButton) {
            openButton.disabled = !reelDrops.length;
            if (reelDrops.length && hasPremiumDiscount) {
                openButton.innerHTML = `ОТКРЫТЬ ЗА <span class="case-open-current-price">${discountedPrice.toLocaleString('ru-RU')} BC</span> <span class="case-open-old-price">${basePrice.toLocaleString('ru-RU')} BC</span>`;
            } else if (reelDrops.length) {
                openButton.textContent = `ОТКРЫТЬ ЗА ${basePrice.toLocaleString('ru-RU')} BC`;
            } else {
                openButton.textContent = 'В КЕЙСЕ НЕТ ПРЕДМЕТОВ';
            }
        }
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
        const baseTotal = Number(selectedCase.price || 0) * count;
        const { discountedPrice, hasPremiumDiscount } = getCasePriceInfo(baseTotal);
        if (reelDrops.length && hasPremiumDiscount) {
            openCaseButton.innerHTML = `ОТКРЫТЬ ЗА <span class="case-open-current-price">${discountedPrice.toLocaleString('ru-RU')} BC</span> <span class="case-open-old-price">${baseTotal.toLocaleString('ru-RU')} BC</span>`;
            return;
        }
        openCaseButton.textContent = reelDrops.length
            ? `ОТКРЫТЬ ЗА ${baseTotal.toLocaleString('ru-RU')} BC`
            : 'В КЕЙСЕ НЕТ ПРЕДМЕТОВ';
    }

    caseCards.forEach(card => card.addEventListener('click', openCaseDetail));
    openCaseButtons.forEach(button => button.addEventListener('click', openCaseDetail));

    document.querySelector('.view-all')?.addEventListener('click', event => {
        event.preventDefault();
        openAllCasesModal();
    });

    document.querySelector('#all-cases-modal')?.addEventListener('click', event => {
        if (event.target === event.currentTarget) closeAllCasesModal();
    });

    document.querySelector('.all-cases-close')?.addEventListener('click', closeAllCasesModal);

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            const allCasesModal = document.querySelector('#all-cases-modal');
            if (allCasesModal && allCasesModal.classList.contains('open')) closeAllCasesModal();
        }
    });

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
        activeResultDrops = drops;
        resultActionCompleted = freeCaseOpening;
        dropResultsList.innerHTML = drops.map((drop, index) => `<label class="drop-result-item"><input type="checkbox" checked data-result-index="${index}"><span class="drop-result-check"><img src="./data/assets/check.svg" alt=""></span><span class="drop-result-image-wrap"><img src="${escapeHtml(drop.image)}" alt="${escapeHtml(drop.alt)}"></span><span class="drop-result-info"><strong>${escapeHtml(drop.name)}</strong><small>${Number(drop.price || 0).toLocaleString('ru-RU')} BC</small></span></label>`).join('');
        const totalValue = drops.reduce((sum, drop) => sum + (Number(drop.price) || 0), 0);
        if (dropResultTotal) dropResultTotal.textContent = `${totalValue.toLocaleString('ru-RU')} BC`;
        if (dropSaveButton) dropSaveButton.textContent = `СОХРАНИТЬ ВЫБРАННЫЕ (${drops.length})`;
        if (dropResultSell) dropResultSell.textContent = 'ПРОДАТЬ ВЫБРАННЫЕ';
        dropSaveButton?.removeAttribute('hidden');
        dropResultSell?.removeAttribute('hidden');
        if (freeCaseOpening) {
            if (dropSaveButton) dropSaveButton.textContent = 'СОХРАНИТЬ В ИНВЕНТАРЬ';
            if (dropResultSell) dropResultSell.textContent = 'ПРОДАТЬ ДРОП';
        }

        dropResultModal.classList.add('active');
        dropResultModal.setAttribute('aria-hidden', 'false');
    }

    function hideResultModal() {
        if (!dropResultModal) return;
        dropResultModal.classList.remove('active');
        dropResultModal.setAttribute('aria-hidden', 'true');
    }

    function chooseDrop() {
        if (freeCaseOpening && freeCaseForcedDrop) {
            const forcedIndex = reelDrops.findIndex(drop => String(drop.itemId) === String(freeCaseForcedDrop.itemId) || drop.name === freeCaseForcedDrop.name);
            return { drop: freeCaseForcedDrop, winnerIndex: forcedIndex >= 0 ? forcedIndex : reelDrops.length - 1 };
        }
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
            item.className = `reel-item-shell rarity-${drop.rarity}`;
            item.innerHTML = `
                <div class="reel-item">
                    <span>${Number(drop.chance).toLocaleString('ru-RU')}%</span>
                    <img src="${escapeHtml(drop.image)}" alt="${escapeHtml(drop.alt)}">
                </div>
                <div class="reel-item-meta">
                    <strong>${escapeHtml(drop.name)}</strong>
                    <small>${Number(drop.price || 0).toLocaleString('ru-RU')} BC</small>
                </div>
            `;
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
        const winnerIndex = Number(winnerElement?.dataset.dropIndex);
        return { window: windowElement, track, drop: reelDrops[winnerIndex] || selection.drop, winnerElement, winnerIndex, position: 0, velocity: 0, startPosition: 0, targetPosition: 0, duration: 5800 + Math.random() * 1400, animationFrame: 0, inertiaFrame: 0, dragging: false, pointerX: 0, pointerTime: 0 };
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
            const winner = instance.track.querySelector('.reel-winner');
            const winnerIndex = Number(winner?.dataset.dropIndex);
            return reelDrops[winnerIndex] || instance.drop;
        });
        resultDrop = results[0];
        if (freeCaseOpening) {
            resultActionCompleted = true;
        } else {
            await recordCaseOpenings(results);
        }
        if (openingStatus) openingStatus.textContent = 'Открытие завершено';
        clearTimeout(openingFinishTimer);
        openingFinishTimer = setTimeout(() => showResultModal(results), 750);
    }

    async function recordCaseOpenings(drops) {
        if (!supabase || currentProfileId === null || !selectedCase || !drops.length) return;
        const { error } = await supabase.from('case_openings').insert(drops.map(drop => ({
            user_id: currentProfileId,
            case_id: selectedCase.id,
            item_name: drop.name,
            rarity: drop.rarity,
            item_value: Number(drop.price) || 0
        })));
        if (error) {
            console.error('Supabase case opening save error:', error);
            return;
        }
await logPlayerAction('case_opened', {
    case_id: Number(selectedCase.id),
    case_name: selectedCase.name || null,
    quantity: drops.length,
    drops: drops.map(drop => ({
        item_id: drop.itemId || null,
        item_name: drop.name,
        rarity: drop.rarity,
        value: Number(drop.price || 0)
    })),
    total_value: drops.reduce(
        (sum, drop) => sum + Number(drop.price || 0),
        0
    )
});
        await loadProfileStats();
    }

    async function chargeCaseOpening(quantity) {
        if (!supabase || currentProfileId === null || !selectedCase) {
            return { error: new Error('Профиль игрока не найден. Откройте приложение через Telegram.') };
        }
        const { data, error } = await supabase.rpc('charge_case_opening', {
            p_case_id: Number(selectedCase.id),
            p_user_id: Number(currentProfileId),
            p_quantity: Number(quantity)
        });
        if (!error) {

await logPlayerAction('case_open_started', {
    case_id: Number(selectedCase.id),
    case_name: selectedCase.name || null,
    quantity: Number(quantity),
    balance_after: Number(data || 0)
});
            const balanceAmount = document.querySelector('.balance-amount');
            if (balanceAmount) balanceAmount.textContent = Number(data || 0).toLocaleString('ru-RU');
        }
        return { data, error };
    }

    function selectQuickDrops(quantity) {
        return Array.from({ length: quantity }, () => chooseDrop().drop);
    }

    async function startQuickOpening(quantity) {
        const drops = selectQuickDrops(quantity);
        resultDrop = drops[0];
        await recordCaseOpenings(drops);
        showResultModal(drops);
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

    function startReelOpening(forcedCount = null) {
        if (!openingOverlay || !reelStage || !reelDrops.length) return;
        hideResultModal();
        const selectedCount = forcedCount || Number(document.querySelector('.open-count.selected')?.textContent.replace('x', '')) || 1;
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
            instance.targetPosition = windowWidth / 2 - (winner.offsetLeft + winnerWidth / 2);
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

    window.startFreeCaseReel = (forcedDrop, drops) => {
        reelDrops = drops;
        freeCaseForcedDrop = forcedDrop;
        freeCaseOpening = true;
        reelInstances.forEach(instance => {
            cancelAnimationFrame(instance.animationFrame);
            cancelAnimationFrame(instance.inertiaFrame);
        });
        reelInstances = [];
        openingOverlay.classList.add('active');
        openingOverlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('case-opening-active');
        startReelOpening(1);
    };

    if (openCaseButton) {
        openCaseButton.addEventListener('click', async function() {
            if (openingInProgress || !selectedCase || !reelDrops.length) return;
            openingInProgress = true;
            openCaseButton.disabled = true;
            const selectedCount = Number(document.querySelector('.open-count.selected')?.textContent.replace('x', '')) || 1;
            const chargeResult = await chargeCaseOpening(selectedCount);
            if (chargeResult.error) {
                console.error('Supabase case charge error:', chargeResult.error);
                showInsufficientFundsToast(chargeResult.error.message.includes('Недостаточно')
                    ? 'На балансе недостаточно BC для этого открытия.'
                    : 'Не удалось списать стоимость кейса. Попробуйте еще раз.');
                openingInProgress = false;
                openCaseButton.disabled = false;
                return;
            }
            openingOverlay.classList.add('active');
            openingOverlay.setAttribute('aria-hidden', 'false');
            document.body.classList.add('case-opening-active');
            if (quickToggle?.getAttribute('aria-pressed') === 'true') {
                await startQuickOpening(selectedCount);
            } else {
                startReelOpening();
            }
            openingInProgress = false;
            openCaseButton.disabled = false;
        });
    }

    if (openingClose) {
        openingClose.addEventListener('click', function() {
            openingOverlay.classList.remove('active');
            openingOverlay.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('case-opening-active');
            hideResultModal();
            reelInstances.forEach(instance => { cancelAnimationFrame(instance.animationFrame); cancelAnimationFrame(instance.inertiaFrame); });
            clearTimeout(openingFinishTimer);
            reelIsRunning = false;
            freeCaseOpening = false;
            freeCaseForcedDrop = null;
            freeCaseClaimId = null;
            loadFreeCaseState();
            loadRecentWins();
        });
    }

    function getSelectedResultDrops() {
        return [...(dropResultsList?.querySelectorAll('[data-result-index]:checked') || [])]
            .map(input => activeResultDrops[Number(input.dataset.resultIndex)])
            .filter(Boolean);
    }

    function isFreeCaseResultSale() {
        return Boolean((freeCaseOpening || freeCaseClaimId) && (freeCaseForcedDrop || activeResultDrops.some(drop => String(drop.itemId || '') === String(freeCaseForcedDrop?.itemId || ''))));
    }

    async function saveResultDrops(drops) {
        if (!drops.length) return new Error('Нет предметов для сохранения.');
        const results = await Promise.all(drops.map(drop => saveDropToInventory(drop)));
        return results.find(result => result.error)?.error || null;
    }

    function closeResultFlow() {
        hideResultModal();
        openingOverlay.classList.remove('active');
        openingOverlay.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('case-opening-active');
        freeCaseOpening = false;
        freeCaseForcedDrop = null;
        freeCaseClaimId = null;
        loadInventory();
        loadProfileStats();
        loadFreeCaseState();
        loadRecentWins();
    }

    async function sellResultDrops(drops) {
        if (!supabase || currentProfileId === null || !drops.length) return new Error('Не выбраны предметы или профиль не найден.');
        const total = drops.reduce((sum, drop) => sum + (Number(drop.price) || 0), 0);
        const { data: profile, error: readError } = await supabase.from('profiles').select('balance').eq('id', currentProfileId).single();
        if (readError) return readError;
        const { error } = await supabase.from('profiles').update({ balance: Number(profile.balance || 0) + total, updated_at: new Date().toISOString() }).eq('id', currentProfileId);
        if (!error) {

await logPlayerAction('case_items_sold', {
    case_id: selectedCase?.id || null,
    case_name: selectedCase?.name || null,
    items: drops.map(drop => ({
        item_id: drop.itemId || null,
        item_name: drop.name,
        rarity: drop.rarity,
        value: Number(drop.price || 0)
    })),
    total_value: total,
    balance_before: Number(profile.balance || 0),
    balance_after: Number(profile.balance || 0) + total
});

            const balanceAmount = document.querySelector('.balance-amount');
            if (balanceAmount) balanceAmount.textContent = (Number(profile.balance || 0) + total).toLocaleString('ru-RU');
            await loadProfileStats();
        }
        return error;
    }

    if (dropSaveButton) {
        dropSaveButton.addEventListener('click', async () => {
            const drops = getSelectedResultDrops();
            if (!drops.length) return;
            if (isFreeCaseResultSale()) {
                resultActionCompleted = true;
                closeResultFlow();
                return;
            }
            dropSaveButton.disabled = true;
            const error = await saveResultDrops(drops);
            dropSaveButton.disabled = false;
            if (error) { dropSaveButton.textContent = `Ошибка сохранения: ${error.message}`; return; }
            resultActionCompleted = true;
            dropSaveButton.textContent = 'СОХРАНЕНО';
            closeResultFlow();
        });
    }

    if (dropResultSell) {
        dropResultSell.addEventListener('click', async () => {
            const drops = getSelectedResultDrops();
            if (!drops.length) return;
            const isFreeCaseSale = isFreeCaseResultSale();
            if (isFreeCaseSale) {
                if (!supabase || !currentProfileId || !freeCaseClaimId) return;
                dropResultSell.disabled = true;
                const { data, error } = await supabase.rpc('sell_free_case_claim', {
                    p_claim_id: Number(freeCaseClaimId),
                    p_user_id: Number(currentProfileId)
                });
                dropResultSell.disabled = false;
                if (error || !data?.sold) {
                    dropResultSell.textContent = 'ОШИБКА ПРОДАЖИ';
                    return;
                }
                await logPlayerAction('free_case_sold', {
    claim_id: Number(freeCaseClaimId),
    item_id: drops[0]?.itemId || null,
    item_name: drops[0]?.name || null,
    item_value: Number(drops[0]?.price || 0),
    balance_after: Number(data.balance || 0)
});
                const balanceAmount = document.querySelector('.balance-amount');
                if (balanceAmount) balanceAmount.textContent = Number(data.balance || 0).toLocaleString('ru-RU');
                await loadProfileStats();
                resultActionCompleted = true;
                closeResultFlow();
                return;
            }
            dropResultSell.disabled = true;
            const error = await sellResultDrops(drops);
            dropResultSell.disabled = false;
            if (error) { dropResultSell.textContent = `Ошибка продажи: ${error.message}`; return; }
            resultActionCompleted = true;
            dropResultSell.textContent = 'ПРОДАНО';
            closeResultFlow();
        });
    }

    if (dropResultClose) {
        dropResultClose.addEventListener('click', async function() {
            if (!resultActionCompleted && activeResultDrops.length) {
                dropResultClose.disabled = true;
                const error = await saveResultDrops(activeResultDrops);
                dropResultClose.disabled = false;
                if (error) {
                    console.error('Supabase automatic inventory save error:', error);
                    dropResultClose.title = `Не удалось сохранить предметы: ${error.message}`;
                    return;
                }
                resultActionCompleted = true;
            }
            hideResultModal();
            openingOverlay.classList.remove('active');
            openingOverlay.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('case-opening-active');
            reelInstances.forEach(instance => { cancelAnimationFrame(instance.animationFrame); cancelAnimationFrame(instance.inertiaFrame); });
            clearTimeout(openingFinishTimer);
            reelIsRunning = false;
            freeCaseOpening = false;
            freeCaseForcedDrop = null;
            freeCaseClaimId = null;
            loadInventory();
            loadProfileStats();
            loadFreeCaseState();
            loadRecentWins();
        });
    }

    loadCases();
    loadRecentWins();
    setupRecentWinsRealtime();

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

    document.querySelector('.btn-add')?.addEventListener('click', () => showPage('donate'));

    document.querySelector('[data-open-upgrader]')?.addEventListener('click', () => {
        upgraderDebug('upgrader opened');
        showPage('upgrader');
        loadUpgraderInventory();
        loadUpgraderCatalog();
    });
    document.querySelector('[data-close-upgrader]')?.addEventListener('click', () => showPage('home'));
    document.querySelector('.upgrader-fast-toggle')?.addEventListener('click', event => {
        const button = event.currentTarget;
        button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true'));
    });
    const chanceRing = document.querySelector('.upgrader-chance-ring');
    upgraderDebug('ring binding', { found: Boolean(chanceRing) });
    chanceRing?.addEventListener('click', chooseUpgraderTarget);
    chanceRing?.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            chooseUpgraderTarget();
        }
    });
    document.querySelectorAll('[data-upgrader-multiplier]').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('[data-upgrader-multiplier]').forEach(option => option.classList.toggle('selected', option === button));
            upgraderMultiplier = Number(button.dataset.upgraderMultiplier) || 1.2;
            upgraderDebug('multiplier changed', { multiplier: upgraderMultiplier });
            renderUpgraderState();
            chooseUpgraderTarget();
        });
    });
    document.querySelector('#upgrader-inventory-grid')?.addEventListener('click', event => {
        const itemButton = event.target.closest('[data-upgrader-item-id]');
        if (!itemButton) return;
        selectedUpgraderItem = upgraderItems.find(item => String(item.id) === String(itemButton.dataset.upgraderItemId)) || null;
        selectedUpgraderTarget = null;
        renderUpgraderInventory();
    });
    document.querySelector('.upgrader-submit')?.addEventListener('click', async () => {
        if (!selectedUpgraderItem || !supabase || currentProfileId === null) return;

        const submitButton = document.querySelector('.upgrader-submit');
        if (submitButton) submitButton.disabled = true;
        document.querySelector('.upgrader-page')?.classList.add('is-upgrader-spinning');

        try {
            const { data, error } = await supabase.rpc('upgrade_inventory_item', {
                p_user_id: Number(currentProfileId),
                p_inventory_id: Number(selectedUpgraderItem.id),
                p_multiplier: Number(upgraderMultiplier)
            });

            if (error) {
                console.error('Supabase upgrader rpc error:', error);
                resetUpgraderChanceUI();
                showInsufficientFundsToast(error.message || 'Не удалось выполнить апгрейд.');
                return;
            }

            if (!data || data.ok === false) {
                resetUpgraderChanceUI();
                showInsufficientFundsToast(data?.error || 'Не удалось выполнить апгрейд.');
                return;
            }
await logPlayerAction(
    data.success ? 'upgrader_success' : 'upgrader_failed',
    {
        inventory_id: Number(selectedUpgraderItem.id),
        item_name: selectedUpgraderItem.item_name || null,
        item_value: Number(selectedUpgraderItem.item_value || 0),
        rarity: selectedUpgraderItem.rarity || null,
        multiplier: Number(upgraderMultiplier),
        success: Boolean(data.success),
        result: data
    }
);

            spinUpgraderChance(Boolean(data.success), async () => {
                selectedUpgraderTarget = null;
                await loadUpgraderInventory();
                await loadInventory();
                await chooseUpgraderTarget();
            });
        } catch (error) {
            console.error('Upgrader submit crashed:', error);
            resetUpgraderChanceUI();
            showInsufficientFundsToast('Не удалось выполнить апгрейд. Попробуйте ещё раз.');
        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    });

    document.querySelectorAll('.header-premium-badge, .profile-premium-badge').forEach(badge => {
        const openPremiumToast = () => {
            if (badge.querySelector('img')) showPremiumToast();
        };
        badge.addEventListener('click', openPremiumToast);
        badge.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openPremiumToast();
            }
        });
    });

    document.addEventListener('keydown', event => {
        const adminBadge = event.target.closest('.header-admin-badge, .profile-admin-badge, .top-admin-badge, .seller-admin-tag, .leaderboard-profile-admin');
        if (!adminBadge || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        showAdminToast(adminBadge.dataset.adminPlayer || '');
    });

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

    const settingsModal = document.querySelector('#settings-modal');
    const settingsButton = document.querySelector('.profile-settings-btn');
    const settingsCloseButton = document.querySelector('.settings-close-btn');

    function setSettingsModal(open) {
        if (!settingsModal) return;
        settingsModal.classList.toggle('open', open);
        settingsModal.setAttribute('aria-hidden', String(!open));
    }

    settingsButton?.addEventListener('click', () => setSettingsModal(true));
    settingsCloseButton?.addEventListener('click', () => setSettingsModal(false));
    settingsModal?.addEventListener('click', event => {
        if (event.target === settingsModal) setSettingsModal(false);
    });

    document.querySelector('#showcase-comment-form')?.addEventListener('submit', async event => {
        event.preventDefault();
        const input = document.querySelector('#showcase-comment-input');
        const content = input?.value.trim();
        if (!content || !activeShowcaseId || !supabase || currentProfileId === null) return;
        const { error } = await supabase.from('showcase_comments').insert({ showcase_id: activeShowcaseId, user_id: currentProfileId, content });
        if (error) {
            console.error('Supabase showcase comment error:', error);
            return;
        }
        input.value = '';
        await loadShowcase();
        openShowcaseModal(activeShowcaseId);
    });

    document.querySelector('.shop-profile-btn')?.addEventListener('click', openShowcaseManager);
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') setSettingsModal(false);
    });

    document.querySelector('[data-settings-action="nickname"]')?.addEventListener('click', () => {
        setSettingsModal(false);
        openNicknameModal();
    });

    document.querySelector('[data-settings-action="referral"]')?.addEventListener('click', () => {
        setSettingsModal(false);
        showPage('referral');
        loadReferralStats();
    });

    document.querySelector('.referral-share-btn')?.addEventListener('click', async () => {
        try {
            await shareReferralLink();
        } catch (error) {
            if (error?.name !== 'AbortError') console.error('Referral share error:', error);
        }
    });

    document.querySelector('#free-case-claim')?.addEventListener('click', claimFreeCase);

    document.querySelector('.referral-back-btn')?.addEventListener('click', () => {
        showPage('profile');
    });

    const topTabs = document.querySelectorAll('.top-tab[data-top-metric]');
    topTabs.forEach(tab => {
        tab.addEventListener('click', async () => {
            topTabs.forEach(topTab => topTab.classList.remove('active'));
            tab.classList.add('active');
            const topMetric = tab.dataset.topMetric || 'balance';
            const podium = document.querySelector('.top-ranking-grid');
            const list = document.querySelector('.top-players-list');
            if (podium) podium.innerHTML = '<p class="top-loading">Загрузка рейтинга...</p>';
            if (list) list.innerHTML = '<p class="top-loading">Загрузка рейтинга...</p>';
            await loadLeaderboard(topMetric);
        });
    });

    showPage('home');
    initTelegramAuth();
});

})();

function processPlayerLogs_() {
  const props = PropertiesService.getScriptProperties();

  let lastId = Number(
    props.getProperty('PLAYER_LOG_LAST_ID') || 0
  );

  const rows = supabaseRequest_(
    'bot_logs',
    'get',
    null,
    {
      id: 'gt.' + lastId,
      order: 'id.asc',
      limit: '50'
    }
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    return;
  }

  let maxId = lastId;

  rows.forEach(function(row) {
    try {
      const text = formatPlayerLog_(row);

      sendAdminTopic_(
        cfg_('TOPIC_LOGGING'),
        text
      );

      maxId = Math.max(maxId, Number(row.id));

    } catch (err) {
      console.error(
        'PLAYER LOG SEND ERROR:',
        err
      );
    }
  });

  if (maxId > lastId) {
    props.setProperty(
      'PLAYER_LOG_LAST_ID',
      String(maxId)
    );
  }
}


function formatPlayerLog_(row) {
  const details = row.details || {};
  const action = row.action || 'unknown';

  const telegramId = row.telegram_id
    ? String(row.telegram_id)
    : '—';

  const userId = details.user_id
    ? String(details.user_id)
    : '—';

  const username = details.username
    ? '@' + String(details.username).replace(/^@/, '')
    : '—';

  const time = row.created_at
    ? String(row.created_at)
    : '—';

  let icon = '📌';
  let title = action;

  switch (action) {

    case 'case_open_started':
      icon = '🎰';
      title = 'Начато открытие кейса';
      break;

    case 'case_opened':
      icon = '📦';
      title = 'Кейс открыт';
      break;

    case 'inventory_item_received':
      icon = '🎁';
      title = 'Предмет получен';
      break;

    case 'inventory_item_sold':
      icon = '💰';
      title = 'Предмет продан';
      break;

    case 'inventory_bulk_sold':
      icon = '💰';
      title = 'Инвентарь продан';
      break;

    case 'case_items_sold':
      icon = '💵';
      title = 'Предметы из кейса проданы';
      break;

    case 'free_case_claimed':
      icon = '🎁';
      title = 'Бесплатный кейс получен';
      break;

    case 'free_case_sold':
      icon = '💵';
      title = 'Предмет бесплатного кейса продан';
      break;

    case 'upgrader_success':
      icon = '🚀';
      title = 'Апгрейд успешен';
      break;

    case 'upgrader_failed':
      icon = '❌';
      title = 'Апгрейд неудачен';
      break;

    case 'promo_used':
      icon = '🎟️';
      title = 'Промокод использован';
      break;

    case 'referral_claimed':
      icon = '👥';
      title = 'Реферальный бонус получен';
      break;

    case 'showcase_item_added':
      icon = '🖼️';
      title = 'Предмет добавлен на витрину';
      break;

    case 'showcase_item_removed':
      icon = '🖼️';
      title = 'Предмет убран с витрины';
      break;

    case 'showcase_liked':
      icon = '❤️';
      title = 'Лайк витрины';
      break;

    case 'showcase_unliked':
      icon = '💔';
      title = 'Лайк витрины снят';
      break;

    case 'showcase_comment_added':
      icon = '💬';
      title = 'Добавлен комментарий';
      break;

    case 'showcase_comment_liked':
      icon = '❤️';
      title = 'Лайк комментария';
      break;

    case 'showcase_comment_unliked':
      icon = '💔';
      title = 'Лайк комментария снят';
      break;

    case 'showcase_settings_changed':
      icon = '🎨';
      title = 'Изменены настройки витрины';
      break;
  }

  let text =
    icon + ' <b>' + escapeHtml_(title) + '</b>\n\n' +
    '👤 User ID: <code>' + escapeHtml_(userId) + '</code>\n' +
    '🆔 Telegram: <code>' + escapeHtml_(telegramId) + '</code>\n' +
    '📛 Username: ' + escapeHtml_(username) + '\n' +
    '🕐 ' + escapeHtml_(time);

  const important = [];

  if (details.case_name) {
    important.push(
      '🎰 Кейс: <b>' +
      escapeHtml_(details.case_name) +
      '</b>'
    );
  }

  if (details.item_name) {
    important.push(
      '📦 Предмет: <b>' +
      escapeHtml_(details.item_name) +
      '</b>'
    );
  }

  if (details.quantity != null) {
    important.push(
      '🔢 Количество: <b>' +
      escapeHtml_(String(details.quantity)) +
      '</b>'
    );
  }

  if (details.item_value != null) {
    important.push(
      '💎 Стоимость: <b>' +
      escapeHtml_(String(details.item_value)) +
      '</b>'
    );
  }

  if (details.total_value != null) {
    important.push(
      '💰 Сумма: <b>' +
      escapeHtml_(String(details.total_value)) +
      '</b>'
    );
  }

  if (details.balance_after != null) {
    important.push(
      '💳 Баланс после: <b>' +
      escapeHtml_(String(details.balance_after)) +
      '</b>'
    );
  }

  if (details.multiplier != null) {
    important.push(
      '⚡ Множитель: <b>x' +
      escapeHtml_(String(details.multiplier)) +
      '</b>'
    );
  }

  if (details.success != null) {
    important.push(
      '📊 Результат: <b>' +
      (details.success ? 'УСПЕХ' : 'НЕУДАЧА') +
      '</b>'
    );
  }

  if (important.length) {
    text += '\n\n' + important.join('\n');
  }

  return text;
}


function escapeHtml_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
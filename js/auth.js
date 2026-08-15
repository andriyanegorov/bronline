/**
 * TELEGRAM AUTH MODULE
 * 
 * Handles Telegram WebApp authorization and Supabase integration
 * for BLACK RUSSIA: ОНЛАЙН
 */

const TelegramAuth = (() => {
  // ============================================================
  // PRIVATE STATE
  // ============================================================

  let currentUser = null;
  let currentProfile = null;
  let isInitialized = false;
  let initPromise = null;

  // ============================================================
  // CONFIGURATION
  // ============================================================

  const CONFIG = {
    // Supabase keys from environment or hardcoded (DO NOT EXPOSE SERVICE ROLE)
    // These are normally set from environment variables in production
    supabaseUrl: window.SUPABASE_URL || 'https://your-project.supabase.co',
    supabaseAnonKey: window.SUPABASE_ANON_KEY || 'your-anon-key-here',
    
    // Telegram WebApp script URL
    telegramScriptUrl: 'https://telegram.org/js/telegram-web-app.js',
    
    // Session storage key
    sessionStorageKey: 'br_user_session',
  };

  // ============================================================
  // SUPABASE CLIENT INITIALIZATION
  // ============================================================

  let supabase = null;

  const initSupabase = () => {
    if (supabase) return supabase;
    
    if (!window.supabase) {
      console.error('Supabase SDK not loaded. Include it in your HTML.');
      return null;
    }

    supabase = window.supabase.createClient(
      CONFIG.supabaseUrl,
      CONFIG.supabaseAnonKey
    );

    return supabase;
  };

  // ============================================================
  // TELEGRAM SDK INITIALIZATION
  // ============================================================

  const initTelegramSDK = () => {
    return new Promise((resolve) => {
      // Check if Telegram WebApp already exists
      if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
        Telegram.WebApp.ready();
        console.log('[Auth] Telegram WebApp already available');
        resolve(Telegram.WebApp);
        return;
      }

      // Load Telegram script
      const script = document.createElement('script');
      script.src = CONFIG.telegramScriptUrl;
      script.async = true;

      script.onload = () => {
        if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
          Telegram.WebApp.ready();
          console.log('[Auth] Telegram WebApp loaded');
          resolve(Telegram.WebApp);
        } else {
          console.warn('[Auth] Telegram script loaded but WebApp not available');
          resolve(null);
        }
      };

      script.onerror = () => {
        console.warn('[Auth] Failed to load Telegram WebApp script');
        resolve(null);
      };

      document.head.appendChild(script);
    });
  };

  // ============================================================
  // TELEGRAM USER EXTRACTION
  // ============================================================

  const getTelegramUser = async () => {
    try {
      await initTelegramSDK();

      if (typeof Telegram === 'undefined' || !Telegram.WebApp) {
        console.warn('[Auth] Telegram WebApp not available');
        return null;
      }

      // Get user from initDataUnsafe
      const user = Telegram.WebApp.initDataUnsafe?.user;

      if (!user) {
        console.warn('[Auth] No Telegram user data available');
        return null;
      }

      // Also save initData for future server-side validation
      const initData = Telegram.WebApp.initData;

      return {
        id: user.id,
        username: user.username || null,
        first_name: user.first_name || '',
        last_name: user.last_name || null,
        photo_url: user.photo_url || null,
        is_premium: user.is_premium || false,
        initData: initData, // For server-side validation later
      };
    } catch (error) {
      console.error('[Auth] Failed to get Telegram user:', error);
      return null;
    }
  };

  // ============================================================
  // SUPABASE OPERATIONS
  // ============================================================

  /**
   * Find existing player by telegram_id
   */
  const findPlayerByTelegramId = async (telegramId) => {
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('uid, telegram_id, telegram_username, first_name, last_name, avatar_url, nickname, level, experience, status, last_seen_at, is_banned, is_deleted, created_at, updated_at')
        .eq('telegram_id', telegramId)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows found (expected for new users)
        console.error('[Auth] Query error:', error);
        return null;
      }

      return data || null;
    } catch (error) {
      console.error('[Auth] Failed to find player:', error);
      return null;
    }
  };

  /**
   * Create new player profile
   */
  const createNewPlayer = async (telegramUser) => {
    if (!supabase) return null;

    try {
      const now = new Date().toISOString();
      const nickname = `Player_${telegramUser.id}`;

      const { data, error } = await supabase
        .from('profiles')
        .insert([
          {
            telegram_id: telegramUser.id,
            telegram_username: telegramUser.username,
            first_name: telegramUser.first_name,
            last_name: telegramUser.last_name,
            avatar_url: telegramUser.photo_url,
            nickname: nickname,
            level: 1,
            experience: 0,
            status: 'online',
            last_seen_at: now,
            is_verified: false,
            is_banned: false,
            is_deleted: false,
            created_at: now,
            updated_at: now,
          },
        ])
        .select('uid, telegram_id, telegram_username, first_name, last_name, avatar_url, nickname, level, experience, status, last_seen_at, is_banned, is_deleted')
        .single();

      if (error) {
        // Handle UNIQUE constraint violation (duplicate telegram_id)
        if (error.code === '23505') {
          console.warn('[Auth] Player already exists (concurrent creation)');
          return await findPlayerByTelegramId(telegramUser.id);
        }
        console.error('[Auth] Insert error:', error);
        return null;
      }

      console.log('[Auth] New player created:', data.uid);
      return data;
    } catch (error) {
      console.error('[Auth] Failed to create player:', error);
      return null;
    }
  };

  /**
   * Create related tables for new player
   */
  const createPlayerRelatedData = async (uid) => {
    if (!supabase) return false;

    try {
      const now = new Date().toISOString();

      // Check and create player_balances
      const { data: balanceExists } = await supabase
        .from('player_balances')
        .select('uid')
        .eq('uid', uid)
        .single();

      if (!balanceExists) {
        await supabase
          .from('player_balances')
          .insert([{ uid, cash: 0, bank: 0, updated_at: now }]);
      }

      // Check and create player_settings
      const { data: settingsExists } = await supabase
        .from('player_settings')
        .select('uid')
        .eq('uid', uid)
        .single();

      if (!settingsExists) {
        await supabase
          .from('player_settings')
          .insert([
            {
              uid,
              notifications_enabled: true,
              chat_notifications: true,
              sound_enabled: true,
              updated_at: now,
            },
          ]);
      }

      // Check and create player_vip
      const { data: vipExists } = await supabase
        .from('player_vip')
        .select('uid')
        .eq('uid', uid)
        .single();

      if (!vipExists) {
        await supabase
          .from('player_vip')
          .insert([{ uid, vip_level: 0, expires_at: null, updated_at: now }]);
      }

      console.log('[Auth] Player related data created/verified');
      return true;
    } catch (error) {
      console.error('[Auth] Failed to create related data:', error);
      // Don't fail the login if related data creation fails
      return true;
    }
  };

  /**
   * Update player status to online
   */
  const updatePlayerOnline = async (uid) => {
    if (!supabase) return false;

    try {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('profiles')
        .update({
          status: 'online',
          last_seen_at: now,
          updated_at: now,
        })
        .eq('uid', uid);

      if (error) {
        console.error('[Auth] Failed to update player status:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[Auth] Update error:', error);
      return false;
    }
  };

  /**
   * Fetch full player profile with balance and vip
   */
  const fetchFullProfile = async (uid) => {
    if (!supabase) return null;

    try {
      // Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('uid, telegram_id, telegram_username, first_name, last_name, avatar_url, nickname, level, experience, status, last_seen_at, is_banned, is_deleted, created_at, updated_at')
        .eq('uid', uid)
        .single();

      if (profileError || !profile) {
        console.error('[Auth] Failed to fetch profile:', profileError);
        return null;
      }

      // Fetch balance
      const { data: balance, error: balanceError } = await supabase
        .from('player_balances')
        .select('cash, bank, updated_at')
        .eq('uid', uid)
        .single();

      if (balanceError) {
        console.warn('[Auth] No balance found:', balanceError);
      }

      // Fetch vip
      const { data: vip, error: vipError } = await supabase
        .from('player_vip')
        .select('vip_level, expires_at, updated_at')
        .eq('uid', uid)
        .single();

      if (vipError) {
        console.warn('[Auth] No vip found:', vipError);
      }

      // Fetch settings
      const { data: settings, error: settingsError } = await supabase
        .from('player_settings')
        .select('notifications_enabled, chat_notifications, sound_enabled, updated_at')
        .eq('uid', uid)
        .single();

      if (settingsError) {
        console.warn('[Auth] No settings found:', settingsError);
      }

      return {
        profile,
        balance: balance || { cash: 0, bank: 0 },
        vip: vip || { vip_level: 0, expires_at: null },
        settings: settings || { notifications_enabled: true, chat_notifications: true, sound_enabled: true },
      };
    } catch (error) {
      console.error('[Auth] Failed to fetch full profile:', error);
      return null;
    }
  };

  // ============================================================
  // LOCAL STORAGE
  // ============================================================

  const saveUserToLocalStorage = (user, profile) => {
    try {
      const data = {
        uid: profile.uid,
        telegram_id: user.id,
        nickname: profile.nickname,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        avatar_url: user.photo_url,
        timestamp: Date.now(),
      };

      localStorage.setItem(CONFIG.sessionStorageKey, JSON.stringify(data));
      console.log('[Auth] User saved to localStorage');
    } catch (error) {
      console.warn('[Auth] Failed to save to localStorage:', error);
    }
  };

  const getStoredUser = () => {
    try {
      const stored = localStorage.getItem(CONFIG.sessionStorageKey);
      if (!stored) return null;

      const data = JSON.parse(stored);
      return data;
    } catch (error) {
      console.warn('[Auth] Failed to read localStorage:', error);
      return null;
    }
  };

  const restoreStoredSession = async () => {
    if (!supabase) return null;

    const stored = getStoredUser();
    if (!stored) return null;

    try {
      let profileRecord = null;

      if (stored.uid) {
        const { data, error } = await supabase
          .from('profiles')
          .select('uid, telegram_id, telegram_username, first_name, last_name, avatar_url, nickname, level, experience, status, last_seen_at, is_banned, is_deleted, created_at, updated_at')
          .eq('uid', stored.uid)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('[Auth] Stored session profile lookup error:', error);
        }

        profileRecord = data || null;
      }

      if (!profileRecord && stored.telegram_id) {
        const { data, error } = await supabase
          .from('profiles')
          .select('uid, telegram_id, telegram_username, first_name, last_name, avatar_url, nickname, level, experience, status, last_seen_at, is_banned, is_deleted, created_at, updated_at')
          .eq('telegram_id', stored.telegram_id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('[Auth] Stored session telegram lookup error:', error);
        }

        profileRecord = data || null;
      }

      if (!profileRecord) {
        console.warn('[Auth] Stored session profile not found in Supabase');
        return null;
      }

      const fullProfile = await fetchFullProfile(profileRecord.uid);
      if (!fullProfile) return null;

      const fallbackUser = {
        id: profileRecord.telegram_id || stored.telegram_id,
        username: profileRecord.telegram_username || stored.username || null,
        first_name: profileRecord.first_name || stored.first_name || '',
        last_name: profileRecord.last_name || stored.last_name || null,
        photo_url: profileRecord.avatar_url || stored.avatar_url || null,
        is_premium: false,
        initData: '',
      };

      currentUser = fallbackUser;
      currentProfile = fullProfile;
      isInitialized = true;

      return { user: currentUser, profile: currentProfile };
    } catch (error) {
      console.error('[Auth] Failed to restore stored session:', error);
      return null;
    }
  };

  const clearStoredUser = () => {
    try {
      localStorage.removeItem(CONFIG.sessionStorageKey);
      console.log('[Auth] User cleared from localStorage');
    } catch (error) {
      console.warn('[Auth] Failed to clear localStorage:', error);
    }
  };

  // ============================================================
  // MAIN INITIALIZATION
  // ============================================================

  const initialize = async () => {
    if (isInitialized) return { user: currentUser, profile: currentProfile };
    if (initPromise) return initPromise;

    initPromise = (async () => {
      try {
        console.log('[Auth] Initializing Telegram auth...');

        // Initialize Supabase
        initSupabase();

        // Get Telegram user
        const telegramUser = await getTelegramUser();

        if (!telegramUser) {
          const restored = await restoreStoredSession();
          if (restored) {
            console.log('[Auth] Restored user from local session');
            return restored;
          }

          console.log('[Auth] No Telegram user available and no stored session');
          isInitialized = true;
          return { user: null, profile: null };
        }

        console.log('[Auth] Telegram user:', telegramUser.id);

        // Check if player exists
        let player = await findPlayerByTelegramId(telegramUser.id);

        if (!player) {
          // Create new player
          console.log('[Auth] Creating new player...');
          player = await createNewPlayer(telegramUser);

          if (!player) {
            throw new Error('Failed to create player');
          }

          // Create related data
          await createPlayerRelatedData(player.uid);
        } else {
          // Update existing player status
          console.log('[Auth] Existing player found:', player.uid);

          // Check if banned or deleted
          if (player.is_banned) {
            console.warn('[Auth] Player is banned');
            isInitialized = true;
            return { user: null, profile: null, error: 'BANNED' };
          }

          if (player.is_deleted) {
            console.warn('[Auth] Player is deleted');
            isInitialized = true;
            return { user: null, profile: null, error: 'DELETED' };
          }

          await updatePlayerOnline(player.uid);
        }

        // Fetch full profile with balance and vip
        const fullProfile = await fetchFullProfile(player.uid);

        if (!fullProfile) {
          throw new Error('Failed to fetch full profile');
        }

        currentUser = telegramUser;
        currentProfile = fullProfile;

        saveUserToLocalStorage(telegramUser, fullProfile.profile);

        console.log('[Auth] Initialization complete:', currentProfile.profile.uid);

        isInitialized = true;
        return { user: currentUser, profile: currentProfile };
      } catch (error) {
        console.error('[Auth] Initialization error:', error);
        isInitialized = true;
        return { user: null, profile: null, error: error.message };
      }
    })();

    return initPromise;
  };

  // ============================================================
  // PUBLIC API
  // ============================================================

  return {
    /**
     * Initialize Telegram auth
     * Returns: { user, profile, error? }
     */
    init: initialize,

    /**
     * Get current user (returns Telegram user data)
     */
    getCurrentUser: () => currentUser,

    /**
     * Get current profile (returns { profile, balance, vip, settings })
     */
    getCurrentProfile: () => currentProfile,

    /**
     * Backward-compatible alias for the active player object
     */
    getCurrentPlayer: () => currentProfile,

    /**
     * Re-load the current authenticated user from Supabase
     */
    loadCurrentUser: initialize,

    /**
     * Check if user is authorized
     */
    isAuthorized: () => currentUser !== null && currentProfile !== null,

    /**
     * Check if user is banned
     */
    isBanned: () => currentProfile?.profile?.is_banned || false,

    /**
     * Check if user is deleted
     */
    isDeleted: () => currentProfile?.profile?.is_deleted || false,

    /**
     * Get full profile data (main profile info)
     */
    getProfile: () => currentProfile?.profile || null,

    /**
     * Get balance (cash + bank)
     */
    getBalance: () => currentProfile?.balance || { cash: 0, bank: 0 },

    /**
     * Get VIP info
     */
    getVip: () => currentProfile?.vip || { vip_level: 0, expires_at: null },

    /**
     * Get settings
     */
    getSettings: () => currentProfile?.settings || {},

    /**
     * Logout (clear local data)
     */
    logout: () => {
      currentUser = null;
      currentProfile = null;
      isInitialized = false;
      initPromise = null;
      clearStoredUser();
      console.log('[Auth] Logged out');
    },

    /**
     * Get stored user from localStorage (cache only)
     */
    getStoredUser: getStoredUser,

    /**
     * Check if Telegram is available
     */
    isTelegramAvailable: () => typeof Telegram !== 'undefined' && Telegram.WebApp,

    /**
     * Set Supabase config (call before init)
     */
    setConfig: (config) => {
      Object.assign(CONFIG, config);
    },
  };
})();

// ============================================================
// EXPORT FOR GLOBAL USE
// ============================================================

if (typeof window !== 'undefined') {
  window.TelegramAuth = TelegramAuth;
}

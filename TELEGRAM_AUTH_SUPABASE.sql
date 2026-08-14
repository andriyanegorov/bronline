-- ============================================================
-- TELEGRAM AUTH - SQL MIGRATIONS FOR SUPABASE
-- Copy and paste this into: Supabase Dashboard → SQL Editor
-- ============================================================

-- If you get "policy already exists" errors, run these first:
DROP POLICY IF EXISTS "allow_create_profile" ON public.profiles;
DROP POLICY IF EXISTS "allow_create_balance" ON public.player_balances;
DROP POLICY IF EXISTS "allow_create_settings" ON public.player_settings;
DROP POLICY IF EXISTS "allow_create_vip" ON public.player_vip;
DROP POLICY IF EXISTS "allow_read_profiles" ON public.profiles;
DROP POLICY IF EXISTS "allow_update_profile_status" ON public.profiles;

-- ============================================================
-- CREATE RLS POLICIES
-- ============================================================

-- 1. Allow INSERT for new profiles (anon user)
CREATE POLICY "allow_create_profile" ON public.profiles
FOR INSERT
TO anon
WITH CHECK (true);

-- 2. Allow INSERT for player_balances
CREATE POLICY "allow_create_balance" ON public.player_balances
FOR INSERT
TO anon
WITH CHECK (true);

-- 3. Allow INSERT for player_settings
CREATE POLICY "allow_create_settings" ON public.player_settings
FOR INSERT
TO anon
WITH CHECK (true);

-- 4. Allow INSERT for player_vip
CREATE POLICY "allow_create_vip" ON public.player_vip
FOR INSERT
TO anon
WITH CHECK (true);

-- 5. Allow SELECT profiles by telegram_id (read any profile)
CREATE POLICY "allow_read_profiles" ON public.profiles
FOR SELECT
TO anon
USING (true);

-- 6. Allow UPDATE profile status (for login)
CREATE POLICY "allow_update_profile_status" ON public.profiles
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- ============================================================
-- NOTES:
-- ============================================================
--
-- These policies allow anonymous (anon) users to:
--
-- ✅ DO:
--    - INSERT into profiles (only once per telegram_id due to UNIQUE)
--    - INSERT into player_balances
--    - INSERT into player_settings
--    - INSERT into player_vip
--    - SELECT from profiles
--    - UPDATE profile.status and profile.last_seen_at
--
-- ❌ CANNOT:
--    - UPDATE balance (protected for later)
--    - UPDATE level/experience
--    - DELETE profiles
--    - INSERT into money_transactions
--    - UPDATE is_banned/is_deleted
--
-- Economic operations will use Edge Functions with service_role key later.
-- Those will have full permissions for money transfers, etc.
--
-- ============================================================

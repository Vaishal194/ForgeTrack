-- RESTORE AUTH PERMISSIONS
-- This script fixes the "Database error querying schema" by ensuring the internal roles have correct access.

-- 1. Grant schema usage
GRANT USAGE ON SCHEMA auth TO supabase_auth_admin, postgres, authenticator;

-- 2. Grant table permissions
GRANT ALL ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin, postgres;
GRANT SELECT ON ALL TABLES IN SCHEMA auth TO authenticator;

-- 3. Grant sequence permissions
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin, postgres;

-- 4. Grant routine permissions
GRANT ALL ON ALL ROUTINES IN SCHEMA auth TO supabase_auth_admin, postgres;

-- 5. Force schema cache reload
NOTIFY pgrst, 'reload schema';

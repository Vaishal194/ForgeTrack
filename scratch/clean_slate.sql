-- EMERGENCY CLEAN SLATE SQL
-- This script removes all custom logic that might be causing the "Database error querying schema" issue.

-- 1. Drop the Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Drop the Functions
DROP FUNCTION IF EXISTS public.handle_auth_user_created() CASCADE;
DROP FUNCTION IF EXISTS public.is_mentor() CASCADE;
DROP FUNCTION IF EXISTS public.get_my_student_id() CASCADE;

-- 3. Disable RLS on all tables to ensure absolute access
ALTER TABLE IF EXISTS public.students DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.materials DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.import_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;

-- 4. Drop all policies just in case
DROP POLICY IF EXISTS "students_mentor_all" ON public.students;
DROP POLICY IF EXISTS "students_read_own" ON public.students;
DROP POLICY IF EXISTS "sessions_mentor_all" ON public.sessions;
DROP POLICY IF EXISTS "sessions_read_all" ON public.sessions;
DROP POLICY IF EXISTS "attendance_mentor_all" ON public.attendance;
DROP POLICY IF EXISTS "attendance_read_own" ON public.attendance;
DROP POLICY IF EXISTS "materials_mentor_all" ON public.materials;
DROP POLICY IF EXISTS "materials_read_all" ON public.materials;
DROP POLICY IF EXISTS "importlog_mentor_all" ON public.import_log;
DROP POLICY IF EXISTS "users_mentor_all" ON public.users;
DROP POLICY IF EXISTS "users_read_own" ON public.users;
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;

-- 5. Force schema cache reload (Supabase specific hint)
NOTIFY pgrst, 'reload schema';

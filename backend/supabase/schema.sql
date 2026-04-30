-- ForgeTrack Database Schema
-- Run this in your Supabase SQL editor.

-- 1. Enable pgcrypto for UUIDs (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. CREATE TABLES

-- Students Table
CREATE TABLE IF NOT EXISTS public.students (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    usn TEXT UNIQUE NOT NULL,
    admission_number TEXT,
    email TEXT,
    branch_code TEXT NOT NULL,
    batch TEXT DEFAULT '2024-2028',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sessions Table
CREATE TABLE IF NOT EXISTS public.sessions (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    topic TEXT NOT NULL,
    month_number INTEGER NOT NULL,
    duration_hours DECIMAL(3,1) DEFAULT 2.0,
    session_type TEXT DEFAULT 'offline',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ImportLog Table
CREATE TABLE IF NOT EXISTS public.import_log (
    id SERIAL PRIMARY KEY,
    filename TEXT NOT NULL,
    uploaded_by TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_rows INTEGER NOT NULL,
    imported_rows INTEGER NOT NULL,
    skipped_rows INTEGER NOT NULL,
    warnings TEXT,
    column_mapping TEXT,
    status TEXT NOT NULL
);

-- Attendance Table
CREATE TABLE IF NOT EXISTS public.attendance (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    session_id INTEGER NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    present BOOLEAN NOT NULL,
    marked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    marked_by TEXT DEFAULT 'system',
    import_id INTEGER REFERENCES public.import_log(id) ON DELETE SET NULL,
    UNIQUE(student_id, session_id)
);

-- Materials Table
CREATE TABLE IF NOT EXISTS public.materials (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users Extension (Mapping Supabase Auth to Students)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('mentor', 'student')),
    student_id INTEGER REFERENCES public.students(id) ON DELETE SET NULL,
    display_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ADD CHECK CONSTRAINTS
-- Attendance date cannot be prior to program start (2025-08-04)
ALTER TABLE IF EXISTS public.sessions
DROP CONSTRAINT IF EXISTS check_session_date_range;

ALTER TABLE IF EXISTS public.sessions
ADD CONSTRAINT check_session_date_range 
CHECK (date >= '2025-08-04');


-- 4. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 5. RLS HELPER FUNCTIONS
-- These functions use SECURITY DEFINER to bypass RLS when checking roles,
-- avoiding infinite recursion when a policy on a table queries the same table.

CREATE OR REPLACE FUNCTION public.is_mentor()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'mentor'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_my_student_id()
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT student_id FROM public.users
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RLS POLICIES

-- Students Policy: Mentors full access, Students select own
DROP POLICY IF EXISTS "students_mentor_all" ON public.students;
DROP POLICY IF EXISTS "students_read_own" ON public.students;
CREATE POLICY "students_mentor_all" ON public.students FOR ALL USING (is_mentor());
CREATE POLICY "students_read_own" ON public.students FOR SELECT USING (id = get_my_student_id());

-- Sessions Policy: Mentors full access, Students select all
DROP POLICY IF EXISTS "sessions_mentor_all" ON public.sessions;
DROP POLICY IF EXISTS "sessions_read_all" ON public.sessions;
CREATE POLICY "sessions_mentor_all" ON public.sessions FOR ALL USING (is_mentor());
CREATE POLICY "sessions_read_all" ON public.sessions FOR SELECT USING (true);

-- Attendance Policy: Mentors full access, Students select own
DROP POLICY IF EXISTS "attendance_mentor_all" ON public.attendance;
DROP POLICY IF EXISTS "attendance_read_own" ON public.attendance;
CREATE POLICY "attendance_mentor_all" ON public.attendance FOR ALL USING (is_mentor());
CREATE POLICY "attendance_read_own" ON public.attendance FOR SELECT USING (student_id = get_my_student_id());

-- Materials Policy: Mentors full access, Students select all
DROP POLICY IF EXISTS "materials_mentor_all" ON public.materials;
DROP POLICY IF EXISTS "materials_read_all" ON public.materials;
CREATE POLICY "materials_mentor_all" ON public.materials FOR ALL USING (is_mentor());
CREATE POLICY "materials_read_all" ON public.materials FOR SELECT USING (true);

-- ImportLog Policy: Mentors full access, Students no access
DROP POLICY IF EXISTS "importlog_mentor_all" ON public.import_log;
CREATE POLICY "importlog_mentor_all" ON public.import_log FOR ALL USING (is_mentor());

-- Users Policy: Mentors full access, Students select own
DROP POLICY IF EXISTS "users_mentor_all" ON public.users;
DROP POLICY IF EXISTS "users_read_own" ON public.users;
CREATE POLICY "users_mentor_all" ON public.users FOR ALL USING (is_mentor());
CREATE POLICY "users_read_own" ON public.users FOR SELECT USING (id = auth.uid());

-- 7. AUTO-SYNC AUTH USER TO PUBLIC.USERS TRIGGER
-- This trigger ensures that when a user signs up via Supabase Auth,
-- they automatically get a record in public.users with the correct ID.

CREATE OR REPLACE FUNCTION public.handle_auth_user_created()
RETURNS TRIGGER AS $$
DECLARE
    v_student_id INTEGER;
    v_role TEXT := 'student';
    v_display_name TEXT;
BEGIN
    -- Try to find if this email belongs to a student
    -- We check both the email directly and the USN-based forge email
    SELECT id, name INTO v_student_id, v_display_name
    FROM public.students
    WHERE email = NEW.email 
       OR (usn || '@forge.com') = NEW.email
    LIMIT 1;

    IF v_student_id IS NOT NULL THEN
        v_role := 'student';
    ELSE
        -- Default to mentor if not found as student
        -- We check metadata first, then fallback
        v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'mentor');
        v_display_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
    END IF;

    INSERT INTO public.users (id, email, role, student_id, display_name)
    VALUES (NEW.id, NEW.email, v_role, v_student_id, v_display_name)
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        student_id = EXCLUDED.student_id,
        display_name = EXCLUDED.display_name;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Keep function lookup deterministic regardless of caller/session settings.
ALTER FUNCTION public.handle_auth_user_created() SET search_path = public, auth;

-- Trigger on auth.users for new sign-ups
-- NOTE: In some Supabase environments, you must run this as a superuser 
-- or via the Dashboard SQL editor if 'auth' schema access is restricted.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_auth_user_created();


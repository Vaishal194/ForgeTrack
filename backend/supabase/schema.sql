-- ForgeTrack Database Schema (Production Ready)
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

-- Users Table (Mapping Supabase Auth to Students/Mentors)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('mentor', 'student')),
    student_id INTEGER REFERENCES public.students(id) ON DELETE SET NULL,
    display_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ADD CHECK CONSTRAINTS
ALTER TABLE IF EXISTS public.sessions DROP CONSTRAINT IF EXISTS check_session_date_range;
ALTER TABLE IF EXISTS public.sessions ADD CONSTRAINT check_session_date_range CHECK (date >= '2025-08-04');

-- 4. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 5. RLS HELPER FUNCTIONS

-- Recursion-Safe Mentor Check
-- Queries auth.users directly (Security Definer) to avoid looping with public.users RLS
CREATE OR REPLACE FUNCTION public.is_mentor()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND (
      raw_app_meta_data ->> 'role' = 'mentor' 
      OR raw_user_meta_data ->> 'role' = 'mentor'
    )
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, auth;

-- Student ID Lookup
CREATE OR REPLACE FUNCTION public.get_my_student_id()
RETURNS INTEGER AS $$
  SELECT student_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, auth;

-- 6. RLS POLICIES

-- Students Policy
DROP POLICY IF EXISTS "students_mentor_all" ON public.students;
DROP POLICY IF EXISTS "students_read_own" ON public.students;
CREATE POLICY "students_mentor_all" ON public.students FOR ALL USING (is_mentor());
CREATE POLICY "students_read_own" ON public.students FOR SELECT USING (id = get_my_student_id());

-- Sessions Policy
DROP POLICY IF EXISTS "sessions_mentor_all" ON public.sessions;
DROP POLICY IF EXISTS "sessions_read_all" ON public.sessions;
CREATE POLICY "sessions_mentor_all" ON public.sessions FOR ALL USING (is_mentor());
CREATE POLICY "sessions_read_all" ON public.sessions FOR SELECT USING (true);

-- Attendance Policy
DROP POLICY IF EXISTS "attendance_mentor_all" ON public.attendance;
DROP POLICY IF EXISTS "attendance_read_own" ON public.attendance;
CREATE POLICY "attendance_mentor_all" ON public.attendance FOR ALL USING (is_mentor());
CREATE POLICY "attendance_read_own" ON public.attendance FOR SELECT USING (student_id = get_my_student_id());

-- Materials Policy
DROP POLICY IF EXISTS "materials_mentor_all" ON public.materials;
DROP POLICY IF EXISTS "materials_read_all" ON public.materials;
CREATE POLICY "materials_mentor_all" ON public.materials FOR ALL USING (is_mentor());
CREATE POLICY "materials_read_all" ON public.materials FOR SELECT USING (true);

-- Users Policy
DROP POLICY IF EXISTS "users_read_own" ON public.users;
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "users_mentor_all" ON public.users;

CREATE POLICY "users_read_own" ON public.users FOR SELECT USING (id = auth.uid());
CREATE POLICY "users_insert_own" ON public.users FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (id = auth.uid());
CREATE POLICY "users_mentor_all" ON public.users FOR ALL USING (is_mentor());

-- 7. AUTO-SYNC AUTH USER TO PUBLIC.USERS TRIGGER

CREATE OR REPLACE FUNCTION public.handle_auth_user_created()
RETURNS TRIGGER AS $$
DECLARE
    v_student_id INTEGER;
    v_role TEXT;
    v_display_name TEXT;
BEGIN
    -- Try to find if this email belongs to a student
    SELECT id, name INTO v_student_id, v_display_name
    FROM public.students
    WHERE email = NEW.email 
       OR (usn || '@forge.com') = NEW.email
    LIMIT 1;

    IF v_student_id IS NOT NULL THEN
        v_role := 'student';
    ELSE
        v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'mentor');
        v_display_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);
    END IF;

    IF v_role IS NULL THEN v_role := 'student'; END IF;

    INSERT INTO public.users (id, email, role, student_id, display_name)
    VALUES (NEW.id, NEW.email, v_role, v_student_id, v_display_name)
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        student_id = EXCLUDED.student_id,
        display_name = EXCLUDED.display_name;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_auth_user_created();

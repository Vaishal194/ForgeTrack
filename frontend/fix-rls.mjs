import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

async function applyFix() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    
    try {
        console.log('Step 1: Creating SECURITY DEFINER helper functions...');
        await client.query(`
            CREATE OR REPLACE FUNCTION public.is_mentor()
            RETURNS BOOLEAN AS $$
            BEGIN
              RETURN EXISTS (
                SELECT 1 FROM public.users
                WHERE id = auth.uid() AND role = 'mentor'
              );
            END;
            $$ LANGUAGE plpgsql SECURITY DEFINER;
        `);
        console.log('  ✓ is_mentor() created');

        await client.query(`
            CREATE OR REPLACE FUNCTION public.get_my_student_id()
            RETURNS INTEGER AS $$
            BEGIN
              RETURN (
                SELECT student_id FROM public.users
                WHERE id = auth.uid()
              );
            END;
            $$ LANGUAGE plpgsql SECURITY DEFINER;
        `);
        console.log('  ✓ get_my_student_id() created');

        console.log('\nStep 2: Replacing old recursive RLS policies...');

        // --- public.users ---
        await client.query(`DROP POLICY IF EXISTS "users_mentor_all" ON public.users`);
        await client.query(`DROP POLICY IF EXISTS "users_read_own" ON public.users`);
        await client.query(`DROP POLICY IF EXISTS "users_update_own" ON public.users`);
        await client.query(`CREATE POLICY "users_mentor_all" ON public.users FOR ALL USING (is_mentor())`);
        await client.query(`CREATE POLICY "users_read_own" ON public.users FOR SELECT USING (id = auth.uid())`);
        console.log('  ✓ users policies updated');

        // --- public.students ---
        await client.query(`DROP POLICY IF EXISTS "students_mentor_all" ON public.students`);
        await client.query(`DROP POLICY IF EXISTS "students_read_own" ON public.students`);
        await client.query(`CREATE POLICY "students_mentor_all" ON public.students FOR ALL USING (is_mentor())`);
        await client.query(`CREATE POLICY "students_read_own" ON public.students FOR SELECT USING (id = get_my_student_id())`);
        console.log('  ✓ students policies updated');

        // --- public.sessions ---
        await client.query(`DROP POLICY IF EXISTS "sessions_mentor_all" ON public.sessions`);
        await client.query(`DROP POLICY IF EXISTS "sessions_read_all" ON public.sessions`);
        await client.query(`CREATE POLICY "sessions_mentor_all" ON public.sessions FOR ALL USING (is_mentor())`);
        await client.query(`CREATE POLICY "sessions_read_all" ON public.sessions FOR SELECT USING (true)`);
        console.log('  ✓ sessions policies updated');

        // --- public.attendance ---
        await client.query(`DROP POLICY IF EXISTS "attendance_mentor_all" ON public.attendance`);
        await client.query(`DROP POLICY IF EXISTS "attendance_read_own" ON public.attendance`);
        await client.query(`CREATE POLICY "attendance_mentor_all" ON public.attendance FOR ALL USING (is_mentor())`);
        await client.query(`CREATE POLICY "attendance_read_own" ON public.attendance FOR SELECT USING (student_id = get_my_student_id())`);
        console.log('  ✓ attendance policies updated');

        // --- public.materials ---
        await client.query(`DROP POLICY IF EXISTS "materials_mentor_all" ON public.materials`);
        await client.query(`DROP POLICY IF EXISTS "materials_read_all" ON public.materials`);
        await client.query(`CREATE POLICY "materials_mentor_all" ON public.materials FOR ALL USING (is_mentor())`);
        await client.query(`CREATE POLICY "materials_read_all" ON public.materials FOR SELECT USING (true)`);
        console.log('  ✓ materials policies updated');

        // --- public.import_log ---
        await client.query(`DROP POLICY IF EXISTS "importlog_mentor_all" ON public.import_log`);
        await client.query(`CREATE POLICY "importlog_mentor_all" ON public.import_log FOR ALL USING (is_mentor())`);
        console.log('  ✓ import_log policies updated');

        console.log('\nStep 3: Verifying functions were created...');
        const fnCheck = await client.query(
            `SELECT proname FROM pg_proc 
             WHERE proname IN ('is_mentor', 'get_my_student_id') 
             AND pronamespace = 'public'::regnamespace`
        );
        console.log('  Functions found:', fnCheck.rows.map(r => r.proname));

        console.log('\nStep 4: Verifying policies on users table...');
        const polCheck = await client.query(
            `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public'`
        );
        console.log('  Policies:', polCheck.rows);

        console.log('\n✅ All done! Login should work now.');

    } catch (e) {
        console.error('❌ Error:', e.message);
    } finally {
        await client.end();
    }
}

applyFix();

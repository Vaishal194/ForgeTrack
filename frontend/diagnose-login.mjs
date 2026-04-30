import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

async function diagnose() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
        console.log('\n--- auth.users (nischay email) ---');
        const r1 = await client.query(
            `SELECT id, email, email_confirmed_at, confirmation_token, 
                    raw_app_meta_data, raw_user_meta_data, encrypted_password IS NOT NULL as has_password
             FROM auth.users WHERE email = 'nischay@theboringpeople.in'`
        );
        console.log(JSON.stringify(r1.rows, null, 2));

        console.log('\n--- public.users (nischay email) ---');
        const r2 = await client.query(
            `SELECT * FROM public.users WHERE email = 'nischay@theboringpeople.in'`
        );
        console.log(JSON.stringify(r2.rows, null, 2));

        console.log('\n--- RLS helper functions check ---');
        const r3 = await client.query(
            `SELECT proname, prosecdef FROM pg_proc 
             WHERE proname IN ('is_mentor', 'get_my_student_id') AND pronamespace = 'public'::regnamespace`
        );
        console.log(JSON.stringify(r3.rows, null, 2));

        console.log('\n--- Active RLS policies on public.users ---');
        const r4 = await client.query(
            `SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public'`
        );
        console.log(JSON.stringify(r4.rows, null, 2));

    } catch (e) {
        console.error('Diagnostic error:', e.message);
    } finally {
        await client.end();
    }
}

diagnose();

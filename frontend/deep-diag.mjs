import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

async function diagnose() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
        console.log('\n--- Triggers on auth.users ---');
        const r1 = await client.query(
            `SELECT trigger_name, event_manipulation, event_object_table, action_statement 
             FROM information_schema.triggers 
             WHERE event_object_schema = 'auth' AND event_object_table = 'users'`
        );
        console.log(JSON.stringify(r1.rows, null, 2));

        console.log('\n--- Triggers on public.users ---');
        const r2 = await client.query(
            `SELECT trigger_name, event_manipulation, event_object_table, action_statement 
             FROM information_schema.triggers 
             WHERE event_object_schema = 'public' AND event_object_table = 'users'`
        );
        console.log(JSON.stringify(r2.rows, null, 2));

        console.log('\n--- RLS Status for all tables ---');
        const r3 = await client.query(
            `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'`
        );
        console.log(JSON.stringify(r3.rows, null, 2));

        console.log('\n--- Check for any recursive policies (by name or content) ---');
        const r4 = await client.query(
            `SELECT schemaname, tablename, policyname, qual, with_check 
             FROM pg_policies`
        );
        console.log(JSON.stringify(r4.rows, null, 2));

    } catch (e) {
        console.error('Diagnostic error:', e.message);
    } finally {
        await client.end();
    }
}

diagnose();

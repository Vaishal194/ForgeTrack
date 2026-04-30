import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

async function run() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
        await client.query('DROP TRIGGER IF EXISTS on_student_created ON public.students;');
        await client.query('DROP FUNCTION IF EXISTS public.handle_new_student();');
        console.log('Successfully dropped old trigger/function');
    } catch (e) {
        console.error('Failed to drop:', e.message);
    } finally {
        await client.end();
    }
}

run();

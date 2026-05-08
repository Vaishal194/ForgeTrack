import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
        const res = await client.query('SELECT role, count(*) FROM public.users GROUP BY role');
        console.log('User roles:', res.rows);
        
        const students = await client.query('SELECT count(*) FROM public.students');
        console.log('Total students:', students.rows[0].count);
        
        const sessions = await client.query('SELECT count(*) FROM public.sessions');
        console.log('Total sessions:', sessions.rows[0].count);
    } finally {
        await client.end();
    }
}
main();

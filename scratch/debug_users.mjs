import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
        console.log("Checking public.users...");
        const res = await client.query('SELECT * FROM public.users');
        console.log('Users in public.users:', res.rows);
        
        console.log("Checking auth.users...");
        const authRes = await client.query('SELECT id, email FROM auth.users');
        console.log('Users in auth.users:', authRes.rows);
    } finally {
        await client.end();
    }
}
main();

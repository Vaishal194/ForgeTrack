import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

async function check() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
        const res = await client.query('SELECT * FROM users LIMIT 5');
        console.log('Users found:', res.rows);
    } catch (e) {
        console.error('Error checking users:', e.message);
    } finally {
        await client.end();
    }
}

check();

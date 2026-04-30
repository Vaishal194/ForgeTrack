import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

async function check() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
        const res = await client.query('SELECT count(*) FROM students');
        console.log('Students count:', res.rows[0].count);
    } catch (e) {
        console.error('Error checking students:', e.message);
    } finally {
        await client.end();
    }
}

check();

import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs/promises';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

async function run() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
        const sql = await fs.readFile('cleanup.sql', 'utf-8');
        await client.query(sql);
        console.log('Cleanup successful');
    } catch (e) {
        console.error('Cleanup failed:', e.message);
    } finally {
        await client.end();
    }
}

run();

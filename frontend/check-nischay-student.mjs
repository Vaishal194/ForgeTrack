import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

async function check() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
        const res = await client.query("SELECT * FROM public.students WHERE email = 'nischay@theboringpeople.in'");
        console.log("Students rows:", res.rows);
    } finally {
        await client.end();
    }
}

check();

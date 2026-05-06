import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
        const res = await client.query("SELECT email, role FROM public.users WHERE email = 'vaishalnvpc@gmail.com'");
        console.log("--- Public Users Table ---");
        console.table(res.rows);

        const authRes = await client.query("SELECT email, raw_app_meta_data FROM auth.users WHERE email = 'vaishalnvpc@gmail.com'");
        console.log("\n--- Auth Users Table ---");
        console.table(authRes.rows);
    } finally {
        await client.end();
    }
}

main();

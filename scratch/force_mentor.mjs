import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
        const email = 'vaishalnvpc@gmail.com';
        const res = await client.query('SELECT id FROM auth.users WHERE email = $1', [email]);
        if (res.rows.length > 0) {
            const userId = res.rows[0].id;
            console.log(`Found auth user ${userId}. Inserting into public.users...`);
            await client.query(`
                INSERT INTO public.users (id, email, role, display_name)
                VALUES ($1, $2, 'mentor', 'Vaishal')
                ON CONFLICT (id) DO UPDATE SET
                    email = EXCLUDED.email,
                    role = EXCLUDED.role,
                    display_name = EXCLUDED.display_name
            `, [userId, email]);
            console.log("Insert successful.");
        } else {
            console.error("Auth user not found!");
        }
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.end();
    }
}
main();

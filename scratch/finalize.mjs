import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
        const res = await client.query('SELECT id FROM auth.users WHERE email = $1', ['vaishalnvpc@gmail.com']);
        if (res.rows.length === 0) {
            console.log("User not found.");
            return;
        }

        const userId = res.rows[0].id;
        
        await client.query(`
            UPDATE auth.users 
            SET email_confirmed_at = NOW(),
                raw_app_meta_data = '{"provider": "email", "providers": ["email"], "role": "mentor"}',
                raw_user_meta_data = '{"full_name": "Vaishal", "role": "mentor"}'
            WHERE id = $1
        `, [userId]);

        await client.query(`
            INSERT INTO public.users (id, email, role, display_name)
            VALUES ($1, 'vaishalnvpc@gmail.com', 'mentor', 'Vaishal')
            ON CONFLICT (id) DO UPDATE SET role = 'mentor'
        `, [userId]);

        console.log("SUCCESS: Mentor confirmed and linked.");
    } finally {
        await client.end();
    }
}

main();

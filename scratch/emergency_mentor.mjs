import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: './frontend/.env' });
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const dbUrl = process.env.DATABASE_URL;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
    console.log("--- EMERGENCY MENTOR SETUP ---");
    const email = 'vaishal.mentor@gmail.com';
    const password = 'password123';
    
    // 1. Sign up (Fresh Email = No Rate Limit)
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: 'Vaishal',
                role: 'mentor'
            }
        }
    });

    if (error) {
        console.error("Sign up error:", error.message);
        return;
    }
    const userId = data.user.id;
    console.log("1. Signed up as:", email);

    // 2. Confirm and sync via SQL
    const dbClient = new Client({ connectionString: dbUrl });
    await dbClient.connect();
    try {
        await dbClient.query(`
            UPDATE auth.users 
            SET email_confirmed_at = NOW(),
                raw_app_meta_data = '{"provider": "email", "providers": ["email"], "role": "mentor"}',
                raw_user_meta_data = '{"full_name": "Vaishal", "role": "mentor"}'
            WHERE id = $1
        `, [userId]);

        await dbClient.query(`
            INSERT INTO public.users (id, email, role, display_name)
            VALUES ($1, $2, 'mentor', 'Vaishal')
            ON CONFLICT (id) DO UPDATE SET role = 'mentor'
        `, [userId, email]);

        console.log("2. Confirmed and linked successfully.");
    } finally {
        await dbClient.end();
    }
    
    console.log("\n--- SETUP COMPLETE ---");
    console.log("Email:", email);
    console.log("Password:", password);
}

main();

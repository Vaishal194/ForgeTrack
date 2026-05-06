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
    console.log("--- FINAL MENTOR SETUP ---");
    
    // 1. Force delete the stuck record
    const dbClient = new Client({ connectionString: dbUrl });
    await dbClient.connect();
    await dbClient.query("DELETE FROM auth.users WHERE email = 'vaishalnvpc@gmail.com'");
    await dbClient.query("DELETE FROM public.users WHERE email = 'vaishalnvpc@gmail.com'");
    console.log("1. Cleaned up old records.");

    // 2. Sign up via Official API (Correct hashing)
    const { data, error } = await supabase.auth.signUp({
        email: 'vaishalnvpc@gmail.com',
        password: 'password123',
        options: {
            data: {
                full_name: 'Vaishal',
                role: 'mentor'
            }
        }
    });

    if (error) {
        console.error("2. Sign up error:", error.message);
        await dbClient.end();
        return;
    }
    console.log("2. Signed up via API.");

    // 3. Confirm and sync via SQL
    const userId = data.user.id;
    
    await dbClient.query(`
        UPDATE auth.users 
        SET email_confirmed_at = NOW(),
            raw_app_meta_data = '{"provider": "email", "providers": ["email"], "role": "mentor"}',
            raw_user_meta_data = '{"full_name": "Vaishal", "role": "mentor"}'
        WHERE id = $1
    `, [userId]);

    await dbClient.query(`
        INSERT INTO public.users (id, email, role, display_name)
        VALUES ($1, 'vaishalnvpc@gmail.com', 'mentor', 'Vaishal')
        ON CONFLICT (id) DO UPDATE SET role = 'mentor'
    `, [userId]);

    console.log("3. Confirmed and synced metadata.");
    
    console.log("\n--- SETUP COMPLETE ---");
    console.log("Email: vaishalnvpc@gmail.com");
    console.log("Password: password123");
    
    await dbClient.end();
}

main();

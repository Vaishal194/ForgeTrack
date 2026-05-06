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
    console.log("Attempting to create mentor via Auth API...");
    
    // 1. Sign up (This handles hashing correctly)
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

    if (error && error.message !== 'User already registered') {
        console.error("Sign up error:", error.message);
        return;
    }

    console.log("Auth record exists. Ensuring it is confirmed and has the mentor role in the database...");

    // 2. Use SQL to force confirm and set metadata (since we don't have service_role key)
    const client = new Client({ connectionString: dbUrl });
    await client.connect();
    try {
        const sql = `
            UPDATE auth.users 
            SET 
                email_confirmed_at = NOW(),
                last_sign_in_at = NOW(),
                raw_app_meta_data = raw_app_meta_data || '{"role": "mentor"}',
                raw_user_meta_data = raw_user_meta_data || '{"role": "mentor", "full_name": "Vaishal"}'
            WHERE email = 'vaishalnvpc@gmail.com';
            
            -- Ensure public.users is also correct
            INSERT INTO public.users (id, email, role, display_name)
            SELECT id, email, 'mentor', 'Vaishal'
            FROM auth.users WHERE email = 'vaishalnvpc@gmail.com'
            ON CONFLICT (id) DO UPDATE SET role = 'mentor';
        `;
        await client.query(sql);
        console.log("Success! Mentor account is confirmed and ready.");
        console.log("Email: vaishalnvpc@gmail.com");
        console.log("Password: password123");
    } finally {
        await client.end();
    }
}

main();

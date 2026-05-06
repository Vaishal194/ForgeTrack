import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: './frontend/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
    console.log("Attempting sign-up with a FRESH email: test_mentor@forge.com");
    
    const { data, error } = await supabase.auth.signUp({
        email: 'test_mentor@forge.com',
        password: 'password123'
    });

    if (error) {
        console.error("Sign up error:", error.message);
    } else {
        console.log("SUCCESS! User created:", data.user.email);
    }
}

main();

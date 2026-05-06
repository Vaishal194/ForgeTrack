import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from root
dotenv.config({ path: './.env' });
// Load env from frontend as fallback
dotenv.config({ path: './frontend/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log("Testing Connection to:", supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
    console.log("--- Testing auth.getUser() ---");
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log("User:", user ? user.email : "Not logged in");
    if (userError) console.error("User Error:", userError);

    console.log("\n--- Testing a simple query (sessions) ---");
    const { data, error } = await supabase.from('sessions').select('count', { count: 'exact', head: true });
    if (error) {
        console.error("Query Error:", error);
    } else {
        console.log("Sessions count query successful:", data);
    }

    console.log("\n--- Testing Login with known mentor ---");
    // We try to login with the password 'password123' used in run-sql.mjs
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: 'vaishalnvpc@gmail.com',
        password: 'password123'
    });

    if (loginError) {
        console.error("Login Error:", loginError);
    } else {
        console.log("Login Successful for:", loginData.user.email);
    }
}

test();

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '../.env' });

// Read from .env.local
const envLocal = fs.readFileSync('.env.local', 'utf-8');
const anonKeyMatch = envLocal.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
const urlMatch = envLocal.match(/VITE_SUPABASE_URL=(.*)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseAnonKey = anonKeyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testLogin() {
    console.log("Testing login for nischay@theboringpeople.in...");
    const { data, error } = await supabase.auth.signInWithPassword({
        email: 'nischay@theboringpeople.in',
        password: 'password123'
    });

    if (error) {
        console.log("Login Error Detected:");
        console.log("Message:", error.message);
        console.log("Status:", error.status);
    } else {
        console.log("Login Successful!");
        console.log("User ID:", data.user.id);
    }
}

testLogin();

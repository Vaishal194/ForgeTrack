import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '../.env' });

// Read from frontend/.env.local
const envLocal = fs.readFileSync('frontend/.env.local', 'utf-8');
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
        console.log("Full Error Object:", JSON.stringify(error, null, 2));
    } else {
        console.log("Login Successful!");
        console.log("User ID:", data.user.id);
        
        // Try to query public.users
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .single();
            
        if (userError) {
            console.log("Error querying public.users after login:");
            console.log(userError.message);
        } else {
            console.log("Successfully queried public.users:", userData);
        }
    }
}

testLogin();

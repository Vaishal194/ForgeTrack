import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' }); // Root .env contains DATABASE_URL. Is ANON_KEY there? 

// We need ANON_KEY. Let's read it from frontend/.env.local
import fs from 'fs';
const envLocal = fs.readFileSync('.env.local', 'utf-8');
const anonKeyMatch = envLocal.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
const urlMatch = envLocal.match(/VITE_SUPABASE_URL=(.*)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseAnonKey = anonKeyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function setup() {
    console.log("Signing up mentor...");
    const { data: mentorData, error: mentorErr } = await supabase.auth.signUp({
        email: 'nischay@theboringpeople.in',
        password: 'password123'
    });
    
    if (mentorErr) console.error("Mentor Form Err (might exist already):", mentorErr.message);

    console.log("Signing up test student...");
    const { data: studentData, error: studentErr } = await supabase.auth.signUp({
        email: '4SH24CS001@forge.com',
        password: '4SH24CS001'
    });
    
    if (studentErr) console.error("Student Form Err (might exist already):", studentErr.message);

    console.log("Done syncing auth.");
}

setup();

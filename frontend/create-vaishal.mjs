import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '../.env' });

// Read from .env.local (assuming we are in frontend/)
const envLocal = fs.readFileSync('.env.local', 'utf-8');
const anonKeyMatch = envLocal.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
const urlMatch = envLocal.match(/VITE_SUPABASE_URL=(.*)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseAnonKey = anonKeyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createMentor() {
    console.log("Signing up vaishalnv@gmail.com...");
    const { data, error } = await supabase.auth.signUp({
        email: 'vaishalnv@gmail.com',
        password: 'password123',
        options: {
            data: {
                role: 'mentor',
                full_name: 'Vaishal'
            }
        }
    });

    if (error) {
        if (error.message.includes('already registered')) {
            console.log("User already exists in Auth.");
        } else {
            console.error("Error during signUp:", error.message);
            return;
        }
    } else {
        console.log("User signed up successfully.");
    }
}

createMentor();

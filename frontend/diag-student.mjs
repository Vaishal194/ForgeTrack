import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val) acc[key.trim()] = val.join('=').trim();
  return acc;
}, {});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function diag() {
  const email = '4SH24CS002@forge.local'; // Matching the schema fix
  const password = '4SH24CS002'; // Default USN password

  console.log(`Attempting login for ${email}...`);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error("Login failed:", error.message);
    return;
  }

  console.log("Login successful! User ID:", data.user.id);

  console.log("Testing SELECT from public.users...");
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('*')
    .eq('id', data.user.id);

  if (usersError) {
    console.error("Error fetching user record:", usersError.message);
    if (usersError.message.includes('recursion')) {
       console.error("DETECTED RLS RECURSION!");
    }
  } else {
    console.log("User record found:", users);
  }
}

diag();

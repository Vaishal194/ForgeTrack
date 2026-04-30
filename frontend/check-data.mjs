import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val) acc[key.trim()] = val.join('=').trim();
  return acc;
}, {});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkData() {
  const { data, count, error } = await supabase.from('students').select('*', { count: 'exact' });
  if (error) {
    console.error("Error:", error.message);
  } else {
    console.log("Student count in Project A (biwitpx):", count);
  }
}

checkData();

import { Client } from 'pg';
import fs from 'fs/promises';
import dotenv from 'dotenv';
dotenv.config();

async function runSqlFile(client, filePath) {
    console.log(`Applying ${filePath}...`);
    const sql = await fs.readFile(filePath, 'utf-8');
    await client.query(sql);
    console.log(`Successfully applied ${filePath}\n`);
}

async function main() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error("No DATABASE_URL found in .env");
        process.exit(1);
    }
    
    // Connect to Supabase
    const client = new Client({ connectionString });
    await client.connect();
    
    try {
        await runSqlFile(client, './backend/supabase/schema.sql');
        await runSqlFile(client, './backend/supabase/seed.sql');

        console.log("Injecting mentor...");
        const mentorSql = `
            DO $$
            DECLARE
                new_user_id UUID := gen_random_uuid();
            BEGIN
                -- Clean up existing
                DELETE FROM auth.users WHERE email = 'vaishalnvpc@gmail.com';
                DELETE FROM public.users WHERE email = 'vaishalnvpc@gmail.com';
                
                -- Insert into auth.users
                INSERT INTO auth.users (
                    id, 
                    email, 
                    encrypted_password, 
                    email_confirmed_at, 
                    raw_app_meta_data, 
                    raw_user_meta_data, 
                    created_at, 
                    updated_at, 
                    role, 
                    aud,
                    instance_id
                ) VALUES (
                    new_user_id,
                    'vaishalnvpc@gmail.com',
                    crypt('password123', gen_salt('bf')),
                    NOW(),
                    '{"provider": "email", "providers": ["email"]}',
                    '{}',
                    NOW(),
                    NOW(),
                    'authenticated',
                    'authenticated',
                    '00000000-0000-0000-0000-000000000000'
                );

                -- Link in public.users
                INSERT INTO public.users (id, email, role, display_name)
                VALUES (new_user_id, 'vaishalnvpc@gmail.com', 'mentor', 'Vaishal');
            END $$;
        `;
        await client.query(mentorSql);
        console.log("Mentor injected successfully.");
    } catch (e) {
        console.error("Error applying SQL:", e);
    } finally {
        await client.end();
    }
}

main();

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
        console.log("Applying Schema...");
        await runSqlFile(client, './backend/supabase/schema.sql');
        
        console.log("Applying Seed Data...");
        // Use a try-catch for seed to ignore duplicate errors if re-running
        try {
            await runSqlFile(client, './backend/supabase/seed.sql');
        } catch (seedErr) {
            console.warn("Seed data already exists or failed partially:", seedErr.message);
        }

        console.log("Injecting mentor (Vaishal)...");
        const mentorSql = `
            DO $$
            DECLARE
                v_user_id UUID;
                new_user_id UUID := gen_random_uuid();
            BEGIN
                -- 1. Check if user already exists in auth.users
                SELECT id INTO v_user_id FROM auth.users WHERE email = 'vaishalnvpc@gmail.com';
                
                IF v_user_id IS NULL THEN
                    -- Insert into auth.users (Minimal but complete for Supabase)
                    INSERT INTO auth.users (
                        id, email, encrypted_password, email_confirmed_at, 
                        raw_user_meta_data, raw_app_meta_data, aud, role
                    ) VALUES (
                        new_user_id,
                        'vaishalnvpc@gmail.com',
                        crypt('password123', gen_salt('bf')),
                        NOW(),
                        '{"full_name": "Vaishal", "role": "mentor"}',
                        '{"role": "mentor"}',
                        'authenticated',
                        'authenticated'
                    );
                    v_user_id := new_user_id;
                END IF;

                -- 3. Link in public.users (if not exists)
                INSERT INTO public.users (id, email, role, display_name)
                VALUES (v_user_id, 'vaishalnvpc@gmail.com', 'mentor', 'Vaishal')
                ON CONFLICT (id) DO UPDATE SET
                    email = EXCLUDED.email,
                    role = EXCLUDED.role,
                    display_name = EXCLUDED.display_name;
            END $$;
        `;
        await client.query(mentorSql);
        console.log("Mentor check/injection complete (Password: password123).");
        
    } catch (e) {
        console.error("Critical error applying SQL:", e);
    } finally {
        await client.end();
    }
}

main();

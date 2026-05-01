import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' }); 

async function main() {
    const connectionString = process.env.DATABASE_URL;
    const client = new Client({ connectionString });
    await client.connect();
    
    try {
        const sql = `
            DO $$
            DECLARE
                new_user_id UUID := gen_random_uuid();
            BEGIN
                -- 1. Check if user exists already and delete them to avoid issues
                DELETE FROM auth.users WHERE email = 'vaishalnvpc@gmail.com';
                DELETE FROM public.users WHERE email = 'vaishalnvpc@gmail.com';
                
                -- 2. Insert into auth.users
                INSERT INTO auth.users (
                    id, 
                    instance_id, 
                    email, 
                    encrypted_password, 
                    email_confirmed_at, 
                    raw_app_meta_data, 
                    raw_user_meta_data, 
                    created_at, 
                    updated_at, 
                    role, 
                    aud,
                    is_super_admin,
                    confirmation_token,
                    recovery_token,
                    email_change_token_new,
                    email_change
                ) VALUES (
                    new_user_id,
                    '00000000-0000-0000-0000-000000000000',
                    'vaishalnvpc@gmail.com',
                    crypt('password123', gen_salt('bf')),
                    NOW(),
                    '{"provider": "email", "providers": ["email"]}',
                    '{"full_name": "Vaishal", "role": "mentor"}',
                    NOW(),
                    NOW(),
                    'authenticated',
                    'authenticated',
                    false,
                    '',
                    '',
                    '',
                    ''
                );

                -- 3. Link them in public.users
                INSERT INTO public.users (
                    id,
                    email,
                    role,
                    display_name
                ) VALUES (
                    new_user_id,
                    'vaishalnvpc@gmail.com',
                    'mentor',
                    'Vaishal'
                );
            END $$;
        `;
        
        console.log("Applying direct auth insert for Vaishal...");
        await client.query(sql);
        console.log("Successfully inserted mentor Vaishal.");
    } catch (e) {
        console.error("Error applying SQL:", e);
    } finally {
        await client.end();
    }
}

main();

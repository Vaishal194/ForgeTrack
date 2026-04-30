import pg from 'pg';
const { Client } = pg;

async function main() {
    const connectionString = 'postgresql://postgres:yshalnv123%23@db.gqrpyccjprzqrmlebmbb.supabase.co:5432/postgres';
    const client = new Client({ connectionString });
    await client.connect();
    
    try {
        const sql = `
            DO $$
            DECLARE
                new_user_id UUID := gen_random_uuid();
            BEGIN
                -- 1. Check if user exists already and delete them to avoid issues
                DELETE FROM auth.users WHERE email = 'nischay@theboringpeople.in';
                DELETE FROM public.users WHERE email = 'nischay@theboringpeople.in';
                
                -- 2. Insert into auth.users using pgcrypto for password
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
                    is_super_admin
                ) VALUES (
                    new_user_id,
                    '00000000-0000-0000-0000-000000000000',
                    'nischay@theboringpeople.in',
                    crypt('password123', gen_salt('bf')),
                    NOW(),
                    '{"provider": "email", "providers": ["email"]}',
                    '{}',
                    NOW(),
                    NOW(),
                    'authenticated',
                    'authenticated',
                    false
                );

                -- 3. Link them in public.users
                INSERT INTO public.users (
                    id,
                    email,
                    role,
                    display_name
                ) VALUES (
                    new_user_id,
                    'nischay@theboringpeople.in',
                    'mentor',
                    'Nischay B K'
                );
            END $$;
        `;
        
        console.log("Applying direct auth insert...");
        await client.query(sql);
        console.log("Successfully inserted mentor.");
    } catch (e) {
        console.error("Error applying SQL:", e);
    } finally {
        await client.end();
    }
}

main();

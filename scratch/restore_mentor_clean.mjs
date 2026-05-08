import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
        console.log("Restoring mentor (Vaishal) while keeping tables clean...");
        
        const mentorSql = `
            DO $$
            DECLARE
                v_user_id UUID;
                new_user_id UUID := gen_random_uuid();
            BEGIN
                -- 1. Check if user already exists in auth.users
                SELECT id INTO v_user_id FROM auth.users WHERE email = 'vaishalnvpc@gmail.com';
                
                IF v_user_id IS NULL THEN
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

                -- 2. Link in public.users (if not exists)
                INSERT INTO public.users (id, email, role, display_name)
                VALUES (v_user_id, 'vaishalnvpc@gmail.com', 'mentor', 'Vaishal')
                ON CONFLICT (id) DO UPDATE SET
                    email = EXCLUDED.email,
                    role = EXCLUDED.role,
                    display_name = EXCLUDED.display_name;
            END $$;
        `;
        await client.query(mentorSql);
        console.log("Mentor Vaishal restored.");
        
        // Final cleanup of seed data just in case
        await client.query('TRUNCATE TABLE public.attendance RESTART IDENTITY CASCADE');
        await client.query('TRUNCATE TABLE public.materials RESTART IDENTITY CASCADE');
        await client.query('TRUNCATE TABLE public.sessions RESTART IDENTITY CASCADE');
        await client.query('TRUNCATE TABLE public.students RESTART IDENTITY CASCADE');
        
        console.log("Cleanup complete. public.users (mentor) is ready.");
    } catch (e) {
        console.error("Operation failed:", e);
    } finally {
        await client.end();
    }
}
main();

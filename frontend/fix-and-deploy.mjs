import pg from 'pg';
const { Client } = pg;
import fs from 'fs/promises';

const connectionString = "postgresql://postgres:yshalnv123%23@db.gqrpyccjprzqrmlebmbb.supabase.co:5432/postgres";

async function run() {
    console.log("Connecting to database...");
    const client = new Client({ connectionString });
    await client.connect();
    
    try {
        console.log("Applying updated schema.sql (includes new auth trigger)...");
        const schemaSql = await fs.readFile('../backend/supabase/schema.sql', 'utf-8');
        await client.query(schemaSql);
        console.log("Schema applied successfully.");

        console.log("Synchronizing existing user data between auth.users and public.users...");
        const fixSql = `
            -- 1. Remove public.users records that have IDs not found in auth.users (likely random UUIDs from old trigger)
            -- but keep them if we can match them by email to a valid auth user.
            
            -- Delete the mismatched public.users records
            DELETE FROM public.users p
            WHERE NOT EXISTS (
                SELECT 1 FROM auth.users a WHERE a.id = p.id
            );

            -- 2. Insert/Update records for all users in auth.users to ensure they have correct roles in public.users
            INSERT INTO public.users (id, email, role, student_id, display_name)
            SELECT 
                a.id, 
                a.email, 
                CASE 
                    WHEN s.id IS NOT NULL THEN 'student'
                    ELSE COALESCE(a.raw_user_meta_data->>'role', 'mentor')
                END as role,
                s.id as student_id,
                COALESCE(s.name, a.raw_user_meta_data->>'full_name', a.email) as display_name
            FROM auth.users a
            LEFT JOIN public.students s ON (s.email = a.email OR (s.usn || '@forge.local') = a.email)
            ON CONFLICT (id) DO UPDATE SET
                email = EXCLUDED.email,
                role = EXCLUDED.role,
                student_id = EXCLUDED.student_id,
                display_name = EXCLUDED.display_name;
        `;
        await client.query(fixSql);
        console.log("Data synchronization complete.");

    } catch (e) {
        console.error("Error during execution:", e);
    } finally {
        await client.end();
        console.log("Database connection closed.");
    }
}

run();

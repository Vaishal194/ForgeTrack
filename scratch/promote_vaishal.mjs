import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
        console.log("Syncing roles for vaishalnvpc@gmail.com...");
        
        // 1. Update Auth Metadata
        await client.query(`
            UPDATE auth.users 
            SET raw_app_meta_data = raw_app_meta_data || '{"role": "mentor"}',
                raw_user_meta_data = raw_user_meta_data || '{"role": "mentor"}'
            WHERE email = 'vaishalnvpc@gmail.com'
        `);

        // 2. Update Public User Role
        await client.query(`
            UPDATE public.users 
            SET role = 'mentor' 
            WHERE email = 'vaishalnvpc@gmail.com'
        `);

        console.log("SUCCESS: User promoted to Mentor in both Auth and Public schemas.");
        
        // 3. Double check if we have data
        const studentCount = await client.query("SELECT count(*) FROM public.students");
        console.log(`Current students in database: ${studentCount.rows[0].count}`);
        
    } finally {
        await client.end();
    }
}

main();

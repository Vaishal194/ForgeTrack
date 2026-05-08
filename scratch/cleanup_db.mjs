import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
        console.log("Cleaning up seed data...");
        // Truncate tables with CASCADE to handle foreign keys
        // Restart identity to reset SERIAL columns
        await client.query('TRUNCATE TABLE public.attendance RESTART IDENTITY CASCADE');
        await client.query('TRUNCATE TABLE public.materials RESTART IDENTITY CASCADE');
        await client.query('TRUNCATE TABLE public.sessions RESTART IDENTITY CASCADE');
        await client.query('TRUNCATE TABLE public.students RESTART IDENTITY CASCADE');
        await client.query('TRUNCATE TABLE public.import_log RESTART IDENTITY CASCADE');
        
        console.log("Cleanup complete. public.users kept.");
    } catch (e) {
        console.error("Cleanup failed:", e);
    } finally {
        await client.end();
    }
}
main();

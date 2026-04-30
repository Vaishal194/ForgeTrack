import { Client } from 'pg';
import fs from 'fs/promises';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' }); // Load the DB url we saved at the root

async function runSqlFile(client, filePath) {
    console.log(`Applying ${filePath}...`);
    try {
        const sql = await fs.readFile(filePath, 'utf-8');
        await client.query(sql);
        console.log(`Successfully applied ${filePath}\n`);
    } catch (err) {
        if (err.message.includes('already exists') || err.message.includes('already a member')) {
            console.log(`  Skipping: ${err.message.split('\n')[0]}`);
        } else {
            console.error(`  Error applying ${filePath}: ${err.message}`);
        }
    }
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
        await runSqlFile(client, '../backend/supabase/schema.sql');
        await runSqlFile(client, '../backend/supabase/seed.sql');
    } catch (e) {
        console.error("Error applying SQL:", e);
    } finally {
        await client.end();
    }
}

main();

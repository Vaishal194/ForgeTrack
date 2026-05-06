import { Client } from 'pg';
import fs from 'fs/promises';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    const connectionString = process.env.DATABASE_URL;
    const client = new Client({ connectionString });
    await client.connect();
    
    try {
        const sql = await fs.readFile('./scratch/inventory.sql', 'utf-8');
        const queries = sql.split(';');
        
        for (let query of queries) {
            if (query.trim()) {
                const res = await client.query(query);
                if (res.rows && res.rows.length > 0) {
                    console.table(res.rows);
                }
            }
        }
    } catch (e) {
        console.error("Error running inventory:", e);
    } finally {
        await client.end();
    }
}

main();

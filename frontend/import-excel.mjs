import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import * as XLSX from 'xlsx';

// Read from .env.local
const envLocal = fs.readFileSync('.env.local', 'utf-8');
const anonKeyMatch = envLocal.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
const urlMatch = envLocal.match(/VITE_SUPABASE_URL=(.*)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseAnonKey = anonKeyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runImport() {
    console.log("Logging in as Mentor...");
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'vaishalnvpc@gmail.com',
        password: 'password123'
    });

    if (authError) {
        console.error("Login failed:", authError.message);
        return;
    }
    console.log("Logged in successfully.");

    const filePath = 'C:/Users/vaish/Downloads/Data Engineering and AI - Actual Program (2).xlsx';
    console.log(`Reading Excel file from ${filePath}...`);
    
    if (!fs.existsSync(filePath)) {
        console.error("File not found!");
        return;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const wb = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    // The data structure:
    // Row 0: might be headers
    // Let's identify columns
    const headers = rawData[0];
    console.log("Headers:", headers);
    
    // Some excel files might have empty rows or merged headers. We need to find the actual header row.
    let headerRowIdx = 0;
    let actualHeaders = headers;
    for (let i = 0; i < 5; i++) {
        if (rawData[i] && rawData[i].some(c => c && typeof c === 'string' && c.toLowerCase().includes('usn'))) {
            headerRowIdx = i;
            actualHeaders = rawData[i];
            break;
        }
    }
    
    console.log("Actual headers found at row", headerRowIdx, ":", actualHeaders);

    const usnIdx = actualHeaders.findIndex(h => h && h.toString().toLowerCase().includes('usn'));
    let nameIdx = actualHeaders.findIndex(h => h && h.toString().toLowerCase().includes('name'));

    if (usnIdx === -1) {
        console.error("Could not find USN column.");
        return;
    }
    if (nameIdx === -1) {
        console.warn("Could not find Name column. Using index next to USN");
        nameIdx = usnIdx + 1;
    }

    // Find date columns for attendance. They usually look like dates or 'Att-' or just DD-MMM.
    // We will consider columns from index 'nameIdx + 1' onwards that have a non-empty header string.
    const dateCols = [];
    for(let i = 0; i < actualHeaders.length; i++) {
        if (i !== usnIdx && i !== nameIdx && actualHeaders[i]) {
            dateCols.push({ colIndex: i, rawHeader: actualHeaders[i].toString().trim() });
        }
    }

    console.log(`Found ${dateCols.length} potential session columns.`);

    // 1. Collect all students
    const studentsData = [];
    for (let i = headerRowIdx + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || !row.some(c => c !== '')) continue; // skip empty rows
        
        const usn = row[usnIdx] ? row[usnIdx].toString().trim() : '';
        const name = row[nameIdx] ? row[nameIdx].toString().trim() : '';

        if (!usn || !name) continue;

        studentsData.push({
            name,
            usn,
            branch_code: 'CSE', // Default
            batch: '2024-2028',
            is_active: true
        });
    }

    console.log(`Upserting ${studentsData.length} students...`);
    const { data: insertedStudents, error: stuError } = await supabase.from('students').upsert(
        studentsData, 
        { onConflict: 'usn', ignoreDuplicates: false }
    ).select();

    if (stuError) {
        console.error("Student insert error:", stuError);
        return;
    }

    // Create a map of USN to student ID
    const usnToId = {};
    for (const s of insertedStudents) {
        usnToId[s.usn] = s.id;
    }

    // 2. Process sessions and attendance
    let totalAtt = 0;
    
    // Process each session sequentially
    let dateCounter = new Date('2025-08-04T00:00:00Z');

    for (const dateCol of dateCols) {
        let sessionDateStr = dateCol.rawHeader;
        let d = new Date(sessionDateStr);
        let finalDateStr;

        if (sessionDateStr.toLowerCase().includes('attendance')) {
            // It's an attendance column with no explicit date in header, use the counter
            finalDateStr = dateCounter.toISOString().split('T')[0];
            d = new Date(dateCounter);
            dateCounter.setDate(dateCounter.getDate() + 1);
        } else if (!isNaN(d.getTime())) {
            if (d.toISOString().split('T')[0] < '2025-08-04') d.setFullYear(2025);
            finalDateStr = d.toISOString().split('T')[0];
        } else {
            console.warn(`Skipping column ${dateCol.rawHeader} - not a valid date.`);
            continue;
        }

        // Ensure session exists
        const { data: sess, error: sessErr } = await supabase.from('sessions').upsert({
            date: finalDateStr,
            topic: `Imported Session - ${dateCol.rawHeader}`,
            month_number: d.getMonth() + 1,
            duration_hours: 2.0,
            session_type: 'offline'
        }, { onConflict: 'date' }).select().single();

        if (sessErr) {
            console.error("Session insert error for date", finalDateStr, ":", sessErr);
            continue;
        }

        const sessionId = sess.id;
        const attRows = [];

        for (let i = headerRowIdx + 1; i < rawData.length; i++) {
            const row = rawData[i];
            const usn = row[usnIdx] ? row[usnIdx].toString().trim() : '';
            if (!usn || !usnToId[usn]) continue;
            
            const cellVal = row[dateCol.colIndex] ? row[dateCol.colIndex].toString().toLowerCase().trim() : '';
            if (!cellVal) continue;

            const isPresent = cellVal === 'p' || cellVal === 'present' || cellVal === '1' || cellVal === 'true';

            attRows.push({
                student_id: usnToId[usn],
                session_id: sessionId,
                present: isPresent,
                marked_by: 'ScriptImport'
            });
        }

        if (attRows.length > 0) {
            const { error: attErr } = await supabase.from('attendance').upsert(
                attRows,
                { onConflict: 'student_id,session_id' }
            );

            if (attErr) {
                console.error("Attendance insert error:", attErr);
            } else {
                totalAtt += attRows.length;
            }
        }
    }

    console.log(`Import Complete! Imported/Updated ${studentsData.length} students and ${totalAtt} attendance records.`);
}

runImport();

import { supabase } from './supabase';

/**
 * MENTOR CRUD OPERATIONS
 */

// 1. Dashboard Stats
export async function getDashboardStats() {
    const today = new Date().toISOString().split('T')[0];

    // Card 1: Today's Session
    const { data: todaySession, error: sessionErr } = await supabase
        .from('sessions')
        .select('*')
        .eq('date', today)
        .single();
        
    // We do not throw on PGROUTINE errors for no rows, but just handle safely
    if (sessionErr && sessionErr.code !== 'PGRST116') {
        throw sessionErr;
    }

    // Card 3: Overall Program Stats
    const { data: allSessions, error: allSessErr } = await supabase
        .from('sessions')
        .select('id');
    if (allSessErr) throw allSessErr;

    const { data: allStudents, error: allStuErr } = await supabase
        .from('students')
        .select('id')
        .eq('is_active', true);
    if (allStuErr) throw allStuErr;

    const totalSessions = allSessions.length;
    const activeStudentsCount = allStudents.length;

    let overallAttendancePct = 0;
    if (totalSessions > 0 && activeStudentsCount > 0) {
        const { count: presentCount, error: presentErr } = await supabase
            .from('attendance')
            .select('*', { count: 'exact', head: true })
            .eq('present', true);
            
        if (presentErr) throw presentErr;
        
        overallAttendancePct = (presentCount / (totalSessions * activeStudentsCount)) * 100;
    }

    // Card 2: Today's Attendance
    let todayAttendance = null;
    if (todaySession) {
        const { data: attData, error: attErr } = await supabase
            .from('attendance')
            .select('present, student_id, students(name, usn)')
            .eq('session_id', todaySession.id);
        if (attErr) throw attErr;
        todayAttendance = attData;
    }

    // Last session date
    const { data: latestSession } = await supabase
        .from('sessions')
        .select('date')
        .order('date', { ascending: false })
        .limit(1)
        .single();

    return {
        todaySession,
        todayAttendance,
        totalSessions,
        activeStudentsCount,
        overallAttendancePct,
        lastSessionDate: latestSession ? latestSession.date : null
    };
}

// 2. Upsert Attendance
export async function upsertAttendance(records) {
    // Expected format for records:
    // [{ student_id: 1, session_id: 1, present: true, marked_by: 'Mentor Name' }, ...]
    const { data, error } = await supabase
        .from('attendance')
        .upsert(records, { onConflict: 'student_id,session_id' });

    if (error) throw error;
    return data;
}

// 3. Student History
export async function getStudentHistory(studentId) {
    // Using explicit where clause (over RLS just in case)
    const { data, error } = await supabase
        .from('attendance')
        .select('*, sessions(*)')
        .eq('student_id', studentId);
        
    if (error) throw error;
    return data;
}

// 4. Materials CRUD
export async function getMaterials() {
    const { data, error } = await supabase
        .from('sessions')
        .select('id, date, topic, month_number, materials(*)')
        .order('date', { ascending: false });
        
    if (error) throw error;
    return data;
}

export async function addMaterial(materialData) {
    const { data, error } = await supabase
        .from('materials')
        .insert([materialData]);
        
    if (error) throw error;
    return data;
}

// 5. Get all active students for the attendance form
export async function getActiveStudents() {
    const { data, error } = await supabase
        .from('students')
        .select('id, name, usn')
        .eq('is_active', true)
        .order('name');
        
    if (error) throw error;
    return data;
}

// 6. Get session by date or create
export async function getOrCreateSession(date, topic, month_number, duration_hours = 2.0, type = 'offline') {
    const { data: session, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('date', date)
        .single();
        
    if (session) return { session, created: false };
    
    // Create new
    const { data: newSession, error: createErr } = await supabase
        .from('sessions')
        .insert([{ date, topic, month_number, duration_hours, session_type: type }])
        .select()
        .single();
        
    if (createErr) throw createErr;
    return { session: newSession, created: true };
}

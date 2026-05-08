import { genAI } from './gemini';

/**
 * AI Agent for ForgeTrack — Spreadsheet mapping, date inference, and conflict detection.
 */

// ---- System Prompt Builder ----
function buildMappingPrompt(classDays) {
  const daysStr = classDays?.length ? classDays.join(', ') : 'not specified';

  return `You are a data migration expert for ForgeTrack, an attendance tracking system used by an AI/ML bootcamp.

DATABASE SCHEMA:
- students: { id, name, usn, email, branch_code, batch }
- sessions:  { id, date (YYYY-MM-DD), topic, month_number }
- attendance: { student_id, session_id, present }

YOUR TASK:
Analyze the given spreadsheet headers and sample rows. Identify:
1. USN/Student-ID column — roll numbers or unique IDs (e.g., "4JN22CS001", "USN", "Roll No", "ID")
2. Student Name column — the full name field (e.g., "Name", "Student Name", "Full Name")
3. All ATTENDANCE columns — columns whose values are attendance markers:
   - P/A, Present/Absent, 1/0, Yes/No, ✔/✘, TRUE/FALSE, or similar

For each attendance column:
- If the header IS a recognizable date (any common format like DD/MM, MM-DD-YY, "May 5", "2025-05-01" etc):
  → Parse it to YYYY-MM-DD format. Set "needs_date_inference": false.
- If the header is NOT a date (e.g. "Col5", "Unnamed: 3", a session number, blank, or generic label):
  → Set "needs_date_inference": true
  → Using the class days (${daysStr}) and the pattern/gaps of other known dates in the sheet, infer the most likely date
  → Set "suggested_date" to your best guess in YYYY-MM-DD
  → Explain your logic in "inference_reason"

STRICT OUTPUT RULES:
- Return ONLY a valid JSON object. No markdown. No code fences. No text outside the JSON.
- Every attendance column must appear in the output.
- "date" must be null if inference is needed; "suggested_date" must always have a value for inferred columns.

JSON FORMAT:
{
  "mappings": {
    "usn": "Column Name or null",
    "name": "Column Name or null",
    "attendance_cols": [
      {
        "column": "Header string exactly as given",
        "date": "YYYY-MM-DD or null",
        "needs_date_inference": false,
        "suggested_date": "YYYY-MM-DD or null",
        "inference_reason": "string or null",
        "confidence": 0.95
      }
    ]
  },
  "explanation": "Brief summary of your mapping decisions"
}`;
}

// ---- Attendance Column Heuristic ----
// Pre-screens headers to help AI focus (not sent to AI, used in prompt construction)
function likelyAttendanceCols(headers, sampleRows) {
  return headers.filter((h, i) => {
    const vals = sampleRows.map(r => String(r[i] || '').trim().toLowerCase());
    const attendanceTokens = ['p', 'a', '1', '0', 'present', 'absent', 'yes', 'no', '✔', '✘', 'true', 'false'];
    const matchCount = vals.filter(v => attendanceTokens.includes(v)).length;
    return matchCount >= Math.ceil(vals.length * 0.4); // at least 40% of sample rows match
  });
}

// ---- Main Export: Analyze Spreadsheet ----
export async function analyzeSpreadsheetMapping(headers, sampleRows, classDays = []) {
  if (!import.meta.env.VITE_GEMINI_API_KEY) {
    throw new Error('Gemini API Key is missing. Add VITE_GEMINI_API_KEY to your .env file.');
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `${buildMappingPrompt(classDays)}

---

INPUT DATA:
Headers: ${JSON.stringify(headers)}
Sample Rows (first 5): ${JSON.stringify(sampleRows)}

Likely attendance columns (pre-screened): ${JSON.stringify(likelyAttendanceCols(headers, sampleRows))}

Analyze the data and return the mapping JSON now.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Strip markdown code fences if model wraps output
    const jsonStr = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const parsed = JSON.parse(jsonStr);

    // Validation guard
    if (!parsed.mappings || !Array.isArray(parsed.mappings.attendance_cols)) {
      throw new Error('AI returned an unexpected structure. Please retry.');
    }

    return parsed;
  } catch (err) {
    console.error('AI Mapping Error:', err);
    throw new Error(`AI Mapping Failed: ${err.message || 'Unknown error'}`);
  }
}

// ---- Conflict Detection (pure, no AI needed) ----
/**
 * Compares incoming dates against what's already in the DB.
 * @param {Array<{id: number, date: string}>} existingSessions
 * @param {Array<string>} incomingDates - YYYY-MM-DD strings
 * @returns {Array<{date, conflict, existing_session_id}>}
 */
export function detectSessionConflicts(existingSessions, incomingDates) {
  const existingMap = new Map(
    (existingSessions || []).map(s => [s.date, s.id])
  );

  return incomingDates.map(date => ({
    date,
    conflict: existingMap.has(date),
    existing_session_id: existingMap.get(date) ?? null,
  }));
}

// ---- Presence Parser ----
/**
 * Converts a raw cell value to boolean presence.
 * Returns null if value is ambiguous or blank.
 */
export function parsePresence(val) {
  if (val === null || val === undefined || val === '') return null;
  const s = String(val).trim().toLowerCase();
  if (['p', '1', 'present', 'yes', 'y', '✔', '✓', 'true'].includes(s)) return true;
  if (['a', '0', 'absent', 'no', 'n', '✘', '✗', 'false'].includes(s)) return false;
  return null;
}

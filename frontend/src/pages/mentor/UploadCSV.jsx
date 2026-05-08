import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { analyzeSpreadsheetMapping, detectSessionConflicts, parsePresence } from '../../lib/aiAgent';
import { AlertCircle, X } from 'lucide-react';
import { StepBar, DropZone, Step1Config, Step2Mapping, Step3Conflicts, Step4Import } from './UploadSteps';

export default function UploadCSV() {
  const [file, setFile] = useState(null);
  const [allSheets, setAllSheets] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [classDays, setClassDays] = useState([]);
  const [step, setStep] = useState(0);
  const [mappedSheets, setMappedSheets] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [conflicts, setConflicts] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState('');

  // ---- Step 0: Parse uploaded file ----
  const handleFile = (f) => {
    setFile(f);
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const sheets = wb.SheetNames.map(name => {
          const raw = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
          const data = raw.filter(row => row.some(c => c !== ''));
          return { name, data };
        });
        setAllSheets(sheets);
        setSelected(new Set(sheets.map(s => s.name)));
        setStep(1);
      } catch {
        setError('Could not parse file. Please upload a valid .xlsx, .xls, or .csv.');
      }
    };
    reader.readAsBinaryString(f);
  };

  // ---- Step 1 handlers ----
  const toggleSheet = (name) =>
    setSelected(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });

  const toggleDay = (d) =>
    setClassDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const startMapping = () => {
    const chosen = allSheets.filter(s => selected.has(s.name));
    const initial = chosen.map(s => ({ ...s, mapping: null, status: 'pending', dateOverrides: {}, explanation: '' }));
    setMappedSheets(initial);
    setActiveIdx(0);
    setStep(2);
    // Kick off AI mapping for each sheet concurrently
    initial.forEach((_, i) => runAiMapping(initial, i));
  };

  // ---- Step 2: AI mapping ----
  const runAiMapping = async (sheetsArr, index) => {
    const sheet = (sheetsArr || mappedSheets)[index];
    if (!sheet?.data?.length) return;
    setMappedSheets(prev => prev.map((s, i) => i === index ? { ...s, status: 'mapping' } : s));
    try {
      const result = await analyzeSpreadsheetMapping(sheet.data[0], sheet.data.slice(1, 6), classDays);
      setMappedSheets(prev => prev.map((s, i) => i === index
        ? { ...s, mapping: result.mappings, explanation: result.explanation, status: 'mapped' }
        : s));
    } catch (err) {
      setMappedSheets(prev => prev.map((s, i) => i === index ? { ...s, status: 'error' } : s));
      setError(`"${sheet.name}": ${err.message}`);
    }
  };

  const setDateOverride = (si, col, date) =>
    setMappedSheets(prev => prev.map((s, i) => i === si ? { ...s, dateOverrides: { ...s.dateOverrides, [col]: date } } : s));

  const allMapped = mappedSheets.length > 0 && mappedSheets.every(s => s.status === 'mapped' || s.status === 'error');

  // ---- Step 3: Conflict detection ----
  const checkConflicts = async () => {
    setIsProcessing(true);
    setError('');
    try {
      const { data: existing, error: dbErr } = await supabase.from('sessions').select('id, date');
      if (dbErr) throw dbErr;

      const dateToSheets = new Map();
      for (const sheet of mappedSheets) {
        if (sheet.status !== 'mapped') continue;
        for (const col of sheet.mapping.attendance_cols) {
          const date = sheet.dateOverrides[col.column] || col.date || col.suggested_date;
          if (!date) continue;
          if (!dateToSheets.has(date)) dateToSheets.set(date, []);
          dateToSheets.get(date).push(sheet.name);
        }
      }

      const incoming = [...dateToSheets.keys()];
      const raw = detectSessionConflicts(existing || [], incoming);
      const resolved = raw.map(c => ({
        ...c,
        fromSheets: dateToSheets.get(c.date) || [],
        intraConflict: (dateToSheets.get(c.date) || []).length > 1,
        selectedSheet: null,
        resolution: c.conflict ? 'merge' : 'import',
      }));
      setConflicts(resolved);
      setStep(3);
    } catch (err) {
      setError('Conflict check failed: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const setResolution = (date, resolution) =>
    setConflicts(prev => prev.map(c => c.date === date ? { ...c, resolution } : c));

  const setIntraChoice = (date, sheetName) =>
    setConflicts(prev => prev.map(c => c.date === date ? { ...c, selectedSheet: sheetName } : c));

  // ---- Step 4: Import ----
  const runImport = async () => {
    setStep(4);
    setIsProcessing(true);
    setError('');
    let totalInserted = 0, totalSkipped = 0;
    const breakdown = [];

    try {
      const { data: { session: auth } } = await supabase.auth.getSession();
      const uploader = auth?.user?.email || 'mentor';

      const skipDates = new Set(conflicts.filter(c => c.resolution === 'skip').map(c => c.date));
      const intraMap = new Map(conflicts.filter(c => c.intraConflict && c.selectedSheet).map(c => [c.date, c.selectedSheet]));

      const { data: allStudents } = await supabase.from('students').select('id, usn, name');
      const usnMap = new Map((allStudents || []).map(s => [String(s.usn || '').toLowerCase(), s.id]));
      const nameMap = new Map((allStudents || []).map(s => [String(s.name || '').toLowerCase(), s.id]));

      for (const sheet of mappedSheets) {
        if (sheet.status !== 'mapped') continue;
        let ins = 0, skp = 0;
        const { usn: usnCol, name: nameCol, attendance_cols } = sheet.mapping;
        const headers = sheet.data[0];
        const usnIdx = usnCol ? headers.indexOf(usnCol) : -1;
        const nameIdx = nameCol ? headers.indexOf(nameCol) : -1;

        for (const col of attendance_cols) {
          const date = sheet.dateOverrides[col.column] || col.date || col.suggested_date;
          if (!date || skipDates.has(date)) { skp++; continue; }
          if (intraMap.has(date) && intraMap.get(date) !== sheet.name) { skp++; continue; }

          const colIdx = headers.indexOf(col.column);
          if (colIdx === -1) continue;

          const { data: sess, error: se } = await supabase
            .from('sessions')
            .upsert({ date, topic: `AI Import – ${sheet.name}`, month_number: new Date(date).getMonth() + 1 }, { onConflict: 'date' })
            .select().single();
          if (se) throw se;

          const rows = [];
          for (let ri = 1; ri < sheet.data.length; ri++) {
            const row = sheet.data[ri];
            const rawUsn = String(row[usnIdx] ?? '').trim().toLowerCase();
            const rawName = String(row[nameIdx] ?? '').trim().toLowerCase();
            const sid = usnMap.get(rawUsn) || nameMap.get(rawName);
            if (!sid) { skp++; continue; }
            const present = parsePresence(row[colIdx]);
            if (present === null) continue;
            rows.push({ student_id: sid, session_id: sess.id, present, marked_by: 'AI_Import' });
          }

          if (rows.length) {
            const cf = conflicts.find(c => c.date === date);
            const { error: ae } = await supabase.from('attendance').upsert(rows, {
              onConflict: 'student_id,session_id',
              ignoreDuplicates: cf?.resolution !== 'overwrite',
            });
            if (ae) throw ae;
            ins += rows.length;
            totalInserted += rows.length;
          }
        }
        breakdown.push({ name: sheet.name, inserted: ins, skipped: skp });
        totalSkipped += skp;
      }

      await supabase.from('import_log').insert({
        filename: file.name,
        uploaded_by: uploader,
        total_rows: mappedSheets.reduce((a, s) => a + Math.max(0, s.data.length - 1), 0),
        imported_rows: totalInserted,
        skipped_rows: totalSkipped,
        warnings: conflicts.filter(c => c.conflict).map(c => `${c.date}: ${c.resolution}`).join('; '),
        column_mapping: JSON.stringify(mappedSheets.map(s => ({ sheet: s.name, usn: s.mapping?.usn }))),
        status: 'success',
      });

      setImportResult({ success: true, totalInserted, totalSkipped, breakdown });
    } catch (err) {
      console.error(err);
      setImportResult({ success: false, message: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetAll = () => {
    setFile(null); setAllSheets([]); setSelected(new Set()); setClassDays([]);
    setStep(0); setMappedSheets([]); setActiveIdx(0);
    setConflicts([]); setImportResult(null); setError('');
  };

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto pb-24 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-display-md font-display text-fg-primary tracking-tight mb-2">Bulk Attendance Upload</h1>
          <p className="text-body text-fg-secondary">Upload spreadsheets and let the AI map columns to attendance records.</p>
        </div>
        {step > 0 && (
          <button onClick={resetAll} className="btn-secondary flex items-center gap-2 text-sm">
            <X size={14}/> Start Over
          </button>
        )}
      </div>

      {step > 0 && step < 5 && <StepBar current={step}/>}

      {step === 0 && <DropZone onFile={handleFile}/>}

      {step === 1 && (
        <Step1Config
          allSheets={allSheets} selected={selected} toggleSheet={toggleSheet}
          classDays={classDays} toggleDay={toggleDay} file={file} onProceed={startMapping}
        />
      )}

      {step === 2 && (
        <Step2Mapping
          sheets={mappedSheets} activeIdx={activeIdx} setActiveIdx={setActiveIdx}
          setDateOverride={setDateOverride}
          rerun={(i) => runAiMapping(null, i)}
          onCheckConflicts={checkConflicts} isProcessing={isProcessing}
        />
      )}

      {step === 3 && (
        <Step3Conflicts
          conflicts={conflicts} setResolution={setResolution}
          setIntraChoice={setIntraChoice} onImport={runImport}
        />
      )}

      {step === 4 && <Step4Import isProcessing={isProcessing} result={importResult} onReset={resetAll}/>}

      {error && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-danger-bg border border-danger-border text-danger px-5 py-3.5 rounded-2xl flex items-center gap-3 shadow-2xl animate-fade-in max-w-lg">
          <AlertCircle size={17}/>
          <p className="text-body-sm font-medium flex-1">{error}</p>
          <button onClick={() => setError('')} className="opacity-50 hover:opacity-100"><X size={15}/></button>
        </div>
      )}
    </div>
  );
}

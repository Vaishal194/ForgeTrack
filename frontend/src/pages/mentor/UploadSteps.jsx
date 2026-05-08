import React from 'react';
import { Upload, BrainCircuit, CheckCircle2, AlertCircle, RefreshCw, X, Calendar, Database, Layers, SkipForward } from 'lucide-react';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export function StepBar({ current }) {
  const steps = ['Upload','Configure','AI Mapping','Conflicts','Import'];
  return (
    <div className="flex items-center gap-2 mb-2">
      {steps.map((s, i) => {
        const idx = i + 1;
        const done = current > idx;
        const active = current === idx;
        return (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-micro font-semibold transition-all ${
              active ? 'bg-accent-glow/20 text-accent-glow border border-accent-glow/40'
              : done ? 'bg-success/10 text-success border border-success/20'
              : 'bg-surface-raised text-fg-tertiary border border-border-subtle'}`}>
              {done ? <CheckCircle2 size={12}/> : <span>{idx}</span>}
              <span>{s}</span>
            </div>
            {i < steps.length - 1 && <div className={`h-px flex-1 ${done ? 'bg-success/30' : 'bg-border-subtle'}`}/>}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export function DropZone({ onFile }) {
  const ref = React.useRef();
  const [drag, setDrag] = React.useState(false);
  const handle = (f) => { if (f) onFile(f); };
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
      onClick={() => ref.current?.click()}
      className={`card border-2 border-dashed flex flex-col items-center justify-center py-24 gap-5 cursor-pointer transition-all group ${drag ? 'border-accent-glow bg-accent-glow/5' : 'border-border-default hover:border-accent-glow/60'}`}>
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${drag ? 'bg-accent-glow/20 text-accent-glow' : 'bg-surface-raised text-fg-tertiary group-hover:text-accent-glow'}`}>
        <Upload size={28}/>
      </div>
      <div className="text-center">
        <p className="text-body-lg font-semibold text-fg-primary">Drop your spreadsheet here</p>
        <p className="text-caption text-fg-tertiary mt-1">XLSX, XLS, or CSV — multi-sheet supported</p>
      </div>
      <input ref={ref} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => handle(e.target.files[0])}/>
    </div>
  );
}

export function Step1Config({ allSheets, selected, toggleSheet, classDays, toggleDay, file, onProceed }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card flex flex-col gap-4">
        <div className="flex items-center gap-3 mb-1">
          <Layers size={18} className="text-accent-glow"/>
          <h3 className="text-body-lg font-semibold text-fg-primary">Select Sheets</h3>
        </div>
        <p className="text-caption text-fg-secondary">Found {allSheets.length} sheet(s) in <span className="font-mono text-fg-primary">{file?.name}</span></p>
        {allSheets.map(s => (
          <label key={s.name} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selected.has(s.name) ? 'border-accent-glow/50 bg-accent-glow/5' : 'border-border-subtle hover:border-border-default'}`}>
            <input type="checkbox" checked={selected.has(s.name)} onChange={() => toggleSheet(s.name)} className="accent-indigo-500 w-4 h-4"/>
            <div className="flex-1">
              <p className="text-body-sm font-semibold text-fg-primary">{s.name}</p>
              <p className="text-micro text-fg-tertiary">{s.data.length - 1} rows · {s.data[0]?.length ?? 0} columns</p>
            </div>
            {selected.has(s.name) && <CheckCircle2 size={16} className="text-accent-glow"/>}
          </label>
        ))}
      </div>
      <div className="card flex flex-col gap-4">
        <div className="flex items-center gap-3 mb-1">
          <Calendar size={18} className="text-accent-glow"/>
          <h3 className="text-body-lg font-semibold text-fg-primary">Class Days <span className="text-fg-tertiary font-normal text-body-sm">(optional)</span></h3>
        </div>
        <p className="text-caption text-fg-secondary">Help the AI infer dates for undated attendance columns.</p>
        <div className="flex flex-wrap gap-2 mt-1">
          {DAYS.map(d => (
            <button key={d} onClick={() => toggleDay(d)}
              className={`px-4 py-2 rounded-full text-body-sm font-medium border transition-all ${classDays.includes(d) ? 'bg-accent-glow text-white border-accent-glow' : 'bg-surface-raised text-fg-secondary border-border-subtle hover:border-border-default'}`}>
              {d.slice(0,3)}
            </button>
          ))}
        </div>
        {classDays.length > 0 && (
          <p className="text-micro text-fg-tertiary mt-1">Selected: {classDays.join(', ')}</p>
        )}
        <div className="mt-auto pt-4">
          <button onClick={onProceed} disabled={selected.size === 0}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40">
            <BrainCircuit size={16}/> Run AI Analysis
          </button>
        </div>
      </div>
    </div>
  );
}

export function Step2Mapping({ sheets, activeIdx, setActiveIdx, setDateOverride, rerun, onCheckConflicts, isProcessing }) {
  const active = sheets[activeIdx];
  const allMapped = sheets.length > 0 && sheets.every(s => s.status === 'mapped' || s.status === 'error');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-1 flex flex-col gap-2">
        <p className="text-label text-fg-tertiary mb-1">SHEETS</p>
        {sheets.map((s, i) => (
          <button key={i} onClick={() => setActiveIdx(i)}
            className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${activeIdx === i ? 'bg-surface-raised border-accent-glow/50' : 'bg-surface border-border-subtle hover:border-border-default'}`}>
            <div>
              <p className="text-body-sm font-semibold text-fg-primary truncate max-w-[130px]">{s.name}</p>
              <p className="text-micro text-fg-tertiary capitalize">{s.status}</p>
            </div>
            {s.status === 'mapped' && <CheckCircle2 size={15} className="text-success"/>}
            {s.status === 'mapping' && <BrainCircuit size={15} className="text-accent-glow animate-pulse"/>}
            {s.status === 'error' && <AlertCircle size={15} className="text-danger"/>}
          </button>
        ))}
      </div>

      <div className="lg:col-span-3 flex flex-col gap-5">
        {active && (
          <>
            <div className="card flex items-center justify-between gap-4 bg-surface-raised border-accent-glow/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-accent-glow/10 text-accent-glow"><BrainCircuit size={22}/></div>
                <div>
                  <h3 className="text-body-lg font-semibold text-fg-primary">Sheet: {active.name}</h3>
                  <p className="text-caption text-fg-secondary">
                    {active.status === 'pending' && 'Queued for analysis...'}
                    {active.status === 'mapping' && 'Analyzing columns...'}
                    {active.status === 'mapped' && active.explanation}
                    {active.status === 'error' && 'Analysis failed.'}
                  </p>
                </div>
              </div>
              {(active.status === 'error' || active.status === 'pending') && (
                <button onClick={() => rerun(activeIdx)} className="btn-secondary flex items-center gap-2 text-sm">
                  <RefreshCw size={14}/> Retry
                </button>
              )}
            </div>

            {active.status === 'mapped' && active.mapping && (
              <div className="flex flex-col gap-4 animate-fade-in">
                <div className="grid grid-cols-2 gap-4">
                  <div className="card border-success/20 bg-success/5">
                    <p className="text-label text-success mb-2">STUDENT FIELDS</p>
                    <p className="text-body-sm text-fg-primary"><span className="text-fg-tertiary">USN/ID: </span>{active.mapping.usn ?? <span className="text-warning">Not found</span>}</p>
                    <p className="text-body-sm text-fg-primary mt-1"><span className="text-fg-tertiary">Name: </span>{active.mapping.name ?? '—'}</p>
                  </div>
                  <div className="card border-info/20 bg-info/5">
                    <p className="text-label text-info mb-2">SESSIONS FOUND</p>
                    <p className="text-body-sm text-fg-primary"><span className="font-bold">{active.mapping.attendance_cols.length}</span> attendance columns</p>
                    <p className="text-micro text-warning mt-1">{active.mapping.attendance_cols.filter(c=>c.needs_date_inference).length} need date confirmation</p>
                  </div>
                </div>

                <div className="card p-0 border-border-subtle overflow-hidden">
                  <div className="p-4 bg-surface-raised border-b border-border-subtle">
                    <p className="text-label text-fg-tertiary">ATTENDANCE COLUMN MAPPING</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-void">
                          <th className="px-4 py-3 text-micro text-fg-tertiary border-b border-border-subtle">Column</th>
                          <th className="px-4 py-3 text-micro text-fg-tertiary border-b border-border-subtle">Mapped Date</th>
                          <th className="px-4 py-3 text-micro text-fg-tertiary border-b border-border-subtle">Confidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {active.mapping.attendance_cols.map((col, ci) => {
                          const override = active.dateOverrides?.[col.column];
                          const displayDate = override || col.date || col.suggested_date || '';
                          const inferred = col.needs_date_inference && !override;
                          return (
                            <tr key={ci} className="hover:bg-white/5 transition-colors border-b border-border-subtle last:border-0">
                              <td className="px-4 py-3 text-body-sm text-fg-primary font-mono">{col.column || '(blank)'}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {inferred && (
                                    <span className="text-micro px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20">Inferred</span>
                                  )}
                                  <input
                                    type="date"
                                    value={displayDate}
                                    onChange={e => setDateOverride(activeIdx, col.column, e.target.value)}
                                    className="bg-surface-inset border border-border-subtle rounded-lg px-2 py-1 text-body-sm text-fg-primary focus:outline-none focus:border-accent-glow"
                                  />
                                </div>
                                {inferred && col.inference_reason && (
                                  <p className="text-micro text-fg-tertiary mt-1 italic">{col.inference_reason}</p>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-micro font-semibold ${col.confidence >= 0.8 ? 'text-success' : col.confidence >= 0.5 ? 'text-warning' : 'text-danger'}`}>
                                  {Math.round((col.confidence || 0) * 100)}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {allMapped && (
          <div className="flex justify-end mt-2">
            <button onClick={onCheckConflicts} disabled={isProcessing}
              className="btn-primary flex items-center gap-2 px-8 py-3">
              {isProcessing ? <><RefreshCw size={16} className="animate-spin"/> Checking...</> : <><Database size={16}/> Check for Conflicts</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Step3Conflicts({ conflicts, setResolution, setIntraChoice, onImport }) {
  const hasConflicts = conflicts.some(c => c.conflict || c.intraConflict);
  const unresolvedIntra = conflicts.some(c => c.intraConflict && !c.selectedSheet);

  if (!hasConflicts) {
    return (
      <div className="card flex flex-col items-center gap-5 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center">
          <CheckCircle2 size={32} className="text-success"/>
        </div>
        <div>
          <h3 className="text-display-sm font-display text-fg-primary">No Conflicts Found</h3>
          <p className="text-body text-fg-secondary mt-1">All {conflicts.length} session dates are new. Ready to import.</p>
        </div>
        <button onClick={onImport} className="btn-primary flex items-center gap-2 px-8 py-3">
          <Database size={16}/> Import Now
        </button>
      </div>
    );
  }

  const OPTS = [
    { value: 'merge', label: 'Merge', desc: 'Fill only missing records', color: 'text-info' },
    { value: 'overwrite', label: 'Overwrite', desc: 'Replace all records', color: 'text-warning' },
    { value: 'skip', label: 'Skip', desc: 'Do not import this date', color: 'text-fg-tertiary' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="card border-warning/20 bg-warning/5 flex items-start gap-4">
        <AlertCircle size={20} className="text-warning mt-0.5 shrink-0"/>
        <div>
          <p className="text-body-sm font-semibold text-fg-primary">{conflicts.filter(c=>c.conflict||c.intraConflict).length} conflicts detected</p>
          <p className="text-caption text-fg-secondary mt-0.5">Choose how to handle each. Merge fills only missing attendance records (recommended).</p>
        </div>
      </div>

      <div className="card p-0 border-border-subtle overflow-hidden">
        <div className="p-4 bg-surface-raised border-b border-border-subtle grid grid-cols-4 text-micro text-fg-tertiary font-semibold uppercase tracking-wider">
          <span>Date</span><span>Source Sheets</span><span>Status</span><span>Resolution</span>
        </div>
        {conflicts.map((c, i) => (
          <div key={i} className="grid grid-cols-4 items-start px-4 py-4 border-b border-border-subtle last:border-0 hover:bg-white/3">
            <span className="font-mono text-body-sm text-fg-primary">{c.date}</span>
            <div className="flex flex-wrap gap-1">
              {c.fromSheets.map(s => (
                <span key={s} onClick={() => c.intraConflict && setIntraChoice(c.date, s)}
                  className={`text-micro px-2 py-0.5 rounded-full border cursor-pointer transition-all ${
                    c.intraConflict
                      ? c.selectedSheet === s ? 'bg-accent-glow/20 text-accent-glow border-accent-glow/40' : 'bg-surface-raised text-fg-tertiary border-border-subtle hover:border-border-default'
                      : 'bg-surface-raised text-fg-secondary border-border-subtle cursor-default'
                  }`}>{s}</span>
              ))}
              {c.intraConflict && <p className="text-micro text-warning w-full mt-1">Click to select source sheet</p>}
            </div>
            <div>
              {c.conflict && <span className="text-micro text-warning bg-warning/10 border border-warning/20 px-2 py-0.5 rounded-full">Exists in DB</span>}
              {c.intraConflict && <span className="text-micro text-danger bg-danger/10 border border-danger/20 px-2 py-0.5 rounded-full mt-1 block w-fit">Multi-sheet</span>}
              {!c.conflict && !c.intraConflict && <span className="text-micro text-success">New</span>}
            </div>
            <div className="flex flex-col gap-1">
              {OPTS.map(opt => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name={`res-${c.date}`} value={opt.value}
                    checked={c.resolution === opt.value}
                    onChange={() => setResolution(c.date, opt.value)}
                    className="accent-indigo-500"/>
                  <span className={`text-body-sm ${opt.color}`}>{opt.label}</span>
                  <span className="text-micro text-fg-tertiary">— {opt.desc}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button onClick={onImport} disabled={unresolvedIntra}
          className="btn-primary flex items-center gap-2 px-8 py-3 disabled:opacity-40">
          <Database size={16}/> Confirm & Import
        </button>
      </div>
    </div>
  );
}

export function Step4Import({ isProcessing, result, onReset }) {
  if (isProcessing) {
    return (
      <div className="card flex flex-col items-center gap-6 py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-accent-glow/15 flex items-center justify-center">
          <BrainCircuit size={32} className="text-accent-glow animate-pulse"/>
        </div>
        <div>
          <h3 className="text-display-sm font-display text-fg-primary">Importing Attendance</h3>
          <p className="text-body text-fg-secondary mt-1">Syncing records to the database...</p>
        </div>
      </div>
    );
  }
  if (!result) return null;
  if (!result.success) {
    return (
      <div className="card border-danger/20 bg-danger/5 flex flex-col gap-4">
        <div className="flex items-center gap-3"><AlertCircle size={22} className="text-danger"/><h3 className="text-body-lg font-semibold text-danger">Import Failed</h3></div>
        <p className="text-body-sm text-fg-secondary">{result.message}</p>
        <button onClick={onReset} className="btn-secondary w-fit">Try Again</button>
      </div>
    );
  }
  return (
    <div className="card border-success/20 bg-success/5 flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-success/20 flex items-center justify-center"><CheckCircle2 size={28} className="text-success"/></div>
        <div>
          <h3 className="text-display-sm font-display text-fg-primary">Import Complete</h3>
          <p className="text-body text-fg-secondary mt-0.5">{result.totalInserted} records synced · {result.totalSkipped} skipped</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {result.breakdown?.map((b, i) => (
          <div key={i} className="bg-surface-raised rounded-xl p-4 border border-border-subtle">
            <p className="text-body-sm font-semibold text-fg-primary truncate">{b.name}</p>
            <p className="text-micro text-success mt-1">{b.inserted} imported</p>
            {b.skipped > 0 && <p className="text-micro text-fg-tertiary">{b.skipped} skipped</p>}
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <button onClick={() => window.location.href='/dashboard'} className="btn-primary flex items-center gap-2">
          <Database size={15}/> View Dashboard
        </button>
        <button onClick={onReset} className="btn-secondary">Upload Another</button>
      </div>
    </div>
  );
}

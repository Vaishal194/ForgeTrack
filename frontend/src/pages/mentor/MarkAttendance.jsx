import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Check, X, AlertTriangle, Search, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";

export default function MarkAttendance() {
  const [dateStr, setDateStr] = useState(new Date().toISOString().split('T')[0]);
  const [session, setSession] = useState(null); // null means no session yet, loading means checking
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  
  // Creation Wizard variables
  const [newTopic, setNewTopic] = useState('');
  const [newDuration, setNewDuration] = useState('2.0');
  const [newType, setNewType] = useState('offline');

  // Attendance Checklist
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({}); // { student_id: boolean }
  const [initialAttendance, setInitialAttendance] = useState({}); // for diff detection
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [recentSessions, setRecentSessions] = useState([]);
  const [toast, setToast] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const minDate = '2025-08-04';
  const maxDate = new Date().toISOString().split('T')[0];

  useEffect(() => {
    // Fetch recent sessions for history sidebar
    supabase.from('sessions').select('*').order('date', { ascending: false }).limit(10)
      .then(({ data }) => { if(data) setRecentSessions(data); });

    // Check if session exists for selected date
    setIsCheckingSession(true);
    // ... (rest of the logic)
    setSession(null);
    setAttendance({});
    setInitialAttendance({});
    
    supabase.from('sessions').select('*').eq('date', dateStr).maybeSingle()
      .then(({ data: sess }) => {
         if (sess) {
            setSession(sess);
            // Fetch students and existing attendance
            Promise.all([
               supabase.from('students').select('*').eq('is_active', true).order('name'),
               supabase.from('attendance').select('*').eq('session_id', sess.id)
            ]).then(([{ data: stuData }, { data: attData }]) => {
               if (stuData) setStudents(stuData);
               
               const attMap = {};
               if (attData) {
                 attData.forEach(r => attMap[r.student_id] = r.present);
               } else if (stuData) {
                 // default un-saved state is false
                 stuData.forEach(s => attMap[s.id] = false);
               }
               setAttendance(attMap);
               // copy object to track overrides
               setInitialAttendance({...attMap});
            });
         } else {
            // No session. Fetch students just to be ready.
            supabase.from('students').select('*').eq('is_active', true).order('name')
               .then(({ data }) => { if(data) setStudents(data); });
         }
         setIsCheckingSession(false);
      });
  }, [dateStr]);

  const handleCreateSession = async () => {
    if (!newTopic) return;
    setIsCheckingSession(true); // Loading lock
    const payload = {
       date: dateStr,
       topic: newTopic,
       month_number: new Date(dateStr).getMonth() + 1, // rough estimate
       duration_hours: parseFloat(newDuration),
       session_type: newType
    };
    
    const { data, error } = await supabase.from('sessions').insert([payload]).select().single();
    if (!error && data) {
       setSession(data);
       const initMap = {};
       students.forEach(s => initMap[s.id] = false);
       setAttendance(initMap);
       setInitialAttendance(initMap);
       // Refresh history sidebar
       supabase.from('sessions').select('*').order('date', { ascending: false }).limit(10)
         .then(({ data }) => { if(data) setRecentSessions(data); });
    }
    setIsCheckingSession(false);
  };

  const hasModifications = Object.keys(attendance).some(k => attendance[k] !== initialAttendance[k]);
  const isUpdatingExisting = Object.keys(initialAttendance).length > 0 && Object.keys(initialAttendance).some(k => initialAttendance[k] === true || initialAttendance[k] === false); // if initial had entries. Wait, if it's purely new, initial might only consist of default false or be empty. Let's explicitly check if db had rows.

  const executeSave = async () => {
    setIsSaving(true);
    setShowConfirmModal(false);

    const payload = Object.entries(attendance).map(([student_id, present]) => ({
      student_id: parseInt(student_id),
      session_id: session.id,
      present,
      marked_by: 'system_mentor' // normally fetch display_name from context
    }));

    // Upsert conflicts on (student_id, session_id) automatically if configured correctly in Schema UNIQUE constraint
    // In Supabase js, upsert accepts an array. We specify onConflict explicitly.
    const { error } = await supabase.from('attendance').upsert(payload, { onConflict: 'student_id,session_id' });
    
    setIsSaving(false);
    if (!error) {
       setToast(`Marked ${payload.filter(p=>p.present).length} present, ${payload.filter(p=>!p.present).length} absent.`);
       setInitialAttendance({...attendance});
       setTimeout(() => setToast(''), 4000);
    } else {
       alert("Error saving: " + error.message);
    }
  };

  const triggerSave = () => {
    // Spec mandates confirmation if updating existing
    // We determine 'existing' if there was actually attendance records pulled in useEffect (keys existed that were true/false from DB)
    // To cleanly detect this: if initialAttendance has values AND we consider them pristine db values:
    const previouslySavedCount = Object.values(initialAttendance).filter(v => v === true).length;
    if (previouslySavedCount > 0 && hasModifications) {
       setShowConfirmModal(true);
    } else {
       executeSave();
    }
  };

  const toggleAll = (present) => {
    const newMap = {};
    students.forEach(s => newMap[s.id] = present);
    setAttendance(newMap);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 max-w-[1600px] pb-24 relative animate-in fade-in">
      {/* Sidebar: Session History */}
      <div className="w-full lg:w-80 shrink-0">
         <div className="flex items-center justify-between mb-4">
            <h2 className="text-label text-fg-tertiary">SESSION HISTORY</h2>
            <button onClick={() => setShowCreateModal(true)} className="text-accent-glow hover:underline text-caption font-medium">New Session</button>
         </div>
         <div className="flex flex-col gap-2">
            {recentSessions.map(s => (
               <button 
                 key={s.id} 
                 onClick={() => setDateStr(s.date)}
                 className={`w-full text-left p-4 rounded-xl border transition-all ${
                   dateStr === s.date 
                   ? 'bg-surface-raised border-accent-glow shadow-[0_0_15px_rgba(99,102,241,0.15)]' 
                   : 'bg-surface border-border-subtle hover:border-border-default'
                 }`}
               >
                  <p className="text-body-sm font-semibold text-fg-primary truncate">{s.topic}</p>
                  <p className="text-caption text-fg-tertiary mt-1 tabular-nums">{s.date}</p>
               </button>
            ))}
         </div>
      </div>

      {/* Main Content: Mark Attendance */}
      <div className="flex-1 min-w-0">
         <div className="flex justify-between items-end mb-8">
            <div>
               <h1 className="text-display-sm font-display text-fg-primary mb-2">Attendance: {session?.topic || 'Select Session'}</h1>
               <p className="text-body-sm text-fg-secondary">Viewing roster for <span className="text-fg-primary font-mono">{dateStr}</span></p>
            </div>
            <div className="flex gap-3">
               <button onClick={()=>toggleAll(true)} className="btn-secondary py-2 text-sm"><Check size={16} className="inline mr-1" /> All Present</button>
               <button onClick={()=>toggleAll(false)} className="btn-secondary py-2 text-sm"><X size={16} className="inline mr-1" /> All Absent</button>
            </div>
         </div>

         {/* Search Bar */}
         <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-tertiary" size={18} />
            <input 
               type="text" 
               placeholder="Search 65+ students by Name or USN..." 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="w-full bg-surface-inset border border-border-default rounded-xl py-4 pl-12 pr-4 text-fg-primary focus:outline-none focus:ring-1 focus:ring-accent-glow transition-all shadow-sm"
            />
         </div>

         {isCheckingSession ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
               {[1,2,3,4,5,6].map(i => <div key={i} className="card h-20 bg-surface-inset" />)}
            </div>
         ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
               {students
                  .filter(s => 
                     s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                     s.usn.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map(s => {
                     const isPresent = attendance[s.id] || false;
                     return (
                        <div key={s.id} className="bg-surface border border-border-subtle rounded-xl p-4 flex items-center justify-between hover:bg-surface-raised transition-all group">
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-fg-primary font-bold bg-void group-hover:border-accent-glow/50 transition-colors">
                                 {s.name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                 <p className="text-body-sm font-semibold text-fg-primary truncate">{s.name}</p>
                                 <p className="text-micro font-mono text-fg-tertiary mt-0.5 truncate">{s.usn}</p>
                              </div>
                           </div>
                           
                           <div className="flex gap-1.5">
                              <button 
                                 onClick={() => setAttendance(a => ({...a, [s.id]: true}))}
                                 className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-all ${
                                    isPresent 
                                    ? 'bg-success/20 border-success text-success shadow-[0_0_10px_rgba(16,185,129,0.2)]' 
                                    : 'bg-void border-white/5 text-fg-tertiary hover:border-white/20'
                                 }`}
                              >
                                 <Check size={16} />
                              </button>
                              <button 
                                 onClick={() => setAttendance(a => ({...a, [s.id]: false}))}
                                 className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-all ${
                                    !isPresent 
                                    ? 'bg-danger/20 border-danger text-danger shadow-[0_0_10px_rgba(244,63,94,0.2)]' 
                                    : 'bg-void border-white/5 text-fg-tertiary hover:border-white/20'
                                 }`}
                              >
                                 <X size={16} />
                              </button>
                           </div>
                        </div>
                     );
                  })}
            </div>
         )}
      </div>

      {/* Create Session Dialog */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New Session</DialogTitle>
            <DialogDescription>
              Set up a session for {dateStr} to start marking attendance.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-label text-fg-secondary">TOPIC</label>
              <input 
                type="text" 
                placeholder="e.g. Introduction to React" 
                value={newTopic} 
                onChange={e=>setNewTopic(e.target.value)} 
                className="input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="grid gap-2">
                 <label className="text-label text-fg-secondary">DURATION (HRS)</label>
                 <input type="number" step="0.5" value={newDuration} onChange={e=>setNewDuration(e.target.value)} className="input" />
               </div>
               <div className="grid gap-2">
                 <label className="text-label text-fg-secondary">TYPE</label>
                 <select value={newType} onChange={e=>setNewType(e.target.value)} className="input">
                    <option value="offline">Offline</option>
                    <option value="online">Online</option>
                 </select>
               </div>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setShowCreateModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={() => { handleCreateSession(); setShowCreateModal(false); }} className="btn-primary" disabled={!newTopic}>Establish Session</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent>
          <DialogHeader>
             <div className="flex items-center gap-4 mb-4">
                <div className="bg-warning-bg text-warning p-3 rounded-full outline outline-1 outline-warning-border">
                  <AlertTriangle size={24} />
                </div>
                <div className="text-left">
                  <DialogTitle>Update Existing Attendance?</DialogTitle>
                  <DialogDescription className="mt-1">
                    You are modifying a session that already has confirmed attendance records attached. Overwriting this will change historical records for affected students. Proceed?
                  </DialogDescription>
                </div>
             </div>
          </DialogHeader>
          <DialogFooter>
            <button onClick={()=>setShowConfirmModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={executeSave} className="btn-primary bg-danger text-white border-none hover:bg-danger/80">Overwrite Data</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-8 right-8 z-50 bg-surface-raised border border-border-strong shadow-raised px-5 py-4 rounded-lg flex gap-3 items-center w-80 animate-in slide-in-from-right">
           <CheckCircle2 className="text-success" size={20} />
           <div>
              <p className="text-body font-semibold text-fg-primary">Success</p>
              <p className="text-caption text-fg-secondary">{toast}</p>
           </div>
        </div>
      )}
    </div>
  );
}

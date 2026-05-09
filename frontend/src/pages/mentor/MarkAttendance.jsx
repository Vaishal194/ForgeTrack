import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Check, X, AlertTriangle, Search, CheckCircle2, Save, RefreshCw } from 'lucide-react';
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
  const [session, setSession] = useState(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  
  // Creation Wizard variables
  const [newTopic, setNewTopic] = useState('');
  const [newDuration, setNewDuration] = useState('2.0');
  const [newType, setNewType] = useState('offline');

  // Attendance Checklist
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({}); // { student_id: boolean | null }
  const [initialAttendance, setInitialAttendance] = useState({}); 
  const [isSaving, setIsSaving] = useState(false);
  
  // Modals
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAllPresentModal, setShowAllPresentModal] = useState(false);
  const [showAllAbsentModal, setShowAllAbsentModal] = useState(false);
  
  const [recentSessions, setRecentSessions] = useState([]);
  const [toast, setToast] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    supabase.from('sessions').select('*').order('date', { ascending: false }).limit(15)
      .then(({ data }) => { if(data) setRecentSessions(data); });

    setIsCheckingSession(true);
    setSession(null);
    setAttendance({});
    setInitialAttendance({});
    
    supabase.from('sessions').select('*').eq('date', dateStr).maybeSingle()
      .then(({ data: sess }) => {
         if (sess) {
            setSession(sess);
            Promise.all([
               supabase.from('students').select('*').eq('is_active', true).order('name'),
               supabase.from('attendance').select('*').eq('session_id', sess.id)
            ]).then(([{ data: stuData }, { data: attData }]) => {
               if (stuData) setStudents(stuData);
               
               const attMap = {};
               if (stuData) stuData.forEach(s => attMap[s.id] = null); // default unmarked
               
               if (attData) {
                 attData.forEach(r => attMap[r.student_id] = r.present);
               }
               
               setAttendance(attMap);
               setInitialAttendance({...attMap});
            });
         } else {
            supabase.from('students').select('*').eq('is_active', true).order('name')
               .then(({ data }) => { if(data) setStudents(data); });
         }
         setIsCheckingSession(false);
      });
  }, [dateStr]);

  const handleCreateSession = async () => {
    if (!newTopic) return;
    setIsCheckingSession(true);
    const payload = {
       date: dateStr,
       topic: newTopic,
       month_number: new Date(dateStr).getMonth() + 1,
       duration_hours: parseFloat(newDuration),
       session_type: newType
    };
    
    const { data, error } = await supabase.from('sessions').insert([payload]).select().single();
    if (!error && data) {
       setSession(data);
       
       const { data: previousSessions } = await supabase.from('sessions')
         .select('id').neq('id', data.id).order('date', { ascending: false }).limit(1);

       let loadedFromMaster = true;
       let activeStudents = [];

       if (previousSessions && previousSessions.length > 0) {
          const { data: prevAtt } = await supabase.from('attendance')
             .select('student_id').eq('session_id', previousSessions[0].id);

          if (prevAtt && prevAtt.length > 0) {
             const prevIds = new Set(prevAtt.map(a => a.student_id));
             const { data: allStudents } = await supabase.from('students').select('*').eq('is_active', true).order('name');
             const filtered = (allStudents || []).filter(s => prevIds.has(s.id));
             if (filtered.length > 0) {
                 activeStudents = filtered;
                 loadedFromMaster = false;
             }
          }
       }
       
       if (loadedFromMaster || activeStudents.length === 0) {
           const { data: allStudents } = await supabase.from('students').select('*').eq('is_active', true).order('name');
           activeStudents = allStudents || [];
       }

       setStudents(activeStudents);

       const initMap = {};
       activeStudents.forEach(s => initMap[s.id] = null); // explicit unmarked
       setAttendance(initMap);
       setInitialAttendance(initMap);

       supabase.from('sessions').select('*').order('date', { ascending: false }).limit(15)
         .then(({ data }) => { if(data) setRecentSessions(data); });

       setToast(loadedFromMaster ? "Loaded students from master database" : "Previous roster imported successfully");
       setTimeout(() => setToast(''), 4000);
    }
    setIsCheckingSession(false);
  };

  const hasModifications = useMemo(() => {
     return Object.keys(attendance).some(k => attendance[k] !== initialAttendance[k]);
  }, [attendance, initialAttendance]);

  const isUpdatingExisting = useMemo(() => {
     return Object.values(initialAttendance).some(v => v !== null);
  }, [initialAttendance]);

  const executeSave = async () => {
    setIsSaving(true);
    setShowConfirmModal(false);

    // Only save records that are explicitly true or false (skip null)
    const payload = Object.entries(attendance)
      .filter(([_, present]) => present !== null)
      .map(([student_id, present]) => ({
        student_id: parseInt(student_id),
        session_id: session.id,
        present,
        marked_by: 'system_mentor'
      }));

    if (payload.length === 0) {
      setIsSaving(false);
      setToast("No attendance marked to save.");
      setTimeout(() => setToast(''), 4000);
      return;
    }

    const { error } = await supabase.from('attendance').upsert(payload, { onConflict: 'student_id,session_id' });
    
    setIsSaving(false);
    if (!error) {
       setToast(`Saved ${payload.filter(p=>p.present).length} present, ${payload.filter(p=>!p.present).length} absent.`);
       setInitialAttendance({...attendance});
       setTimeout(() => setToast(''), 4000);
    } else {
       alert("Error saving: " + error.message);
    }
  };

  const triggerSave = () => {
    const previouslySavedCount = Object.values(initialAttendance).filter(v => v === true || v === false).length;
    if (previouslySavedCount > 0 && hasModifications) {
       setShowConfirmModal(true);
    } else {
       executeSave();
    }
  };

  const toggleAll = (present) => {
    const newMap = { ...attendance };
    students.forEach(s => {
       // only toggle visible students if we want to respect search, but usually "All" means all in roster.
       // The prompt says "Mark every displayed student as Present". So we filter by search!
       const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.usn.toLowerCase().includes(searchQuery.toLowerCase());
       if (matchesSearch) {
          newMap[s.id] = present;
       }
    });
    setAttendance(newMap);
  };

  // Progress Calculations
  const totalDisplayed = students.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.usn.toLowerCase().includes(searchQuery.toLowerCase())).length;
  const markedDisplayed = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.usn.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch && attendance[s.id] !== null && attendance[s.id] !== undefined;
  }).length;
  const progressPct = totalDisplayed === 0 ? 0 : Math.round((markedDisplayed / totalDisplayed) * 100);

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto w-full pb-24 relative animate-in fade-in min-w-0">
      
      {/* Sidebar: Session History */}
      <div className="w-full lg:w-72 shrink-0 flex flex-col gap-4">
         <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
            <h2 className="text-label text-fg-tertiary">SESSION HISTORY</h2>
            <button onClick={() => setShowCreateModal(true)} className="text-accent-glow hover:underline text-caption font-medium flex items-center gap-1">
               New Session
            </button>
         </div>
         <div className="flex flex-col gap-2 overflow-y-auto max-h-[80vh] custom-scrollbar pr-2">
            {recentSessions.map(s => (
               <button 
                 key={s.id} 
                 onClick={() => setDateStr(s.date)}
                 className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col gap-1 ${
                   dateStr === s.date 
                   ? 'bg-surface-raised border-accent-glow shadow-[0_0_15px_rgba(99,102,241,0.15)] ring-1 ring-accent-glow' 
                   : 'bg-surface border-border-subtle hover:border-border-default'
                 }`}
               >
                  <p className="text-body-sm font-semibold text-fg-primary truncate">{s.topic}</p>
                  <div className="flex justify-between items-center text-caption text-fg-tertiary">
                     <span className="tabular-nums">{s.date}</span>
                     <span className="uppercase text-[10px]">{s.session_type}</span>
                  </div>
               </button>
            ))}
         </div>
      </div>

      {/* Main Content: Mark Attendance */}
      <div className="flex-1 flex flex-col min-w-0">
         
         <div className="mb-6">
            <h1 className="text-display-sm font-display text-fg-primary truncate">
               {session?.topic || 'Select or Create Session'}
            </h1>
            <p className="text-body-sm text-fg-secondary mt-1">Viewing roster for <span className="text-fg-primary font-mono">{dateStr}</span></p>
         </div>

         {/* Sticky Toolbar */}
         <div className="sticky top-0 z-20 bg-void/90 backdrop-blur-md pt-2 pb-4 mb-4 border-b border-border-subtle">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
               {/* Search */}
               <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-tertiary" size={16} />
                  <input 
                     type="text" 
                     placeholder="Search Name or USN..." 
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     className="w-full bg-surface-inset border border-border-default rounded-lg py-2 pl-9 pr-3 text-body-sm text-fg-primary focus:outline-none focus:ring-1 focus:ring-accent-glow transition-all"
                  />
               </div>

               {/* Actions & Progress */}
               <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="flex flex-col gap-1 min-w-[120px]">
                     <div className="flex justify-between text-caption text-fg-secondary">
                        <span>Marked</span>
                        <span className="tabular-nums font-mono">{markedDisplayed} / {totalDisplayed}</span>
                     </div>
                     <div className="h-1.5 w-full bg-surface-inset rounded-full overflow-hidden">
                        <div 
                           className="h-full bg-accent-glow transition-all duration-300 ease-out" 
                           style={{ width: `${progressPct}%` }}
                        />
                     </div>
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto">
                     <button onClick={()=>setShowAllPresentModal(true)} className="btn-secondary py-1.5 px-3 text-xs flex-1 sm:flex-none justify-center">
                        <Check size={14} className="mr-1" /> All P
                     </button>
                     <button onClick={()=>setShowAllAbsentModal(true)} className="btn-secondary py-1.5 px-3 text-xs flex-1 sm:flex-none justify-center">
                        <X size={14} className="mr-1" /> All A
                     </button>
                     <button 
                        onClick={triggerSave} 
                        disabled={isSaving || !hasModifications} 
                        className={`py-1.5 px-4 text-xs font-semibold rounded-lg flex items-center justify-center transition-all flex-1 sm:flex-none ${
                           hasModifications && !isSaving 
                           ? (isUpdatingExisting ? 'bg-warning text-warning-bg hover:bg-warning/90' : 'bg-accent-glow text-white hover:bg-accent-glow/90') 
                           : 'bg-surface-inset text-fg-tertiary cursor-not-allowed border border-border-default'
                        }`}
                     >
                        {isSaving ? <RefreshCw size={14} className="animate-spin mr-1.5" /> : <Save size={14} className="mr-1.5" />}
                        {isUpdatingExisting ? 'Update' : 'Save'}
                     </button>
                  </div>
               </div>
            </div>
         </div>

         {/* Roster Grid */}
         {isCheckingSession ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-pulse">
               {[1,2,3,4,5,6].map(i => <div key={i} className="h-16 bg-surface-inset rounded-xl" />)}
            </div>
         ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
               {students
                  .filter(s => 
                     s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                     s.usn.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map(s => {
                     const status = attendance[s.id];
                     const isPresent = status === true;
                     const isAbsent = status === false;

                     return (
                        <div key={s.id} className={`bg-surface border rounded-xl p-3 flex items-center justify-between transition-all group ${
                           isPresent ? 'border-success/30 bg-success/5 shadow-[0_0_10px_rgba(16,185,129,0.05)]' : 
                           isAbsent ? 'border-danger/30 bg-danger/5 shadow-[0_0_10px_rgba(244,63,94,0.05)]' : 
                           'border-border-subtle hover:border-border-default hover:bg-surface-raised'
                        }`}>
                           <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                                 isPresent ? 'border-success text-success bg-success/10' :
                                 isAbsent ? 'border-danger text-danger bg-danger/10' :
                                 'border-white/10 text-fg-secondary bg-void'
                              }`}>
                                 {s.name.charAt(0)}
                              </div>
                              <div className="min-w-0 flex flex-col">
                                 <p className="text-body-sm font-semibold text-fg-primary truncate" title={s.name}>{s.name}</p>
                                 <p className="text-micro font-mono text-fg-tertiary truncate">{s.usn}</p>
                              </div>
                           </div>
                           
                           <div className="flex gap-1 shrink-0 ml-2">
                              <button 
                                 onClick={() => setAttendance(a => ({...a, [s.id]: true}))}
                                 className={`w-8 h-8 rounded-md flex items-center justify-center border transition-all ${
                                    isPresent 
                                    ? 'bg-success border-success text-void shadow-sm' 
                                    : 'bg-void border-white/5 text-fg-tertiary hover:border-success/30 hover:text-success'
                                 }`}
                              >
                                 <Check size={14} />
                              </button>
                              <button 
                                 onClick={() => setAttendance(a => ({...a, [s.id]: false}))}
                                 className={`w-8 h-8 rounded-md flex items-center justify-center border transition-all ${
                                    isAbsent 
                                    ? 'bg-danger border-danger text-void shadow-sm' 
                                    : 'bg-void border-white/5 text-fg-tertiary hover:border-danger/30 hover:text-danger'
                                 }`}
                              >
                                 <X size={14} />
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
                    You are modifying a session that already has confirmed attendance records. Overwriting this changes historical data. Proceed?
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

      {/* All Present Modal */}
      <Dialog open={showAllPresentModal} onOpenChange={setShowAllPresentModal}>
        <DialogContent>
          <DialogHeader>
             <div className="flex items-center gap-4 mb-4">
                <div className="bg-success/20 text-success p-3 rounded-full outline outline-1 outline-success">
                  <Check size={24} />
                </div>
                <div className="text-left">
                  <DialogTitle>Mark Displayed Present?</DialogTitle>
                  <DialogDescription className="mt-1">
                    This will mark all currently displayed students as Present. Are you sure?
                  </DialogDescription>
                </div>
             </div>
          </DialogHeader>
          <DialogFooter>
            <button onClick={()=>setShowAllPresentModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={() => { toggleAll(true); setShowAllPresentModal(false); }} className="btn-primary bg-success text-white border-none hover:bg-success/80">Mark All Present</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* All Absent Modal */}
      <Dialog open={showAllAbsentModal} onOpenChange={setShowAllAbsentModal}>
        <DialogContent>
          <DialogHeader>
             <div className="flex items-center gap-4 mb-4">
                <div className="bg-danger/20 text-danger p-3 rounded-full outline outline-1 outline-danger">
                  <X size={24} />
                </div>
                <div className="text-left">
                  <DialogTitle>Mark Displayed Absent?</DialogTitle>
                  <DialogDescription className="mt-1">
                    This will mark all currently displayed students as Absent. Are you sure?
                  </DialogDescription>
                </div>
             </div>
          </DialogHeader>
          <DialogFooter>
            <button onClick={()=>setShowAllAbsentModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={() => { toggleAll(false); setShowAllAbsentModal(false); }} className="btn-primary bg-danger text-white border-none hover:bg-danger/80">Mark All Absent</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-surface-raised border border-border-strong shadow-raised px-5 py-4 rounded-lg flex gap-3 items-center min-w-[300px] animate-in slide-in-from-bottom-5">
           <CheckCircle2 className="text-success" size={20} />
           <div>
              <p className="text-body font-semibold text-fg-primary">Notification</p>
              <p className="text-caption text-fg-secondary">{toast}</p>
           </div>
        </div>
      )}
    </div>
  );
}

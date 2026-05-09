import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Users, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import Heatmap from '../../components/ui/Heatmap';

export default function StudentHistory() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [attendance, setAttendance] = useState([]);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterPct, setFilterPct] = useState('');
  const [filterBranch, setFilterBranch] = useState('');

  const threshold = 75;

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [stuRes, sessRes, attRes] = await Promise.all([
          supabase.from('students').select('*').order('name'),
          supabase.from('sessions').select('*').order('date', { ascending: false }),
          supabase.from('attendance').select('student_id, session_id, present')
        ]);
        
        if (stuRes.data) setStudents(stuRes.data);
        if (sessRes.data) setSessions(sessRes.data);
        if (attRes.data) setAttendance(attRes.data);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  const studentStats = useMemo(() => {
    if (!students.length) return [];
    
    let activeSessions = sessions;
    if (filterMonth) {
      activeSessions = sessions.filter(s => {
        const hMonth = new Date(s.date).getMonth() + 1;
        return hMonth.toString() === filterMonth;
      });
    }

    const sessionIds = new Set(activeSessions.map(s => s.id));

    return students.map(student => {
      const stuAtt = attendance.filter(a => a.student_id === student.id && sessionIds.has(a.session_id));
      
      const total = activeSessions.length;
      const presentCount = stuAtt.filter(a => a.present).length;
      const absentCount = stuAtt.filter(a => !a.present).length;
      const pct = total === 0 ? 0 : Math.round((presentCount / total) * 100);

      const heatmapData = activeSessions.map(s => {
        const record = stuAtt.find(a => a.session_id === s.id);
        return {
          id: s.id,
          date: s.date,
          topic: s.topic,
          status: record ? (record.present ? 'present' : 'absent') : 'unmarked'
        };
      });

      return {
        ...student,
        total,
        presentCount,
        absentCount,
        pct,
        heatmapData
      };
    });
  }, [students, sessions, attendance, filterMonth]);

  const displayedStudents = useMemo(() => {
    return studentStats.filter(s => {
      let match = true;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (!s.name.toLowerCase().includes(term) && !s.usn.toLowerCase().includes(term)) {
          match = false;
        }
      }
      if (filterBranch && s.branch_code !== filterBranch) match = false;
      if (filterPct) {
        if (filterPct === 'low' && s.pct >= threshold) match = false;
        if (filterPct === 'mid' && (s.pct < threshold || s.pct > 90)) match = false;
        if (filterPct === 'high' && s.pct <= 90) match = false;
      }
      return match;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [studentStats, searchTerm, filterBranch, filterPct]);

  const globalStats = useMemo(() => {
    const totalDisplayed = displayedStudents.length;
    if (!totalDisplayed) return { avg: 0, belowThreshold: 0, top: null, bottom: null };
    
    const sumPct = displayedStudents.reduce((acc, s) => acc + s.pct, 0);
    const avg = Math.round(sumPct / totalDisplayed);
    const belowThreshold = displayedStudents.filter(s => s.pct < threshold).length;
    
    const sortedByPct = [...displayedStudents].sort((a, b) => b.pct - a.pct);
    const top = sortedByPct[0];
    const bottom = sortedByPct[sortedByPct.length - 1];

    return { avg, belowThreshold, top, bottom };
  }, [displayedStudents]);

  const uniqueBranches = useMemo(() => [...new Set(students.map(s => s.branch_code).filter(Boolean))], [students]);

  if (loading) {
     return <div className="p-8 text-center animate-pulse text-fg-tertiary">Loading Analytics Dashboard...</div>;
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-24 animate-in fade-in min-w-0 overflow-hidden">
       <div>
         <h1 className="text-display-md font-display tracking-tight text-fg-primary mb-2">Attendance Analytics</h1>
         <p className="text-body text-fg-secondary">Global overview of student engagement and historical data.</p>
       </div>

       {/* Top Analytics Cards */}
       <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="card bg-surface flex flex-col justify-between">
             <div className="flex items-center gap-3 text-fg-tertiary mb-4">
                <Users size={18} />
                <span className="text-label">TOTAL STUDENTS</span>
             </div>
             <p className="text-display-lg tabular-nums text-fg-primary leading-none">{displayedStudents.length}</p>
          </div>
          <div className="card bg-surface flex flex-col justify-between">
             <div className="flex items-center gap-3 text-fg-tertiary mb-4">
                <TrendingUp size={18} />
                <span className="text-label">AVERAGE ATTENDANCE</span>
             </div>
             <p className={`text-display-lg tabular-nums leading-none ${globalStats.avg >= threshold ? 'text-success' : 'text-danger'}`}>
                {globalStats.avg}%
             </p>
          </div>
          <div className="card bg-surface flex flex-col justify-between">
             <div className="flex items-center gap-3 text-danger mb-4">
                <AlertTriangle size={18} />
                <span className="text-label">AT RISK (&lt;{threshold}%)</span>
             </div>
             <p className="text-display-lg tabular-nums text-danger leading-none">{globalStats.belowThreshold}</p>
          </div>
          <div className="card bg-surface flex flex-col justify-between text-body-sm text-fg-secondary min-w-0">
             <div className="flex items-center gap-3 text-fg-tertiary mb-2">
                <TrendingDown size={18} />
                <span className="text-label">PERFORMANCE OUTLIERS</span>
             </div>
             <div className="flex justify-between items-center py-1 min-w-0">
                <span className="truncate pr-2 flex-1">High: {globalStats.top?.name || '-'}</span>
                <span className="text-success font-mono font-medium shrink-0">{globalStats.top?.pct || 0}%</span>
             </div>
             <div className="flex justify-between items-center py-1 border-t border-border-subtle min-w-0">
                <span className="truncate pr-2 flex-1">Low: {globalStats.bottom?.name || '-'}</span>
                <span className="text-danger font-mono font-medium shrink-0">{globalStats.bottom?.pct || 0}%</span>
             </div>
          </div>
       </div>

       {/* Filters */}
       <div className="flex flex-wrap items-center gap-4 bg-surface-inset p-4 rounded-xl border border-border-default">
          <div className="relative flex-1 min-w-[250px]">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-tertiary" />
            <input 
               type="text" 
               placeholder="Search Name or USN..." 
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
               className="input w-full pl-10"
            />
          </div>
          <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} className="input w-auto min-w-[140px]">
             <option value="">All Months</option>
             {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                <option key={m} value={m}>{new Date(2000, m-1, 1).toLocaleString('default', { month: 'short' })}</option>
             ))}
          </select>
          <select value={filterPct} onChange={e=>setFilterPct(e.target.value)} className="input w-auto min-w-[140px]">
             <option value="">All % Ranges</option>
             <option value="high">&gt; 90% (Excellent)</option>
             <option value="mid">75% - 90% (Good)</option>
             <option value="low">&lt; 75% (At Risk)</option>
          </select>
          <select value={filterBranch} onChange={e=>setFilterBranch(e.target.value)} className="input w-auto min-w-[140px]">
             <option value="">All Sections</option>
             {uniqueBranches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
       </div>

       {/* Student Roster */}
       <div className="card p-0 overflow-x-auto border-border-subtle border">
          <table className="table whitespace-nowrap">
             <thead>
                <tr>
                   <th className="w-[200px]">Student Details</th>
                   <th className="w-24 text-center">Att %</th>
                   <th>Attendance Timeline (Recent 35)</th>
                   <th className="w-24 text-center">Present</th>
                   <th className="w-24 text-center">Absent</th>
                </tr>
             </thead>
             <tbody>
                {displayedStudents.map((s) => (
                   <tr key={s.id} className="hover:bg-surface-raised transition-colors group">
                      <td>
                         <div className="flex flex-col min-w-[150px]">
                            <span className="text-body font-semibold text-fg-primary group-hover:text-accent-glow transition-colors truncate">{s.name}</span>
                            <span className="text-caption font-mono text-fg-tertiary truncate">{s.usn}</span>
                         </div>
                      </td>
                      <td className="text-center">
                         <span className={`inline-block font-mono font-bold w-12 text-right ${s.pct >= threshold ? 'text-success' : 'text-danger'}`}>
                            {s.pct}%
                         </span>
                      </td>
                      <td className="w-full">
                         <Heatmap sessions={s.heatmapData} maxBlocks={35} />
                      </td>
                      <td className="text-center">
                         <span className="text-body-sm tabular-nums text-fg-secondary">{s.presentCount}</span>
                      </td>
                      <td className="text-center">
                         <span className="text-body-sm tabular-nums text-fg-secondary">{s.absentCount}</span>
                      </td>
                   </tr>
                ))}
                {displayedStudents.length === 0 && (
                   <tr>
                      <td colSpan="5" className="text-center py-12 text-fg-tertiary">
                         No students found matching your filters.
                      </td>
                   </tr>
                )}
             </tbody>
          </table>
       </div>
    </div>
  );
}

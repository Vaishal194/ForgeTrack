import React from 'react';

export default function Heatmap({ sessions = [], maxBlocks = 35 }) {
  // Sort sessions by date descending, then take maxBlocks, then reverse for left-to-right timeline
  const sortedSessions = [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date));
  const displaySessions = sortedSessions.slice(0, maxBlocks).reverse();
  
  // Pad if fewer than maxBlocks
  const blocks = [...displaySessions];
  while (blocks.length < maxBlocks) {
    blocks.unshift({ dummy: true });
  }

  return (
    <div className="flex gap-1 items-center">
      {blocks.map((session, idx) => {
        if (session.dummy) {
          return (
            <div 
              key={`dummy-${idx}`} 
              className="w-4 h-4 rounded-sm bg-surface-inset opacity-30" 
            />
          );
        }

        let bgClass = "bg-surface-inset"; // unmarked/no data
        if (session.status === 'present') bgClass = "bg-success hover:bg-success/80";
        else if (session.status === 'absent') bgClass = "bg-danger hover:bg-danger/80";

        return (
          <div 
            key={session.id || session.date || idx} 
            title={`${session.date}\n${session.topic || ''}\n${session.status ? session.status.toUpperCase() : 'NO DATA'}`}
            className={`w-4 h-4 rounded-sm transition-all cursor-help hover:scale-125 ${bgClass}`}
          />
        );
      })}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SessionRecord } from '../../types';
import api from '../../lib/api';

export const SessionHistory = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/sessions').then(({ data }) => setSessions(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  const formatDuration = (s: number) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;

  return (
    <div className="p-6 pb-24 max-w-2xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Session History</h1>
        <p className="text-gray-400 text-sm mt-1">{sessions.length} session{sessions.length !== 1 ? 's' : ''} recorded</p>
      </header>

      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-[1.5rem] p-6 border border-gray-100 animate-pulse">
              <div className="h-4 bg-gray-100 rounded-full w-1/3 mb-3" />
              <div className="h-3 bg-gray-100 rounded-full w-2/3" />
            </div>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-[1.5rem] mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-400 font-semibold">No sessions yet</p>
          <p className="text-gray-300 text-sm mt-1">Your sessions will appear here after completion.</p>
          <button onClick={() => navigate('/')}
            className="mt-6 px-6 py-3 rounded-2xl text-white font-bold text-sm transition-all active:scale-95"
            style={{ backgroundColor: '#EF5900' }}>
            Start Your First Session
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((session) => (
            <button
              key={session._id}
              onClick={() => navigate(`/sessions/${session._id}`)}
              className="w-full bg-white rounded-[1.5rem] p-6 border border-gray-100 shadow-sm text-left hover:border-orange-200 hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{formatDate(session.createdAt)}</p>
                  <p className="text-sm font-semibold text-gray-700 mt-1 line-clamp-1">{session.summary || 'Session completed'}</p>
                </div>
                <div className="flex flex-col items-end gap-1 ml-4 flex-shrink-0">
                  <span className="text-xs font-bold text-gray-400">{formatDuration(session.durationSeconds)}</span>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                    session.inputMode === 'voice' ? 'bg-orange-50 text-orange-400' : 'bg-blue-50 text-blue-400'
                  }`}>
                    {session.inputMode}
                  </span>
                </div>
              </div>
              {session.reflection && (
                <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">{session.reflection}</p>
              )}
              <div className="flex items-center justify-between mt-3">
                <span className="text-[10px] text-gray-300 font-medium">{session.creditsUsed} credit used</span>
                <svg className="w-4 h-4 text-gray-300 group-hover:text-orange-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SessionRecord } from '../../types';
import api from '../../lib/api';

export const SessionDetailScreen = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.get(`/sessions/${id}`).then(({ data }) => setSession(data)).catch(() => navigate('/sessions')).finally(() => setLoading(false));
  }, [id, navigate]);

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const formatDuration = (s: number) => s < 60 ? `${s} seconds` : `${Math.floor(s / 60)} min ${s % 60}s`;

  if (loading) return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-100 rounded-full w-1/2" />
        <div className="h-40 bg-gray-100 rounded-[1.5rem]" />
        <div className="h-40 bg-gray-100 rounded-[1.5rem]" />
      </div>
    </div>
  );

  if (!session) return null;

  return (
    <div className="p-6 pb-24 max-w-2xl mx-auto">
      <button onClick={() => navigate('/sessions')}
        className="flex items-center gap-2 text-gray-400 hover:text-gray-700 transition-colors mb-8 font-bold text-sm">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
        </svg>
        Back to History
      </button>

      <header className="mb-8">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{formatDate(session.createdAt)}</p>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight leading-snug">
          {session.summary || 'Session Details'}
        </h1>
        <div className="flex items-center gap-4 mt-3">
          <span className="text-xs font-bold text-gray-400">{formatDuration(session.durationSeconds)}</span>
          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
            session.inputMode === 'voice' ? 'bg-orange-50 text-orange-400' : 'bg-blue-50 text-blue-400'
          }`}>{session.inputMode}</span>
          <span className="text-xs font-bold text-gray-300">{session.creditsUsed} credit</span>
        </div>
      </header>

      <div className="space-y-4">
        <div className="bg-gray-50 rounded-[1.5rem] p-6 border border-gray-100">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Summary</p>
          <p className="text-gray-700 font-medium leading-relaxed">{session.summary || 'No summary available.'}</p>
        </div>
        <div className="bg-orange-50 rounded-[1.5rem] p-6 border border-orange-100">
          <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-3">Reflection</p>
          <p className="text-gray-700 font-medium leading-relaxed">{session.reflection || 'No reflection recorded.'}</p>
        </div>
        <div className="bg-white rounded-[1.5rem] p-6 border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Closing Thought</p>
          <p className="text-gray-600 italic leading-relaxed">"{session.groundingLine || 'Take care of yourself.'}"</p>
        </div>
      </div>

      <button onClick={() => navigate('/')}
        className="mt-8 w-full py-5 rounded-[1.5rem] text-white font-black uppercase tracking-widest text-sm shadow-xl transition-all active:scale-95"
        style={{ backgroundColor: '#EF5900' }}>
        Start New Session
      </button>
    </div>
  );
};

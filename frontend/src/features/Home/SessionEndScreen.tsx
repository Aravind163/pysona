import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { COLORS } from '../../constants';
import { useAuth } from '../../App';

export const SessionEndScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const summary = location.state?.summary;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white">
      <div className="w-full max-w-md text-center">
        <div className="w-20 h-20 rounded-[2rem] mx-auto mb-8 flex items-center justify-center shadow-xl"
          style={{ backgroundColor: COLORS.accent }}>
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>

        <h1 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">Session Complete</h1>
        <p className="text-gray-400 text-sm font-medium mb-10">Here's a reflection from today's conversation</p>

        {summary && (
          <div className="space-y-4 mb-10 text-left">
            <div className="bg-gray-50 rounded-[1.5rem] p-6 border border-gray-100">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Summary</p>
              <p className="text-gray-700 font-medium leading-relaxed">{summary.summary}</p>
            </div>
            <div className="bg-orange-50 rounded-[1.5rem] p-6 border border-orange-100">
              <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-2">Reflection</p>
              <p className="text-gray-700 font-medium leading-relaxed">{summary.reflection}</p>
            </div>
            <div className="bg-white rounded-[1.5rem] p-6 border border-gray-100 shadow-sm">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Closing Thought</p>
              <p className="text-gray-600 italic leading-relaxed">"{summary.groundingLine}"</p>
            </div>
          </div>
        )}

        {/* Credits remaining */}
        <div className="flex items-center justify-center gap-2 mb-8 text-sm text-gray-400">
          <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
          <span>{user?.credits ?? 0} credits remaining</span>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate('/')}
            className="w-full py-5 rounded-[1.5rem] text-white font-black uppercase tracking-widest text-sm shadow-xl transition-all active:scale-95"
            style={{ backgroundColor: COLORS.accent }}
          >
            Start New Session
          </button>
          <button
            onClick={() => navigate('/sessions')}
            className="w-full py-4 rounded-[1.5rem] text-gray-500 font-bold text-sm hover:bg-gray-50 transition-all"
          >
            View Session History
          </button>
        </div>
      </div>
    </div>
  );
};

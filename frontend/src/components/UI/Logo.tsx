import React from 'react';

export const PysonaLogo = ({ className = '' }: { className?: string }) => (
  <div className={`flex items-center gap-2 ${className}`}>
    <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg" style={{ backgroundColor: '#EF5900' }}>
      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
      </svg>
    </div>
    <span className="text-2xl font-black tracking-tight text-gray-900 font-display">Pysona</span>
  </div>
);

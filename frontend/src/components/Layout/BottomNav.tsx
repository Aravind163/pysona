import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../App';

const items = [
  { path: '/', label: 'Session', d: 'M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 1.93c-3.94-.49-7-3.85-7-7.93H5a7 7 0 1014 0h1c0 4.08-3.06 7.44-7 7.93V19h3v2H8v-2h3v-3.07z', filled: true },
  { path: '/sessions', label: 'History', d: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', filled: false },
  { path: '/plans', label: 'Plans', d: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z', filled: false },
  { path: '/account', label: 'Account', d: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', filled: false },
];

export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  return (
    <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-white/90 backdrop-blur-xl border-t border-gray-100 z-40 px-2 pb-safe">
      <div className="flex items-center justify-around">
        {items.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1 py-3 px-4 transition-all ${active ? 'text-[#EF5900]' : 'text-gray-400'}`}
            >
              <svg className="w-5 h-5" fill={item.filled && active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.d} />
              </svg>
              <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
              {item.path === '/account' && user?.credits === 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

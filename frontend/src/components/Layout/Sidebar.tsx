import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PysonaLogo } from '../UI/Logo';
import { useAuth } from '../../App';

const items = [
  { path: '/', label: 'Session', d: 'M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 1.93c-3.94-.49-7-3.85-7-7.93H5a7 7 0 1014 0h1c0 4.08-3.06 7.44-7 7.93V19h3v2H8v-2h3v-3.07z', filled: true },
  { path: '/sessions', label: 'History', d: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', filled: false },
  { path: '/plans', label: 'Plans', d: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z', filled: false },
  { path: '/account', label: 'Account', d: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', filled: false },
];

export const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-100 flex-col z-40">
      <div className="p-6 mb-4">
        <PysonaLogo />
      </div>

      {/* Credits badge */}
      <div className="mx-4 mb-6 p-4 bg-orange-50 rounded-2xl border border-orange-100">
        <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">Credits</p>
        <p className="text-2xl font-black text-orange-600">{user?.credits ?? 0}</p>
        <p className="text-[10px] text-orange-400 mt-0.5">{((user?.credits ?? 0) / 3).toFixed(1)} sessions remaining</p>
        {(user?.credits ?? 0) < 3 && (
          <button onClick={() => navigate('/account')}
            className="mt-2 w-full py-1.5 bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl">
            Top Up →
          </button>
        )}
      </div>

      <nav className="flex-1 px-3">
        {items.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl mb-1 text-left transition-all ${
                active ? 'bg-orange-50 text-[#EF5900]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill={item.filled && active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.d} />
              </svg>
              <span className={`text-sm font-bold ${active ? 'text-[#EF5900]' : ''}`}>{item.label}</span>
            </button>
          );
        })}
        {user?.role === 'admin' && (
          <button
            onClick={() => navigate('/admin')}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl mb-1 text-left transition-all ${
              location.pathname === '/admin' ? 'bg-orange-50 text-[#EF5900]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-sm font-bold">Admin</span>
          </button>
        )}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 px-2">
          {user?.avatar
            ? <img src={user.avatar} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
            : <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-400 text-xs font-black">
                {(user?.email?.[0] || 'U').toUpperCase()}
              </div>
          }
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-gray-900 truncate">{user?.name || user?.email}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{user?.plan}</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

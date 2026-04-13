import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useToast } from '../../hooks/useToast';
import { AppPlan } from '../../types';

interface AdminUser {
  _id: string;
  email: string;
  name: string;
  plan: AppPlan;
  credits: number;
  totalSessionsCount: number;
  isBlocked: boolean;
  createdAt: string;
  role: string;
}

interface Stats {
  totalUsers: number;
  totalSessions: number;
  sessionsToday: number;
  revenueTotal: number;
}

export const AdminDashboard = () => {
  const { showToast } = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [grantUserId, setGrantUserId] = useState<string | null>(null);
  const [grantAmount, setGrantAmount] = useState(9);

  const fetchData = async () => {
    try {
      const [statsRes, usersRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get(`/admin/users?search=${search}`),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data.users);
    } catch {
      showToast('Failed to load admin data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [search]);

  const handleBlock = async (userId: string, blocked: boolean) => {
    try {
      await api.put(`/admin/users/${userId}/block`, { blocked });
      setUsers((prev) => prev.map((u) => u._id === userId ? { ...u, isBlocked: blocked } : u));
      showToast(`User ${blocked ? 'blocked' : 'unblocked'}.`, 'success');
    } catch {
      showToast('Action failed.', 'error');
    }
  };

  const handleGrantCredits = async (userId: string) => {
    try {
      await api.post(`/admin/users/${userId}/grant-credits`, { credits: grantAmount });
      showToast(`Granted ${grantAmount} credits.`, 'success');
      setGrantUserId(null);
      fetchData();
    } catch {
      showToast('Failed to grant credits.', 'error');
    }
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="p-6 md:p-10 pb-24 max-w-7xl mx-auto">
      <header className="mb-10">
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Admin Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Manage users, credits, and platform health.</p>
      </header>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Total Users', value: stats.totalUsers.toLocaleString(), color: 'text-gray-900' },
            { label: 'Sessions Today', value: stats.sessionsToday.toLocaleString(), color: 'text-orange-500' },
            { label: 'Total Sessions', value: stats.totalSessions.toLocaleString(), color: 'text-blue-600' },
            { label: 'Revenue (Total)', value: `₹${stats.revenueTotal.toLocaleString()}`, color: 'text-green-600' },
          ].map((s) => (
            <div key={s.label} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{s.label}</p>
              <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between gap-4">
          <h2 className="font-black text-gray-900">Users</h2>
          <input
            type="search"
            placeholder="Search by email..."
            className="px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-medium text-gray-700 placeholder:text-gray-300 outline-none focus:ring-2 focus:ring-orange-300 w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-300 font-semibold">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['User', 'Plan', 'Credits', 'Sessions', 'Joined', 'Actions'].map((h) => (
                    <th key={h} className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u) => (
                  <React.Fragment key={u._id}>
                    <tr className={`hover:bg-gray-50 transition-colors ${u.isBlocked ? 'opacity-50' : ''}`}>
                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-900 text-sm">{u.name || u.email}</p>
                        {u.name && <p className="text-xs text-gray-400">{u.email}</p>}
                        {u.role === 'admin' && <span className="text-[9px] bg-orange-100 text-orange-600 font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full">admin</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          u.plan === AppPlan.STANDARD ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600'
                        }`}>{u.plan}</span>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-700">{u.credits}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{u.totalSessionsCount}</td>
                      <td className="px-6 py-4 text-xs text-gray-400">{formatDate(u.createdAt)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setGrantUserId(grantUserId === u._id ? null : u._id)}
                            className="text-xs font-bold text-blue-600 uppercase hover:text-blue-700 transition-colors"
                          >
                            Credits
                          </button>
                          <button
                            onClick={() => handleBlock(u._id, !u.isBlocked)}
                            className={`text-xs font-bold uppercase transition-colors ${u.isBlocked ? 'text-green-600' : 'text-red-500'}`}
                          >
                            {u.isBlocked ? 'Unblock' : 'Block'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {grantUserId === u._id && (
                      <tr className="bg-blue-50">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-gray-600">Grant credits to {u.email}:</span>
                            <div className="flex gap-2">
                              {[3, 9, 30, 90].map((amt) => (
                                <button key={amt} onClick={() => setGrantAmount(amt)}
                                  className={`px-3 py-1.5 rounded-full text-xs font-black ${grantAmount === amt ? 'bg-blue-600 text-white' : 'bg-white border border-blue-200 text-blue-600'}`}>
                                  +{amt}
                                </button>
                              ))}
                            </div>
                            <button onClick={() => handleGrantCredits(u._id)}
                              className="px-4 py-1.5 bg-blue-600 text-white rounded-full text-xs font-black hover:bg-blue-700 transition-colors">
                              Grant
                            </button>
                            <button onClick={() => setGrantUserId(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <p className="text-center py-12 text-gray-300 font-semibold">No users found.</p>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 p-6 bg-orange-50 rounded-3xl border border-orange-100">
        <p className="text-sm text-orange-800 font-medium">
          <b>Security Notice:</b> As an administrator, you only have access to session metadata and AI-generated summaries. Raw audio recordings and full transcripts are never stored.
        </p>
      </div>
    </div>
  );
};

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
  isApproved: boolean;
  createdAt: string;
  role: string;
}

interface Stats {
  totalUsers: number;
  totalSessions: number;
  sessionsToday: number;
  revenueTotal: number;
  pendingApprovals: number;
}

const PLAN_COLORS: Record<string, string> = {
  FREE: 'bg-gray-100 text-gray-600',
  STANDARD: 'bg-orange-100 text-orange-600',
  PREMIUM: 'bg-purple-100 text-purple-600',
};

export const AdminDashboard = () => {
  const { showToast } = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'pending'>('all');
  const [grantUserId, setGrantUserId] = useState<string | null>(null);
  const [grantAmount, setGrantAmount] = useState(9);
  const [changePlanUserId, setChangePlanUserId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // ── Second-admin setup panel state ──────────────────────────────────────────
  const [showAdminSetup, setShowAdminSetup] = useState(false);
  const [admin2Email, setAdmin2Email] = useState('');
  const [admin2Saving, setAdmin2Saving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get(`/admin/users?search=${search}&filter=${tab}`),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data.users);
    } catch {
      showToast('Failed to load admin data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [search, tab]);

  const handleApprove = async (userId: string, approved: boolean) => {
    try {
      await api.put(`/admin/users/${userId}/approve`, { approved });
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, isApproved: approved } : u));
      showToast(`User ${approved ? 'approved ✅' : 'unapproved'}.`, 'success');
      fetchData();
    } catch {
      showToast('Action failed.', 'error');
    }
  };

  const handleBlock = async (userId: string, blocked: boolean) => {
    try {
      await api.put(`/admin/users/${userId}/block`, { blocked });
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, isBlocked: blocked } : u));
      showToast(`User ${blocked ? 'banned 🚫' : 'unbanned ✅'}.`, 'success');
    } catch {
      showToast('Action failed.', 'error');
    }
  };

  const handleChangePlan = async (userId: string, plan: string) => {
    try {
      await api.put(`/admin/users/${userId}/plan`, { plan });
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, plan: plan as AppPlan } : u));
      showToast(`Plan changed to ${plan}.`, 'success');
      setChangePlanUserId(null);
    } catch {
      showToast('Failed to change plan.', 'error');
    }
  };

  const handleGrantCredits = async (userId: string) => {
    try {
      await api.post(`/admin/users/${userId}/grant-credits`, { credits: grantAmount });
      showToast(`Granted ${grantAmount} credits ✅`, 'success');
      setGrantUserId(null);
      fetchData();
    } catch {
      showToast('Failed to grant credits.', 'error');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers(prev => prev.filter(u => u._id !== userId));
      showToast('User deleted.', 'success');
      setDeleteConfirmId(null);
      fetchData();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to delete user.';
      showToast(msg, 'error');
      setDeleteConfirmId(null);
    }
  };

  // Promote existing user to admin role directly (without env change)
  const handlePromoteToAdmin = async (userId: string, email: string) => {
    try {
      await api.put(`/admin/users/${userId}/plan`, { plan: 'FREE' }); // no-op plan
      await api.put(`/admin/users/${userId}/promote`);
      showToast(`${email} promoted to admin. They must also be added to ADMIN_EMAIL_2 in .env for persistence.`, 'info');
      fetchData();
    } catch (err: any) {
      // Fallback: just show instructions if endpoint doesn't exist yet
      showToast(
        `To make ${email} an admin: add their email to ADMIN_EMAIL_2= in backend/.env and restart the server.`,
        'info'
      );
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="p-6 md:p-10 pb-24 max-w-7xl mx-auto">
      <header className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Manage users, approvals, credits, and plans.</p>
        </div>
        <button
          onClick={() => setShowAdminSetup(!showAdminSetup)}
          className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-orange-50 border border-orange-200 text-orange-700 text-sm font-bold hover:bg-orange-100 transition-colors"
        >
          ⚙️ Admin Setup
        </button>
      </header>

      {/* ── Second Admin Setup Panel ────────────────────────────────────────── */}
      {showAdminSetup && (
        <div className="mb-8 p-6 bg-orange-50 border border-orange-200 rounded-3xl">
          <h2 className="font-black text-orange-900 mb-1">Second Admin Setup</h2>
          <p className="text-sm text-orange-700 mb-4">
            To add a second admin, add their email to <code className="bg-orange-100 px-1 rounded font-mono text-xs">ADMIN_EMAIL_2</code> in{' '}
            <code className="bg-orange-100 px-1 rounded font-mono text-xs">backend/.env</code>, then restart the server.
            On their next login, they'll automatically get admin role.
          </p>

          <div className="bg-orange-100 rounded-2xl p-4 font-mono text-sm text-orange-900 mb-4 select-all">
            # In backend/.env — add this line:{'\n'}
            ADMIN_EMAIL_2=their_email@gmail.com
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <label className="block text-xs font-bold text-orange-700 mb-1">
                Second admin email (for quick reference)
              </label>
              <input
                type="email"
                placeholder="secondadmin@gmail.com"
                value={admin2Email}
                onChange={(e) => setAdmin2Email(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-orange-200 rounded-2xl text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div className="pt-5">
              <button
                onClick={() => {
                  if (admin2Email) {
                    navigator.clipboard?.writeText(`ADMIN_EMAIL_2=${admin2Email}`);
                    showToast('Copied ADMIN_EMAIL_2 line to clipboard!', 'success');
                  }
                }}
                className="px-4 py-2.5 bg-orange-500 text-white rounded-2xl text-sm font-bold hover:bg-orange-600 transition-colors"
              >
                📋 Copy .env Line
              </button>
            </div>
          </div>

          <p className="text-xs text-orange-600 mt-3">
            💡 <b>Quick promote:</b> Find the user below → click their email row → use the "Make Admin" button.
            This sets their DB role immediately but they still need to be in .env for persistence across server restarts.
          </p>
        </div>
      )}

      {/* ── Stats ────────────────────────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Total Users', value: stats.totalUsers.toLocaleString(), color: 'text-gray-900' },
            { label: 'Pending Approval', value: stats.pendingApprovals.toLocaleString(), color: 'text-yellow-600' },
            { label: 'Sessions Today', value: stats.sessionsToday.toLocaleString(), color: 'text-orange-500' },
            { label: 'Total Sessions', value: stats.totalSessions.toLocaleString(), color: 'text-blue-600' },
            { label: 'Revenue', value: `₹${stats.revenueTotal.toLocaleString()}`, color: 'text-green-600' },
          ].map((s) => (
            <div key={s.label} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{s.label}</p>
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-4">
        {(['all', 'pending'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all ${
              tab === t ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}>
            {t === 'pending' ? `⏳ Pending Approval${stats ? ` (${stats.pendingApprovals})` : ''}` : 'All Users'}
          </button>
        ))}
      </div>

      {/* ── Users Table ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between gap-4 flex-wrap">
          <h2 className="font-black text-gray-900">
            {tab === 'pending' ? 'Pending Free Approvals' : `All Users (${users.length})`}
          </h2>
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
                  {['User', 'Plan', 'Status', 'Credits', 'Sessions', 'Joined', 'Actions'].map((h) => (
                    <th key={h} className="px-5 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u) => (
                  <React.Fragment key={u._id}>
                    <tr className={`hover:bg-gray-50 transition-colors ${u.isBlocked ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-4">
                        <p className="font-bold text-gray-900 text-sm">{u.name || u.email}</p>
                        {u.name && <p className="text-xs text-gray-400">{u.email}</p>}
                        {u.role === 'admin' && (
                          <span className="text-[9px] bg-orange-100 text-orange-600 font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full">admin</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${PLAN_COLORS[u.plan] || 'bg-gray-100 text-gray-600'}`}>
                          {u.plan}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {u.isBlocked ? (
                          <span className="text-[10px] bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full uppercase">Banned</span>
                        ) : u.isApproved ? (
                          <span className="text-[10px] bg-green-100 text-green-600 font-bold px-2 py-0.5 rounded-full uppercase">Approved</span>
                        ) : (
                          <span className="text-[10px] bg-yellow-100 text-yellow-600 font-bold px-2 py-0.5 rounded-full uppercase">Pending</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-gray-700">{u.credits}</td>
                      <td className="px-5 py-4 text-sm text-gray-600">{u.totalSessionsCount}</td>
                      <td className="px-5 py-4 text-xs text-gray-400">{formatDate(u.createdAt)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Approve/Unapprove (for free users only) */}
                          {u.plan === 'FREE' && !u.isBlocked && u.role !== 'admin' && (
                            <button onClick={() => handleApprove(u._id, !u.isApproved)}
                              className={`text-xs font-bold uppercase transition-colors ${u.isApproved ? 'text-yellow-600 hover:text-yellow-700' : 'text-green-600 hover:text-green-700'}`}>
                              {u.isApproved ? 'Revoke' : 'Approve'}
                            </button>
                          )}
                          {/* Change Plan */}
                          <button onClick={() => setChangePlanUserId(changePlanUserId === u._id ? null : u._id)}
                            className="text-xs font-bold text-purple-600 uppercase hover:text-purple-700 transition-colors">
                            Plan
                          </button>
                          {/* Grant Credits */}
                          <button onClick={() => setGrantUserId(grantUserId === u._id ? null : u._id)}
                            className="text-xs font-bold text-blue-600 uppercase hover:text-blue-700 transition-colors">
                            Credits
                          </button>
                          {/* Make Admin (non-admin users only) */}
                          {u.role !== 'admin' && (
                            <button onClick={() => handlePromoteToAdmin(u._id, u.email)}
                              className="text-xs font-bold text-orange-500 uppercase hover:text-orange-600 transition-colors">
                              Admin
                            </button>
                          )}
                          {/* Block/Unblock */}
                          {u.role !== 'admin' && (
                            <button onClick={() => handleBlock(u._id, !u.isBlocked)}
                              className={`text-xs font-bold uppercase transition-colors ${u.isBlocked ? 'text-green-600' : 'text-red-500'}`}>
                              {u.isBlocked ? 'Unban' : 'Ban'}
                            </button>
                          )}
                          {/* Delete */}
                          {u.role !== 'admin' && (
                            <button onClick={() => setDeleteConfirmId(deleteConfirmId === u._id ? null : u._id)}
                              className="text-xs font-bold text-gray-400 uppercase hover:text-red-500 transition-colors">
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Delete Confirm Row */}
                    {deleteConfirmId === u._id && (
                      <tr className="bg-red-50">
                        <td colSpan={7} className="px-5 py-4">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-sm font-bold text-red-700">⚠️ Delete {u.email} permanently?</span>
                            <button onClick={() => handleDeleteUser(u._id)}
                              className="px-4 py-1.5 bg-red-600 text-white rounded-full text-xs font-black hover:bg-red-700">
                              Yes, Delete
                            </button>
                            <button onClick={() => setDeleteConfirmId(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Change Plan Row */}
                    {changePlanUserId === u._id && (
                      <tr className="bg-purple-50">
                        <td colSpan={7} className="px-5 py-4">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-sm font-bold text-gray-600">Change plan for {u.email}:</span>
                            <div className="flex gap-2">
                              {['FREE', 'STANDARD', 'PREMIUM'].map((plan) => (
                                <button key={plan} onClick={() => handleChangePlan(u._id, plan)}
                                  className={`px-3 py-1.5 rounded-full text-xs font-black transition-colors ${
                                    u.plan === plan ? 'bg-purple-600 text-white' : 'bg-white border border-purple-200 text-purple-600 hover:bg-purple-50'
                                  }`}>
                                  {plan}
                                </button>
                              ))}
                            </div>
                            <button onClick={() => setChangePlanUserId(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Grant Credits Row */}
                    {grantUserId === u._id && (
                      <tr className="bg-blue-50">
                        <td colSpan={7} className="px-5 py-4">
                          <div className="flex items-center gap-3 flex-wrap">
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
                              className="px-4 py-1.5 bg-blue-600 text-white rounded-full text-xs font-black hover:bg-blue-700">
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
          <b>Security Notice:</b> Admins only access session metadata and AI-generated summaries. Raw audio and full transcripts are never stored.
        </p>
      </div>
    </div>
  );
};

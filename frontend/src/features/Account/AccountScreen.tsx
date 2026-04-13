import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../App';
import { AppPlan } from '../../types';
import { useToast } from '../../hooks/useToast';
import { CREDITS_PER_RUPEE } from '../../constants';
import api from '../../lib/api';

export const AccountScreen = () => {
  const navigate = useNavigate();
  const { logout, user, updateUser } = useAuth();
  const { showToast } = useToast();
  const [buyAmount, setBuyAmount] = useState(10);
  const [isBuying, setIsBuying] = useState(false);
  const [showBuyPanel, setShowBuyPanel] = useState(false);

  const handleBuyCredits = async () => {
    setIsBuying(true);
    try {
      const { data } = await api.post('/users/me/credits/purchase', { rupees: buyAmount });
      updateUser({ credits: data.credits });
      showToast(`Added ${data.added} credits (₹${buyAmount})`, 'success');
      setShowBuyPanel(false);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Purchase failed.', 'error');
    } finally {
      setIsBuying(false);
    }
  };

  const creditsWorth = `${user?.credits ?? 0} credits ≈ ₹${((user?.credits ?? 0) / CREDITS_PER_RUPEE).toFixed(2)}`;

  return (
    <div className="p-6 pb-24 max-w-md mx-auto">
      <header className="mb-10 flex flex-col items-center">
        {user?.avatar ? (
          <img src={user.avatar} alt="avatar" className="w-24 h-24 rounded-[2rem] object-cover mb-4 shadow-sm border border-gray-50" />
        ) : (
          <div className="w-24 h-24 bg-gray-100 rounded-[2rem] flex items-center justify-center mb-4 text-gray-300 shadow-sm border border-gray-50">
            <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
        )}
        <h1 className="text-xl font-black text-gray-900 tracking-tight">{user?.name || user?.email}</h1>
        {user?.name && <p className="text-xs text-gray-400 font-medium mt-0.5">{user.email}</p>}
        {user?.role === 'admin' && (
          <span className="mt-2 px-3 py-1 bg-orange-100 text-orange-600 text-[10px] font-black uppercase tracking-widest rounded-full">
            Admin
          </span>
        )}
      </header>

      <div className="space-y-6">
        {/* Credits Panel */}
        <section>
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-2">Credits</h2>
          <div className="bg-white rounded-[1.5rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 flex justify-between items-center">
              <div>
                <p className="font-black text-2xl text-gray-900">{user?.credits ?? 0} <span className="text-base font-bold text-gray-400">credits</span></p>
                <p className="text-xs font-medium text-gray-400 mt-1">{creditsWorth} • 3 credits = ₹1</p>
              </div>
              <button
                onClick={() => setShowBuyPanel(!showBuyPanel)}
                className="text-xs font-black px-4 py-2 rounded-full text-white uppercase tracking-widest transition-all active:scale-95"
                style={{ backgroundColor: '#EF5900' }}
              >
                Top Up
              </button>
            </div>

            {showBuyPanel && (
              <div className="border-t border-gray-50 p-6 space-y-4 bg-orange-50/40">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Buy Credits (₹1 = 3 credits)</p>
                <div className="flex gap-2 flex-wrap">
                  {[5, 10, 25, 50, 100].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setBuyAmount(amt)}
                      className={`px-4 py-2 rounded-full text-sm font-black transition-all ${buyAmount === amt ? 'bg-[#EF5900] text-white shadow-lg' : 'bg-white border border-gray-200 text-gray-600 hover:border-orange-300'}`}
                    >
                      ₹{amt}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between bg-white rounded-2xl p-4 border border-gray-100">
                  <p className="text-sm text-gray-600">
                    ₹{buyAmount} → <span className="font-black text-gray-900">{buyAmount * CREDITS_PER_RUPEE} credits</span>
                    <span className="text-gray-400"> ({buyAmount * CREDITS_PER_RUPEE} sessions)</span>
                  </p>
                  <button
                    onClick={handleBuyCredits}
                    disabled={isBuying}
                    className="px-5 py-2.5 rounded-full text-white font-black text-sm transition-all active:scale-95 disabled:opacity-60"
                    style={{ backgroundColor: '#EF5900' }}
                  >
                    {isBuying ? '...' : 'Buy'}
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 text-center">Demo: payment simulation only. Integrate Razorpay for production.</p>
              </div>
            )}
          </div>
        </section>

        {/* Subscription */}
        <section>
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-2">Subscription</h2>
          <div className="bg-white rounded-[1.5rem] p-6 border border-gray-100 flex justify-between items-center shadow-sm">
            <div>
              <p className="font-bold text-gray-900">{user?.plan === AppPlan.STANDARD ? 'Standard Plan' : 'Free Plan'}</p>
              <p className="text-xs font-medium text-gray-500">{user?.plan === AppPlan.STANDARD ? 'Unlimited sessions' : 'Pay-as-you-go credits'}</p>
            </div>
            <button onClick={() => navigate('/plans')}
              className="text-xs font-black text-[#EF5900] uppercase tracking-widest hover:translate-x-1 transition-transform">
              Change →
            </button>
          </div>
        </section>

        {/* Personalization */}
        {user?.plan === AppPlan.STANDARD && (
          <section>
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-2">Personalization</h2>
            <div className="bg-white rounded-[1.5rem] border border-gray-100 overflow-hidden shadow-sm">
              <button onClick={() => navigate('/onboarding')}
                className="w-full p-6 text-left flex justify-between items-center group">
                <div>
                  <p className="font-bold text-gray-900">Session Preferences</p>
                  <p className="text-xs font-medium text-gray-500">Tune AI behavior and tone</p>
                </div>
                <svg className="w-4 h-4 text-gray-300 group-hover:text-orange-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </section>
        )}

        {/* Admin link */}
        {user?.role === 'admin' && (
          <section>
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-2">Admin</h2>
            <div className="bg-white rounded-[1.5rem] border border-orange-100 overflow-hidden shadow-sm">
              <button onClick={() => navigate('/admin')}
                className="w-full p-6 text-left flex justify-between items-center group">
                <div>
                  <p className="font-bold text-orange-600">Admin Dashboard</p>
                  <p className="text-xs font-medium text-gray-500">Manage users, credits, sessions</p>
                </div>
                <svg className="w-4 h-4 text-orange-300 group-hover:text-orange-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </section>
        )}

        {/* Danger Zone */}
        <section>
          <h2 className="text-[10px] font-black text-red-400/50 uppercase tracking-widest mb-3 ml-2">Danger Zone</h2>
          <div className="bg-white rounded-[1.5rem] border border-gray-100 overflow-hidden shadow-sm">
            <button onClick={logout}
              className="w-full p-6 text-left text-red-500 font-bold hover:bg-red-50 transition-colors flex items-center justify-between group">
              Sign Out
              <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </section>

        <div className="text-center py-4">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">Pysona v2.0.0 (Fullstack)</p>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../App';
import { AppPlan } from '../../types';
import { useToast } from '../../hooks/useToast';
import { CREDITS_PER_RUPEE } from '../../constants';
import api from '../../lib/api';

// ─── Razorpay type shim ────────────────────────────────────────────────────────
declare global {
  interface Window { Razorpay: any; }
}

const loadRazorpayScript = (): Promise<boolean> =>
  new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

// ─── Top-up packages (must match backend PLAN_PACKAGES) ──────────────────────
const STANDARD_TOPUPS = [
  { packageId: 'topup_100',  credits: 100,  rupees: 34  },
  { packageId: 'topup_300',  credits: 300,  rupees: 100 },
  { packageId: 'topup_1000', credits: 1000, rupees: 334 },
];

const PREMIUM_TOPUPS = [
  { packageId: 'premium_topup_500',  credits: 500,  rupees: 125 },
  { packageId: 'premium_topup_1000', credits: 1000, rupees: 250 },
];

export const AccountScreen = () => {
  const navigate = useNavigate();
  const { logout, user, updateUser, syncUser } = useAuth();
  const { showToast } = useToast();
  const [selectedPkg, setSelectedPkg] = useState<string | null>(null);
  const [isBuying, setIsBuying] = useState(false);
  const [showBuyPanel, setShowBuyPanel] = useState(false);

  const isPremium = user?.plan === AppPlan.PREMIUM;
  const topups = isPremium ? PREMIUM_TOPUPS : STANDARD_TOPUPS;

  const selectedTopup = topups.find(t => t.packageId === selectedPkg) ?? topups[1];

  const creditsWorth = `${user?.credits ?? 0} credits ≈ ₹${((user?.credits ?? 0) / CREDITS_PER_RUPEE).toFixed(2)}`;

  const handleBuyCredits = async () => {
    if (!selectedPkg) return;
    setIsBuying(true);

    try {
      // 1. Load Razorpay SDK
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        showToast('Payment gateway failed to load. Check your internet.', 'error');
        setIsBuying(false);
        return;
      }

      // 2. Create order on backend
      const { data: orderData } = await api.post('/payment/create-order', { packageId: selectedPkg });

      // 3. Open Razorpay checkout
      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency,
          name: 'Pysona',
          description: orderData.package.label,
          order_id: orderData.orderId,
          prefill: { email: user?.email || '' },
          theme: { color: '#EF5900' },
          modal: {
            ondismiss: () => reject(new Error('Payment cancelled')),
          },
          handler: async (response: any) => {
            try {
              // 4. Verify on backend
              const { data: verifyData } = await api.post('/payment/verify', {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                packageId: selectedPkg,
              });

              // 5. Update local state
              updateUser({ credits: verifyData.credits });
              await syncUser();
              showToast(verifyData.message || `Credits added successfully!`, 'success');
              setShowBuyPanel(false);
              resolve();
            } catch (err) {
              reject(err);
            }
          },
        });
        rzp.open();
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Purchase failed';
      if (msg !== 'Payment cancelled') showToast(msg, 'error');
    } finally {
      setIsBuying(false);
    }
  };

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
                <p className="text-xs font-medium text-gray-400 mt-1">{creditsWorth} • {isPremium ? '4' : '3'} credits = ₹1</p>
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
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                  {isPremium ? 'Top Up Credits (Premium rate: 4 credits = ₹1)' : 'Top Up Credits (3 credits = ₹1)'}
                </p>

                {/* Package selector */}
                <div className="flex flex-col gap-2">
                  {topups.map((pkg) => (
                    <button
                      key={pkg.packageId}
                      onClick={() => setSelectedPkg(pkg.packageId)}
                      className={`flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all border-2 ${
                        (selectedPkg ?? topups[1].packageId) === pkg.packageId
                          ? 'bg-orange-50 border-orange-500 text-orange-700'
                          : 'bg-white border-gray-100 text-gray-600 hover:border-orange-200'
                      }`}
                    >
                      <span>{pkg.credits} credits</span>
                      <span className="font-black">₹{pkg.rupees}</span>
                    </button>
                  ))}
                </div>

                {/* Summary + Pay button */}
                <div className="flex items-center justify-between bg-white rounded-2xl p-4 border border-gray-100">
                  <p className="text-sm text-gray-600">
                    ₹{selectedTopup.rupees} →{' '}
                    <span className="font-black text-gray-900">{selectedTopup.credits} credits</span>
                  </p>
                  <button
                    onClick={handleBuyCredits}
                    disabled={isBuying}
                    className="px-5 py-2.5 rounded-full text-white font-black text-sm transition-all active:scale-95 disabled:opacity-60 flex items-center gap-2"
                    style={{ backgroundColor: '#EF5900' }}
                  >
                    {isBuying ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processing…</>
                    ) : (
                      <>🔒 Pay ₹{selectedTopup.rupees}</>
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 text-center">Secured by Razorpay</p>
              </div>
            )}
          </div>
        </section>

        {/* Subscription */}
        <section>
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-2">Subscription</h2>
          <div className="bg-white rounded-[1.5rem] p-6 border border-gray-100 flex justify-between items-center shadow-sm">
            <div>
              <p className="font-bold text-gray-900">
                {user?.plan === AppPlan.PREMIUM ? 'Premium Plan' : user?.plan === AppPlan.STANDARD ? 'Standard Plan' : 'Free Plan'}
              </p>
              <p className="text-xs font-medium text-gray-500">
                {user?.plan === AppPlan.PREMIUM ? '1500 credits/mo + best top-up rate' : user?.plan === AppPlan.STANDARD ? 'Unlimited sessions' : 'Pay-as-you-go credits'}
              </p>
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
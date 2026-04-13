import React, { useState } from 'react';
import { AppPlan } from '../../types';
import { PLANS, COLORS } from '../../constants';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../App';
import api from '../../lib/api';

// ─── Razorpay type shim ────────────────────────────────────────────────────────
declare global {
  interface Window {
    Razorpay: any;
  }
}

// ─── Package IDs must match backend PLAN_PACKAGES ─────────────────────────────
const PACKAGE_MAP: Record<AppPlan, string | null> = {
  [AppPlan.FREE]: null,
  [AppPlan.STANDARD]: 'standard_500',
  [AppPlan.PREMIUM]: null, // contact us
};

const loadRazorpayScript = (): Promise<boolean> =>
  new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

export const PlansScreen = () => {
  const { showToast } = useToast();
  const { user, updateUser, syncUser } = useAuth();
  const currentPlan = user?.plan || AppPlan.FREE;
  const [loadingPlan, setLoadingPlan] = useState<AppPlan | null>(null);

  const handleUpgrade = async (planId: AppPlan) => {
    if (planId === AppPlan.PREMIUM) {
      showToast('Premium plan coming soon! Contact support for details.', 'info');
      return;
    }
    if (planId === AppPlan.FREE) {
      updateUser({ plan: AppPlan.FREE });
      showToast('Switched to Free Plan.', 'info');
      return;
    }

    const packageId = PACKAGE_MAP[planId];
    if (!packageId) return;

    setLoadingPlan(planId);

    try {
      // Step 1 – load Razorpay SDK
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        showToast('Payment gateway failed to load. Check your internet.', 'error');
        setLoadingPlan(null);
        return;
      }

      // Step 2 – create order on backend
      const { data: orderData } = await api.post('/payment/create-order', { packageId });

      // Step 3 – open Razorpay checkout
      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency,
          name: 'Pysona',
          description: orderData.package.label,
          order_id: orderData.orderId,
          prefill: { email: user?.email || '' },
          theme: { color: COLORS.accent },
          modal: {
            ondismiss: () => reject(new Error('Payment cancelled')),
          },
          handler: async (response: any) => {
            try {
              // Step 4 – verify payment on backend (server checks signature)
              const { data: verifyData } = await api.post('/payment/verify', {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                packageId,
              });

              // Step 5 – update local state only AFTER server confirms
              updateUser({ plan: verifyData.plan || user?.plan, credits: verifyData.credits });
              showToast(verifyData.message || 'Payment successful! Credits added.', 'success');
              await syncUser();
              resolve();
            } catch (err: any) {
              reject(err);
            }
          },
        });
        rzp.open();
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Payment failed';
      if (msg !== 'Payment cancelled') showToast(msg, 'error');
    } finally {
      setLoadingPlan(null);
    }
  };

  const PlanCard = ({ planId }: { planId: AppPlan }) => {
    const plan = PLANS[planId];
    const isCurrent = currentPlan === planId;
    const isPremium = planId === AppPlan.PREMIUM;
    const isRecommended = planId === AppPlan.STANDARD;
    const isLoading = loadingPlan === planId;

    return (
      <div className={`relative flex flex-col bg-white p-8 rounded-[2.5rem] shadow-sm border transition-all duration-500 h-full ${
        isRecommended
          ? 'border-orange-500 ring-2 ring-orange-500/20 scale-105 z-10 shadow-2xl shadow-orange-200/50'
          : 'border-gray-100 hover:border-gray-200 hover:shadow-md'
      }`}>
        {isRecommended && (
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-[#EF5900] text-white text-[11px] font-black px-6 py-2 rounded-full uppercase tracking-[0.15em] shadow-lg whitespace-nowrap">
            Most Popular
          </div>
        )}
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1">
            <h3 className="text-2xl font-bold tracking-tight text-gray-900">{plan.name}</h3>
            <p className="text-gray-500 text-sm mt-1.5 leading-tight">{plan.limits}</p>
          </div>
          {isCurrent && (
            <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider border border-gray-200">
              Current
            </span>
          )}
        </div>
        <div className="mb-8 flex items-baseline gap-1">
          <span className="text-4xl font-black text-gray-900 tracking-tighter">{plan.price}</span>
          {planId !== AppPlan.PREMIUM && <span className="text-sm font-semibold text-gray-400">/mo</span>}
        </div>
        <div className="flex-1">
          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">What's included</h4>
          <ul className="space-y-4 mb-10">
            {plan.features.map((feature, i) => (
              <li key={i} className="flex items-start gap-3.5 text-sm text-gray-600 leading-snug">
                <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${isRecommended ? 'bg-orange-50' : 'bg-gray-50'}`}>
                  <svg className={`w-3 h-3 ${isRecommended ? 'text-orange-600' : 'text-green-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                {feature}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-auto pt-6 px-1">
          {isPremium ? (
            <button onClick={() => showToast('Premium plan coming soon!', 'info')}
              className="w-full h-14 rounded-full font-bold border-2 border-slate-900 text-slate-900 hover:bg-slate-900 hover:text-white transition-all flex items-center justify-center">
              Contact Us
            </button>
          ) : isCurrent ? (
            <div className="w-full h-14 text-center text-slate-400 font-bold bg-slate-50 rounded-full border border-slate-100 cursor-default flex items-center justify-center">
              Current Plan
            </div>
          ) : (
            <button
              onClick={() => handleUpgrade(planId)}
              disabled={isLoading}
              className="w-full h-14 rounded-full font-black text-white shadow-xl transition-all hover:translate-y-[-2px] active:scale-[0.97] flex items-center justify-center gap-2 disabled:opacity-60"
              style={{
                backgroundColor: COLORS.accent,
                boxShadow: isRecommended ? '0 12px 24px -6px rgba(239,89,0,0.4)' : '0 8px 16px -4px rgba(239,89,0,0.2)',
              }}>
              {isLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Processing…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                  Pay &amp; Get {plan.name}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 md:p-12 pb-32 max-w-7xl mx-auto min-h-screen">
      <header className="mb-16 text-center max-w-3xl mx-auto">
        <div className="inline-block px-4 py-1.5 mb-6 rounded-full bg-orange-50 text-orange-600 text-[10px] font-black uppercase tracking-[0.2em] border border-orange-100">
          Pricing Plans
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-4 tracking-tight">
          Flexible plans for every journey.
        </h1>
        <p className="text-lg text-gray-500">
          All plans use a credit system. <span className="font-semibold text-gray-700">3 credits = ₹1.</span> Each session costs 1 credit.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 bg-orange-50 px-4 py-2 rounded-full border border-orange-100">
          <span className="text-orange-500 text-sm">●</span>
          <span className="text-sm font-semibold text-orange-700">Your balance: {user?.credits ?? 0} credits</span>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10 items-stretch py-8">
        <PlanCard planId={AppPlan.FREE} />
        <PlanCard planId={AppPlan.STANDARD} />
        <PlanCard planId={AppPlan.PREMIUM} />
      </div>

      <footer className="mt-20 max-w-2xl mx-auto text-center">
        <div className="p-8 bg-white rounded-[2rem] border border-gray-100 shadow-sm">
          <p className="text-sm text-gray-500 font-medium mb-2">Secure payment powered by Razorpay</p>
          <p className="text-xs text-gray-400 mb-6">Credits are added to your account only after successful payment verification.</p>
          <div className="flex justify-center items-center gap-10 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
            <img src="https://upload.wikimedia.org/wikipedia/commons/8/89/Razorpay_logo.svg" alt="Razorpay" className="h-6" />
            <img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg" alt="PayPal" className="h-5" />
            <img src="https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg" alt="Stripe" className="h-6" />
          </div>
        </div>
        <p className="mt-8 text-xs text-gray-400 font-medium">
          All plans include end-to-end encryption. Your privacy is our priority.
        </p>
      </footer>
    </div>
  );
};

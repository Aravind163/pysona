import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { COLORS } from '../../constants';
import { OnboardingData } from '../../types';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../App';
import api from '../../lib/api';

const steps = [
  {
    key: 'intent',
    question: "What brings you here today?",
    options: [
      { value: 'stress', label: 'Feeling stressed', emoji: '😤' },
      { value: 'lonely', label: 'Feeling lonely', emoji: '💙' },
      { value: 'clarity', label: 'Need clarity', emoji: '🌀' },
      { value: 'calm', label: 'Find some calm', emoji: '🌿' },
      { value: 'talk', label: 'Just want to talk', emoji: '💬' },
    ],
  },
  {
    key: 'style',
    question: "How would you like me to support you?",
    options: [
      { value: 'listen', label: 'Just listen', emoji: '👂' },
      { value: 'reflection', label: 'Reflect back', emoji: '🪞' },
      { value: 'encouragement', label: 'Encourage me', emoji: '✨' },
      { value: 'balance', label: 'Mix of both', emoji: '⚖️' },
    ],
  },
  {
    key: 'tone',
    question: "What tone feels right?",
    options: [
      { value: 'calm', label: 'Calm & gentle', emoji: '🌊' },
      { value: 'warm', label: 'Warm & friendly', emoji: '☀️' },
      { value: 'neutral', label: 'Neutral & clear', emoji: '🔷' },
    ],
  },
  {
    key: 'questionComfort',
    question: "Are you comfortable with questions?",
    options: [
      { value: 'yes', label: 'Yes, ask away', emoji: '✅' },
      { value: 'occasionally', label: 'Sometimes', emoji: '🤔' },
      { value: 'no', label: 'No questions please', emoji: '🙏' },
    ],
  },
];

export const OnboardingScreen = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { updateUser, syncUser } = useAuth();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<OnboardingData>>({});
  const [personaName, setPersonaName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const currentStep = steps[step];
  const isLastStep = step === steps.length - 1;

  const handleSelect = (value: string) => {
    const key = currentStep.key as keyof OnboardingData;
    const updated = { ...answers, [key]: value };
    setAnswers(updated);
    if (!isLastStep) {
      setTimeout(() => setStep((s) => s + 1), 300);
    }
  };

  const handleFinish = async () => {
    setIsSaving(true);
    const onboardingData: OnboardingData = {
      ...(answers as OnboardingData),
      personaName: personaName.trim() || 'Pysona',
    };
    try {
      await api.put('/users/me/onboarding', { onboardingData });
      updateUser({ hasCompletedOnboarding: true, onboardingData });
      showToast('Preferences saved! Your sessions are now personalized.', 'success');
      await syncUser();
      navigate('/');
    } catch {
      showToast('Failed to save preferences.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const progress = ((step + 1) / (steps.length + 1)) * 100;

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Progress */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Personalization</span>
            <span className="text-[10px] font-black text-gray-400">{step + 1}/{steps.length + 1}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, backgroundColor: COLORS.accent }} />
          </div>
        </div>

        {step < steps.length ? (
          <>
            <h2 className="text-2xl font-black text-gray-900 mb-8 tracking-tight">{currentStep.question}</h2>
            <div className="flex flex-col gap-3">
              {currentStep.options.map((opt) => {
                const selected = answers[currentStep.key as keyof OnboardingData] === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full flex items-center gap-4 p-5 rounded-[1.5rem] border-2 text-left font-bold transition-all active:scale-[0.98] ${
                      selected
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-100 bg-white text-gray-700 hover:border-gray-200'
                    }`}
                  >
                    <span className="text-2xl">{opt.emoji}</span>
                    <span className="font-semibold">{opt.label}</span>
                    {selected && (
                      <svg className="w-4 h-4 ml-auto text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
            {isLastStep && answers[currentStep.key as keyof OnboardingData] && (
              <button onClick={() => setStep(steps.length)}
                className="mt-6 w-full py-4 rounded-[1.5rem] text-white font-black uppercase tracking-widest text-sm transition-all active:scale-95"
                style={{ backgroundColor: COLORS.accent }}>
                Continue →
              </button>
            )}
          </>
        ) : (
          <>
            <h2 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">Name your companion</h2>
            <p className="text-gray-400 text-sm mb-8">What would you like to call me? (optional)</p>
            <input
              type="text"
              placeholder="e.g. Aria, Sage, or just Pysona"
              className="w-full p-5 bg-gray-50 border border-gray-100 rounded-[1.5rem] focus:ring-2 focus:ring-orange-500 outline-none font-bold text-gray-700 placeholder:text-gray-300 mb-6"
              value={personaName}
              onChange={(e) => setPersonaName(e.target.value)}
              maxLength={20}
            />
            <button
              onClick={handleFinish}
              disabled={isSaving}
              className="w-full py-5 rounded-[1.5rem] text-white font-black uppercase tracking-widest text-sm shadow-xl transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center"
              style={{ backgroundColor: COLORS.accent }}>
              {isSaving
                ? <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                : '✦ Begin My Journey'}
            </button>
          </>
        )}

        {step > 0 && (
          <button onClick={() => setStep((s) => s - 1)}
            className="mt-6 w-full text-center text-[10px] font-black text-gray-300 uppercase tracking-widest hover:text-gray-500 transition-colors">
            ← Back
          </button>
        )}
      </div>
    </div>
  );
};

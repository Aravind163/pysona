import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { COLORS } from '../../constants';
import { OnboardingData } from '../../types';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../App';
import api from '../../lib/api';

// ─── Welcome screen shown before steps ───────────────────────────────────────
const WelcomeScreen = ({ onStart }: { onStart: () => void }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 100); }, []);

  const lines = [
    "hey, you made it here.",
    "life can get heavy sometimes —",
    "and sometimes you just need a space",
    "where you can breathe, think,",
    "or just let it all out.",
    "that's what pysona is.",
    "no judgment. no advice unless you want it.",
    "just presence.",
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col items-start justify-center px-8 py-16 max-w-sm mx-auto">
      <div
        className="w-10 h-10 rounded-full mb-14 transition-all duration-700"
        style={{ backgroundColor: COLORS.accent, opacity: visible ? 1 : 0, transform: visible ? 'scale(1)' : 'scale(0.5)' }}
      />

      <div className="space-y-5 mb-16">
        {lines.map((line, i) => (
          <p
            key={i}
            className="text-gray-800 text-lg leading-snug transition-all duration-500"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(12px)',
              transitionDelay: `${200 + i * 120}ms`,
              fontWeight: i === 5 ? 700 : 400,
            }}
          >
            {line}
          </p>
        ))}
      </div>

      <button
        onClick={onStart}
        className="px-10 py-4 rounded-2xl text-white text-sm font-bold tracking-wide transition-all active:scale-95"
        style={{
          backgroundColor: '#111',
          opacity: visible ? 1 : 0,
          transitionDelay: '1200ms',
          transition: 'opacity 0.5s, transform 0.15s',
        }}
      >
        start
      </button>
    </div>
  );
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const HEAR_ABOUT_OPTIONS = [
  'Instagram', 'Friend or family', 'Google search',
  'YouTube', 'Twitter / X', 'WhatsApp', 'Other',
];

const SUPPORT_FOCUS_OPTIONS = [
  { value: 'relationship', label: 'Relationship issues', emoji: '💛' },
  { value: 'depression', label: 'Depression', emoji: '🌧️' },
  { value: 'anxiety', label: 'Anxiety', emoji: '🌀' },
  { value: 'loneliness', label: 'Loneliness', emoji: '🌙' },
  { value: 'stress', label: 'Stress & burnout', emoji: '🔥' },
  { value: 'clarity', label: 'Finding clarity', emoji: '🧭' },
  { value: 'talk', label: 'Just need to talk', emoji: '💬' },
];

const INTENT_OPTIONS = [
  { value: 'stress', label: 'Feeling stressed', emoji: '😤' },
  { value: 'lonely', label: 'Feeling lonely', emoji: '💙' },
  { value: 'clarity', label: 'Need clarity', emoji: '🌀' },
  { value: 'calm', label: 'Find some calm', emoji: '🌿' },
  { value: 'talk', label: 'Just want to talk', emoji: '💬' },
];

const STYLE_OPTIONS = [
  { value: 'listen', label: 'Just listen to me', emoji: '👂' },
  { value: 'reflection', label: 'Reflect back', emoji: '🪞' },
  { value: 'encouragement', label: 'Encourage me', emoji: '✨' },
  { value: 'balance', label: 'Mix of both', emoji: '⚖️' },
];

const QUESTION_OPTIONS = [
  { value: 'yes', label: 'Yes, ask away', emoji: '✅' },
  { value: 'occasionally', label: 'Sometimes', emoji: '🤔' },
  { value: 'no', label: 'No questions please', emoji: '🙏' },
];

// ─── Option button ─────────────────────────────────────────────────────────────
const OptionBtn = ({
  emoji, label, selected, onClick,
}: { emoji?: string; label: string; selected: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 text-left transition-all active:scale-[0.98] ${
      selected
        ? 'border-orange-500 bg-orange-50 text-orange-700'
        : 'border-gray-100 bg-white text-gray-700 hover:border-gray-200'
    }`}
  >
    {emoji && <span className="text-xl">{emoji}</span>}
    <span className="font-semibold text-sm">{label}</span>
    {selected && (
      <svg className="w-4 h-4 ml-auto text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
      </svg>
    )}
  </button>
);

// ─── Main onboarding ───────────────────────────────────────────────────────────
export const OnboardingScreen = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { updateUser, syncUser } = useAuth();

  const [showWelcome, setShowWelcome] = useState(true);
  const [step, setStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // all answers
  const [gender, setGender] = useState('');
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [hearAboutUs, setHearAboutUs] = useState('');
  const [supportFocus, setSupportFocus] = useState('');
  const [intent, setIntent] = useState('');
  const [style, setStyle] = useState('');
  const [questionComfort, setQuestionComfort] = useState('');
  const [personaName, setPersonaName] = useState('');

  // Steps: 0=gender, 1=dob, 2=hearAbout, 3=supportFocus, 4=intent, 5=style+comfort, 6=name
  const TOTAL_STEPS = 7;
  const progress = ((step + 1) / TOTAL_STEPS) * 100;

  const next = () => setStep(s => s + 1);
  const back = () => setStep(s => Math.max(0, s - 1));

  const canContinue = () => {
    switch (step) {
      case 0: return !!gender;
      case 1: return !!dobDay && !!dobMonth && !!dobYear;
      case 2: return !!hearAboutUs;
      case 3: return !!supportFocus;
      case 4: return !!intent;
      case 5: return !!style && !!questionComfort;
      default: return false;
    }
  };

  const handleFinish = async () => {
    setIsSaving(true);
    const onboardingData: OnboardingData = {
      gender,
      dob: `${dobYear}-${dobMonth}-${dobDay}`,
      hearAboutUs,
      supportFocus,
      intent: intent as OnboardingData['intent'],
      style: style as OnboardingData['style'],
      tone: 'warm',
      questionComfort: questionComfort as OnboardingData['questionComfort'],
      personaName: personaName.trim() || 'Pysona',
    };
    try {
      await api.put('/users/me/onboarding', { onboardingData });
      updateUser({ hasCompletedOnboarding: true, onboardingData });
      showToast('All set! Your space is ready.', 'success');
      await syncUser();
      navigate('/');
    } catch {
      showToast('Failed to save. Try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (showWelcome) return <WelcomeScreen onStart={() => setShowWelcome(false)} />;

  const selectClass = "p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-orange-400 outline-none text-gray-700 font-semibold";

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">

        {/* Progress bar */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            {step > 0 && (
              <button onClick={back} className="text-gray-300 hover:text-gray-500 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/>
                </svg>
              </button>
            )}
            <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, backgroundColor: COLORS.accent }}
              />
            </div>
            <span className="text-[10px] font-black text-gray-300 tabular-nums">{step + 1}/{TOTAL_STEPS}</span>
          </div>
        </div>

        {/* ── Step 0: Gender ── */}
        {step === 0 && (
          <>
            <h2 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">how do you identify?</h2>
            <p className="text-sm text-gray-400 mb-8">this helps pysona speak to you better</p>
            <div className="flex flex-col gap-3">
              {['female', 'male', 'non-binary', 'prefer not to say'].map(opt => (
                <OptionBtn key={opt} label={opt} selected={gender === opt} onClick={() => { setGender(opt); setTimeout(next, 250); }} />
              ))}
            </div>
          </>
        )}

        {/* ── Step 1: Date of Birth ── */}
        {step === 1 && (
          <>
            <h2 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">when were you born?</h2>
            <p className="text-sm text-gray-400 mb-8">we keep this private — just helps us understand you</p>

            <div className="flex gap-3 mb-6">
              {/* Day */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Day</label>
                <select
                  className={`${selectClass} w-20`}
                  value={dobDay}
                  onChange={e => setDobDay(e.target.value)}
                >
                  <option value="">—</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                    <option key={d} value={String(d).padStart(2, '0')}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Month */}
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Month</label>
                <select
                  className={`${selectClass} w-full`}
                  value={dobMonth}
                  onChange={e => setDobMonth(e.target.value)}
                >
                  <option value="">—</option>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Year */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Year</label>
                <select
                  className={`${selectClass} w-24`}
                  value={dobYear}
                  onChange={e => setDobYear(e.target.value)}
                >
                  <option value="">—</option>
                  {Array.from(
                    { length: new Date().getFullYear() - 1939 },
                    (_, i) => new Date().getFullYear() - 5 - i
                  ).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {dobDay && dobMonth && dobYear && (
              <button
                onClick={next}
                className="w-full py-4 rounded-2xl text-white font-black text-sm tracking-wide transition-all active:scale-95"
                style={{ backgroundColor: COLORS.accent }}
              >
                continue →
              </button>
            )}
          </>
        )}

        {/* ── Step 2: How did you hear ── */}
        {step === 2 && (
          <>
            <h2 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">how did you find us?</h2>
            <p className="text-sm text-gray-400 mb-8">just curious 🙂</p>
            <div className="flex flex-col gap-3">
              {HEAR_ABOUT_OPTIONS.map(opt => (
                <OptionBtn key={opt} label={opt} selected={hearAboutUs === opt} onClick={() => { setHearAboutUs(opt); setTimeout(next, 250); }} />
              ))}
            </div>
          </>
        )}

        {/* ── Step 3: Support focus ── */}
        {step === 3 && (
          <>
            <h2 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">what are you most looking for support with?</h2>
            <p className="text-sm text-gray-400 mb-8">pick the one that feels closest</p>
            <div className="flex flex-col gap-3">
              {SUPPORT_FOCUS_OPTIONS.map(opt => (
                <OptionBtn key={opt.value} emoji={opt.emoji} label={opt.label} selected={supportFocus === opt.value} onClick={() => { setSupportFocus(opt.value); setTimeout(next, 250); }} />
              ))}
            </div>
          </>
        )}

        {/* ── Step 4: Intent ── */}
        {step === 4 && (
          <>
            <h2 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">what brings you here today?</h2>
            <p className="text-sm text-gray-400 mb-8">no right or wrong answer</p>
            <div className="flex flex-col gap-3">
              {INTENT_OPTIONS.map(opt => (
                <OptionBtn key={opt.value} emoji={opt.emoji} label={opt.label} selected={intent === opt.value} onClick={() => { setIntent(opt.value); setTimeout(next, 250); }} />
              ))}
            </div>
          </>
        )}

        {/* ── Step 5: Style + comfort ── */}
        {step === 5 && (
          <>
            <h2 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">how should pysona show up for you?</h2>
            <p className="text-sm text-gray-400 mb-6">two quick things and you're done</p>

            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">support style</p>
            <div className="flex flex-col gap-3 mb-8">
              {STYLE_OPTIONS.map(opt => (
                <OptionBtn key={opt.value} emoji={opt.emoji} label={opt.label} selected={style === opt.value} onClick={() => setStyle(opt.value)} />
              ))}
            </div>

            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">okay with questions?</p>
            <div className="flex flex-col gap-3 mb-8">
              {QUESTION_OPTIONS.map(opt => (
                <OptionBtn key={opt.value} emoji={opt.emoji} label={opt.label} selected={questionComfort === opt.value} onClick={() => setQuestionComfort(opt.value)} />
              ))}
            </div>

            {style && questionComfort && (
              <button
                onClick={next}
                className="w-full py-4 rounded-2xl text-white font-black text-sm tracking-wide transition-all active:scale-95"
                style={{ backgroundColor: COLORS.accent }}
              >
                continue →
              </button>
            )}
          </>
        )}

        {/* ── Step 6: Name your companion ── */}
        {step === 6 && (
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
              style={{ backgroundColor: COLORS.accent }}
            >
              {isSaving
                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : '✦ Begin My Journey'}
            </button>
          </>
        )}

      </div>
    </div>
  );
};
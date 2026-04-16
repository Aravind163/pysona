import React, { useState, useRef } from 'react';
import { COLORS } from '../../constants';
import { useToast } from '../../hooks/useToast';
import { PysonaLogo } from '../../components/UI/Logo';
import api from '../../lib/api';

interface LoginScreenProps {
  onAuthSuccess: (token: string) => Promise<void>;
}

type Screen = 'LOGIN' | 'REGISTER_EMAIL' | 'REGISTER_OTP' | 'FORGOT_EMAIL' | 'FORGOT_OTP' | 'FORGOT_RESET';

// ── Eye Icons ────────────────────────────────────────────────────────────────
const EyeOpenIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeClosedIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

// ── Password Input with Eye Toggle ───────────────────────────────────────────
const PasswordInput = ({
  placeholder,
  autoComplete,
  value,
  onChange,
  className,
}: {
  placeholder: string;
  autoComplete?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className: string;
}) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative w-full">
      <input
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`${className} pr-14`}
        value={value}
        onChange={onChange}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
        tabIndex={-1}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOpenIcon /> : <EyeClosedIcon />}
      </button>
    </div>
  );
};

// ── 6-Box OTP Input ──────────────────────────────────────────────────────────
const OtpBoxInput = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, char: string) => {
    const digit = char.replace(/\D/g, '').slice(-1);
    const arr = value.split('');
    arr[index] = digit;
    const next = arr.join('').padEnd(6, '').slice(0, 6);
    // Trim trailing empty slots
    const newVal = next.replace(/ /g, '').padEnd(index + (digit ? 1 : 0), '').slice(0, 6);
    // Build properly
    const chars = value.split('');
    chars[index] = digit;
    const joined = chars.slice(0, 6).join('').replace(/\s/g, '');
    onChange(joined.slice(0, 6));
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      const chars = value.split('');
      if (chars[index]) {
        chars[index] = '';
        onChange(chars.join('').slice(0, 6));
      } else if (index > 0) {
        const updated = value.split('');
        updated[index - 1] = '';
        onChange(updated.join('').slice(0, 6));
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted);
    const nextFocus = Math.min(pasted.length, 5);
    inputRefs.current[nextFocus]?.focus();
  };

  return (
    <div className="flex gap-2 justify-center w-full">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className="w-11 h-14 bg-gray-50 border border-gray-100 rounded-2xl text-center text-2xl font-black text-gray-700 focus:ring-2 focus:ring-orange-500 outline-none transition-all shadow-inner"
        />
      ))}
    </div>
  );
};

export const LoginScreen = ({ onAuthSuccess }: LoginScreenProps) => {
  const [screen, setScreen] = useState<Screen>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useToast();

  const reset = (to: Screen) => { setOtp(''); setPassword(''); setNewPassword(''); setScreen(to); };

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return showToast('Email and password are required.', 'error');
    setIsLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      showToast('Welcome back!', 'success');
      await onAuthSuccess(data.token);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Sign in failed. Try again.', 'error');
    } finally { setIsLoading(false); }
  };

  // ── Register: send OTP ─────────────────────────────────────────────────────
  const handleRegisterSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return showToast('Enter a valid email address.', 'error');
    setIsLoading(true);
    try {
      const { data: otpData } = await api.post('/auth/register/send-otp', { email });
      if (otpData.devOtp) {
        setOtp(otpData.devOtp);
        showToast(`DEV MODE: OTP is ${otpData.devOtp} (auto-filled for you)`, 'info');
      } else {
        showToast(`Verification code sent to ${email}`, 'success');
      }
      setScreen('REGISTER_OTP');
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to send code.', 'error');
    } finally { setIsLoading(false); }
  };

  // ── Register: verify OTP + set password ───────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return showToast('Enter the 6-digit code from your email.', 'error');
    if (!password || password.length < 6) return showToast('Password must be at least 6 characters.', 'error');
    setIsLoading(true);
    try {
      const { data } = await api.post('/auth/register', { email, otp, password });
      showToast('Account created! Welcome to Pysona.', 'success');
      await onAuthSuccess(data.token);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Registration failed.', 'error');
    } finally { setIsLoading(false); }
  };

  // ── Forgot: send OTP ───────────────────────────────────────────────────────
  const handleForgotSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return showToast('Enter a valid email address.', 'error');
    setIsLoading(true);
    try {
      const { data: forgotData } = await api.post('/auth/forgot-password/send-otp', { email });
      if (forgotData.devOtp) {
        setOtp(forgotData.devOtp);
        showToast(`DEV MODE: OTP is ${forgotData.devOtp} (auto-filled for you)`, 'info');
      } else {
        showToast(`Reset code sent to ${email}`, 'success');
      }
      setScreen('FORGOT_OTP');
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to send reset code.', 'error');
    } finally { setIsLoading(false); }
  };

  // ── Forgot: verify OTP ─────────────────────────────────────────────────────
  const handleForgotVerifyOTP = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return showToast('Enter the 6-digit code from your email.', 'error');
    setScreen('FORGOT_RESET');
  };

  // ── Forgot: reset password ─────────────────────────────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) return showToast('Password must be at least 6 characters.', 'error');
    setIsLoading(true);
    try {
      await api.post('/auth/forgot-password/reset', { email, otp, newPassword });
      showToast('Password reset! Please sign in.', 'success');
      setEmail(''); setOtp(''); setNewPassword('');
      setScreen('LOGIN');
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Reset failed.', 'error');
    } finally { setIsLoading(false); }
  };

  // ── Shared styles ──────────────────────────────────────────────────────────
  const inputCls = "w-full p-5 bg-gray-50 border border-gray-100 rounded-[1.5rem] focus:ring-2 focus:ring-orange-500 outline-none transition-all font-bold text-gray-700 placeholder:text-gray-300";
  const btnCls = "w-full py-5 rounded-[1.5rem] text-white font-black shadow-2xl shadow-orange-100 transition-all active:scale-95 uppercase tracking-widest text-sm flex items-center justify-center disabled:opacity-70";
  const Spinner = () => <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />;
  const BackBtn = ({ to }: { to: Screen }) => (
    <button type="button" onClick={() => reset(to)}
      className="text-[10px] text-gray-300 font-black uppercase tracking-widest hover:text-gray-500 transition-colors">
      ← Back
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white overflow-hidden relative">
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-orange-50 rounded-full blur-[100px] opacity-40" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-50 rounded-full blur-[100px] opacity-40" />

      <div className="w-full max-w-sm text-center relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <PysonaLogo className="scale-[1.3] transform-gpu mb-4" />
          <p className="text-gray-400 font-bold uppercase tracking-[0.25em] text-[10px] mt-2">
            AI-Guided Emotional Reflection
          </p>
        </div>

        {/* ── LOGIN ── */}
        {screen === 'LOGIN' && (
          <form onSubmit={handleLogin} noValidate className="space-y-3">
            <input type="email" placeholder="Email address" autoComplete="email"
              className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
            <PasswordInput
              placeholder="Password"
              autoComplete="current-password"
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="submit" disabled={isLoading} className={btnCls} style={{ backgroundColor: COLORS.accent }}>
              {isLoading ? <Spinner /> : 'Sign In'}
            </button>
            <div className="flex flex-col gap-3 pt-2">
              <button type="button" onClick={() => reset('FORGOT_EMAIL')}
                className="text-[10px] text-gray-400 font-black uppercase tracking-widest hover:text-orange-500 transition-colors">
                Forgot password?
              </button>
              <button type="button" onClick={() => reset('REGISTER_EMAIL')}
                className="text-[10px] text-gray-400 font-black uppercase tracking-widest hover:text-orange-500 transition-colors">
                No account? Create one →
              </button>
            </div>
          </form>
        )}

        {/* ── REGISTER: enter email ── */}
        {screen === 'REGISTER_EMAIL' && (
          <form onSubmit={handleRegisterSendOTP} noValidate className="space-y-4">
            <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-2">Create Account</p>
            <input type="email" placeholder="Your email address" autoComplete="email"
              className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
            <button type="submit" disabled={isLoading} className={btnCls} style={{ backgroundColor: COLORS.accent }}>
              {isLoading ? <Spinner /> : 'Send Verification Code'}
            </button>
            <BackBtn to="LOGIN" />
          </form>
        )}

        {/* ── REGISTER: enter OTP + password ── */}
        {screen === 'REGISTER_OTP' && (
          <form onSubmit={handleRegister} noValidate className="space-y-4">
            <div className="mb-4">
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Verify Email</p>
              <p className="text-sm text-gray-500 font-medium">
                Code sent to <span className="text-gray-900 font-black">{email}</span>
              </p>
            </div>
            <OtpBoxInput value={otp} onChange={setOtp} />
            <PasswordInput
              placeholder="Create a password (min 6 chars)"
              autoComplete="new-password"
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="submit" disabled={isLoading} className={btnCls} style={{ backgroundColor: COLORS.accent }}>
              {isLoading ? <Spinner /> : 'Create Account'}
            </button>
            <div className="flex flex-col gap-3">
              <button type="button" onClick={handleRegisterSendOTP} disabled={isLoading}
                className="text-[10px] text-gray-400 font-black uppercase tracking-widest hover:text-orange-500 transition-colors">
                Resend Code
              </button>
              <BackBtn to="REGISTER_EMAIL" />
            </div>
          </form>
        )}

        {/* ── FORGOT: enter email ── */}
        {screen === 'FORGOT_EMAIL' && (
          <form onSubmit={handleForgotSendOTP} noValidate className="space-y-4">
            <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-2">Reset Password</p>
            <input type="email" placeholder="Your account email" autoComplete="email"
              className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
            <button type="submit" disabled={isLoading} className={btnCls} style={{ backgroundColor: COLORS.accent }}>
              {isLoading ? <Spinner /> : 'Send Reset Code'}
            </button>
            <BackBtn to="LOGIN" />
          </form>
        )}

        {/* ── FORGOT: enter OTP ── */}
        {screen === 'FORGOT_OTP' && (
          <form onSubmit={handleForgotVerifyOTP} noValidate className="space-y-4">
            <div className="mb-4">
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Check Your Email</p>
              <p className="text-sm text-gray-500 font-medium">
                Reset code sent to <span className="text-gray-900 font-black">{email}</span>
              </p>
            </div>
            <OtpBoxInput value={otp} onChange={setOtp} />
            <button type="submit" disabled={isLoading} className={btnCls} style={{ backgroundColor: COLORS.accent }}>
              {isLoading ? <Spinner /> : 'Verify Code'}
            </button>
            <div className="flex flex-col gap-3">
              <button type="button" onClick={handleForgotSendOTP} disabled={isLoading}
                className="text-[10px] text-gray-400 font-black uppercase tracking-widest hover:text-orange-500 transition-colors">
                Resend Code
              </button>
              <BackBtn to="FORGOT_EMAIL" />
            </div>
          </form>
        )}

        {/* ── FORGOT: new password ── */}
        {screen === 'FORGOT_RESET' && (
          <form onSubmit={handleResetPassword} noValidate className="space-y-4">
            <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-2">New Password</p>
            <PasswordInput
              placeholder="New password (min 6 chars)"
              autoComplete="new-password"
              className={inputCls}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <button type="submit" disabled={isLoading} className={btnCls} style={{ backgroundColor: COLORS.accent }}>
              {isLoading ? <Spinner /> : 'Reset Password'}
            </button>
            <BackBtn to="FORGOT_OTP" />
          </form>
        )}

        <div className="mt-12 text-[10px] text-gray-400 uppercase tracking-[0.2em] font-black max-w-[280px] mx-auto leading-relaxed">
          By signing in, you agree to our focus on{' '}
          <span className="text-gray-600">Safe AI Support</span>.
        </div>
      </div>
    </div>
  );
};
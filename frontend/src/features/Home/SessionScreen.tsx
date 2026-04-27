import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { COLORS } from '../../constants';
import { SessionState, OnboardingData } from '../../types';
import { useVoice } from '../../hooks/useVoice';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../App';
import { generateAIResponse, generateSessionSummary } from '../../services/geminiService';
import { AnimatedText } from '../../components/UI/AnimatedText';
import api from '../../lib/api';

export const SessionScreen = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user, updateUser } = useAuth();

  const [sessionState, setSessionState] = useState<SessionState>(SessionState.IDLE);
  const [aiText, setAiText] = useState('');
  const [history, setHistory] = useState<{ role: 'user' | 'model'; parts: { text: string }[] }[]>([]);
  const [timeLeft, setTimeLeft] = useState(300);
  const [sessionLog, setSessionLog] = useState<string[]>([]);
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const [textInput, setTextInput] = useState('');
  const [sessionStartTime] = useState(Date.now());

  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);

  const {
    isListening, isSpeaking, transcript, transcriptRef,
    startListening, stopListening, speak, stopSpeaking,
    recognitionRef, clearTranscript, isSupported: voiceSupported,
  } = useVoice();

  const onboardingData: OnboardingData | undefined = user?.onboardingData as OnboardingData | undefined;
  const credits = user?.credits ?? 0;

  const handleEndSession = useCallback(async () => {
    if (sessionState === SessionState.ENDED) return;
    stopListening();
    stopSpeaking();

    // ✅ FIX: If no messages were exchanged, end silently without deducting a credit
    if (history.length === 0) {
      setSessionState(SessionState.IDLE);
      navigate('/');
      return;
    }

    setSessionState(SessionState.THINKING);
    try {
      const summaryData = await generateSessionSummary(sessionLog.join('\n'));
      const durationSeconds = Math.floor((Date.now() - sessionStartTime) / 1000);

      // Save to backend → deducts 1 credit
      const { data } = await api.post('/sessions', {
        durationSeconds,
        summary: summaryData.summary,
        reflection: summaryData.reflection,
        groundingLine: summaryData.groundingLine,
        inputMode,
      });

      // Update credit balance in real-time
      updateUser({ credits: data.creditsRemaining });

      setSessionState(SessionState.ENDED);
      navigate('/session-end', { state: { summary: summaryData } });
    } catch (e: any) {
      if (e?.response?.status === 402) {
        showToast('Not enough credits. Please top up.', 'error');
        navigate('/account');
      } else {
        showToast('Failed to save session.', 'error');
      }
      setSessionState(SessionState.IDLE);
    }
  }, [sessionLog, navigate, sessionState, stopListening, stopSpeaking, showToast, updateUser, inputMode, sessionStartTime]);

  const processUserInput = useCallback(async (input: string) => {
    if (!input.trim() || sessionState === SessionState.THINKING || sessionState === SessionState.SPEAKING) return;
    stopListening();
    setSessionState(SessionState.THINKING);
    setSessionLog((prev) => [...prev, `User: ${input}`]);
    setHasCheckedIn(false);
    try {
      const response = await generateAIResponse(input, history, onboardingData);
      setAiText(response.text);
      setHistory((prev) => [
        ...prev,
        { role: 'user', parts: [{ text: input }] },
        { role: 'model', parts: [{ text: response.text }] },
      ]);
      setSessionLog((prev) => [...prev, `AI: ${response.text}`]);
      setSessionState(SessionState.SPEAKING);
      speak(response.text, onboardingData?.voiceName, () => {
        if (response.isSafetyTriggered) handleEndSession();
        else { setSessionState(SessionState.IDLE); clearTranscript(); }
      });
    } catch (err) {
      showToast((err as Error)?.message || 'Connection issue. Try again.', 'error');
      setSessionState(SessionState.IDLE);
    }
  }, [history, onboardingData, speak, stopListening, clearTranscript, handleEndSession, showToast, sessionState]);

  // ✅ FIX: Silence auto-submit is now handled inside useVoice via onSilenceSubmitRef,
  // so we no longer need a stale-closure-prone event listener here.

  // Inactivity check-in
  useEffect(() => {
    if (sessionState === SessionState.LISTENING || (sessionState === SessionState.IDLE && aiText)) {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(() => {
        if (!hasCheckedIn) {
          setHasCheckedIn(true);
          const msg = "I'm still here if you need to talk. Take your time.";
          setAiText(msg);
          setSessionState(SessionState.SPEAKING);
          stopListening();
          speak(msg, onboardingData?.voiceName, () => setSessionState(SessionState.IDLE));
        } else {
          handleEndSession();
        }
      }, 60000);
    } else {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    }
    return () => { if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current); };
  }, [sessionState, hasCheckedIn, speak, stopListening, onboardingData, handleEndSession, aiText]);

  // Session timer
  useEffect(() => {
    let timer: any;
    if (sessionState !== SessionState.IDLE || history.length > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => { if (prev <= 1) { handleEndSession(); return 0; } return prev - 1; });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [sessionState, handleEndSession, history]);

  const handleMicTap = () => {
    if (credits <= 0 && history.length === 0) {
      showToast('No credits left. Please top up to continue.', 'info');
      navigate('/account');
      return;
    }
    switch (sessionState) {
      case SessionState.IDLE:
        setAiText('');
        setSessionState(SessionState.LISTENING);
        // ✅ FIX: Pass processUserInput as the silence callback — always fresh, never stale
        startListening(processUserInput);
        break;
      case SessionState.LISTENING:
        if (transcript.trim()) processUserInput(transcript);
        else { stopListening(); setSessionState(SessionState.IDLE); }
        break;
      case SessionState.SPEAKING:
        stopSpeaking();
        setSessionState(SessionState.IDLE);
        break;
      case SessionState.THINKING:
        setSessionState(SessionState.IDLE);
        break;
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    if (credits <= 0 && history.length === 0) {
      showToast('No credits left. Please top up to continue.', 'info');
      navigate('/account');
      return;
    }
    const input = textInput.trim();
    setTextInput('');
    processUserInput(input);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const personaName = onboardingData?.personaName || 'Pysona';

  const StateIcon = useMemo(() => {
    if (sessionState === SessionState.LISTENING) {
      return (
        <div className="relative flex items-center justify-center">
          <div className="absolute w-24 h-24 bg-orange-400/20 rounded-full animate-ping" />
          <div className="absolute w-16 h-16 bg-orange-400/30 rounded-full animate-pulse" />
          <svg className="w-10 h-10 text-white relative z-10" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 1.93c-3.94-.49-7-3.85-7-7.93H5a7 7 0 1014 0h1c0 4.08-3.06 7.44-7 7.93V19h3v2H8v-2h3v-3.07z" />
          </svg>
        </div>
      );
    }
    if (sessionState === SessionState.THINKING) {
      return (
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-3 h-3 bg-white/70 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      );
    }
    if (sessionState === SessionState.SPEAKING) {
      return (
        <div className="flex gap-1 items-center h-10">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="w-1.5 bg-white rounded-full animate-pulse"
              style={{ height: `${12 + Math.sin(i * 1.2) * 8 + 8}px`, animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      );
    }
    return (
      <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 1.93c-3.94-.49-7-3.85-7-7.93H5a7 7 0 1014 0h1c0 4.08-3.06 7.44-7 7.93V19h3v2H8v-2h3v-3.07z" />
      </svg>
    );
  }, [sessionState]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-6 pb-20 md:pb-6 bg-[#F9FAFB]">
      {/* Header */}
      <div className="w-full max-w-md flex justify-between items-center pt-2">
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Session</p>
          <p className="text-sm font-black text-gray-700">{personaName}</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Credits badge */}
          <div className="flex items-center gap-1.5 bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100">
            <span className="text-orange-500 text-xs">●</span>
            <span className="text-xs font-black text-orange-600">{credits} credits</span>
          </div>
          <p className="text-sm font-black text-gray-500 tabular-nums">{formatTime(timeLeft)}</p>
        </div>
      </div>

      {/* AI Text */}
      <div className="w-full max-w-md flex-1 flex items-center justify-center my-8">
        {aiText ? (
          <AnimatedText text={aiText} className="text-center text-gray-700 text-lg font-medium leading-relaxed" />
        ) : (
          <div className="text-center">
            <p className="text-gray-300 font-medium text-lg">
              {sessionState === SessionState.IDLE ? `Tap to begin talking with ${personaName}` : ''}
            </p>
          </div>
        )}
        {sessionState === SessionState.LISTENING && transcript && (
          <p className="absolute bottom-40 left-1/2 -translate-x-1/2 text-sm text-gray-400 italic max-w-xs text-center px-4">
            "{transcript}"
          </p>
        )}
      </div>

      {/* Input Mode Toggle */}
      <div className="w-full max-w-md mb-4">
        <div className="flex justify-center gap-2 mb-4">
          <button
            onClick={() => setInputMode('voice')}
            className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all ${inputMode === 'voice' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
          >
            Voice
          </button>
          <button
            onClick={() => setInputMode('text')}
            className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all ${inputMode === 'text' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
          >
            Text
          </button>
        </div>

        {/* Text Input */}
        {inputMode === 'text' && (
          <form onSubmit={handleTextSubmit} className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Type your message..."
              className="flex-1 p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-orange-400 outline-none text-sm font-medium text-gray-700 placeholder:text-gray-300"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              disabled={sessionState === SessionState.THINKING || sessionState === SessionState.SPEAKING}
            />
            <button
              type="submit"
              disabled={!textInput.trim() || sessionState === SessionState.THINKING || sessionState === SessionState.SPEAKING}
              className="px-5 py-4 rounded-2xl text-white font-black text-sm transition-all active:scale-95 disabled:opacity-40"
              style={{ backgroundColor: COLORS.accent }}
            >
              Send
            </button>
          </form>
        )}
      </div>

      {/* Main Controls */}
      <div className="w-full max-w-md flex items-center justify-between">
        <button
          onClick={handleEndSession}
          disabled={sessionState === SessionState.ENDED || history.length === 0}
          className="w-12 h-12 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-200 transition-all disabled:opacity-30 shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Mic / State button (voice mode) */}
        {inputMode === 'voice' && (
          <button
            onClick={handleMicTap}
            disabled={!voiceSupported}
            className="w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-95 disabled:opacity-40"
            style={{ backgroundColor: COLORS.accent }}
          >
            {StateIcon}
          </button>
        )}

        {inputMode === 'text' && (
          <div className="w-20 h-20 rounded-full flex items-center justify-center bg-gray-100">
            {sessionState === SessionState.THINKING ? (
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <div key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
                ))}
              </div>
            ) : sessionState === SessionState.SPEAKING ? (
              <div className="flex gap-0.5 items-center h-8">
                {[0,1,2,3,4].map(i => (
                  <div key={i} className="w-1.5 bg-orange-400 rounded-full animate-pulse"
                    style={{ height: `${10 + Math.sin(i*1.2)*6+6}px`, animationDelay: `${i*0.1}s` }} />
                ))}
              </div>
            ) : (
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            )}
          </div>
        )}

        <div className="w-12 h-12 rounded-full flex items-center justify-center">
          {credits === 0 && (
            <button onClick={() => navigate('/account')}
              className="w-12 h-12 rounded-full bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-400 hover:bg-orange-100 transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {!voiceSupported && inputMode === 'voice' && (
        <p className="mt-4 text-xs text-red-400 font-medium text-center">
          Voice not supported in this browser. Use Chrome or switch to text mode.
        </p>
      )}
    </div>
  );
};

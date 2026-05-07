import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { COLORS } from '../../constants';
import { SessionState, OnboardingData } from '../../types';
import { useVoice } from '../../hooks/useVoice';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../App';
import { generateAIResponse, generateSessionSummary } from '../../services/aiService';
import api from '../../lib/api';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

export const SessionScreen = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user, updateUser } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [sessionState, setSessionState] = useState<SessionState>(SessionState.IDLE);
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<{ role: 'user' | 'model'; parts: { text: string }[] }[]>([]);
  const [timeLeft, setTimeLeft] = useState(300);
  const [sessionLog, setSessionLog] = useState<string[]>([]);
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const [textInput, setTextInput] = useState('');
  const [sessionStartTime] = useState(Date.now());
  const [isTyping, setIsTyping] = useState(false);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    isListening, transcript,
    startListening, stopListening, speak, stopSpeaking,
    clearTranscript, isSupported: voiceSupported,
  } = useVoice();

  const onboardingData: OnboardingData | undefined = user?.onboardingData as OnboardingData | undefined;
  const credits = user?.credits ?? 0;
  const personaName = onboardingData?.personaName || 'Pysona';

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  useEffect(() => {
    if (sessionState === SessionState.IDLE && messages.length > 0) {
      setTimeout(scrollToBottom, 100);
    }
  }, [sessionState, scrollToBottom, messages.length]);

  const handleEndSession = useCallback(async () => {
    if (sessionState === SessionState.ENDED) return;
    stopListening(); stopSpeaking();
    if (history.length === 0) { setSessionState(SessionState.IDLE); navigate('/'); return; }
    setSessionState(SessionState.THINKING);
    try {
      const summaryData = await generateSessionSummary(sessionLog.join('\n'));
      const durationSeconds = Math.floor((Date.now() - sessionStartTime) / 1000);
      const { data } = await api.post('/sessions', {
        durationSeconds, summary: summaryData.summary,
        reflection: summaryData.reflection, groundingLine: summaryData.groundingLine, inputMode,
      });
      updateUser({ credits: data.creditsRemaining });
      setSessionState(SessionState.ENDED);
      navigate('/session-end', { state: { summary: summaryData } });
    } catch (e: any) {
      if (e?.response?.status === 402) { showToast('Not enough credits.', 'error'); navigate('/account'); }
      else showToast('Failed to save session.', 'error');
      setSessionState(SessionState.IDLE);
    }
  }, [sessionLog, navigate, sessionState, stopListening, stopSpeaking, showToast, updateUser, inputMode, sessionStartTime, history]);

  const processUserInput = useCallback(async (input: string) => {
    if (!input.trim() || sessionState === SessionState.THINKING || sessionState === SessionState.SPEAKING) return;
    stopListening();
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setSessionState(SessionState.THINKING);
    setSessionLog(prev => [...prev, `User: ${input}`]);
    setHasCheckedIn(false);
    setIsTyping(true);

    try {
      const response = await generateAIResponse(input, history, onboardingData);
      setIsTyping(false);

      // Split into sentences
      const raw = response.text.trim();
      const sentences = raw.match(/[^.!?]+[.!?]+/g) || [raw];

      // Add empty AI message to fill sentence by sentence
      const aiMsgId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: aiMsgId, role: 'ai', text: '', timestamp: new Date() }]);

      setHistory(prev => [
        ...prev,
        { role: 'user', parts: [{ text: input }] },
        { role: 'model', parts: [{ text: response.text }] },
      ]);
      setSessionLog(prev => [...prev, `AI: ${response.text}`]);
      setSessionState(SessionState.SPEAKING);

      let shownText = '';

      // Speak sentences one by one, reveal in UI as each is spoken
      const speakNext = (index: number) => {
        if (index >= sentences.length) {
          if (response.isSafetyTriggered) handleEndSession();
          else {
            setSessionState(SessionState.IDLE);
            clearTranscript();
          }
          return;
        }

        const sentence = sentences[index].trim();
        shownText += (shownText ? ' ' : '') + sentence;
        const currentText = shownText;

        // Update AI message text in place
        setMessages(prev => prev.map(m =>
          m.id === aiMsgId ? { ...m, text: currentText } : m
        ));

        // After 3rd sentence spoken, scroll down to reveal rest
        if (index === 2) {
          setTimeout(scrollToBottom, 150);
        }

        // Speak this sentence then move to next
        speak(sentence, onboardingData?.voiceName, () => {
          speakNext(index + 1);
        });
      };

      speakNext(0);

    } catch (err) {
      setIsTyping(false);
      showToast((err as Error)?.message || 'Connection issue.', 'error');
      setSessionState(SessionState.IDLE);
    }
  }, [history, onboardingData, speak, stopListening, clearTranscript, handleEndSession, showToast, sessionState, scrollToBottom]);

  useEffect(() => {
    if (sessionState === SessionState.LISTENING || (sessionState === SessionState.IDLE && messages.length > 0)) {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(() => {
        if (!hasCheckedIn) {
          setHasCheckedIn(true);
          const msg = "Still here.";
          setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', text: msg, timestamp: new Date() }]);
          setSessionState(SessionState.SPEAKING);
          stopListening();
          speak(msg, onboardingData?.voiceName, () => setSessionState(SessionState.IDLE));
        } else { handleEndSession(); }
      }, 60000);
    } else { if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current); }
    return () => { if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current); };
  }, [sessionState, hasCheckedIn, speak, stopListening, onboardingData, handleEndSession, messages.length]);

  useEffect(() => {
    let timer: any;
    if (sessionState !== SessionState.IDLE || history.length > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => { if (prev <= 1) { handleEndSession(); return 0; } return prev - 1; });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [sessionState, handleEndSession, history]);

  const handleMicTap = () => {
    if (credits <= 0 && history.length === 0) { showToast('No credits left.', 'info'); navigate('/account'); return; }
    switch (sessionState) {
      case SessionState.IDLE:
        setSessionState(SessionState.LISTENING);
        startListening(processUserInput);
        break;
      case SessionState.LISTENING:
        if (transcript.trim()) processUserInput(transcript);
        else { stopListening(); setSessionState(SessionState.IDLE); }
        break;
      case SessionState.SPEAKING:
        stopSpeaking(); setSessionState(SessionState.IDLE); break;
      case SessionState.THINKING:
        setSessionState(SessionState.IDLE); break;
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    if (credits <= 0 && history.length === 0) { showToast('No credits left.', 'info'); navigate('/account'); return; }
    const input = textInput.trim(); setTextInput(''); processUserInput(input);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const formatMsgTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // ─── Voice Orb ─────────────────────────────────────────────────────────────
  const VoiceOrb = () => {
    const isActive = sessionState === SessionState.LISTENING || sessionState === SessionState.SPEAKING || sessionState === SessionState.THINKING;
    const isListeningState = sessionState === SessionState.LISTENING;
    const isSpeakingState = sessionState === SessionState.SPEAKING;
    const isThinkingState = sessionState === SessionState.THINKING;

    const lastAiText = messages.filter(m => m.role === 'ai').slice(-1)[0]?.text || '';

    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-6 select-none px-6">
        <p className="text-sm font-medium text-gray-400 tracking-wide h-5">
          {isListeningState ? 'Listening...'
            : isThinkingState ? 'Thinking...'
            : isSpeakingState ? 'Speaking...'
            : messages.length === 0 ? 'Tap to speak'
            : 'Tap to continue'}
        </p>

        <div className="relative flex items-center justify-center cursor-pointer" onClick={handleMicTap}>
          {isActive && (
            <>
              <div className="absolute w-56 h-56 rounded-full opacity-10 animate-ping"
                style={{ backgroundColor: COLORS.accent, animationDuration: '2s' }} />
              <div className="absolute w-44 h-44 rounded-full opacity-15 animate-ping"
                style={{ backgroundColor: COLORS.accent, animationDuration: '1.5s', animationDelay: '0.3s' }} />
            </>
          )}
          <div
            className="relative w-36 h-36 rounded-full flex items-center justify-center transition-all duration-500"
            style={{
              background: isActive
                ? `radial-gradient(circle at 35% 35%, ${COLORS.accent}ee, ${COLORS.accent}88)`
                : `radial-gradient(circle at 35% 35%, #e5e7eb, #d1d5db)`,
              boxShadow: isActive
                ? `0 0 60px ${COLORS.accent}44, 0 20px 40px ${COLORS.accent}22`
                : '0 8px 32px rgba(0,0,0,0.08)',
              transform: isListeningState ? 'scale(1.08)' : isActive ? 'scale(1.04)' : 'scale(1)',
            }}>
            {isListeningState && (
              <div className="flex gap-1 items-center">
                {[0,1,2,3,4].map(i => (
                  <div key={i} className="w-1 bg-white rounded-full animate-bounce"
                    style={{ height: `${12 + Math.sin(i * 1.2) * 8 + 8}px`, animationDelay: `${i * 0.1}s`, animationDuration: '0.6s' }} />
                ))}
              </div>
            )}
            {isSpeakingState && (
              <div className="flex gap-1 items-center">
                {[0,1,2,3,4,5].map(i => (
                  <div key={i} className="w-0.5 bg-white/80 rounded-full"
                    style={{ height: `${8 + Math.sin(i * 0.8) * 10 + 10}px`, animation: `pulse 0.4s ease-in-out ${i * 0.08}s infinite alternate` }} />
                ))}
              </div>
            )}
            {isThinkingState && (
              <div className="flex gap-1.5 items-center">
                {[0,1,2].map(i => (
                  <div key={i} className="w-2 h-2 bg-white/80 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            )}
            {!isActive && (
              <svg className="w-10 h-10 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 1.93c-3.94-.49-7-3.85-7-7.93H5a7 7 0 1014 0h1c0 4.08-3.06 7.44-7 7.93V19h3v2H8v-2h3v-3.07z"/>
              </svg>
            )}
          </div>
        </div>

        {isListeningState && transcript && (
          <p className="text-gray-400 text-sm font-medium italic max-w-xs text-center leading-relaxed">
            "{transcript}"
          </p>
        )}

        {/* AI text — shows sentence by sentence, scrollable after 3rd */}
        {lastAiText && !isListeningState && (
          <div
            className="w-full max-w-sm text-center"
            style={{
              maxHeight: '9em',
              overflowY: 'auto',
              lineHeight: '1.8em',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            <p className="text-gray-600 text-sm font-medium leading-relaxed">
              {lastAiText}
            </p>
            <div ref={messagesEndRef} />
          </div>
        )}

        {history.length > 0 && (
          <button onClick={handleEndSession}
            className="text-xs text-gray-300 hover:text-red-400 transition-colors font-medium tracking-wide uppercase">
            End session
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-white" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div className="px-5 py-4 flex justify-between items-center border-b border-gray-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-black"
            style={{ backgroundColor: COLORS.accent }}>
            {personaName.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-black text-gray-900">{personaName}</p>
            <p className="text-xs text-gray-400">AI Emotional Companion</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-orange-500 bg-orange-50 px-3 py-1.5 rounded-full">
            {credits} credits
          </span>
          <span className="text-xs font-bold text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full tabular-nums">
            {formatTime(timeLeft)}
          </span>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex justify-center gap-2 pt-4 px-4">
        {(['voice', 'text'] as const).map(mode => (
          <button key={mode} onClick={() => setInputMode(mode)}
            className={`px-5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all ${
              inputMode === mode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'
            }`}>
            {mode}
          </button>
        ))}
      </div>

      {/* ─── VOICE MODE ──────────────────────────────────────────────────────── */}
      {inputMode === 'voice' && (
        <div className="flex flex-col flex-1 items-center justify-center overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          <VoiceOrb />
          {!voiceSupported && (
            <p className="text-xs text-red-400 text-center pb-4">
              Voice not supported. Use Chrome or switch to Text.
            </p>
          )}
        </div>
      )}

      {/* ─── TEXT MODE ───────────────────────────────────────────────────────── */}
      {inputMode === 'text' && (
        <>
          <div
            className="flex-1 px-4 py-3 space-y-3"
            style={{
              overflowY: 'auto',
              backgroundImage: 'radial-gradient(circle at 1px 1px, #f3f4f6 1px, transparent 0)',
              backgroundSize: '20px 20px',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}>

            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 gap-2">
                <p className="text-gray-300 text-sm font-medium text-center">
                  Type something to begin talking with {personaName}
                </p>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'ai' && (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black mr-2 mt-1 flex-shrink-0"
                    style={{ backgroundColor: COLORS.accent }}>
                    {personaName.charAt(0)}
                  </div>
                )}
                <div className="max-w-[75%] flex flex-col">
                  <div className={`px-4 py-2.5 rounded-2xl text-sm font-medium leading-relaxed shadow-sm ${
                    msg.role === 'user'
                      ? 'text-white rounded-tr-sm'
                      : 'bg-white text-gray-800 rounded-tl-sm border border-gray-100'
                  }`} style={msg.role === 'user' ? { backgroundColor: COLORS.accent } : {}}>
                    {msg.text}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 px-1">{formatMsgTime(msg.timestamp)}</p>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black mr-2 mt-1 flex-shrink-0"
                  style={{ backgroundColor: COLORS.accent }}>
                  {personaName.charAt(0)}
                </div>
                <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm">
                  <div className="flex gap-1">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {sessionState === SessionState.LISTENING && transcript && (
              <div className="flex justify-end">
                <div className="max-w-[75%] px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm italic text-white/80 shadow-sm"
                  style={{ backgroundColor: COLORS.accent + 'aa' }}>
                  {transcript}...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Text input */}
          <div className="px-4 py-3 border-t border-gray-100 bg-white">
            <form onSubmit={handleTextSubmit} className="flex gap-2 items-end">
              <textarea
                placeholder="Type a message..."
                className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-orange-200 outline-none text-sm font-medium text-gray-700 placeholder:text-gray-300 resize-none"
                value={textInput} rows={1}
                onChange={e => {
                  setTextInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
                }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTextSubmit(e as any); } }}
                disabled={sessionState === SessionState.THINKING || sessionState === SessionState.SPEAKING}
                style={{ scrollbarWidth: 'none' }}
              />
              <div className="flex gap-2">
                {history.length > 0 && (
                  <button type="button" onClick={handleEndSession}
                    className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:text-red-400 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                )}
                <button type="submit"
                  disabled={!textInput.trim() || sessionState === SessionState.THINKING || sessionState === SessionState.SPEAKING}
                  className="w-11 h-11 rounded-full text-white flex items-center justify-center transition-all active:scale-95 disabled:opacity-40"
                  style={{ backgroundColor: COLORS.accent }}>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
};
import { useState, useCallback, useRef, useEffect } from 'react';

export const useVoice = () => {
  const [isSupported, setIsSupported] = useState(true);
  const [transcript, setTranscript] = useState('');
  const transcriptRef = useRef('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const heartbeatIntervalRef = useRef<any>(null);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try { recognitionRef.current.stop(); } catch (e) {}
    setIsListening(false);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
  }, []);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { setIsSupported(false); return; }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onresult = (event: any) => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      let interim = '', final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }
      const currentFull = (transcriptRef.current + ' ' + final + interim).trim();
      setTranscript(currentFull);
      if (final) transcriptRef.current = (transcriptRef.current + ' ' + final).trim();
      silenceTimerRef.current = setTimeout(() => {
        if (recognitionRef.current) {
          recognitionRef.current.dispatchEvent(new CustomEvent('pysona-silence-submit', {
            detail: { text: currentFull },
          }));
        }
      }, 3500);
    };

    recognitionRef.current.onerror = (event: any) => {
      if (event.error !== 'no-speech') console.warn('Speech status:', event.error);
    };
    recognitionRef.current.onend = () => setIsListening(false);

    if ('speechSynthesis' in window) window.speechSynthesis.getVoices();
    return () => { if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current); };
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    setTranscript('');
    transcriptRef.current = '';
    setIsListening(true);
    try {
      recognitionRef.current.start();
    } catch (e) {
      try {
        recognitionRef.current.stop();
        setTimeout(() => recognitionRef.current.start(), 200);
      } catch (err) {}
    }
  }, []);

  const speak = useCallback((text: string, voiceName?: string, onEnd?: () => void) => {
    if (!('speechSynthesis' in window)) { if (onEnd) onEnd(); return; }
    window.speechSynthesis.cancel();
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    const setVoiceAndSpeak = () => {
      const voices = window.speechSynthesis.getVoices();
      let preferred = voices.find(v => v.name === voiceName);
      if (!preferred) {
        preferred = voices.find(v =>
          (v.name.includes('Google') && v.name.includes('English')) ||
          v.name.includes('Natural') || v.name.includes('Samantha') || v.lang.startsWith('en')
        ) || voices[0];
      }
      if (preferred) utterance.voice = preferred;
      utterance.onstart = () => {
        setIsSpeaking(true);
        heartbeatIntervalRef.current = setInterval(() => {
          if (window.speechSynthesis.speaking) { window.speechSynthesis.pause(); window.speechSynthesis.resume(); }
        }, 10000);
      };
      utterance.onend = () => {
        setIsSpeaking(false);
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
        utteranceRef.current = null;
        if (onEnd) onEnd();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
        utteranceRef.current = null;
        if (onEnd) onEnd();
      };
      window.speechSynthesis.speak(utterance);
    };
    if (window.speechSynthesis.getVoices().length > 0) setVoiceAndSpeak();
    else { window.speechSynthesis.onvoiceschanged = () => { setVoiceAndSpeak(); window.speechSynthesis.onvoiceschanged = null; }; }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    setIsSpeaking(false);
    utteranceRef.current = null;
  }, []);

  return {
    isSupported, isListening, isSpeaking, transcript, transcriptRef,
    startListening, stopListening, speak, stopSpeaking, recognitionRef,
    clearTranscript: () => { setTranscript(''); transcriptRef.current = ''; },
  };
};

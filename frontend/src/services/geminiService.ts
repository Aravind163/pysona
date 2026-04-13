import api from '../lib/api';
import { OnboardingData } from '../types';

// Cooldown tracker — prevent sending faster than 1 request per 4 seconds
let lastRequestTime = 0;
const MIN_GAP_MS = 4000;

export const generateAIResponse = async (
  userInput: string,
  history: { role: 'user' | 'model'; parts: { text: string }[] }[],
  onboardingData?: OnboardingData
): Promise<{ text: string; isSafetyTriggered: boolean }> => {
  // Enforce minimum gap between requests
  const now = Date.now();
  const gap = now - lastRequestTime;
  if (gap < MIN_GAP_MS) {
    await new Promise(r => setTimeout(r, MIN_GAP_MS - gap));
  }
  lastRequestTime = Date.now();

  try {
    const { data } = await api.post('/ai/chat', {
      userInput,
      history: history.slice(-20),
      onboardingData,
    });
    return { text: data.text || "I'm right here with you.", isSafetyTriggered: !!data.isSafetyTriggered };
  } catch (err: any) {
    const status = err?.response?.status;
    const msg = err?.response?.data?.message;

    if (status === 429) throw new Error('AI is busy. Please wait a moment and try again.');
    if (status === 502) throw new Error(msg || 'AI service error. Check your Gemini API key.');
    if (status === 500) throw new Error(msg || 'Server error. Make sure backend is running.');
    throw new Error(msg || 'Connection failed. Is your backend running on port 5000?');
  }
};

export const generateSessionSummary = async (sessionText: string) => {
  try {
    const { data } = await api.post('/ai/summary', { sessionText });
    return data;
  } catch {
    return {
      summary: 'We shared some meaningful thoughts today.',
      reflection: 'It takes courage to be open about how you feel.',
      groundingLine: 'I hope you carry a little of this peace into your evening.',
    };
  }
};

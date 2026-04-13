export enum AppPlan {
  FREE = 'FREE',
  STANDARD = 'STANDARD',
  PREMIUM = 'PREMIUM',
}

export interface OnboardingData {
  intent: 'stress' | 'lonely' | 'clarity' | 'calm' | 'talk';
  style: 'listen' | 'reflection' | 'encouragement' | 'balance';
  tone: 'calm' | 'warm' | 'neutral';
  questionComfort: 'yes' | 'occasionally' | 'no';
  personaName?: string;
  voiceName?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar: string;
  role: 'user' | 'admin';
  plan: AppPlan;
  credits: number;           // live credit balance
  hasCompletedOnboarding: boolean;
  onboardingData?: OnboardingData;
}

export interface SessionRecord {
  _id: string;
  userId: string;
  createdAt: string;
  durationSeconds: number;
  summary: string;
  reflection: string;
  groundingLine: string;
  inputMode: 'text' | 'voice' | 'both';
  creditsUsed: number;
}

export enum SessionState {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  THINKING = 'THINKING',
  SPEAKING = 'SPEAKING',
  ENDED = 'ENDED',
}

export interface PlanDetails {
  id: AppPlan;
  name: string;
  price: string;
  features: string[];
  limits: string;
}

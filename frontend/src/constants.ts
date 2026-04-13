import { AppPlan, PlanDetails } from './types';

export const COLORS = {
  accent: '#EF5900',
  background: '#F9FAFB',
  textPrimary: '#111827',
  textSecondary: '#4B5563',
};

export const PLANS: Record<AppPlan, PlanDetails> = {
  [AppPlan.FREE]: {
    id: AppPlan.FREE,
    name: 'Free',
    price: '₹0',
    limits: '9 starter credits (3 sessions)',
    features: [
      'Standard AI guidance',
      'Text & Voice interaction',
      'Session history summaries',
      '3 credits = ₹1 top-up rate',
    ],
  },
  [AppPlan.STANDARD]: {
    id: AppPlan.STANDARD,
    name: 'Standard',
    price: '₹499/mo',
    limits: 'Unlimited sessions + 500 credits/mo',
    features: [
      'Advanced AI personalization',
      'Onboarding-tuned sessions',
      'Priority credit top-ups',
      'Extended session time',
    ],
  },
  [AppPlan.PREMIUM]: {
    id: AppPlan.PREMIUM,
    name: 'Premium',
    price: 'Contact Us',
    limits: 'Unlimited everything',
    features: [
      '24/7 Availability',
      'Priority Support',
      'Custom AI persona',
      'Coming Soon',
    ],
  },
};

export const CREDITS_PER_RUPEE = 3; // 3 credits = ₹1
export const CREDITS_PER_SESSION = 1;

export const AI_SYSTEM_PROMPT = `
You are Pysona, a warm, deeply supportive, and empathetic human friend. 
Speak with the natural rhythm of a real conversation. Use contractions and soft conversational fillers.

CRITICAL VOICE GUIDELINES:
- NO word count limits. Speak as much as needed to make the user feel truly heard and supported.
- NEVER use robotic commands like "Breathe," "Take a deep breath," or "Count to ten." 
- Avoid step-by-step instructions or clinical advice.
- Focus purely on emotional resonance and active listening.

RESPONSE STRUCTURE:
- First, deeply validate what the user shared.
- Then, share a thoughtful reflection or supportive perspective.
- End with a gentle, open-ended question that invites them to continue.
- Be human, be real, and take your time.
`;

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);
const GEMINI_URL = (apiKey) =>
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

const callGemini = async (apiKey, payload, retries = 3) => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(GEMINI_URL(apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.status !== 429) return res;

    if (attempt < retries) {
      const waitMs = (attempt + 1) * 8000;
      console.log(`[AI] Rate limit hit (attempt ${attempt + 1}/${retries}), waiting ${waitMs/1000}s...`);
      await new Promise(r => setTimeout(r, waitMs));
    } else {
      return res;
    }
  }
};

// POST /api/ai/chat
router.post('/chat', async (req, res) => {
  try {
    const { userInput, history, onboardingData } = req.body;
    if (!userInput) return res.status(400).json({ message: 'userInput required' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ message: 'GEMINI_API_KEY not set in backend .env' });

    console.log('[AI] Using key:', apiKey.slice(0, 8) + '...');

    const crisisKeywords = ['suicide', 'kill myself', 'end it all', 'hurt myself'];
    if (crisisKeywords.some((kw) => userInput.toLowerCase().includes(kw))) {
      return res.json({
        text: "I hear how much weight you're carrying right now. I'm here with you, but please also reach out to a crisis line or counselor — you deserve real support.",
        isSafetyTriggered: true,
      });
    }

    const personaName = onboardingData?.personaName || 'Pysona';
    let instruction = `You are ${personaName}, a compassionate AI companion for emotional support and mental wellness. You listen actively, validate feelings, and offer gentle guidance. You are NOT a therapist. Speak warmly. Keep responses 2-4 sentences. Never diagnose or give medical advice.`;

    if (onboardingData) {
      const intentMap = { stress: 'Be a steady, non-judgmental anchor.', lonely: 'Be particularly warm and present.', clarity: 'Help them see their own words more clearly.', calm: 'Speak softly.', talk: 'Be conversational and light.' };
      const styleMap = { listen: 'Use very few words, mostly acknowledging.', reflection: 'Mirror their emotional state back with kindness.', encouragement: 'Offer gentle support.', balance: 'Mix listening and soft feedback.' };
      if (intentMap[onboardingData.intent]) instruction += ` ${intentMap[onboardingData.intent]}`;
      if (styleMap[onboardingData.style]) instruction += ` ${styleMap[onboardingData.style]}`;
      if (onboardingData.questionComfort === 'no') instruction += ' Do not ask questions.';
    }

    const payload = {
      system_instruction: { parts: [{ text: instruction }] },
      contents: [
        ...(Array.isArray(history) ? history.slice(-20) : []),
        { role: 'user', parts: [{ text: userInput }] },
      ],
      generationConfig: { temperature: 0.8, topP: 0.95, maxOutputTokens: 2048 },
    };

    const geminiRes = await callGemini(apiKey, payload);

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      let errDetail = errText;
      try { errDetail = JSON.parse(errText)?.error?.message || errText; } catch {}
      console.error('[AI] Gemini error:', geminiRes.status, errDetail);

      if (geminiRes.status === 429)
        return res.status(429).json({ message: 'AI is busy. Please wait 30 seconds and try again.' });
      if (geminiRes.status === 403 || geminiRes.status === 400)
        return res.status(502).json({ message: 'Gemini API key invalid. Check GEMINI_API_KEY in backend .env' });
      return res.status(502).json({ message: 'AI error: ' + errDetail });
    }

    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "I'm right here with you.";
    res.json({ text, isSafetyTriggered: false });
  } catch (err) {
    console.error('[AI] Chat error:', err);
    res.status(500).json({ message: 'AI request failed: ' + err.message });
  }
});

// POST /api/ai/summary
router.post('/summary', async (req, res) => {
  try {
    const { sessionText } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ message: 'AI not configured' });

    const payload = {
      contents: [{ role: 'user', parts: [{ text: `Reflect on this conversation warmly. Respond ONLY as a JSON object (no markdown, no backticks) with exactly these keys: summary, reflection, groundingLine. transcript: ${sessionText}` }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
    };

    const geminiRes = await callGemini(apiKey, payload);
    const data = await geminiRes.json();
    let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    text = text.replace(/```json|```/g, '').trim();

    try { res.json(JSON.parse(text)); }
    catch {
      res.json({
        summary: 'We shared some meaningful thoughts today.',
        reflection: 'It takes courage to be open about how you feel.',
        groundingLine: 'Carry this peace into your evening.',
      });
    }
  } catch (err) {
    console.error('[AI] Summary error:', err);
    res.status(500).json({ message: 'Summary failed' });
  }
});

module.exports = router;

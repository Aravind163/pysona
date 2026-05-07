const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { buildSystemPrompt, CRISIS_KEYWORDS, CRISIS_RESPONSE } = require('../AI_RULES');

router.use(authMiddleware);

const GROQ_MODEL = 'llama-3.1-8b-instant';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const callGroq = async (apiKey, systemPrompt, history, userInput) => {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-16).map(h => ({
      role: h.role === 'model' ? 'assistant' : 'user',
      content: Array.isArray(h.parts) ? h.parts[0]?.text || '' : h.content || '',
    })),
    { role: 'user', content: userInput },
  ];

  return await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: 0.8,
      max_tokens: 300,
    }),
  });
};

// POST /api/ai/chat
router.post('/chat', async (req, res) => {
  try {
    const { userInput, history, onboardingData } = req.body;
    if (!userInput) return res.status(400).json({ message: 'userInput required' });

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(500).json({ message: 'GROQ_API_KEY not set in backend .env' });

    console.log('[AI] Using Groq | model:', GROQ_MODEL);

    const lower = userInput.toLowerCase();
    if (CRISIS_KEYWORDS.some(kw => lower.includes(kw))) {
      return res.json({ text: CRISIS_RESPONSE, isSafetyTriggered: true });
    }

    const personaName = onboardingData?.personaName || 'Pysona';
    const systemPrompt = buildSystemPrompt(personaName, onboardingData);

    const groqRes = await callGroq(apiKey, systemPrompt, history || [], userInput);

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      let errDetail = errText;
      try { errDetail = JSON.parse(errText)?.error?.message || errText; } catch {}
      console.error('[AI] Groq error:', groqRes.status, errDetail);
      return res.status(502).json({ message: 'AI error: ' + errDetail });
    }

    const data = await groqRes.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || "I'm here.";
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
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(500).json({ message: 'AI not configured' });

    const groqRes = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: 'You are a warm journaling assistant. Respond ONLY with a raw JSON object (no markdown, no backticks) with exactly these keys: summary, reflection, groundingLine. Each value should be one short, warm sentence.' },
          { role: 'user', content: `Reflect on this conversation: ${sessionText}` },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    const data = await groqRes.json();
    let text = data?.choices?.[0]?.message?.content?.trim() || '{}';
    text = text.replace(/```json|```/g, '').trim();

    try { res.json(JSON.parse(text)); }
    catch {
      res.json({
        summary: 'We shared some meaningful thoughts today.',
        reflection: 'It takes courage to open up.',
        groundingLine: 'Carry this peace with you.',
      });
    }
  } catch (err) {
    console.error('[AI] Summary error:', err);
    res.status(500).json({ message: 'Summary failed' });
  }
});

module.exports = router;
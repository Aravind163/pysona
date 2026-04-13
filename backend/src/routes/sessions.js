const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const CreditTransaction = require('../models/CreditTransaction');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

// All routes require auth
router.use(authMiddleware);

// GET /api/sessions - list user sessions
router.get('/', async (req, res) => {
  try {
    const sessions = await Session.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch sessions' });
  }
});

// GET /api/sessions/:id
router.get('/:id', async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, userId: req.user._id });
    if (!session) return res.status(404).json({ message: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch session' });
  }
});

// POST /api/sessions - save completed session (deducts 1 credit)
router.post('/', async (req, res) => {
  try {
    const user = req.user;
    const { durationSeconds, summary, reflection, groundingLine, inputMode } = req.body;

    // Check credits (1 credit per session)
    if (user.credits < 1) {
      return res.status(402).json({ message: 'Insufficient credits. Purchase more to continue.', credits: user.credits });
    }

    // Create session
    const session = await Session.create({
      userId: user._id,
      durationSeconds: durationSeconds || 0,
      summary: summary || '',
      reflection: reflection || '',
      groundingLine: groundingLine || '',
      creditsUsed: 1,
      inputMode: inputMode || 'voice',
    });

    // Deduct credit
    const newBalance = user.credits - 1;
    await User.findByIdAndUpdate(user._id, {
      $inc: { credits: -1, totalSessionsCount: 1 },
      lastActiveAt: new Date(),
    });

    await CreditTransaction.create({
      userId: user._id,
      type: 'deduct',
      amount: -1,
      description: 'Session completed',
      balanceAfter: newBalance,
      sessionId: session._id,
    });

    res.status(201).json({ session, creditsRemaining: newBalance });
  } catch (err) {
    console.error('Save session error:', err);
    res.status(500).json({ message: 'Failed to save session' });
  }
});

module.exports = router;

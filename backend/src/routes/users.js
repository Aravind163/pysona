const express = require('express');
const router = express.Router();
const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/users/me/credits
router.get('/me/credits', async (req, res) => {
  try {
    const transactions = await CreditTransaction.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json({ credits: req.user.credits, transactions });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch credits' });
  }
});

// POST /api/users/me/credits/purchase - simulate credit purchase (₹1 = 3 credits)
router.post('/me/credits/purchase', async (req, res) => {
  try {
    const { rupees } = req.body;
    if (!rupees || rupees < 1) return res.status(400).json({ message: 'Minimum ₹1 required' });

    const creditsToAdd = rupees * 3; // 3 credits per rupee
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { credits: creditsToAdd } },
      { new: true }
    );

    await CreditTransaction.create({
      userId: req.user._id,
      type: 'purchase',
      amount: creditsToAdd,
      description: `Purchased ${creditsToAdd} credits for ₹${rupees}`,
      rupeesCharged: rupees,
      balanceAfter: user.credits,
    });

    res.json({ credits: user.credits, added: creditsToAdd, message: `Added ${creditsToAdd} credits (₹${rupees})` });
  } catch (err) {
    res.status(500).json({ message: 'Purchase failed' });
  }
});

// PUT /api/users/me/onboarding
router.put('/me/onboarding', async (req, res) => {
  try {
    const { onboardingData } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { onboardingData, hasCompletedOnboarding: true },
      { new: true }
    );
    res.json({ hasCompletedOnboarding: true, onboardingData: user.onboardingData });
  } catch (err) {
    res.status(500).json({ message: 'Failed to save onboarding' });
  }
});

// PUT /api/users/me/consent
router.put('/me/consent', async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { consentGiven: true });
    res.json({ consentGiven: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to save consent' });
  }
});

module.exports = router;

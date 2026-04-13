const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Session = require('../models/Session');
const CreditTransaction = require('../models/CreditTransaction');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

router.use(authMiddleware, adminMiddleware);

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [totalUsers, totalSessions, revenueData] = await Promise.all([
      User.countDocuments(),
      Session.countDocuments(),
      CreditTransaction.aggregate([
        { $match: { type: 'purchase' } },
        { $group: { _id: null, total: { $sum: '$rupeesCharged' } } },
      ]),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sessionsToday = await Session.countDocuments({ createdAt: { $gte: today } });

    res.json({
      totalUsers,
      totalSessions,
      sessionsToday,
      revenueTotal: revenueData[0]?.total || 0,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const query = search ? { email: { $regex: search, $options: 'i' } } : {};
    const users = await User.find(query)
      .select('-otp -otpExpires')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const total = await User.countDocuments(query);
    res.json({ users, total, page: Number(page) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// PUT /api/admin/users/:id/block
router.put('/users/:id/block', async (req, res) => {
  try {
    const { blocked } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { isBlocked: blocked }, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: `User ${blocked ? 'blocked' : 'unblocked'}`, isBlocked: user.isBlocked });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update user' });
  }
});

// POST /api/admin/users/:id/grant-credits
router.post('/users/:id/grant-credits', async (req, res) => {
  try {
    const { credits } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $inc: { credits } },
      { new: true }
    );
    await CreditTransaction.create({
      userId: req.params.id,
      type: 'bonus',
      amount: credits,
      description: `Admin granted ${credits} credits`,
      balanceAfter: user.credits,
    });
    res.json({ message: `Granted ${credits} credits`, credits: user.credits });
  } catch (err) {
    res.status(500).json({ message: 'Failed to grant credits' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Session = require('../models/Session');
const CreditTransaction = require('../models/CreditTransaction');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { sendWelcomeEmail } = require('../services/emailService');

router.use(authMiddleware, adminMiddleware);

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [totalUsers, totalSessions, revenueData, pendingApprovals] = await Promise.all([
      User.countDocuments(),
      Session.countDocuments(),
      CreditTransaction.aggregate([
        { $match: { type: 'purchase' } },
        { $group: { _id: null, total: { $sum: '$rupeesCharged' } } },
      ]),
      User.countDocuments({ plan: 'FREE', isApproved: false, password: { $ne: null } }),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sessionsToday = await Session.countDocuments({ createdAt: { $gte: today } });

    res.json({
      totalUsers,
      totalSessions,
      sessionsToday,
      revenueTotal: revenueData[0]?.total || 0,
      pendingApprovals,
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', filter = 'all' } = req.query;
    let query = {};

    if (search) query.email = { $regex: search, $options: 'i' };
    if (filter === 'pending') {
      query.plan = 'FREE';
      query.isApproved = false;
      query.password = { $ne: null };
    }

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

// PUT /api/admin/users/:id/approve  — approve/revoke free user
router.put('/users/:id/approve', async (req, res) => {
  try {
    const { approved } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isApproved: approved },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Send welcome email when approved
    if (approved) {
      try { await sendWelcomeEmail(user.email, user.name || user.email); } catch (_) {}
    }

    res.json({ message: `User ${approved ? 'approved' : 'unapproved'}`, isApproved: user.isApproved });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update approval' });
  }
});

// PUT /api/admin/users/:id/block
router.put('/users/:id/block', async (req, res) => {
  try {
    const { blocked } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { isBlocked: blocked }, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: `User ${blocked ? 'banned' : 'unbanned'}`, isBlocked: user.isBlocked });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update user' });
  }
});

// PUT /api/admin/users/:id/plan  — change user plan
router.put('/users/:id/plan', async (req, res) => {
  try {
    const { plan } = req.body;
    if (!['FREE', 'STANDARD', 'PREMIUM'].includes(plan))
      return res.status(400).json({ message: 'Invalid plan' });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        plan,
        // Paid plans are auto-approved
        ...(plan !== 'FREE' ? { isApproved: true } : {}),
      },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: `Plan changed to ${plan}`, plan: user.plan });
  } catch (err) {
    res.status(500).json({ message: 'Failed to change plan' });
  }
});

// PUT /api/admin/users/:id/promote  — promote user to admin role
// NOTE: For persistence across server restarts, also add their email to ADMIN_EMAIL_2 in .env
router.put('/users/:id/promote', async (req, res) => {
  try {
    // Prevent self-demotion
    if (req.params.id === req.user._id.toString())
      return res.status(400).json({ message: 'Cannot change your own role' });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role: 'admin', isApproved: true },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    console.log(`[Admin] ${req.user.email} promoted ${user.email} to admin`);
    res.json({
      message: `${user.email} is now an admin. Add their email to ADMIN_EMAIL_2 in .env for persistence.`,
      role: user.role,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to promote user' });
  }
});

// POST /api/admin/users/:id/grant-credits
router.post('/users/:id/grant-credits', async (req, res) => {
  try {
    const { credits } = req.body;
    if (!credits || credits < 1 || credits > 10000)
      return res.status(400).json({ message: 'Credits must be between 1 and 10,000' });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $inc: { credits } },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found' });

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

// DELETE /api/admin/users/:id  — permanently delete a user and their data
router.delete('/users/:id', async (req, res) => {
  try {
    // Prevent self-deletion
    if (req.params.id === req.user._id.toString())
      return res.status(400).json({ message: 'Cannot delete your own account from admin panel' });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Don't delete other admins
    if (user.role === 'admin')
      return res.status(403).json({ message: 'Cannot delete another admin account' });

    // Delete all user data
    await Promise.all([
      User.findByIdAndDelete(req.params.id),
      Session.deleteMany({ userId: req.params.id }),
      CreditTransaction.deleteMany({ userId: req.params.id }),
    ]);

    console.log(`[Admin] ${req.user.email} deleted user: ${user.email}`);
    res.json({ message: `User ${user.email} and all their data have been deleted.` });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ message: 'Failed to delete user' });
  }
});

module.exports = router;

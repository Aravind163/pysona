const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Build admin emails list from env — filter out blank/undefined entries
const ADMIN_EMAILS = [
  process.env.ADMIN_EMAIL?.toLowerCase().trim(),
  process.env.ADMIN_EMAIL_2?.toLowerCase().trim(),
].filter(Boolean);

console.log('[Auth] Admin emails configured:', ADMIN_EMAILS);

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
      return res.status(401).json({ message: 'No token provided' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select('-otp -otpExpires');
    if (!user) return res.status(401).json({ message: 'User not found' });
    if (user.isBlocked) return res.status(403).json({ message: 'Account is blocked. Contact support.' });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const adminMiddleware = (req, res, next) => {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ message: 'Admin access required' });
  next();
};

// Checks if free user is approved (paid users always pass)
const approvalMiddleware = (req, res, next) => {
  const user = req.user;
  if (!user) return res.status(401).json({ message: 'Unauthorized' });

  // Admins and paid users always allowed
  if (user.role === 'admin' || user.plan !== 'FREE') return next();

  // Free users need approval
  if (!user.isApproved)
    return res.status(403).json({
      message: 'Your account is pending admin approval. You will receive an email once approved.',
    });

  next();
};

module.exports = { authMiddleware, adminMiddleware, approvalMiddleware, ADMIN_EMAILS };

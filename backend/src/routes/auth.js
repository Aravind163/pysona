const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { generateOTP, sendOTPEmail, sendForgotPasswordEmail, isEmailConfigured } = require('../services/emailService');
const { authMiddleware } = require('../middleware/auth');

const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const userPublicFields = (u) => ({
  id: u._id, email: u.email, name: u.name, avatar: u.avatar,
  role: u.role, plan: u.plan, credits: u.credits,
  hasCompletedOnboarding: u.hasCompletedOnboarding,
  onboardingData: u.onboardingData,
});

// ─── Step 1: Send OTP ──────────────────────────────────────────────────────────
router.post('/register/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ message: 'Valid email required' });

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing && existing.password)
      return res.status(409).json({ message: 'An account with this email already exists. Please sign in.' });

    const otp = generateOTP(); // 6-digit string e.g. "482931"
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    // Use findOneAndUpdate to avoid race conditions
    await User.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      { email: email.toLowerCase().trim(), otp: otp.toString(), otpExpires },
      { upsert: true, new: true }
    );

    await sendOTPEmail(email, otp);

    const devMode = !isEmailConfigured();
    console.log(`[AUTH] OTP for ${email}: ${otp} (devMode=${devMode})`);

    res.json({
      message: devMode
        ? `DEV MODE: Email not configured. OTP is shown below.`
        : `Verification code sent to ${email}`,
      ...(devMode && { devOtp: otp }),
    });
  } catch (err) {
    console.error('Register send-otp error:', err);
    res.status(500).json({ message: 'Failed to send code: ' + err.message });
  }
});

// ─── Step 2: Verify OTP + create account ──────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { email, otp, password } = req.body;

    if (!email || !otp || !password)
      return res.status(400).json({ message: 'Email, OTP and password are required' });
    if (password.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(404).json({ message: 'No verification pending for this email. Please request a new code.' });
    if (user.password) return res.status(409).json({ message: 'Account already exists. Please sign in.' });

    // Compare as strings, trimmed
    const storedOtp = (user.otp || '').toString().trim();
    const inputOtp = otp.toString().trim();

    console.log(`[AUTH] Register verify - stored: "${storedOtp}", input: "${inputOtp}"`);

    if (!storedOtp || storedOtp !== inputOtp)
      return res.status(401).json({ message: `Invalid verification code. Check the code and try again.` });
    if (user.otpExpires < new Date())
      return res.status(401).json({ message: 'Code expired. Please request a new one.' });

    user.password = password;
    user.otp = null;
    user.otpExpires = null;
    user.role = email.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase() ? 'admin' : 'user';
    user.lastActiveAt = new Date();
    await user.save();

    const token = generateToken(user._id);
    res.status(201).json({ token, user: userPublicFields(user) });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Registration failed: ' + err.message });
  }
});

// ─── Login ─────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !user.password)
      return res.status(401).json({ message: 'No account found with this email. Please register first.' });
    if (user.isBlocked)
      return res.status(403).json({ message: 'Account is blocked. Contact support.' });

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ message: 'Incorrect password. Please try again.' });

    user.lastActiveAt = new Date();
    await user.save();

    const token = generateToken(user._id);
    res.json({ token, user: userPublicFields(user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Login failed: ' + err.message });
  }
});

// ─── Forgot Password: Send OTP ─────────────────────────────────────────────────
router.post('/forgot-password/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !user.password) {
      return res.json({ message: `If an account exists, a code was sent to ${email}` });
    }

    const otp = generateOTP();
    user.otp = otp.toString();
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendForgotPasswordEmail(email, otp);
    console.log(`[AUTH] Forgot password OTP for ${email}: ${otp}`);

    const devMode = !isEmailConfigured();
    res.json({
      message: devMode ? 'DEV MODE: Check backend console for OTP.' : `Reset code sent to ${email}`,
      ...(devMode && { devOtp: otp }),
    });
  } catch (err) {
    console.error('Forgot password send-otp error:', err);
    res.status(500).json({ message: 'Failed to send reset code: ' + err.message });
  }
});

// ─── Forgot Password: Reset ────────────────────────────────────────────────────
router.post('/forgot-password/reset', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword)
      return res.status(400).json({ message: 'Email, OTP and new password are required' });
    if (newPassword.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(404).json({ message: 'Account not found' });

    const storedOtp = (user.otp || '').toString().trim();
    const inputOtp = otp.toString().trim();
    if (!storedOtp || storedOtp !== inputOtp)
      return res.status(401).json({ message: 'Invalid code' });
    if (user.otpExpires < new Date())
      return res.status(401).json({ message: 'Code expired. Request a new one.' });

    user.password = newPassword;
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    res.json({ message: 'Password reset successful. You can now sign in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Failed to reset password: ' + err.message });
  }
});

// ─── Get current user ──────────────────────────────────────────────────────────
router.get('/me', authMiddleware, (req, res) => {
  res.json(userPublicFields(req.user));
});

module.exports = router;

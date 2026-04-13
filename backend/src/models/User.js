const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: { type: String, default: null },
  googleId: { type: String, default: null },
  name: { type: String, default: '' },
  avatar: { type: String, default: '' },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },

  credits: { type: Number, default: 9 },
  plan: { type: String, enum: ['FREE', 'STANDARD', 'PREMIUM'], default: 'FREE' },
  consentGiven: { type: Boolean, default: false },
  hasCompletedOnboarding: { type: Boolean, default: false },

  onboardingData: {
    intent: String,
    style: String,
    tone: String,
    questionComfort: String,
    personaName: String,
    voiceName: String,
  },

  isBlocked: { type: Boolean, default: false },

  // OTP kept for backward compat
  otp: { type: String, default: null },
  otpExpires: { type: Date, default: null },

  totalSessionsCount: { type: Number, default: 0 },
  lastActiveAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare plain password with hash
userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', userSchema);

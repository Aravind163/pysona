const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  durationSeconds: { type: Number, default: 0 },
  summary: { type: String, default: '' },
  reflection: { type: String, default: '' },
  groundingLine: { type: String, default: '' },
  creditsUsed: { type: Number, default: 1 }, // 1 credit per session
  inputMode: { type: String, enum: ['text', 'voice', 'both'], default: 'voice' },
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);

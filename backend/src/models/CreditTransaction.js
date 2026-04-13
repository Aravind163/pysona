const mongoose = require('mongoose');

const creditTransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['purchase', 'deduct', 'refund', 'bonus'], required: true },
  amount: { type: Number, required: true }, // positive = added, negative = deducted
  description: { type: String, default: '' },
  // For purchases: 3 credits = ₹1
  rupeesCharged: { type: Number, default: 0 },
  balanceAfter: { type: Number, required: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', default: null },
  paymentId: { type: String, unique: true, sparse: true }, // Razorpay payment_id
  orderId:   { type: String, default: null },              // Razorpay order_id
}, { timestamps: true });

module.exports = mongoose.model('CreditTransaction', creditTransactionSchema);

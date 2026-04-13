const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

const PLAN_PACKAGES = {
  standard_500: { credits: 500, rupees: 166, planUpgrade: 'standard', label: 'Standard Plan – 500 Credits' },
  topup_100:    { credits: 100, rupees: 34,  planUpgrade: null,       label: '100 Credits Top-Up' },
  topup_300:    { credits: 300, rupees: 100, planUpgrade: null,       label: '300 Credits Top-Up' },
  topup_1000:   { credits: 1000,rupees: 334, planUpgrade: null,       label: '1000 Credits Top-Up' },
};

// POST /api/payment/create-order  – create Razorpay order
router.post('/create-order', async (req, res) => {
  try {
    const { packageId } = req.body;
    const pkg = PLAN_PACKAGES[packageId];
    if (!pkg) return res.status(400).json({ message: 'Invalid package' });

    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!razorpayKeyId || !razorpayKeySecret) {
      return res.status(500).json({ message: 'Payment gateway not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env' });
    }

    const amountPaise = pkg.rupees * 100; // Razorpay uses paise

    const orderPayload = {
      amount: amountPaise,
      currency: 'INR',
      receipt: `order_${req.user._id}_${Date.now()}`,
      notes: { userId: req.user._id.toString(), packageId, credits: pkg.credits },
    };

    const auth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64');
    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify(orderPayload),
    });

    if (!rzpRes.ok) {
      const err = await rzpRes.json();
      console.error('Razorpay create order error:', err);
      return res.status(502).json({ message: 'Payment gateway error', detail: err });
    }

    const order = await rzpRes.json();

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: razorpayKeyId,
      package: pkg,
    });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ message: 'Failed to create payment order' });
  }
});

// POST /api/payment/verify  – verify Razorpay payment signature & credit user
router.post('/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, packageId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !packageId) {
      return res.status(400).json({ message: 'Missing payment verification fields' });
    }

    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!razorpayKeySecret) return res.status(500).json({ message: 'Payment gateway not configured' });

    // Verify signature
    const expectedSig = crypto
      .createHmac('sha256', razorpayKeySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSig !== razorpay_signature) {
      console.error('Payment signature mismatch');
      return res.status(400).json({ message: 'Payment verification failed. Invalid signature.' });
    }

    // Prevent double-credit: check if this payment_id was already used
    const alreadyProcessed = await CreditTransaction.findOne({ paymentId: razorpay_payment_id });
    if (alreadyProcessed) {
      return res.status(409).json({ message: 'Payment already processed' });
    }

    const pkg = PLAN_PACKAGES[packageId];
    if (!pkg) return res.status(400).json({ message: 'Invalid package' });

    // Credit the user
    const updateFields = { $inc: { credits: pkg.credits } };
    if (pkg.planUpgrade) updateFields.$set = { plan: pkg.planUpgrade };

    const user = await User.findByIdAndUpdate(req.user._id, updateFields, { new: true });

    await CreditTransaction.create({
      userId: req.user._id,
      type: 'purchase',
      amount: pkg.credits,
      description: pkg.label,
      rupeesCharged: pkg.rupees,
      balanceAfter: user.credits,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
    });

    // Emit realtime credit update via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${req.user._id.toString()}`).emit('credits:update', { credits: user.credits });
    }

    res.json({
      success: true,
      credits: user.credits,
      plan: user.plan,
      message: `${pkg.credits} credits added successfully!`,
    });
  } catch (err) {
    console.error('Verify payment error:', err);
    res.status(500).json({ message: 'Payment verification failed' });
  }
});

module.exports = router;

const nodemailer = require('nodemailer');

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const isEmailConfigured = () => !!(process.env.GMAIL_USER && process.env.GMAIL_PASS);

const createTransporter = () => nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

const otpBlock = (otp) => `
  <div style="background:#F9FAFB;border-radius:24px;padding:32px;text-align:center;">
    <div style="font-size:48px;font-weight:900;letter-spacing:12px;color:#EF5900;background:#fff;padding:20px;border-radius:16px;display:inline-block;border:2px solid #FED7AA;">${otp}</div>
    <p style="color:#9CA3AF;font-size:13px;margin-top:24px;">This code expires in 10 minutes.</p>
  </div>
`;

const header = `
  <div style="text-align:center;margin-bottom:32px;">
    <h1 style="color:#EF5900;font-size:28px;font-weight:900;letter-spacing:-1px;margin:0;">Pysona</h1>
    <p style="color:#6B7280;font-size:12px;text-transform:uppercase;letter-spacing:0.2em;margin-top:4px;">AI-Guided Emotional Reflection</p>
  </div>
`;

const footer = `
  <p style="color:#D1D5DB;font-size:11px;text-align:center;margin-top:24px;text-transform:uppercase;letter-spacing:0.1em;">If you didn't request this, please ignore this email.</p>
`;

const wrap = (body) => `
  <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;background:#fff;">
    ${header}${body}${footer}
  </div>
`;

const sendOTPEmail = async (email, otp) => {
  if (!isEmailConfigured()) {
    console.log('\n┌─────────────────────────────────────┐');
    console.log(`│  📧 DEV MODE — OTP for ${email}`);
    console.log(`│  🔑 OTP: ${otp}`);
    console.log('│  (Set GMAIL_USER and GMAIL_PASS to send real emails)');
    console.log('└─────────────────────────────────────┘\n');
    return;
  }
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"Pysona" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'Verify your Pysona account',
    html: wrap(`
      <p style="color:#111827;font-size:16px;font-weight:600;text-align:center;margin-bottom:24px;">
        Your verification code is:
      </p>
      ${otpBlock(otp)}
    `),
  });
};

const sendForgotPasswordEmail = async (email, otp) => {
  if (!isEmailConfigured()) {
    console.log('\n┌─────────────────────────────────────┐');
    console.log(`│  📧 DEV MODE — Password reset OTP for ${email}`);
    console.log(`│  🔑 OTP: ${otp}`);
    console.log('└─────────────────────────────────────┘\n');
    return;
  }
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"Pysona" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'Reset your Pysona password',
    html: wrap(`
      <p style="color:#111827;font-size:16px;font-weight:600;text-align:center;margin-bottom:8px;">
        Password Reset Request
      </p>
      <p style="color:#6B7280;font-size:14px;text-align:center;margin-bottom:24px;">
        Use this code to reset your password:
      </p>
      ${otpBlock(otp)}
    `),
  });
};

// ─── Welcome email (sent when admin approves a free user) ──────────────────────
const sendWelcomeEmail = async (email, name) => {
  if (!isEmailConfigured()) {
    console.log(`[EMAIL] Welcome email would be sent to ${email}`);
    return;
  }
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"Pysona" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: '🎉 Welcome to Pysona — You\'re approved!',
    html: wrap(`
      <p style="color:#111827;font-size:20px;font-weight:900;text-align:center;margin-bottom:8px;">
        Welcome, ${name}! 🎉
      </p>
      <p style="color:#6B7280;font-size:15px;text-align:center;margin-bottom:28px;">
        Your Pysona account has been approved. You can now start your emotional wellness journey.
      </p>
      <div style="background:#FFF7ED;border-radius:20px;padding:24px;text-align:center;margin-bottom:24px;">
        <p style="color:#EF5900;font-size:32px;font-weight:900;margin:0;">9 Credits</p>
        <p style="color:#9CA3AF;font-size:13px;margin-top:8px;">Free to use — no payment needed to start</p>
      </div>
      <div style="text-align:center;">
        <a href="${process.env.FRONTEND_URL || 'https://pysona.vercel.app'}" 
           style="background:#EF5900;color:#fff;padding:14px 32px;border-radius:100px;text-decoration:none;font-weight:900;font-size:15px;display:inline-block;">
          Start Talking with Pysona →
        </a>
      </div>
      <p style="color:#9CA3AF;font-size:13px;text-align:center;margin-top:24px;">
        Pysona is your safe, non-judgmental space for emotional reflection. We're glad you're here.
      </p>
    `),
  });
};

// ─── Payment receipt email ──────────────────────────────────────────────────────
const sendPaymentReceiptEmail = async (email, name, plan, credits, amount, orderId) => {
  if (!isEmailConfigured()) {
    console.log(`[EMAIL] Payment receipt would be sent to ${email} for ₹${amount}`);
    return;
  }
  const transporter = createTransporter();
  const date = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  await transporter.sendMail({
    from: `"Pysona" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `Payment Confirmed — Pysona ${plan} Plan`,
    html: wrap(`
      <p style="color:#111827;font-size:18px;font-weight:900;text-align:center;margin-bottom:4px;">
        Payment Successful ✓
      </p>
      <p style="color:#6B7280;font-size:14px;text-align:center;margin-bottom:28px;">
        Thank you, ${name}! Your credits are ready to use.
      </p>

      <div style="background:#F9FAFB;border-radius:20px;padding:24px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;color:#6B7280;font-size:13px;">Date</td>
            <td style="padding:8px 0;color:#111827;font-size:13px;font-weight:600;text-align:right;">${date}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6B7280;font-size:13px;">Plan</td>
            <td style="padding:8px 0;color:#111827;font-size:13px;font-weight:600;text-align:right;">${plan}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6B7280;font-size:13px;">Credits Added</td>
            <td style="padding:8px 0;color:#EF5900;font-size:13px;font-weight:900;text-align:right;">+${credits} credits</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6B7280;font-size:13px;">Order ID</td>
            <td style="padding:8px 0;color:#9CA3AF;font-size:11px;text-align:right;">${orderId}</td>
          </tr>
          <tr style="border-top:2px solid #E5E7EB;">
            <td style="padding:12px 0;color:#111827;font-size:16px;font-weight:900;">Total Paid</td>
            <td style="padding:12px 0;color:#111827;font-size:16px;font-weight:900;text-align:right;">₹${amount}</td>
          </tr>
        </table>
      </div>

      <div style="text-align:center;">
        <a href="${process.env.FRONTEND_URL || 'https://pysona.vercel.app'}"
           style="background:#EF5900;color:#fff;padding:14px 32px;border-radius:100px;text-decoration:none;font-weight:900;font-size:15px;display:inline-block;">
          Start Your Session →
        </a>
      </div>
    `),
  });
};

module.exports = {
  generateOTP,
  sendOTPEmail,
  sendForgotPasswordEmail,
  sendWelcomeEmail,
  sendPaymentReceiptEmail,
  isEmailConfigured,
};

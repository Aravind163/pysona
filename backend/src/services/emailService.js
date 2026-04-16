const nodemailer = require('nodemailer');

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const isEmailConfigured = () => !!(process.env.BREVO_SMTP_USER && process.env.BREVO_SMTP_PASS);

const createTransporter = () => nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_SMTP_USER,
    pass: process.env.BREVO_SMTP_PASS,
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
    console.log('│  (Set BREVO_SMTP_USER and BREVO_SMTP_PASS to send real emails)');
    console.log('└─────────────────────────────────────┘\n');
    return;
  }
  const transporter = createTransporter();
  await transporter.sendMail({
    from: '"Pysona" <' + process.env.BREVO_SMTP_USER + '>',
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
    from: '"Pysona" <' + process.env.BREVO_SMTP_USER + '>',
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

module.exports = { generateOTP, sendOTPEmail, sendForgotPasswordEmail, isEmailConfigured };
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

const app = express();
const server = http.createServer(app);

// ✅ Allowed origins (ADD your domains here)
const allowedOrigins = [
  "http://localhost:5173",
  "https://pysona-l49a.vercel.app",
  "https://pysona-l49a-3xecm52tf-aravind163s-projects.vercel.app"
];

// ─── Socket.IO for realtime auth state ─────────────────────────────
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Socket auth middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('No token'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('email role credits isBlocked');
    if (!user || user.isBlocked) return next(new Error('Unauthorized'));
    socket.user = user;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.user._id.toString();
  socket.join(`user:${userId}`);
  console.log(`[WS] User connected: ${socket.user.email}`);

  // Emit real-time credit balance on connect
  socket.emit('credits:update', { credits: socket.user.credits });

  socket.on('disconnect', () => {
    console.log(`[WS] User disconnected: ${socket.user.email}`);
  });
});

// Export io so routes can use it
app.set('io', io);

// ─── Middleware ───────────────────────────────────────────────────

// ✅ FIXED CORS (supports multiple domains)
// ✅ Replace your existing CORS setup with this exact config

app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      "https://pysona-lilac.vercel.app",  // ← your exact Vercel URL
      "http://localhost:3000",             // for local dev
      "http://localhost:5173",             // if using Vite
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.options("*", cors());

app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.',
});
app.use('/api/', limiter);

// ─── Routes ───────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/users', require('./routes/users'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/payment', require('./routes/payment'));

// Health + root
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', time: new Date().toISOString() })
);

app.get("/", (req, res) => {
  res.send("API is running 🚀");
});

// ─── MongoDB ──────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URL)
  .then(() => console.log('[DB] MongoDB connected'))
  .catch((err) => console.error('[DB] Connection error:', err));

// ─── Start ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`[Server] Running on http://localhost:${PORT}`)
);

// Export for use in routes
module.exports = { io };
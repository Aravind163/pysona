# Pysona — Fullstack (Express + MongoDB)

> AI-Guided Emotional Reflection app with realtime Gmail login, Text+Voice input, and a credit system (3 credits = ₹1).

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite + TailwindCSS |
| Backend | Node.js + Express 4 |
| Database | MongoDB (Mongoose) |
| Auth | Email OTP (Gmail SMTP) + Google OAuth2 + JWT |
| Realtime | Socket.IO (live credit updates after each session) |
| AI | Google Gemini 2.0 Flash |
| Voice | Web Speech API (SpeechRecognition + SpeechSynthesis) |

---

## Credit System

- **3 credits = ₹1**
- Each session costs **1 credit**
- New users get **9 free credits** (3 free sessions)
- Credits can be topped up in Account → Top Up
- Admin can grant credits manually from the dashboard

---

## Project Structure

```
pysona-fullstack/
├── backend/
│   ├── src/
│   │   ├── index.js          # Express + Socket.IO server
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Session.js
│   │   │   └── CreditTransaction.js
│   │   ├── routes/
│   │   │   ├── auth.js       # OTP + Google OAuth
│   │   │   ├── sessions.js
│   │   │   ├── users.js      # credits, onboarding
│   │   │   └── admin.js
│   │   ├── middleware/
│   │   │   └── auth.js       # JWT + admin guard
│   │   └── services/
│   │       └── emailService.js
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── App.tsx            # Auth context + Socket setup
    │   ├── types.ts
    │   ├── constants.ts
    │   ├── lib/
    │   │   ├── api.ts         # Axios (in-memory JWT)
    │   │   └── socket.ts      # Socket.IO client
    │   ├── hooks/
    │   │   ├── useVoice.ts
    │   │   └── useToast.ts
    │   ├── services/
    │   │   └── geminiService.ts
    │   ├── features/
    │   │   ├── Auth/LoginScreen.tsx     # OTP + Google button
    │   │   ├── Home/SessionScreen.tsx   # Text + Voice toggle
    │   │   ├── Account/AccountScreen.tsx # Credits top-up
    │   │   ├── Admin/AdminDashboard.tsx  # Real data + block/grant
    │   │   └── ...
    │   └── components/
    ├── .env.example
    └── package.json
```

---

## Setup

### 1. Clone & install

```bash
# Backend
cd backend && npm install

# Frontend
cd frontend && npm install
```

### 2. Configure backend environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
MONGODB_URI=mongodb://localhost:27017/pysona
JWT_SECRET=change_this_to_something_long_and_random

# Gmail OTP — use an App Password, not your real Gmail password
EMAIL_USER=yourapp@gmail.com
EMAIL_PASS=your_16_char_app_password

# Google OAuth — create at console.cloud.google.com
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback

FRONTEND_URL=http://localhost:5173
ADMIN_EMAIL=bharath@gmail.com
```

### 3. Configure frontend environment

```bash
cp frontend/.env.example frontend/.env.local
```

Edit `frontend/.env.local`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_GEMINI_API_KEY=your_gemini_api_key
```

### 4. Set up Gmail OTP (nodemailer)

1. Go to your Google Account → Security → 2-Step Verification (enable it)
2. Then go to → App Passwords → Generate a new app password for "Mail"
3. Use that 16-character password as `EMAIL_PASS`

### 5. Set up Google OAuth

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → APIs & Services → Credentials → OAuth 2.0 Client ID
3. Application type: **Web application**
4. Authorized redirect URIs: `http://localhost:5000/api/auth/google/callback`
5. Copy Client ID and Secret to `.env`

### 6. Run

```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/send-otp` | Send OTP to email |
| POST | `/api/auth/verify-otp` | Verify OTP → JWT |
| GET | `/api/auth/google` | Get Google OAuth URL |
| GET | `/api/auth/google/callback` | Google OAuth callback |
| GET | `/api/auth/me` | Get current user (JWT required) |

### Sessions
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sessions` | List user sessions |
| GET | `/api/sessions/:id` | Get session detail |
| POST | `/api/sessions` | Save session (deducts 1 credit) |

### Users / Credits
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/users/me/credits` | Get balance + history |
| POST | `/api/users/me/credits/purchase` | Buy credits (₹1 = 3) |
| PUT | `/api/users/me/onboarding` | Save onboarding |
| PUT | `/api/users/me/consent` | Save consent |

### Admin (admin role required)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/stats` | Platform stats |
| GET | `/api/admin/users` | List all users |
| PUT | `/api/admin/users/:id/block` | Block/unblock user |
| POST | `/api/admin/users/:id/grant-credits` | Grant credits |

---

## Production Checklist

- [ ] Swap simulated credit purchase with **Razorpay** or **Stripe**
- [ ] Set strong `JWT_SECRET` in production env
- [ ] Add MongoDB Atlas URI for cloud DB
- [ ] Add HTTPS (reverse proxy via Nginx or Caddy)
- [ ] Update `GOOGLE_REDIRECT_URI` to production domain
- [ ] Rate limit OTP endpoint more aggressively in production
- [ ] Add Helmet.js for security headers

---

## Admin Access

The email set as `ADMIN_EMAIL` in `.env` automatically gets the `admin` role on first sign-in.

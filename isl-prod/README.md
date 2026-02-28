# 🤟 ISL Non-Manual Features Detector — v2.0

**Detection of Non-Manual Features in Indian Sign Language Sentences**

Production-grade full-stack CV + ML + NLP application.

---

## ✨ What's New in v2.0

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Auth**  | JWT + bcrypt | Register/Login/Guest tokens |
| **ML**    | sklearn RandomForest | NMF → grammatical label classification |
| **NLP**   | Rule-based ISL grammar | Sentence-level structure annotation |
| **Temporal** | Rolling buffer | Smooth live-stream predictions |
| **Cursor** | Custom JS particle cursor | Unique UX |
| **Rate limiting** | flask-limiter + Redis | Production safety |
| **Multi-worker** | gunicorn + gevent | High concurrency, thread-safe MediaPipe |
| **Docker** | Compose + nginx | One-command production deploy |

---

## 🚀 Quick Start

### Local Development (no Docker)

**Requirements:** Python 3.9+ · Node.js 16+

```bash
cd isl-nmf-detector-v2
chmod +x start.sh
./start.sh
```
**Windows:** double-click `start.bat`

Opens at: **http://localhost:3000**

---

### Docker (Production)

```bash
cp .env.example .env
# Edit .env — set SECRET_KEY and JWT_SECRET

docker compose up --build
```
Opens at: **http://localhost**

---

## 🏗️ Architecture

```
isl-nmf-detector/
├── backend/
│   ├── app.py                    # Flask application factory
│   ├── config.py                 # Environment-driven config
│   ├── gunicorn.conf.py          # Production server config
│   ├── api/
│   │   ├── auth.py               # JWT register/login/refresh
│   │   ├── detect.py             # Detection endpoints
│   │   └── analytics.py         # Stats, history, glossary
│   ├── core/
│   │   ├── nmf_detector.py       # MediaPipe FaceMesh, thread-safe
│   │   └── ml_pipeline.py        # sklearn RF + ISL NLP analyzer
│   ├── models/
│   │   └── db.py                 # SQLAlchemy ORM
│   └── utils/
│       └── validators.py
├── frontend/
│   └── src/
│       ├── App.jsx               # Root + auth gate
│       ├── pages/LoginPage.jsx   # Animated login/register
│       ├── components/
│       │   ├── Dashboard.jsx     # Main layout
│       │   ├── ImagePanel.jsx    # Upload + landmark overlay
│       │   ├── LivePanel.jsx     # Webcam streaming
│       │   ├── AnalyticsPanel.jsx# Stats + demo + history
│       │   ├── GlossaryPanel.jsx # NMF reference
│       │   ├── CustomCursor.jsx  # Particle cursor
│       │   └── UI.jsx            # Shared components
│       ├── store/authStore.js    # Zustand auth state
│       └── utils/api.js          # Axios + auto-refresh
├── nginx/nginx.conf              # Reverse proxy + rate limits
├── docker-compose.yml
├── .env.example
└── start.sh / start.bat
```

---

## 🧠 ML / NLP Pipeline

### 1. MediaPipe FaceMesh (CV)
- 468 facial landmarks at sub-pixel accuracy
- Thread-local instances per gunicorn worker (no contention)
- 15 NMF metrics computed per frame

### 2. NMF Classifier (ML — sklearn)
- 14 rule-based grammar rules with weighted voting
- RandomForest secondary classifier (trained on synthetic ISL-aligned data)
- Outputs top-5 grammatical labels with confidence scores

### 3. ISL Sentence NLP
- Rule-based ISL grammar annotation (no transformer needed for NMF grammar)
- Temporal rolling buffer for live-stream smoothing (8-frame window)
- Produces: sentence structure, grammatical tags, natural language summary

### 4. Temporal Smoothing
- `TemporalBuffer` averages feature scores over last 8 frames
- Eliminates prediction flicker during live camera use

---

## 🌐 API Reference

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/health` | GET | No | Backend status |
| `/api/demo` | GET | No | Synthetic demo result |
| `/api/auth/register` | POST | No | Create account |
| `/api/auth/login` | POST | No | Get JWT tokens |
| `/api/auth/refresh` | POST | Refresh token | New access token |
| `/api/auth/guest` | POST | No | Short-lived guest token |
| `/api/auth/me` | GET | Yes | Current user |
| `/api/detect/image` | POST | Optional | Analyze image |
| `/api/detect/stream` | POST | Optional | Analyze webcam frame |
| `/api/analytics/history` | GET | Yes | Recent analyses |
| `/api/analytics/stats` | GET | Yes | Aggregate stats |
| `/api/analytics/glossary` | GET | No | NMF + grammar reference |

---

## ⚙️ Configuration

All config via environment variables (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | (required) | Flask secret |
| `JWT_SECRET` | (required) | JWT signing key |
| `DATABASE_URL` | sqlite | SQLite or PostgreSQL |
| `REDIS_ENABLED` | false | Enable Redis rate limiting |
| `WORKERS` | 4 | Gunicorn worker count |
| `RATE_LIMIT_DETECT` | 60/min | Per-IP detection limit |

---

## 🔒 Security Features

- Passwords hashed with bcrypt (cost=12)
- JWT access tokens (24h) + refresh tokens (30d)
- Auto-refresh on token expiry (transparent to user)
- Rate limiting: 300/hour global, 60/min detect, 10/min auth
- Nginx: X-Frame-Options DENY, nosniff, XSS protection
- Request size limits (10MB)
- Thread-safe MediaPipe (no shared state across workers)
- SQL injection protection via SQLAlchemy ORM

---

## 📚 References

- Zeshan, U. (2004). *Hand, head and face: Negative constructions in sign languages*. Linguistics, 42(3).
- Raghavan et al. (2020). *Non-Manual Markers in Indian Sign Language*. LREC 2020.
- MediaPipe FaceMesh — https://mediapipe.dev/solutions/face_mesh
- scikit-learn — https://scikit-learn.org

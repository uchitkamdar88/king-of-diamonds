# ♢ KING OF DIAMONDS

Real-time multiplayer **beauty-contest / number strategy** game — *where strategy crowns the worthy*.

Server-authoritative Socket.IO gameplay, Google OAuth, PostgreSQL + Prisma, React + Vite client.

---

## Architecture

```text
Browser (Vercel)
   │  REST auth + Socket.IO
   ▼
Node.js API / WebSocket server (Render / Railway / Fly.io / VPS)
   │
   ▼
PostgreSQL (Prisma)
```

**Important:** Vercel hosts the **frontend only**. Long-lived WebSockets do **not** run in standard Vercel serverless functions. Deploy the `server/` package to a persistent Node host.

Each game room has **isolated in-memory state**. The socket layer is structured so a Redis adapter can be added later for horizontal scale.

---

## Stack

| Layer | Tech |
|------|------|
| Client | React 19, Vite, TypeScript, Tailwind CSS 4, Framer Motion, Zustand, Socket.IO client |
| Server | Node.js, Express, Socket.IO, TypeScript |
| Auth | Google OAuth (ID token + redirect), express-session |
| DB | PostgreSQL + Prisma |

---

## Folder structure

```text
king-of-diamonds/
├── client/                 # Vite React app (deploy to Vercel)
├── server/                 # Authoritative game + WebSocket API
├── shared/                 # Shared TypeScript types & constants
├── prisma/                 # Prisma schema
├── docker-compose.yml      # Local Postgres
├── .env.example
└── README.md
```

---

## Prerequisites

- Node.js **20+**
- npm **10+**
- Docker (recommended) **or** a local PostgreSQL 16 instance
- Google Cloud OAuth credentials (for real Google login)

---

## Quick start (local)

### 1. Install

```bash
cd "king-of-diamonds"
npm install
```

### 2. Environment

```bash
cp .env.example .env
```

The repo also ships a ready local `.env` with `DEV_AUTH=true` for multiplayer testing without Google.

### 3. Database

```bash
docker compose up -d
npx prisma db push
npx prisma generate
```

If PostgreSQL is not available, the server still boots with an **in-memory user/game store** so you can test multiplayer immediately (`DEV_AUTH=true`). Stats will not persist until Postgres is connected.

### 4. Run

```bash
npm run dev
```

- Client: http://localhost:5173  
- Server: http://localhost:3001  
- Health: http://localhost:3001/health  

---

## Google OAuth setup

This project uses **server-side Google OAuth** (Express + `google-auth-library`), **not Supabase**.

1. Open [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Authorized JavaScript origins:
   - `http://localhost:5173`
   - your production Vercel URL (`https://…`)
4. Authorized redirect URIs (**API host**, not Vercel):
   - `http://localhost:3001/auth/google/callback`
   - `https://YOUR_API_HOST/auth/google/callback`
5. Put values in root `.env` **and** `client/.env`:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
VITE_GOOGLE_CLIENT_ID=...   # same client id only — never the secret
VITE_SERVER_URL=http://localhost:3001
CLIENT_URL=http://localhost:5173
SERVER_URL=http://localhost:3001
```

Flow:

```text
Continue with Google
  → GET /auth/google (API)
  → Google account picker
  → GET /auth/google/callback (API sets session cookie)
  → redirect CLIENT_URL/auth/callback
  → client loads /auth/me → Profile
```

**Never** put `GOOGLE_CLIENT_SECRET` in the client or Vercel frontend env.

### Dev auth (local multiplayer without Google)

```env
DEV_AUTH=true
```

Shows Dev Player buttons only when enabled. Forced off when `NODE_ENV=production`.

---

## Game flow

```text
Intro → Rules → Google Login → Profile → Lobby
  ├── Play Now → Matchmaking → Room/Arena
  ├── Create Room → Room Lobby → Arena
  └── Join Room → Room Lobby → Arena
```

### Rules (server-authoritative)

- Choose `0–100` secretly
- Target = average × `0.8` (final round: **King's Decree** × `0.7`)
- Closest valid choice wins the round; others −1
- At **−10** → eliminated
- Rounds 4–6: **Duplicate Penalty**
- Rounds 7–9: **Perfect Target**
- AI: Rational / Chaotic / Mirror (server-side only)

---

## Multiplayer testing checklist

Before release, with `npm run dev` running:

```bash
npm test
npm run smoke
```

The smoke suite verifies health, session login/logout, room create/join, secret choices, server-authored winners, and build artifacts.

Manual checklist:

1. Browser A → Dev Player 1 → Create Room
2. Browser B (incognito) → Dev Player 2 → Join with code
3. Confirm lobby sync, ready, host start, countdown
4. Lock numbers → secret until calculation → same winner on both clients
5. Refresh mid-game → reconnect within grace period

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Shared watch + API + Vite |
| `npm run build` | Production build all packages |
| `npm test` | Game engine / AI unit tests |
| `npm run smoke` | Live API + multiplayer + auth integration smoke (needs `npm run dev`) |
| `npm run db:push` | Push Prisma schema |
| `npm run db:migrate` | Create migrations |
| `npm run db:studio` | Prisma Studio |

---

## Environment variables

See `.env.example`.

| Variable | Where | Purpose |
|----------|-------|---------|
| `DATABASE_URL` | Server | Postgres connection |
| `GOOGLE_CLIENT_ID` | Server | OAuth |
| `GOOGLE_CLIENT_SECRET` | Server | OAuth |
| `SESSION_SECRET` | Server | Cookie signing |
| `CLIENT_URL` | Server | CORS + redirects |
| `SERVER_URL` | Server | OAuth callback base |
| `VITE_SERVER_URL` | Client | API / Socket origin (empty = same-origin / Vite proxy) |
| `VITE_GOOGLE_CLIENT_ID` | Client | Google Identity button |
| `MATCHMAKING_TIMEOUT_MS` | Server | AI fill timeout |
| `CHOICE_TIME_MS` | Server | Round timer |
| `RECONNECT_GRACE_MS` | Server | Disconnect grace |
| `DEV_AUTH` | Server | Local test login |

---

## Deployment

### Frontend → Vercel

1. Import the repo in Vercel
2. **Root Directory:** `client`
3. Build: `npm run build` (from client) — or set root to monorepo and:
   - Install: `npm install` (from repo root)
   - Build: `npm run build -w shared && npm run build -w client`
   - Output: `client/dist`
4. Env:
   - `VITE_SERVER_URL=https://YOUR_API_HOST`
   - `VITE_GOOGLE_CLIENT_ID=...`
5. `client/vercel.json` rewrites SPA routes to `index.html`

### Backend → Render / Railway / Fly / VPS

Deploy a **persistent** Node process (not serverless):

```bash
npm install
npx prisma generate
npx prisma migrate deploy   # or prisma db push
npm run build -w shared
npm run build -w server
npm run start -w server
```

Set production env vars (`DATABASE_URL`, Google, `SESSION_SECRET`, `CLIENT_URL`, `SERVER_URL`, `DEV_AUTH=false`).

Cookie note: production sessions use `sameSite=none; secure=true` so the Vercel origin can talk to the API over HTTPS with credentials.

Update Google OAuth origins/redirects for production URLs.

### PostgreSQL

Use Neon, Supabase, Railway Postgres, or Render Postgres. Point `DATABASE_URL` at it and run:

```bash
npx prisma db push
# or
npx prisma migrate deploy
```

---

## Testing

```bash
npm test
```

Covers average/target math, ties, duplicate penalty, perfect hit, scoring, elimination, placements, and AI range checks.

---

## Production considerations

- Prefer a Redis-backed session store and Socket.IO Redis adapter when running multiple server instances
- Keep `SESSION_SECRET` long and random
- Disable `DEV_AUTH` in production
- Rate-limit auth endpoints at the reverse proxy if exposed publicly
- Monitor `/health`
- Room state is in-memory — a process restart ends active matches (persist only completed games to Postgres)

---

## Verification checklist

- [ ] Google login (or Dev auth) creates session + profile
- [ ] Play Now / Create / Join all work
- [ ] Two browsers share one room in real time
- [ ] Choices stay secret until calculation
- [ ] Target / winner / scores / elimination are server-driven
- [ ] AI fills seats when configured
- [ ] Reconnect restores mid-game membership
- [ ] Mobile layout usable for slider + numpad
- [ ] Client builds on Vercel; API runs on persistent host

---

## License

**King of Diamonds** is an original independent project.

Inspired by the *Alice in Borderland* King of Diamonds **concept** only — original UI, art direction, and implementation. No copyrighted assets.

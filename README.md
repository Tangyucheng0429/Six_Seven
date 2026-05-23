# SIX7 Bill Splitter System
Hackathon X: FinTech Forward 2026

## Overview
**SIX7 Bill Splitter System** is a real-time, room-based bill-splitting platform that lets a Host upload a receipt, automatically extract every line item with AI-powered OCR, let members join via invite link, choose what they ate (or split equally), upload payment proof, and let the Host verify each payment — all with automatic email reminders when the due date passes.

## Problem Statement
Splitting bills manually is slow, error-prone, and awkward. Groups commonly struggle with:
- Calculating each person's share (especially with SST + service charge).
- Tracking who has paid and who has not.
- Chasing unpaid members after the meal is over.
- Sen-level rounding errors that don't add back to the receipt total.

## Solution
Six Seven solves this end-to-end:
- The Host uploads a receipt photo → **GPT-4o Structured Outputs** OCR parses subtotal, tax, service charge, and every line item.
- Members join a 5-character room code or invite link with one tap.
- Two split modes: **EQUAL** (auto-divided across all participants) or **ITEM_BASED** (each member ticks their own items).
- Proportional SST + Service Charge is applied per item, with a **Sen-Rounding Absorber** that guarantees `Σ amount_to_pay = receipt.total_amount` exactly.
- Members upload payment proof (e.g. DuitNow / TNG / Bank screenshot); the Host approves each one.
- An hourly cron sweep emails the Host a detailed summary of unpaid members once the due date elapses.
- Supabase Realtime pushes every change to the Vue 3 dashboard instantly — no refresh needed.

## Key Features
- Receipt photo upload (Vercel-safe RAM upload, no local disk)
- AI OCR bill recognition (OpenAI GPT-4o `json_schema` mode)
- Equal split with automatic re-calculation as members join
- Item-based split with row-level item assignment
- Invitation link / 5-character room code join
- DuitNow QR / Bank Transfer / TNG QR payment method setup
- Payment proof upload (screenshot)
- Host payment verification with auto room-completion
- Hourly cron + Vercel-Cron webhook for overdue reminders
- Transactional reminder emails via Resend SMTP
- Supabase Realtime sync for dashboard, balances, and assignments
- Bill history for both Hosts and Members
- HttpOnly cookie-based anonymous identity (no signup required)

## Project Structure
```text
SixSeven/
├── be/                          Back-End (Node.js + Express + Supabase)
│   ├── src/
│   │   ├── app.js               Express bootstrap, CORS, error handler, cron init
│   │   ├── routes/              /api/{rooms,receipts,bills,payments,cron}
│   │   ├── controllers/         bill / payment / receipt / room controllers
│   │   ├── services/            calc, cron, notify, ocr
│   │   ├── middleware/          auth (Bearer + cookie), upload (Multer memory)
│   │   ├── jobs/                cronSweep.js (Vercel Cron wrapper)
│   │   ├── config/              supabase.js, openai.js (+ .mock variants)
│   │   ├── utils/               mailer, emailTemplates, helpers, equalSplit, ...
│   │   └── tests/               testConnection, test_flow, test_integration, test_real_ocr
│   ├── supabase/migrations/     PostgreSQL DDL, RPC functions, RLS, Realtime
│   ├── Mock_data/               Sample receipt images for OCR testing
│   ├── README_API.md            Full backend architectural spec
│   ├── .env.example             Backend env template
│   └── package.json
│
├── fe/                          Front-End (Vue 3 + Vite + Tailwind v4)
│   ├── src/
│   │   ├── App.vue              Root + global error boundary
│   │   ├── main.js              App entry
│   │   ├── router/index.js      Vue Router (host/member flow guards)
│   │   ├── views/               14 screens (Home, Create, Upload, Scan, Review,
│   │   │                        Split-Mode, Payment-Setup, HostDashboard,
│   │   │                        Join, Assign, MemberPay, MemberDone, History, ...)
│   │   ├── components/
│   │   │   ├── bill/            AmountSummary, BillMenuList, InviteLinkBox, ...
│   │   │   ├── layout/          AppShell, FlowNavBar, FlowProgress
│   │   │   └── ui/              Neo-brutalist UI kit (Button, Card, Input, ...)
│   │   ├── composables/         useRoomApi, useRoomState, useHostCookie,
│   │   │                        useShareInvite, useMyBills, useDueDate, ...
│   │   ├── api/client.js        Fetch wrapper (credentials: include)
│   │   ├── constants/           flows.js, items.js
│   │   ├── styles/neo.css       Neo-brutalist theme tokens
│   │   └── utils/               copyToClipboard, ...
│   ├── public/                  favicon.svg, icons.svg
│   ├── dist/                    Production build output (vite build)
│   ├── vite.config.js           Vue + Tailwind v4 plugin
│   ├── .env.example             FE env template (VITE_API_URL)
│   └── package.json
│
│
├── .gitignore
└── README.md
```

## Tech Stack

### Frontend
- **Vue 3** (`^3.5`) with `<script setup>` Composition API
- **Vue Router** (`^5.0.7`) with route guards for host/member flow
- **Vite 8** (`^8.0.12`) — dev server + production build
- **Tailwind CSS v4** (`@tailwindcss/vite`) — utility-first styling
- Custom **Neo-brutalist UI kit** (`fe/src/components/ui`)

### Backend
- **Node.js v18+** (ES Modules, `"type": "module"`)
- **Express.js** (`^4.19`) REST API
- **Multer** memory storage (Vercel-safe RAM uploads)
- **node-cron** hourly scheduler + Vercel Cron webhook
- **Nodemailer** + **Resend** SMTP transport for emails
- **ws** for WebSocket support
- **dotenv** for env management
- **nodemon** for dev hot-reload

### Database & Storage
- **Supabase PostgreSQL** with Row Level Security (RLS) on every table
- **Supabase Realtime** publication on `bill_rooms`, `participant_bills`, `item_assignments`
- **Supabase Storage** buckets:
  - `receipts/` — uploaded receipt images
  - `qrcodes/` — Host payment QR codes (publicly readable)
  - `proofs/` — member payment screenshots
- Atomic SQL RPCs for assignment + bill calculation (`assign_items_and_calculate`)

### AI / OCR
- **OpenAI GPT-4o** with **Structured Outputs** (`json_schema` mode) for deterministic receipt parsing

### Deployment
- **PM2** process manager (`sixseven-api`)
- **Nginx** reverse proxy
- Optional **Vercel Cron** for `/api/cron/check-due`

## Installation

### Prerequisites
- Node.js ≥ 18
- A Supabase project (URL + anon key + service-role key)
- An OpenAI API key (GPT-4o access)
- A Resend API key (for overdue email reminders)

### 1. Clone & Install
```bash
git clone <repo-url> SixSeven
cd SixSeven
```

### 2. Back-End
```bash
cd be
cp .env.example .env       # Fill in SUPABASE_*, OPENAI_API_KEY, RESEND_API_KEY
npm install
npm run dev                # nodemon, runs on PORT (default 3000)
```

Run the DB migrations once against your Supabase project:
```bash
# In Supabase SQL editor, run files in order:
be/supabase/migrations/20260523000000_init_schema.sql
be/supabase/migrations/20260524120000_equal_split_headcount.sql
```

Sanity-check the DB connection:
```bash
npm run test:db
```

### 3. Front-End
```bash
cd ../fe
cp .env.example .env       # VITE_API_URL=http://localhost:3000
npm install
npm run dev                # Vite dev server on http://localhost:5173
```

### 4. Production Build (FE)
```bash
cd fe
npm run build              # → fe/dist/
npm run preview            # local preview of the build
```

## Environment Variables

### Back-End (`be/.env`)
```env
# Server
PORT=3000
FRONTEND_URL=http://localhost:5173       # required for CORS + cookies

# Supabase (Dashboard → Settings → API)
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<anon-jwt>
SUPABASE_SERVICE_ROLE_KEY=<service-role-jwt>

# OpenAI (GPT-4o)
OPENAI_API_KEY=sk-...

# Email (Resend SMTP)
RESEND_API_KEY=re_...
# RESEND_USE_VERIFIED_DOMAIN=true
```

### Front-End (`fe/.env`)
```env
VITE_API_URL=http://localhost:3000
```

**Never commit `.env` files.** Service-role keys grant full DB access and must stay server-side only.

## API Overview
All endpoints are prefixed with `/api`. Auth is cookie-or-Bearer based; anonymous identities are auto-issued via HttpOnly cookies on first request. See `be/README_API.md` for the full spec.

| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| `POST` | `/api/rooms/create` | Host creates a new bill room (returns `room_code`, sets `host_id` cookie) |
| `POST` | `/api/rooms/join` | Guest joins by `room_code` (sets `user_id` cookie, triggers EQUAL re-split) |
| `POST` | `/api/receipts/upload` | Host uploads receipt; GPT-4o OCR populates items |
| `PUT`  | `/api/receipts/verify` | Host adjusts OCR results & confirms |
| `POST` | `/api/bills/config-split` | Host sets `EQUAL`/`ITEM_BASED` + payment method (+ QR upload) |
| `POST` | `/api/bills/assign-items` | Member toggles which items they ate (atomic RPC) |
| `POST` | `/api/payments/submit-proof` | Member uploads payment screenshot → `PAID` |
| `POST` | `/api/payments/verify-member` | Host approves a member → `VERIFIED` (auto-closes room when all verified) |
| `POST` | `/api/cron/check-due` | Vercel-Cron webhook to sweep overdue rooms and email Hosts |

Health check: `GET /` returns `{ status: 'healthy', timestamp }`.

## Database Schema
PostgreSQL DDL, RLS policies, atomic RPCs, and Realtime publication setup are versioned under:
```text
be/supabase/migrations/
├── 20260523000000_init_schema.sql               Tables, RLS, RPC, Realtime
└── 20260524120000_equal_split_headcount.sql     Dynamic EQUAL split recalculation
```

Core tables: `users`, `bill_rooms`, `receipts`, `receipt_items`, `item_assignments`, `participant_bills`.

## Frontend Flows

### Host Flow
`Home → Create Room → Upload Receipt → Scan (OCR) → Review → Split Mode → Payment Setup → Host Dashboard`

The dashboard subscribes to Supabase Realtime so members joining, assigning items, paying, and being verified all push updates instantly. Once every member is `VERIFIED`, the room flips to `COMPLETED` automatically.

### Member Flow
`Join (via link or code) → Assign Items (or skip if EQUAL) → Pay (upload proof) → Done`

Members and Hosts can both visit `/history` to see all rooms they've participated in.

## Concurrency & Rounding
Bill calculation runs entirely inside PostgreSQL RPCs with `FOR UPDATE` row locks for transaction isolation. A **Sen-Rounding Absorber** (Host if participating, else the last active selector) absorbs sub-cent residuals so that `Σ amount_to_pay ≡ receipt.total_amount` exactly. See `be/README_API.md` § *Concurrency & Rounding Error Mathematical Model* for the formulas.

## Background Jobs
- **`be/src/services/cron.service.js`** — `node-cron` schedule `'0 * * * *'` (hourly on the hour). Scans `ACTIVE` rooms with `due_date <= NOW()`, gathers `PENDING`/`PAID` participants, and emails the Host a per-member breakdown.
- **`be/src/jobs/cronSweep.js`** — Vercel-Cron-compatible webhook wrapper invoked by `POST /api/cron/check-due` (fire-and-forget, returns immediately).

## Deployment

### One-shot server deploy
The repo ships with a deployment script for a Linux VPS running PM2 + Nginx:
```bash
bash ~/Six_Seven/scripts/deploy.sh
```

It performs:
1. `git fetch && git reset --hard origin/main`
2. `npm install --omit=dev` in `be/`
3. `VITE_API_URL=$SITE npm run build` in `fe/`
4. `pm2 restart sixseven-api` (or `pm2 start be/src/app.js --name sixseven-api`)
5. `pm2 save` and `sudo systemctl reload nginx`

Override defaults with env vars:
```bash
APP_DIR=/srv/sixseven SITE_URL=https://your.domain bash scripts/deploy.sh
```

## Testing
Scripts under `be/src/tests/`:
- `testConnection.js` — verify Supabase credentials (`npm run test:db`)
- `test_flow.js` — happy-path room → receipt → split → pay
- `test_integration.js` — end-to-end integration check
- `test_real_ocr.js` — calls real OpenAI with a sample image

## AI Tools Used
- **ChatGPT** — planning, scaffolding, and development assistance
- **OpenAI GPT-4o** (Structured Outputs) — production receipt OCR engine

## Team
**Team Name:** Six Seven

Hackathon X: FinTech Forward 2026

# SixSeven Frontend

Neo-Brutalism bill splitter — Vue 3 + Tailwind CSS + vue-router.

## Run

```bash
cd fe && npm install && npm run dev
```

## UI flow

### Home (`/`)

- **Create bill room** → host flow (cookie set on create, no login)
- **Enter room number** → `/enter-room` → join when bill is open
- **Host history** → `/history` (only if host cookie exists)

### Host

| Step | Route | Action |
|------|-------|--------|
| 1 | `/create` | Bill name, host name, **email**, **due date** |
| 2 | `/room/:id/upload` | Upload receipt |
| 3 | `/room/:id/scan` | OCR / AI (mock) |
| 4 | `/room/:id/split-mode` | Equal or Item-based split |
| 5 | `/room/:id/review` | Verify line items |
| 6 | `/room/:id/payment-setup` | Payment method + QR |
| 7 | `/room/:id` | Room number + invite link, confirm payments, save to host history |

Router resumes incomplete setup if host opens the wrong step. After **due date**, unpaid balance triggers **email to host** (mock alert on dashboard).

### Member (no login)

| Step | Route | Action |
|------|-------|--------|
| 1 | `/join/:token?room=:id` or `/enter-room` | Enter name |
| 2 | `/room/:id/assign` | Pick items *(skip if Equal)* |
| 3 | `/room/:id/pay` | Pay + upload proof |
| 4 | `/room/:id/done` | Wait for host confirm |

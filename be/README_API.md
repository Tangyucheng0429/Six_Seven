# Six 7 Bill Splitter Backend System - Complete Architectural Specification

This document consolidates and serves as the single source of truth for the complete backend architecture, API endpoints catalog, asynchronous processes, database schemas, Row Level Security (RLS) rules, and real-time synchronization flows.

---

## 🏗️ Technical Stack & Framework
- **Core Environment**: Node.js (v18+), ES Modules (`"type": "module"`)
- **Web Framework**: Express.js
- **Database Client & Security**: Supabase JS SDK (Admin Bypass & Client API), Row Level Security (RLS) policies
- **AI Processing**: OpenAI NodeJS SDK (GPT-4o OCR Engine utilizing Structured Outputs `json_schema` mode)
- **File Uploads**: Multer Memory Storage (zero local disk footprint to prevent serverless Vercel crashes)
- **Background Jobs**: Node-Cron + Webhook endpoints for Vercel Cron integration
- **Email Notifications**: Nodemailer (Resend SMTP Transport)

---

## 📁 Repository Directory Map
- `be/src/app.js` - Express main initialization, CORS credentials handling, error middleware.
- `be/src/routes/index.js` - Consolidated API router.
- `be/src/routes/room.routes.js` - Room allocation routes.
- `be/src/routes/receipt.routes.js` - OCR parser and receipt adjustments routes.
- `be/src/routes/bill.routes.js` - Bill configurations and item selector routes.
- `be/src/routes/payment.routes.js` - Payment proof and verification status-machine routes.
- `be/src/routes/cron.routes.js` - Webhook sweeps.
- `be/src/controllers/` - Route implementations containing parameter validations, identity locking.
- `be/src/middleware/auth.js` - requireAuth middleware parsing Bearer Tokens and browser cookies dynamically.
- `be/src/middleware/upload.js` - Vercel-safe RAM upload filter middleware.
- `be/src/services/calc.service.js` - Direct RPC boundary to database computation procedures.
- `be/src/services/ocr.service.js` - OpenAI Structured Outputs receipt image extractor.
- `be/src/services/cron.service.js` - Periodic overdue bills scanner.
- `be/src/jobs/cronSweep.js` - Vercel Cron webhook wrapper.
- `be/supabase/migrations/` - PostgreSQL DDL, atomic transactional procedures, and RLS policies.

---

## 🛢️ PostgreSQL Database Schema & Realtime Replication

The system is designed with strict PostgreSQL DDL rules inside Supabase. 

### 1. Schema Tables

| Table Name | Primary Key | Foreign Keys | Key Fields & Types |
| :--- | :--- | :--- | :--- |
| `public.users` | `user_id UUID` | `auth.users(id)` | `nickname VARCHAR`, `is_host BOOLEAN` |
| `public.bill_rooms` | `room_id UUID` | `users(user_id)` | `room_code VARCHAR`, `host_email VARCHAR`, `split_mode VARCHAR(50)`, `status VARCHAR(20)` |
| `public.receipts` | `receipt_id UUID` | `bill_rooms(room_id)` | `image_url TEXT`, `subtotal NUMERIC`, `tax_amount NUMERIC`, `service_charge NUMERIC`, `total_amount NUMERIC` |
| `public.receipt_items` | `item_id UUID` | `receipts(receipt_id)` | `item_name VARCHAR`, `price NUMERIC`, `quantity INT` |
| `public.item_assignments` | `assignment_id` | `receipt_items`, `users` | **Unique composite key** `(item_id, user_id)` |
| `public.participant_bills` | `bill_id` | `bill_rooms`, `users` | `amount_to_pay NUMERIC`, `payment_status VARCHAR`, `proof_image_url TEXT` |

### 2. Live Supabase Realtime Replication (WebSocket Publication)
To ensure the Vue 3 frontend immediately syncs room dashboards and balances as changes occur, the following tables are actively bound to the `supabase_realtime` publication:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.bill_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.participant_bills;
ALTER PUBLICATION supabase_realtime ADD TABLE public.item_assignments;
```

---

## 🔒 Row Level Security (RLS) Policies
All database tables have `ALTER TABLE ENABLE ROW LEVEL SECURITY` activated.

- **`users` Policies**:
  - `SELECT`: Readable by the user themselves or by members sharing a room with them (via security definer helper `share_room(uid1, uid2)`).
  - `INSERT` / `UPDATE`: Restricted only to the profile owner (`auth.uid() = user_id`).
- **`bill_rooms` Policies**:
  - `SELECT`: Readable by the room Host or any registered participant (via security helper `is_room_member(room_id, uid)`).
  - `INSERT`: Allowed if the registered host matches the requester (`host_id = auth.uid()`).
  - `UPDATE`: Restricted solely to the Host (`host_id = auth.uid()`).
- **`receipts` / `receipt_items` Policies**:
  - `SELECT`: Viewable by room hosts and registered participants.
  - `INSERT` / `UPDATE` / `DELETE`: Strictly restricted to the room Host.
- **`item_assignments` Policies**:
  - `SELECT`: Viewable by all room participants.
  - `INSERT` / `DELETE`: Restricted strictly to the participant themselves (`user_id = auth.uid()`).
- **`participant_bills` Policies**:
  - `SELECT`: Viewable by the participant themselves or the room Host.
  - `INSERT`: Restricted to the participant themselves.
  - `UPDATE`: Allowed for the participant (status shifts) or the room Host (payment verifications).

---

## 🚀 REST API Endpoints Catalog

All endpoints are mounted under the `/api` prefix.

### 1. Room Management Router (`/api/rooms`)

#### `POST /create` — Create Bill Room
- **Auth**: Optional. If Bearer header or cookies (`host_id`) exist, they are reused. If not, implicitly registers a new anonymous auth profile in `auth.users` to maintain database foreign keys.
- **Body Inputs**:
  ```json
  {
    "host_email": "host@email.com",
    "due_date": "2026-05-30T10:00:00Z",
    "nickname": "Host Nickname (Optional)"
  }
  ```
- **Execution Flow**:
  1. Validates inputs, ensuring email format is valid and `due_date` resides in the future.
  2. Runs a high-concurrency safe 5-attempt collision defense loop to generate a unique 5-character alphanumeric `room_code`.
  3. Resolves/registers Host ID, upserts public `users` profile.
  4. Inserts `bill_rooms` record (default `split_mode: 'EQUAL'`, `status: 'ACTIVE'`).
  5. Binds Host as the first room participant in `participant_bills` (defaults `payment_status: 'VERIFIED'`, `amount_to_pay: 0.00`).
  6. Returns an HttpOnly Cookie `host_id` to the client.
- **Success Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "room_id": "ROOM_UUID",
    "room_code": "GYGHR",
    "host_id": "HOST_UUID",
    "data": { "room_id": "ROOM_UUID", "room_code": "GYGHR", "status": "ACTIVE", "due_date": "..." }
  }
  ```

#### `POST /join` — Anonymous Join Room
- **Auth**: Optional (requireAuth removed to support guest visitors). Looks for session headers or existing cookies. If none exist, registers a new anonymous auth profile.
- **Body Inputs**:
  ```json
  {
    "room_code": "GYGHR",
    "nickname": "Guest Nickname"
  }
  ```
- **Execution Flow**:
  1. Locates room by code (returns 404 if missing or 400 if room is `'COMPLETED'`).
  2. Resolves/registers guest identity `resolvedUserId`.
  3. Upserts public `users` profile.
  4. Inserts guest in `participant_bills` with status `'PENDING'` (or `'VERIFIED'` if Host). Ignores duplicate requests via `onConflict`.
  5. Returns an HttpOnly Cookie `user_id` to the client.
  6. **Dynamic EQUAL Recalculation**: Calls `calculateBill(room_id)` to automatically divide the total bill across $N+1$ active participants immediately, preventing host-only bill concentration.
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "room_id": "ROOM_UUID",
    "user_id": "GUEST_UUID"
  }
  ```

---

### 2. Receipt Management Router (`/api/receipts`)

#### `POST /upload` — Upload Receipt & Run AI OCR
- **Auth**: Required (`requireAuth`). Enforces Multer memory storage.
- **Body Inputs**: `room_id` (Text), `file` (Multipart Form attachment)
- **Execution Flow**:
  1. Checks if the room exists and is active.
  2. Uploads the buffer to the Supabase Storage `'receipts'` bucket.
  3. Passes the image public URL to **OpenAI GPT-4o with Structured Outputs (`json_schema` mode)** to extract subtotal, tax_amount, service_charge, total_amount, and food items.
  4. Saves results in `receipts` and performs bulk insert into `receipt_items`.
  5. Triggers `calculateBill(room_id)` to re-balance room bills.
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "receipt_id": "RECEIPT_UUID",
    "subtotal": 100.00,
    "tax_amount": 6.00,
    "service_charge": 10.00,
    "total_amount": 116.00,
    "items": [
      { "item_name": "Chicken Rice", "price": 20.00, "quantity": 2 },
      { "item_name": "Teh Tarik", "price": 5.00, "quantity": 2 }
    ]
  }
  ```

#### `PUT /verify` — Host Confirms & Adjusts OCR Selections
- **Auth**: Required (`requireAuth`). Confirms Host ownership.
- **Body Inputs**:
  ```json
  {
    "receipt_id": "RECEIPT_UUID",
    "subtotal": 95.00,
    "tax_amount": 5.70,
    "service_charge": 9.50,
    "total_amount": 110.20,
    "items": [
      { "item_name": "Chicken Rice", "price": 19.00, "quantity": 2 }
    ]
  }
  ```
- **Execution Flow**:
  1. Updates the `receipts` record with adjusted values and marks `is_verified: true`.
  2. Purges old receipt items and bulk inserts the verified items list.
  3. Triggers calculation syncing via `calculateBill(room_id)`.
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true
  }
  ```

---

### 3. Billing & Selections Router (`/api/bills`)

#### `POST /config-split` — Set Payout and Split Mode
- **Auth**: Required (`requireAuth`). Enforces a strict Host identity lock (returns `403` for non-hosts).
- **Body Inputs**:
  - `room_id` (Text)
  - `split_mode` (Text: `'EQUAL'` or `'ITEM_BASED'`)
  - `payment_method_type` (Text: `'DUITNOW_QR'`, `'BANK_TRANSFER'`, or `'TNG_QR'`)
  - `payment_method_detail` (Text: detail e.g., bank ID, phone)
  - `qr_code_file` (Optional Multipart Form attachment)
- **Execution Flow**:
  1. Validates ENUM ranges for split mode and payment method types.
  2. Bypasses dynamic storage bucket check, stream-uploads `qr_code_file` directly to the static publicly readable `'qrcodes'` bucket.
  3. Writes public URL and configuration parameters to `bill_rooms`.
  4. Triggers `calculateBill(room_id)` to re-split amounts.
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Split settings configured successfully."
  }
  ```

#### `POST /assign-items` — Toggle Food Item Selections (ITEM_BASED)
- **Auth**: Required (`requireAuth`). Extracts operator identity safely from session `req.user.id`.
- **Body Inputs**:
  ```json
  {
    "room_id": "ROOM_UUID",
    "selected_item_ids": ["ITEM_UUID_1", "ITEM_UUID_2"]
  }
  ```
- **Execution Flow**:
  1. Confirms the room is ACTIVE.
  2. Invokes database RPC transactional function `assign_items_and_calculate`.
  3. Database locks the room row (`FOR UPDATE`), purges the user's old selections, inserts the new ones, recalculates individual SST + Service Charge divisions, and balances rounding仙级误差.
  4. Queries the updated participant bill and returns it.
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "amount_to_pay": 63.80
  }
  ```

---

### 4. Payments & Settlements Router (`/api/payments`)

#### `POST /submit-proof` — Member Submits Payment Proof
- **Auth**: Required (`requireAuth`). Extracts operator identity safely from session `req.user.id`.
- **Body Inputs**: `room_id` (Text), `proof_file` (Multipart Form screenshot)
- **Execution Flow**:
  1. Asserts that the participant's bill exists.
  2. Bypasses dynamic bucket check, stream-uploads `proof_file` directly to the static `'proofs'` bucket.
  3. Saves public URL in `participant_bills.proof_image_url` and shifts `payment_status` to `'PAID'`.
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "payment_status": "PAID",
    "proof_image_url": "https://..."
  }
  ```

#### `POST /verify-member` — Host Approves Payment
- **Auth**: Required (`requireAuth`). Confirms Host ownership (returns `403` for non-hosts).
- **Body Inputs**:
  ```json
  {
    "room_id": "ROOM_UUID",
    "member_user_id": "MEMBER_UUID"
  }
  ```
- **Execution Flow**:
  1. Asserts room is active.
  2. Updates member status to `'VERIFIED'`.
  3. Performs an atomic check across all room bills. If **all** participants are verified, automatically closes the room: updates `bill_rooms.status = 'COMPLETED'`.
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "payment_status": "VERIFIED",
    "room_status": "COMPLETED" // Or 'ACTIVE' if some members are still outstanding
  }
  ```

---

### 5. Webhook sweep Router (`/api/cron`)

#### `POST /check-due` — Trigger Overdue Reminders Sweep
- **Auth**: Accessible by Vercel Cron.
- **Execution Flow**:
  1. Spawns background process `checkDueRoomsAndNotify()` (fire-and-forget to prevent timeouts).
  2. Returns immediate confirmation.
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Overdue room sweep initiated in background successfully."
  }
  ```

---

## ⚙️ Asynchronous & Background Services

### 1. Cron Overdue Sweeper (`be/src/services/cron.service.js` & `be/src/jobs/cronSweep.js`)
- **Schedule**: Standard scheduling runs hourly on the hour (`'0 * * * *'`). Can also be invoked manually or via Vercel Cron trigger at `/api/cron/check-due`.
- **Flow**:
  1. Scans `bill_rooms` for rooms where `status = 'ACTIVE'` and `due_date <= NOW()`.
  2. Fetches all bills for each overdue room.
  3. Gathers participants who are still `'PENDING'` or `'PAID'`.
  4. If everyone is already verified, it automatically completes the room and skips notifications.
  5. If there are outstanding participants, it compiles a detailed summary list showing nicknames and specific amounts to pay.
  6. Dispatches a transaction email using SMTP transport directly to the Room Host's email (`host_email`).

---

## 📈 Concurrency & Rounding Error Mathematical Model

The calculation of bills occurs securely within PostgreSQL database procedures to ensure transaction isolation and high performance.

### 1. Proportional SST (6%) & Service Charge (10%) Tax Coefficient
$$\text{Tax Rate} = \frac{\text{Receipt.tax\_amount} + \text{Receipt.service\_charge}}{\text{Receipt.subtotal}}$$

### 2. Proportional Item Price Distribution
If item $I$ has price $P_I$ and quantity $Q_I$, and is selected by $M_I$ members:
$$\text{Item\_Share\_Subtotal}_I = \frac{P_I \times Q_I}{M_I}$$

### 3. Proportional Billing
$$\text{ParticipantBill.amount\_to\_pay} = \text{ROUND}\left( \sum_{I \in \text{Selected}} \text{Item\_Share\_Subtotal}_I \times (1 + \text{Tax Rate}), 2 \right)$$

### 4. Sen-Rounding Absorber Formula
To prevent fractions of a sen from accumulating and leaking, a participant who is actively sharing is selected as the **Absorber** (Priority: Host if participating, else the last active selector).
$$\text{Absorber.amount\_to\_pay} = \text{Receipt.total\_amount} - \sum_{U \neq \text{Absorber}} \text{Amount\_To\_Pay}_U$$
This guarantees that **$\sum \text{amount\_to\_pay} \equiv \text{Receipt.total\_amount}$** exactly, ensuring **zero sen leakage**.

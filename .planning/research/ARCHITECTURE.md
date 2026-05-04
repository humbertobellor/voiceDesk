# Architecture Patterns

**Project:** VoiceDesk — AI Phone Receptionist for Home-Service Contractors
**Researched:** 2026-05-03
**Confidence note:** WebSearch and WebFetch were unavailable during this session. All findings are from training knowledge (cutoff August 2025) on Retell AI, Twilio, Supabase, Next.js, Google Calendar API, and Stripe. Confidence levels are noted per section. Verify Retell webhook event names and payload shapes against live docs before implementation.

---

## Recommended Architecture

### System Component Diagram (ASCII)

```
  CALLER
    │ dials contractor's forwarded number
    ▼
┌─────────────┐
│   TWILIO    │  Phone number ($1/mo)
│  (PSTN GW)  │  SIP/WebRTC bridge
└──────┬──────┘
       │ routes inbound call (SIP REFER or direct)
       ▼
┌─────────────────────┐
│     RETELL AI       │  Voice AI engine
│  (Agent Runtime)    │  STT → LLM → TTS pipeline
│                     │  Custom LLM endpoint (optional)
└──────┬──────────────┘
       │
       ├─── call_started webhook ──────────────────┐
       ├─── transcript_update webhook (live) ──────┤
       └─── call_ended webhook (+ full transcript) ┤
                                                   ▼
                                        ┌──────────────────────┐
                                        │  NEXT.JS API ROUTES  │
                                        │  (Vercel serverless) │
                                        │                      │
                                        │  /api/webhooks/      │
                                        │    retell            │
                                        └──────┬───────────────┘
                                               │
                       ┌───────────────────────┼──────────────────────┐
                       ▼                       ▼                      ▼
              ┌────────────────┐    ┌──────────────────┐   ┌──────────────────┐
              │   SUPABASE     │    │  GOOGLE CALENDAR  │   │  NOTIFICATION    │
              │  (Postgres +   │    │  API (OAuth 2.0)  │   │  DISPATCHER      │
              │   Auth +       │    │  book appointment │   │                  │
              │   Storage +    │    └──────────────────┘   │  Twilio SMS      │
              │   Realtime)    │                            │  Twilio WhatsApp │
              └──────┬─────────┘                           │  Telegram Bot    │
                     │                                     └──────────────────┘
                     │ Supabase Realtime (change events)
                     ▼
              ┌────────────────────────────────┐
              │  NEXT.JS PORTAL (Vercel)        │
              │  Contractor Admin UI            │
              │  - Call log + recordings        │
              │  - Lead details                 │
              │  - Agent configuration          │
              │  - Onboarding flow              │
              └────────────────────────────────┘
                     │
              ┌──────┴───────┐
              │   STRIPE     │  Subscription billing
              │  (Billing)   │  webhook → activate/suspend
              └──────────────┘
```

---

## 1. Call Flow Architecture

**Confidence: MEDIUM** — Retell + Twilio integration pattern is well-documented in training data; exact Retell webhook names need verification against current docs.

### Sequence

```
1. Contractor forwards their existing number to a Twilio number assigned by VoiceDesk.
2. Twilio receives inbound PSTN call.
3. Twilio TwiML (or Retell's Twilio SDK helper) hands the call off to Retell via SIP or WebSocket.
4. Retell agent handles the conversation (STT → LLM → TTS loop).
5. During call: Retell fires `call_started` webhook to /api/webhooks/retell.
6. During call (optional): Retell fires incremental `transcript_update` events.
7. Call ends: Retell fires `call_ended` webhook with full transcript, duration, recording URL.
8. Webhook handler writes call record to Supabase.
9. Webhook handler classifies outcome (lead / emergency / no-action) from transcript/metadata.
10. If lead → create lead row, trigger Google Calendar booking.
11. If emergency → trigger notification dispatcher immediately (before DB write returns).
12. Supabase Realtime broadcasts row-insert event to any open portal sessions.
```

### Latency Considerations

- Retell is chosen specifically for lower end-to-end voice latency versus Vapi. Do not introduce latency in the webhook path — the webhook fires asynchronously after call events and does not sit in the voice path.
- Keep the webhook handler fast. For any slow work (Calendar API, notification dispatch), write to Supabase immediately then kick off async processing. On Vercel serverless, use `waitUntil()` from the `@vercel/functions` package to run post-response work without blocking the 200 OK back to Retell.
- Twilio SIP routing to Retell adds ~50–150ms overhead over direct PSTN; acceptable for voice AI.

### Twilio → Retell Connection

Two modes exist:
- **Retell manages the Twilio number directly** (recommended for v1): Retell provides a Twilio integration where you link your Twilio account; Retell provisions/manages the TwiML app automatically. Simplest path.
- **Custom TwiML**: You control the TwiML, forward to Retell's SIP endpoint. More control, more maintenance.

For v1, use Retell's native Twilio integration. The contractor gets a Twilio number provisioned via Retell's dashboard or API; the contractor forwards their number to it.

---

## 2. Webhook Reliability

**Confidence: MEDIUM** — General webhook reliability patterns are well-established; Retell-specific retry behavior needs verification.

### Core Problem

Retell fires webhooks via HTTP POST to your Vercel serverless URL. Vercel cold starts, network blips, or handler exceptions can cause missed events. Retell's retry policy (if any) needs to be confirmed in their docs, but assume "at-most-once" delivery unless documented otherwise.

### Recommended Reliability Pattern

```
Webhook arrives at /api/webhooks/retell
    │
    ├── 1. Verify Retell signature header (HMAC) — reject forgeries immediately
    │
    ├── 2. Write raw payload to `webhook_events` table (Supabase) — idempotency log
    │       (call_id + event_type = unique key; INSERT OR IGNORE)
    │
    ├── 3. Return HTTP 200 immediately — do not wait for downstream work
    │
    └── 4. Use Vercel `waitUntil()` to run:
            ├── Upsert call record into `calls` table
            ├── Classify intent from transcript
            ├── If lead → insert lead row → Google Calendar booking
            └── If emergency → dispatch notifications
```

**Idempotency key:** `(call_id, event_type)` — if Retell retries, the `INSERT OR IGNORE` on `webhook_events` prevents double-processing.

**Dead-letter strategy:** If `waitUntil()` work fails, the `webhook_events` row remains unprocessed. A scheduled Supabase cron (pg_cron, via Supabase Edge Functions on a timer) can sweep for unprocessed events older than 2 minutes and reprocess. This is a v2 concern; for v1 with 20–30 contractors, manual retry via admin is acceptable.

### Webhook Signature Verification

Retell signs webhook payloads. Verify the `X-Retell-Signature` header using your Retell API secret before any processing. Reject with 401 otherwise.

---

## 3. Database Schema

**Confidence: HIGH** — Standard SaaS multi-tenant relational patterns; derived directly from stated requirements.

### Core Tables

```sql
-- Contractors (tenants)
CREATE TABLE contractors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  phone_number  TEXT,                    -- their existing number (for display)
  twilio_number TEXT,                    -- VoiceDesk-assigned number
  stripe_customer_id    TEXT,
  stripe_subscription_id TEXT,
  subscription_status   TEXT DEFAULT 'trialing', -- trialing|active|past_due|canceled
  subscription_tier     TEXT DEFAULT 'starter',  -- starter|pro|enterprise
  timezone      TEXT DEFAULT 'America/New_York',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Agent configuration (one per contractor for v1)
CREATE TABLE agents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id   UUID REFERENCES contractors(id) ON DELETE CASCADE,
  retell_agent_id TEXT NOT NULL,         -- Retell's agent ID
  agent_name      TEXT DEFAULT 'VoiceDesk',
  business_hours  JSONB,                 -- { mon: {open:'08:00', close:'17:00'}, ... }
  services        TEXT[],                -- ['HVAC repair','AC install',...]
  emergency_keywords TEXT[],             -- ['no heat','flood','gas leak',...]
  after_hours_message TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Raw call records
CREATE TABLE calls (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id   UUID REFERENCES contractors(id) ON DELETE CASCADE,
  retell_call_id  TEXT UNIQUE NOT NULL,
  caller_phone    TEXT,
  twilio_number   TEXT,
  status          TEXT DEFAULT 'in_progress', -- in_progress|completed|failed
  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  duration_seconds INT,
  recording_url   TEXT,
  transcript      JSONB,                 -- full transcript array [{speaker, text, timestamp}]
  intent          TEXT,                  -- lead|emergency|info|no_action|unknown
  raw_metadata    JSONB,                 -- full Retell payload for debugging
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Qualified leads
CREATE TABLE leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id   UUID REFERENCES contractors(id) ON DELETE CASCADE,
  call_id         UUID REFERENCES calls(id),
  caller_name     TEXT,
  caller_phone    TEXT NOT NULL,
  service_requested TEXT,
  urgency         TEXT DEFAULT 'normal',  -- normal|urgent|emergency
  preferred_time  TEXT,                   -- free-text from caller
  notes           TEXT,                   -- AI summary of call
  status          TEXT DEFAULT 'new',     -- new|contacted|booked|lost
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Calendar bookings
CREATE TABLE bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id   UUID REFERENCES contractors(id) ON DELETE CASCADE,
  lead_id         UUID REFERENCES leads(id),
  google_event_id TEXT,
  calendar_id     TEXT,
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ NOT NULL,
  title           TEXT,
  description     TEXT,
  status          TEXT DEFAULT 'confirmed', -- confirmed|cancelled|rescheduled
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Google Calendar OAuth tokens (per contractor)
CREATE TABLE calendar_credentials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id   UUID REFERENCES contractors(id) ON DELETE CASCADE UNIQUE,
  access_token    TEXT NOT NULL,         -- store encrypted; see note below
  refresh_token   TEXT NOT NULL,         -- long-lived; encrypt at rest
  token_expiry    TIMESTAMPTZ NOT NULL,
  calendar_id     TEXT DEFAULT 'primary',
  scope           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook event idempotency log
CREATE TABLE webhook_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source          TEXT NOT NULL,         -- 'retell' | 'stripe' | 'twilio'
  event_type      TEXT NOT NULL,
  external_id     TEXT NOT NULL,         -- call_id or Stripe event_id
  payload         JSONB NOT NULL,
  processed       BOOLEAN DEFAULT FALSE,
  processed_at    TIMESTAMPTZ,
  error           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source, event_type, external_id)  -- idempotency key
);

-- Notification delivery log
CREATE TABLE notification_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id   UUID REFERENCES contractors(id) ON DELETE CASCADE,
  call_id         UUID REFERENCES calls(id),
  channel         TEXT NOT NULL,         -- sms|whatsapp|telegram
  recipient       TEXT NOT NULL,         -- phone or chat_id
  message         TEXT,
  status          TEXT DEFAULT 'pending', -- pending|sent|failed
  sent_at         TIMESTAMPTZ,
  error           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Contractor notification preferences
CREATE TABLE notification_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id   UUID REFERENCES contractors(id) ON DELETE CASCADE UNIQUE,
  sms_number      TEXT,
  whatsapp_number TEXT,
  telegram_chat_id TEXT,
  notify_on_lead       BOOLEAN DEFAULT TRUE,
  notify_on_emergency  BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Key Indexes

```sql
CREATE INDEX idx_calls_contractor_id ON calls(contractor_id);
CREATE INDEX idx_calls_started_at ON calls(started_at DESC);
CREATE INDEX idx_calls_intent ON calls(intent);
CREATE INDEX idx_leads_contractor_id ON leads(contractor_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed) WHERE processed = FALSE;
```

### Row-Level Security (RLS)

Enable RLS on every table. Core policy pattern:

```sql
-- contractors: user sees only their own row
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;
CREATE POLICY contractors_own ON contractors
  USING (user_id = auth.uid());

-- All other tables: scoped via contractor_id join
CREATE POLICY calls_own ON calls
  USING (contractor_id IN (
    SELECT id FROM contractors WHERE user_id = auth.uid()
  ));
-- (same pattern for leads, bookings, agents, etc.)
```

Service-role key (used in serverless API routes only) bypasses RLS — never expose it to the browser.

---

## 4. Real-Time Updates to the Portal

**Confidence: HIGH** — Supabase Realtime is purpose-built for this use case and works natively with Next.js.

### Recommended: Supabase Realtime (Postgres Changes)

Supabase Realtime broadcasts row-level change events (`INSERT`, `UPDATE`, `DELETE`) over a WebSocket channel to subscribed clients. This is the simplest real-time path given the stack.

```typescript
// In the portal (React component)
const supabase = createClientComponentClient();

useEffect(() => {
  const channel = supabase
    .channel('contractor-calls')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'calls',
        filter: `contractor_id=eq.${contractorId}`,
      },
      (payload) => {
        // New call arrived — update local state
        setCalls((prev) => [payload.new, ...prev]);
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [contractorId]);
```

### Why Not SSE

SSE (Server-Sent Events) from Next.js API routes would require maintaining a long-lived connection in Vercel serverless — serverless functions have a max execution time and are not suited for persistent connections. Supabase Realtime handles the WebSocket layer and is outside Vercel's execution limits. Use Supabase Realtime.

### Portal Data Loading Strategy

- **Initial load:** Server-side fetch (Next.js `fetch` with service role or `createServerComponentClient`) for call log, leads, agent config.
- **Live updates:** Supabase Realtime client subscription for new events after page load.
- This hybrid avoids the cost of re-fetching all data on every new call while keeping the UI fresh.

---

## 5. Google Calendar OAuth Token Storage

**Confidence: HIGH** — Google OAuth 2.0 patterns are stable and well-documented.

### Flow

```
1. Contractor clicks "Connect Google Calendar" in portal.
2. Next.js API route (/api/oauth/google/start) generates OAuth URL with:
   - scope: https://www.googleapis.com/auth/calendar.events
   - access_type: offline   ← required to get refresh_token
   - prompt: consent        ← forces refresh_token on every auth (important for re-auth)
   - state: signed JWT with contractor_id (CSRF protection)
3. Contractor is redirected to Google consent screen.
4. Google redirects back to /api/oauth/google/callback with `code`.
5. Exchange code for tokens (access_token, refresh_token, expiry).
6. Store tokens in `calendar_credentials` table, encrypted at rest.
7. Return contractor to portal — Calendar connected.
```

### Token Refresh Pattern

The `access_token` expires in 1 hour. The `refresh_token` is long-lived (until revoked).

```typescript
// In the webhook handler, before any Calendar API call:
async function getValidAccessToken(contractorId: string): Promise<string> {
  const cred = await supabase
    .from('calendar_credentials')
    .select('*')
    .eq('contractor_id', contractorId)
    .single();

  const isExpired = new Date(cred.token_expiry) <= new Date(Date.now() + 60_000); // 60s buffer

  if (!isExpired) return cred.access_token;

  // Refresh
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: cred.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const { access_token, expires_in } = await response.json();
  const newExpiry = new Date(Date.now() + expires_in * 1000);

  await supabase
    .from('calendar_credentials')
    .update({ access_token, token_expiry: newExpiry.toISOString() })
    .eq('contractor_id', contractorId);

  return access_token;
}
```

### Encryption at Rest

Supabase Postgres does not encrypt individual columns by default. For `access_token` and `refresh_token`:
- **Option A (recommended for v1):** Use `pgcrypto` extension with `pgp_sym_encrypt` / `pgp_sym_decrypt` and a server-side encryption key stored in Supabase Vault (available on Supabase Pro) or as an environment variable. This keeps crypto in the DB layer.
- **Option B:** Encrypt/decrypt in the application layer (Next.js API route) using Node.js `crypto` before writing to Supabase. Simpler for v1 with no Vault dependency.

For v1 at 20–30 contractors, Option B (app-layer AES-256-GCM) is simpler and avoids Vault dependency. Use a `OAUTH_ENCRYPTION_KEY` environment variable stored in Vercel.

### CSRF Protection

The `state` parameter in the OAuth flow must be a short-lived signed value (JWT with 10-minute expiry) containing `contractor_id`. Verify on callback before accepting the code.

---

## 6. Notification Dispatch Architecture

**Confidence: MEDIUM** — Twilio SDK patterns are stable; Telegram Bot API is stable; WhatsApp via Twilio is well-documented. Delivery ordering and failure handling patterns are general best practices.

### Channels and Libraries

| Channel | Provider | Library |
|---------|----------|---------|
| SMS | Twilio | `twilio` npm package |
| WhatsApp | Twilio (WhatsApp Business API) | `twilio` npm package (same client, different `to:` prefix: `whatsapp:+1...`) |
| Telegram | Telegram Bot API | `node-telegram-bot-api` or direct `fetch` to Bot API |

### Dispatch Flow

```
call_ended webhook received
    │
    ├── Intent = "emergency"
    │       └── Dispatch immediately (before writing call record)
    │           ├── SMS via Twilio
    │           ├── WhatsApp via Twilio
    │           └── Telegram via Bot API
    │
    └── Intent = "lead"
            └── Dispatch after lead row created
                ├── SMS (lead summary)
                ├── WhatsApp (lead summary)
                └── Telegram (lead summary)
```

### Reliability Pattern

Fire-and-forget is insufficient. Use a per-channel `notification_log` row with status tracking:

```typescript
async function dispatchNotification(
  contractorId: string,
  callId: string,
  channel: 'sms' | 'whatsapp' | 'telegram',
  message: string,
  recipient: string
) {
  // 1. Insert pending log row
  const { data: logRow } = await supabase
    .from('notification_log')
    .insert({ contractor_id: contractorId, call_id: callId, channel, recipient, message, status: 'pending' })
    .select()
    .single();

  // 2. Attempt send
  try {
    if (channel === 'sms' || channel === 'whatsapp') {
      await twilioClient.messages.create({
        to: channel === 'whatsapp' ? `whatsapp:${recipient}` : recipient,
        from: channel === 'whatsapp' ? `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}` : process.env.TWILIO_FROM_NUMBER,
        body: message,
      });
    } else if (channel === 'telegram') {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: recipient, text: message }),
      });
    }

    // 3. Mark sent
    await supabase
      .from('notification_log')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', logRow.id);

  } catch (err) {
    // 4. Mark failed — visible in portal for manual retry
    await supabase
      .from('notification_log')
      .update({ status: 'failed', error: String(err) })
      .eq('id', logRow.id);
  }
}
```

### Multi-Channel Send Strategy

Send all channels concurrently (`Promise.allSettled`) — a failure on one channel does not block others:

```typescript
await Promise.allSettled([
  dispatchNotification(contractorId, callId, 'sms', message, smsNumber),
  dispatchNotification(contractorId, callId, 'whatsapp', message, waNumber),
  dispatchNotification(contractorId, callId, 'telegram', message, telegramChatId),
]);
```

Only send to channels the contractor has configured. Skip `null`/empty recipients.

---

## 7. Multi-Tenant Isolation

**Confidence: HIGH** — Supabase RLS-based multi-tenancy is well-documented and is the canonical pattern for Supabase SaaS apps.

### Strategy: Row-Level Security (RLS) + `contractor_id` Foreign Key

Every tenant-scoped table has a `contractor_id` column. RLS policies enforce that authenticated users can only read/write rows where `contractor_id` belongs to their own contractor record.

### Isolation Layers

| Layer | Mechanism |
|-------|-----------|
| Authentication | Supabase Auth (JWT) — each user has a `user_id` |
| Portal access | `contractors.user_id = auth.uid()` RLS policy |
| Data access | `contractor_id` FK + RLS policy on every table |
| API routes | Service role key used server-side only; never sent to browser |
| Webhook access | No auth.uid() — use service role key, validate Retell signature |
| Storage (recordings) | Supabase Storage bucket with RLS on objects by `contractor_id` prefix |

### Tenant Provisioning Flow

```
User signs up (Supabase Auth) →
  /api/onboarding/complete creates:
    - contractors row (user_id = auth.uid())
    - agents row (linked to contractor)
    - notification_settings row (empty)
  →
  Provision Twilio number via Retell or Twilio API →
    Update contractors.twilio_number →
  Create Stripe customer →
    Update contractors.stripe_customer_id →
  Redirect to portal
```

### Anti-Pattern: Avoid

Do NOT use schema-per-tenant (one Postgres schema per contractor). Supabase does not support this pattern natively and the complexity is unjustified at 20–30 contractors. RLS on a shared schema is correct for this scale.

---

## 8. Build Order (Dependency Graph)

**Confidence: HIGH** — Derived from functional dependencies in the stated requirements.

### Dependency Analysis

```
Supabase schema + RLS
    │
    ├── Supabase Auth + contractor onboarding flow
    │       │
    │       ├── Twilio number provisioning
    │       │       │
    │       │       └── Retell agent creation + Twilio linkage
    │       │               │
    │       │               └── Retell webhook handler
    │       │                       │
    │       │                       ├── Call record persistence
    │       │                       │
    │       │                       ├── Intent classification
    │       │                       │       │
    │       │                       │       ├── Lead creation
    │       │                       │       │       │
    │       │                       │       │       ├── Google Calendar booking
    │       │                       │       │       │
    │       │                       │       │       └── Notification dispatch (lead)
    │       │                       │       │
    │       │                       │       └── Notification dispatch (emergency)
    │       │                       │
    │       │                       └── Supabase Realtime → Portal live updates
    │       │
    │       └── Stripe billing integration
    │
    └── Admin portal (reads from Supabase; can be built in parallel once schema is done)
```

### Recommended Build Order

| Step | Component | Blocks |
|------|-----------|--------|
| 1 | Supabase schema + RLS (all tables) | Everything |
| 2 | Supabase Auth + basic onboarding UI | Contractor provisioning |
| 3 | Retell agent creation + Twilio number provisioning | Calls |
| 4 | Retell webhook handler (`/api/webhooks/retell`) | Call records, leads |
| 5 | Call record persistence + intent classification | Leads, notifications |
| 6 | Lead creation + Google Calendar OAuth + booking | Lead pipeline |
| 7 | Notification dispatch (SMS + WhatsApp + Telegram) | Alerts |
| 8 | Admin portal UI (call log, leads, recordings) | Contractor value |
| 9 | Supabase Realtime integration in portal | Live updates |
| 10 | Stripe billing + subscription gating | Revenue |
| 11 | Agent configuration UI (business hours, keywords) | Self-serve setup |

### Build Order Rationale

- **Schema first (step 1):** All components read/write to Supabase. Getting the schema right before writing application code avoids costly migrations.
- **Auth + onboarding before provisioning (step 2 before 3):** You need a `contractor_id` to link a Twilio number and Retell agent to.
- **Webhook handler is the core engine (step 4–7):** The product's primary value — capturing calls and notifying contractors — lives entirely in this path. Portal UI is secondary.
- **Portal after core engine (step 8–9):** Contractors can be notified via SMS/WhatsApp/Telegram before the portal is complete. This lets you validate the core loop with real calls before polishing the UI.
- **Stripe last (step 10):** Revenue gating can be added after the product works. Early beta contractors can be onboarded manually. This avoids Stripe complexity blocking the core build.

---

## Data Flow Description

### Happy Path: Lead Booking

```
1.  Caller dials contractor number (forwarded to Twilio)
2.  Twilio routes to Retell agent
3.  Retell agent handles call (~2–5 min conversation)
4.  Call ends; Retell fires call_ended webhook (POST /api/webhooks/retell)
5.  Webhook handler:
      a. Verifies Retell HMAC signature
      b. Inserts webhook_events row (idempotency)
      c. Returns HTTP 200 immediately
      d. (waitUntil) Upserts calls row with transcript + metadata
      e. (waitUntil) Classifies intent from transcript (regex + keywords or LLM call)
      f. (waitUntil) Creates leads row
      g. (waitUntil) Calls getValidAccessToken(), creates Google Calendar event
      h. (waitUntil) Dispatches lead notification via SMS + WhatsApp + Telegram
6.  Supabase Realtime fires INSERT event on `calls` and `leads` tables
7.  Contractor portal (if open) receives real-time update, refreshes call log
8.  Contractor receives WhatsApp/SMS notification on their phone
```

### Emergency Path

```
Same as above, but at step e:
  Intent = "emergency"
  Notification dispatch happens before Calendar booking (skip booking)
  All channels sent concurrently via Promise.allSettled
  Emergency flag set on calls.intent and leads.urgency
```

---

## Scalability Considerations

| Concern | At 30 contractors | At 300 contractors | At 3000 contractors |
|---------|------------------|-------------------|---------------------|
| DB queries | Supabase free tier adequate | Supabase Pro ($25/mo) | Supabase Pro + read replicas |
| Webhook volume | Vercel serverless handles easily | No change | Consider queue (Inngest/QStash) |
| Realtime subs | Supabase free tier (200 concurrent) | Supabase Pro (500 concurrent) | Supabase Pro |
| Twilio numbers | $1/mo each, Twilio auto-scales | No change | Volume discounts available |
| Retell cost | ~$0.05–$0.10/min per call | Track usage per tenant | Add usage-based billing |
| Notification dispatch | Direct API calls fine | Direct API calls fine | Consider queue for retry logic |
| Google Calendar | Per-tenant OAuth tokens, no shared quota | Monitor API quotas | Request quota increase from Google |

At 20–30 contractors, the current architecture runs entirely on free/low-cost tiers with no architectural changes needed.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Blocking the Webhook on Downstream Work
**What goes wrong:** Webhook handler awaits Calendar API + notification sends before returning 200. If any slow call takes >3s, Retell may retry (duplicate events). Calendar API latency is unpredictable.
**Instead:** Return 200 immediately, use `waitUntil()` for all downstream work. Log errors to `webhook_events`.

### Anti-Pattern 2: Storing OAuth Tokens in plaintext
**What goes wrong:** A Supabase data breach or misconfigured RLS exposes contractor Google accounts.
**Instead:** Encrypt at app layer with AES-256-GCM before writing to Supabase.

### Anti-Pattern 3: Using Client Supabase Client for Webhook Handling
**What goes wrong:** Client client respects RLS and uses the anon key — insufficient permissions and tied to a browser session.
**Instead:** Use service role client (server-side only, never in browser) in all API routes and webhook handlers.

### Anti-Pattern 4: Skipping RLS
**What goes wrong:** A bug in query logic exposes one contractor's calls or leads to another contractor.
**Instead:** Enable RLS on every table from day one. Use the service role key only for trusted server-side paths.

### Anti-Pattern 5: Single Notification Attempt (Fire-and-Forget)
**What goes wrong:** SMS provider has a momentary error; contractor misses an emergency alert with no visibility.
**Instead:** Log every notification attempt to `notification_log` with status. Show delivery failures in the portal.

### Anti-Pattern 6: Hardcoding Retell Agent Config
**What goes wrong:** Agent name, business hours, and emergency keywords are different per contractor. Hardcoding forces code deploys to change contractor configuration.
**Instead:** Store all agent configuration in the `agents` table. Inject it into Retell via the agent's "dynamic variables" feature or a custom LLM system prompt constructed at webhook time.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Retell webhook setup | Cold-start latency on first Vercel invocation causing Retell timeouts | Pre-warm with a lightweight health endpoint; confirm Retell timeout window in docs |
| Google Calendar OAuth | Refresh token not returned on re-auth (missing `prompt=consent`) | Always include `prompt=consent` in OAuth URL |
| WhatsApp via Twilio | WhatsApp Business account approval takes 2–7 days | Start approval process in Week 1, not after core build |
| Supabase Realtime + RLS | Realtime events may not respect RLS on older Supabase plans | Test RLS with Realtime; use `filter` param to scope to contractor_id |
| Stripe webhook | `customer.subscription.deleted` not handled → cancelled contractor retains access | Implement Stripe webhook handler for all subscription lifecycle events |
| Intent classification | LLM-based classification adds latency and cost to every call | Start with keyword/regex-based classification; add LLM only if accuracy is insufficient |

---

## Sources

**Note:** WebSearch and WebFetch were unavailable during this research session. All findings are drawn from training knowledge (cutoff August 2025). Verify against:

- Retell AI webhooks: https://docs.retellai.com/api-references/webhook
- Retell Twilio integration: https://docs.retellai.com/integration/twilio
- Supabase Realtime: https://supabase.com/docs/guides/realtime
- Supabase RLS: https://supabase.com/docs/guides/auth/row-level-security
- Google OAuth 2.0 refresh tokens: https://developers.google.com/identity/protocols/oauth2/web-server
- Twilio WhatsApp: https://www.twilio.com/docs/whatsapp/api
- Vercel `waitUntil`: https://vercel.com/docs/functions/functions-api-reference#waituntil
- Telegram Bot API: https://core.telegram.org/bots/api#sendmessage

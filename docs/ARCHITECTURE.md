<!-- generated-by: gsd-doc-writer -->

# Architecture

## System Overview

Koolable is a 24/7 AI phone receptionist SaaS that intercepts missed calls for HVAC, plumbing, and electrical contractors. When a customer calls a contractor's provisioned Twilio number, Retell AI answers the call, qualifies the caller, extracts trade details (service type, issue description), and classifies the intent as lead/emergency/info/no-action. Qualified leads are automatically booked to the contractor's Google Calendar, and emergencies are dispatched via WhatsApp/SMS/Telegram within 60 seconds. The system is built on Next.js, Supabase (database + auth), Inngest (background jobs), and hosted on Vercel.

## Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Incoming Call                         │
│                                                              │
└────────────────────────────┬────────────────────────────────┘
                             │
                             v
         ┌───────────────────────────────────────┐
         │   Twilio Number (Contractor)          │
         │   Routes to → Retell AI Agent         │
         └───────────────────┬───────────────────┘
                             │
                             v
         ┌───────────────────────────────────────┐
         │   Retell AI Voice Pipeline             │
         │   - Conversation flow                  │
         │   - Transcript + analysis              │
         │   - Events: call_ended, call_analyzed  │
         └───────────────────┬───────────────────┘
                             │
                             v
         ┌───────────────────────────────────────┐
         │   Retell Webhook Handler              │
         │   /api/webhooks/retell                │
         │   - Signature verification (HMAC)     │
         │   - Persists skeleton call row        │
         │   - Queues Inngest classify job       │
         └───────────────────┬───────────────────┘
                             │
                   ┌─────────┴──────────┐
                   │                    │
                   v                    v
      ┌──────────────────────────┐   ┌────────────────────────┐
      │  Supabase DB             │   │ Inngest (Jobs)         │
      │  - calls table           │   │ - retell-call-classify │
      │  - leads table           │   │ - retell-notify-       │
      │  - appointments table    │   │   dispatch             │
      │  - contractors table     │   │ - retell-agent-sync    │
      │  - notification_logs     │   │ - stripe-payment-fail  │
      └──────────────────────────┘   └────────────────────────┘
                   │                            │
                   └──────────┬─────────────────┘
                              │
                 ┌────────────┴─────────────┐
                 │                          │
                 v                          v
         ┌─────────────────────┐   ┌────────────────────┐
         │  Google Calendar    │   │ Notification       │
         │  - Book             │   │ Channels           │
         │    appointments     │   │ - WhatsApp         │
         │  - Fetch business   │   │ - SMS (Twilio)     │
         │    hours            │   │ - Telegram         │
         │  - Refresh tokens   │   │ - Email (Resend)   │
         └─────────────────────┘   └────────────────────┘
                 │
                 v
         ┌─────────────────────┐
         │  Portal Dashboard   │
         │  (Next.js + React)  │
         │  - Call log         │
         │  - Leads            │
         │  - Appointments     │
         │  - Agent config     │
         │  - Settings         │
         └─────────────────────┘
```

## Data Flow: Call to Notification

**1. Incoming Call → Retell AI**
- Contractor provisions a Twilio number via `/api/provisioning`.
- Customer calls that number. Twilio routes to Retell agent (identified by `agent_id`).
- Retell AI engages with natural language conversation, extracts caller info and issue details.

**2. Call Completion → Webhook**
- Retell emits two events as the call completes:
  - **`call_ended`** — call duration, timestamps, recording URL
  - **`call_analyzed`** — transcript, call summary, analysis metadata
- Both events are sent to `POST /api/webhooks/retell` with HMAC-SHA256 signature.

**3. Webhook Handler → Skeleton Row + Job Queue**
- Handler verifies HMAC signature (rejects forged webhooks with 401).
- `processCallEnded()` creates a skeleton `calls` row with `analysis_status='analyzing'`.
- `processCallAnalyzed()` enriches row with transcript and summary, then queues Inngest `retell/call.classify` job.
- Webhook returns HTTP 200 immediately (all downstream work in `after()` context).

**4. Inngest Classification Job**
- Inngest runs `retell-call-classify` function (durable, 5 retries on failure).
- **Step 0:** Load contractor and settings (timezone, supported languages, emergency keywords).
- **Step 1:** Check for hard-coded emergency keywords (gas smell, no heat, burst pipe, etc.). If match, set `intent='emergency'` and skip LLM.
- **Step 2:** If no emergency keyword, call OpenAI GPT-4o-mini to classify call intent (lead/info/no_action/unknown).
- **Step 3:** If classified as lead, call GPT-4o to extract trade details (service type, issue description, customer name, phone).
- **Step 4:** If appointment booking is enabled and intent is lead:
  - Fetch available calendar slots from Google Calendar API.
  - Store appointment row in `appointments` table with status `pending_booking`.
- **Step 5:** Fire `retell/call.notify` Inngest job (minimal payload: callId, contractorId).
- Updates `calls` row: set `analysis_status='complete'`, store `intent`, `language`, trade data.

**5. Inngest Notification Dispatcher**
- Inngest runs `retell-notify-dispatch` function.
- Loads call, contractor, and notification settings from DB.
- **Channel selection:** Based on `intent` (lead/emergency/info/no_action) and contractor's notification preferences:
  - Emergency → SMS + WhatsApp (immediate dispatch).
  - Lead → SMS + WhatsApp + Telegram + Email (configurable per channel).
  - Info/no_action → Skipped (unless contractor opted in).
- **Per-channel delivery:** Each channel runs in its own `step.run()` (Inngest memoizes independently; one failure doesn't block others).
- **Fallback logic:** If WhatsApp fails, fall back to SMS within the same function.
- **Notification log:** Before sending, writes row to `notification_logs` table with status `pending`. After send, updates with `sent` or `failed` + error.

**6. Portal Dashboard**
- Contractor logs in (Supabase Auth).
- Sees real-time call log, leads, and appointments via Realtime subscriptions.
- Can manually override lead details, reschedule appointments, or configure notification settings.

## Key Abstractions

### Core Modules

**Retell Integration (`/lib/retell/`)**
- `client.ts` — Retell SDK client singleton and language mapping.
- `webhook-types.ts` — TypeScript types for Retell webhook payloads.
- `system-prompt.ts` — Builds dynamic Retell system prompt with contractor settings, available calendar slots, emergency keywords, and language support.

**Classification (`/lib/classification/`)**
- `emergency-keywords.ts` — Hard-coded emergency phrase detection (English, Spanish, Haitian Creole).
- `classify-intent.ts` — OpenAI GPT-4o-mini prompt and Zod schema for intent classification (lead/info/no_action/unknown).
- `extract-trade.ts` — OpenAI GPT-4o prompt and Zod schema for trade detail extraction (service type, issue, customer info).

**Scheduling (`/lib/scheduling/`)**
- `slots.ts` — Computes available 30-minute appointment slots from Google Calendar (respecting contractor timezone and business hours).
- `inject-slots.ts` — Formats available slots as natural-language text for Retell system prompt.

**Notifications (`/lib/notifications/`)**
- `whatsapp.ts` — Twilio WhatsApp API; sends templated new-lead and emergency messages.
- `sms.ts` — Twilio SMS API.
- `telegram.ts` — grammY Telegram bot client.
- `email.ts` — Resend email service.
- `log.ts` — Writes and updates `notification_logs` table.
- `templates/` — React Email components for email templates.

**Google Calendar (`/lib/google/`)**
- `auth.ts` — OAuth2 token refresh, encryption/decryption of refresh tokens at rest (AES-256-GCM).
- `client.ts` — Google Calendar API client.

**Supabase (`/lib/supabase/`)**
- `service.ts` — Service-role Supabase client (server-side only, never in browser).
- `browser.ts` — Public Supabase client for browser + Next.js Server Components.

**Crypto (`/lib/crypto/`)**
- `tokens.ts` — AES-256-GCM encryption/decryption for OAuth tokens at rest.

### Database Schema

**Key Tables:**

| Table | Purpose |
|-------|---------|
| `contractors` | Contractor account, Twilio number, Retell agent ID, subscription status. |
| `contractor_settings` | Business hours, trade type, supported languages, emergency keywords. |
| `calls` | Call metadata (duration, transcript, summary, intent, after-hours flag). |
| `leads` | Classified leads with extracted trade data (customer name, phone, issue description). |
| `appointments` | Calendar appointments (pending/booked/failed, Google event ID, booking timestamp). |
| `notification_logs` | Sent/failed notifications with channel (SMS/WhatsApp/Telegram/Email) and error details. |
| `notification_settings` | Contractor notification preferences (enabled channels, phone numbers, email). |
| `webhook_events` | Idempotency cache (source=Retell, event_type=call_ended, external_id=call_id). |

**RLS Policies:** Every table has RLS enabled. Contractors can only access rows they own. Service-role client bypasses RLS for webhook handlers and Inngest jobs.

### Inngest Functions

**`retell-call-classify`** (main ML pipeline)
- Input: Minimal event `{ callId, contractorId, transcriptText, durationMs }`.
- Loads contractor settings, checks emergency keywords, calls OpenAI for intent + trade extraction.
- On success: Fires `retell/call.notify` job; updates `calls` row.
- On failure (all retries exhausted): Sets `analysis_status='analysis_failed'`.

**`retell-notify-dispatch`** (multi-channel notifications)
- Input: Event `{ callId, contractorId }`.
- Loads call + settings; computes which channels should fire (lead/emergency/info rules).
- Each channel in separate `step.run()` for independent retry behavior.
- Logs send attempts and results to `notification_logs`.

**`retell-agent-sync`** (agent config sync)
- Triggered when contractor updates agent settings (language, business hours, emergency keywords).
- Rebuilds Retell agent prompt (system + begin message) and syncs via Retell API.
- Durable job with 5 retries and exponential backoff.

**`stripe-payment-failure`** (billing pipeline)
- Triggered by Stripe webhook on payment failure.
- Sends email notification to contractor, marks subscription `past_due`.
- Suspends agent if payment remains unpaid after grace period.

## Directory Structure Rationale

```
src/
├── app/
│   ├── (auth)/                 # Auth pages: login, signup, password reset
│   ├── (dashboard)/            # Authenticated portal: calls, leads, settings
│   ├── api/
│   │   ├── auth/               # NextAuth routes
│   │   ├── webhooks/           # External webhook handlers (Retell, Stripe)
│   │   ├── provisioning/       # Twilio number + Retell agent provisioning
│   │   ├── notifications/      # Portal notifications (call alerts)
│   │   └── ...                 # Other internal API routes
│   ├── layout.tsx              # Root layout + font setup
│   └── page.tsx                # Redirect to dashboard
├── components/                 # Reusable React components (tables, forms, modals)
├── contexts/                   # React context (e.g., theme)
├── inngest/
│   ├── client.ts               # Inngest client singleton
│   └── functions/              # Durable background job functions
├── lib/
│   ├── after-hours/            # Business hours detection
│   ├── classification/         # Intent + trade data extraction (LLM)
│   ├── crypto/                 # Token encryption/decryption
│   ├── google/                 # Google Calendar API integration
│   ├── notifications/          # Multi-channel notification senders
│   ├── openai/                 # OpenAI client + prompts
│   ├── query/                  # Database query helpers (not yet used)
│   ├── realtime/               # Supabase Realtime subscriptions (React hooks)
│   ├── retell/                 # Retell SDK client + webhook types
│   ├── scheduling/             # Calendar slot computation
│   ├── stripe/                 # Stripe API client
│   ├── supabase/               # Supabase clients (service-role + browser)
│   ├── theme/                  # Theme provider + useTheme hook
│   ├── validations/            # Zod schemas for forms
│   └── utils.ts                # Utility functions (e.g., cn() for classname merging)
└── types/
    └── database.ts             # TypeScript types generated from Supabase schema
```

## Technology Rationale

**Retell AI (Voice Agent)**
- Supports multi-language voice conversations (English, Spanish, Haitian Creole).
- Webhook events (`call_ended`, `call_analyzed`) provide transcript and analysis in real-time.
- Custom system prompts allow dynamic context injection (contractor name, available slots, emergency keywords).
- Native integration with Twilio; no separate IVR needed.

**Twilio (Telephony)**
- Programmable voice numbers with call routing to Retell.
- SMS and WhatsApp APIs for emergency notifications.
- Direct integration reduces moving parts (no third-party call-routing service).

**Supabase (Database + Auth)**
- PostgreSQL with Row Level Security (RLS) for contractor data isolation.
- Built-in authentication (email/magic link).
- Realtime subscriptions for instant call log and lead updates on the portal.
- Encryption support (pgcrypto) for OAuth tokens at rest.

**Next.js 14 (Framework)**
- App Router with TypeScript for type-safe API routes.
- Server Components enable server-only secrets (Supabase service-role key never leaks to browser).
- Built-in middleware for auth state management.
- Vercel deployment with built-in support for edge functions and serverless.

**Inngest (Background Jobs)**
- Durable, reliable job queue with built-in retry logic (exponential backoff).
- Function-level memoization prevents duplicate processing of the same event.
- Workflow support for multi-step pipelines (classification → notification → booking).
- No separate infrastructure to manage (Inngest-hosted, serverless).

**Google Calendar API**
- Direct read/write access to contractor calendars for availability and booking.
- OAuth2 refresh token flow for long-lived access without user re-authentication.
- Allows automatic syncing of booked appointments back to contractor's primary calendar.

**OpenAI (LLM)**
- GPT-4o-mini for fast, low-cost intent classification.
- GPT-4o for high-accuracy trade data extraction when needed.
- Both models support function calling for structured output (Zod schema validation).

**Stripe (Billing)**
- Checkout flow for subscription setup.
- Webhook subscriptions for payment success/failure events.
- Subscription status stored in contractor record for plan enforcement.

**Vercel (Hosting)**
- Native Next.js deployments with automatic builds and edge function support.
- Environment variable management for secrets (API keys, OAuth credentials).
- Serverless execution (no container overhead).

## Critical Architecture Rules

1. **RLS on every table** — Every Supabase table must have RLS enabled. All four operation policies (SELECT, INSERT, UPDATE, DELETE) must be defined in migrations. Test as an unprivileged user before deploy.

2. **Webhook returns 200 immediately** — Retell webhook handler returns HTTP 200 before any downstream processing. All work (Supabase writes, Inngest sends) runs inside `after()` context (Vercel's request deferred processing). This ensures Retell can retry reliably.

3. **Service role key server-side only** — Supabase service-role client only used in API routes and Server Components. Never exposed to the browser or Inngest functions (which would leak it to logs).

4. **OAuth tokens encrypted at rest** — Google refresh tokens encrypted with AES-256-GCM before writing to Supabase. Decryption only in server-side code on-demand.

5. **Idempotency on all webhook handlers** — `webhook_events` table with unique constraint on `source + event_type + external_id` prevents duplicate leads and notifications on Retell retries. Inngest event IDs also used for job-level idempotency.

6. **Emergency keywords checked first** — Hard-coded emergency detection runs before LLM classification. If an emergency keyword is found, classification is skipped and `intent='emergency'` is set immediately.

## Security & Compliance Concerns

- All API keys (Retell, Twilio, Stripe, Google, OpenAI) managed via Vercel environment variables.
- Retell webhook signature verification (HMAC-SHA256) mandatory before any payload parsing.
- Notification logs stored (for compliance) but PII (full phone numbers) is hashed/truncated where possible.
- Contractor can revoke Google OAuth at any time; outstanding appointments stay in DB but won't sync updates.

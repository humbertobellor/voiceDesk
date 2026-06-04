# Koolable — AI Receptionist for Field Service Contractors

## What This Project Is

Koolable is a 24/7 AI phone receptionist SaaS for HVAC, plumbing, and electrical contractors. It answers missed calls via Retell voice AI, qualifies leads, books appointments to Google Calendar, and dispatches emergencies via WhatsApp/Telegram/SMS. The agent supports English, Spanish, and Haitian Creole (South Florida market focus).

## Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router, TypeScript, React 19) |
| Voice AI | Retell AI (v2 SDK) |
| Telephony | Twilio (SDK v5) |
| Database + Auth | Supabase (`@supabase/ssr`) |
| Hosting | Vercel |
| Billing | Stripe Checkout + webhooks |
| Calendar | Google Calendar API (`googleapis`) |
| Email | Resend + React Email templates |
| Notifications | Twilio WhatsApp + SMS, grammY (Telegram) |
| Background jobs | Inngest |
| Intent Classification | OpenAI GPT-4o-mini |
| UI components | Shadcn UI + Tailwind CSS |
| Supporting libs | `zod`, `libphonenumber-js`, `date-fns-tz`, `react-query` |
| Tests | Vitest (unit) + Playwright (E2E) |

## Directory Structure

```
voiceDesk/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (auth)/               # Auth-gated routes
│   │   │   ├── auth/             # Login, signup, OAuth callback
│   │   │   ├── setup/phone/      # Phone capture gate (middleware-enforced)
│   │   │   └── pricing/
│   │   ├── (dashboard)/          # Authenticated portal
│   │   │   ├── dashboard/        # Home dashboard
│   │   │   ├── calls/            # Call log + recordings
│   │   │   ├── leads/            # Lead management
│   │   │   ├── settings/         # Multi-tab: agent, account, notifications,
│   │   │   │                     #   phone, calendar, appearance, go-live
│   │   │   └── connect-calendar/ # Google Calendar OAuth flow
│   │   ├── api/
│   │   │   ├── webhooks/
│   │   │   │   ├── retell/       # call_ended + call_analyzed events
│   │   │   │   ├── stripe/       # Billing lifecycle events
│   │   │   │   └── telegram/     # /start command → link chat_id
│   │   │   ├── auth/google/      # OAuth initiate + callback
│   │   │   ├── onboarding/       # create-account
│   │   │   ├── provisioning/     # create + update-agent
│   │   │   ├── notifications/    # mark-read, mark-all-read
│   │   │   ├── notification-settings/ # Save prefs, unlink telegram
│   │   │   ├── stripe/           # checkout, portal, subscription
│   │   │   ├── recordings/       # Signed URL for call recordings
│   │   │   ├── contractor/       # status check
│   │   │   └── inngest/          # Inngest webhook receiver
│   │   └── actions/              # Server actions
│   ├── components/
│   │   ├── agent/                # BusinessInfoForm, VoiceForm, KeywordsForm,
│   │   │                         #   BusinessHoursForm, AgentConfigTabs
│   │   ├── auth/                 # LoginForm, SignupForm, PhoneCaptureForm
│   │   ├── calls/                # CallLogTable, CallPlaybackModal
│   │   ├── leads/                # LeadTable, LeadFilters, StatusBadge
│   │   ├── notification/         # NotificationBell, NotificationSettingsForm
│   │   ├── dashboard/            # Sidebar, BottomTabBar, DashboardProviders,
│   │   │                         #   EmptyState
│   │   ├── theme/                # ThemeToggle
│   │   └── ui/                   # Shadcn primitives + Logo
│   ├── lib/
│   │   ├── supabase/             # browser.ts, server.ts, service.ts
│   │   ├── retell/               # client.ts, system-prompt.ts, webhook-types.ts
│   │   ├── openai/               # client.ts (GPT-4o-mini wrapper)
│   │   ├── google/               # auth.ts, client.ts (Calendar API)
│   │   ├── stripe/               # checkout.ts, portal.ts, client.ts
│   │   ├── notifications/        # sms.ts, whatsapp.ts, telegram.ts, email.ts,
│   │   │   │                     #   log.ts, payment-alert.ts
│   │   │   └── templates/        # React Email JSX templates
│   │   ├── classification/       # classify-intent.ts, emergency-keywords.ts,
│   │   │                         #   trade-extraction.ts
│   │   ├── scheduling/           # slots.ts, inject-slots.ts
│   │   ├── after-hours/          # detect.ts (timezone-aware)
│   │   ├── crypto/               # tokens.ts (AES-256-GCM)
│   │   ├── realtime/             # calls.ts, leads.ts, notifications.ts,
│   │   │                         #   testCallVerification.ts
│   │   ├── query/                # React Query client + provider
│   │   ├── theme/                # Dark mode context
│   │   └── validations/          # Zod schemas
│   ├── inngest/
│   │   ├── client.ts
│   │   └── functions/
│   │       ├── retell-agent-sync.ts       # Patch Retell LLM system prompt; 5 retries
│   │       ├── retell-call-classify.ts    # GPT-4o-mini intent classification
│   │       ├── retell-notify-dispatch.ts  # Multi-channel notification dispatch
│   │       ├── retell-analysis-timeout.ts # 30-min cron; marks stuck calls failed
│   │       └── stripe-payment-failure.ts  # Deactivate + email on payment failure
│   ├── types/
│   │   ├── database.ts           # All DB row types (Contractor, Call, Lead, etc.)
│   │   └── stripe.ts
│   └── contexts/
│       └── ContractorContext.tsx
├── supabase/
│   ├── config.toml               # Local: API 54321, DB 54322, Studio 54323
│   └── migrations/               # 17 timestamped migration files (20260504–20260525)
├── tests/
│   ├── setup.ts                  # Vitest globals + mock setup
│   ├── __mocks__/                # openai, supabase, server-only mocks
│   ├── lib/                      # Unit tests for lib/* utilities
│   ├── db/                       # RLS policy tests, idempotency tests
│   ├── api/                      # Webhook handler + provisioning tests
│   ├── components/               # Component unit tests
│   ├── notifications/            # Notification channel tests
│   └── ui/                       # Form component tests
├── .planning/
│   ├── PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md
│   ├── research/                 # STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md
│   ├── milestones/v1.0-phases/   # Phases 01–11 (completed)
│   └── phases/                   # Phases 12–18 (ongoing/recent)
├── middleware.ts                 # Route protection + phone-capture gate
├── next.config.ts                # Typed routes enabled
├── vitest.config.ts
├── playwright.config.ts          # Chromium, baseURL localhost:3000
├── components.json               # Shadcn UI config
└── .env.example                  # 25+ required env vars (see section below)
```

## Database Schema

All tables have RLS enabled. Contractors access only their own rows (filtered by `contractor_id` + `user_id`).

| Table | Key Columns |
|-------|-------------|
| `contractors` | `id`, `user_id` (→ auth.users), `business_name`, `phone_number`, `twilio_number`, `retell_agent_id`, `stripe_customer_id`, `subscription_status`, `timezone`, `is_active`, `trial_ends_at` |
| `contractor_settings` | `contractor_id`, `trade_type`, `supported_languages[]`, `business_hours` (JSONB), `emergency_keywords` (JSONB), `agent_voice`, `appointment_duration_minutes` |
| `calls` | `contractor_id`, `retell_call_id` (UNIQUE), `caller_phone`, `caller_name`, `status`, `started_at`, `ended_at`, `duration_seconds`, `recording_url`, `transcript` (JSONB), `summary`, `intent` (enum), `language`, `is_after_hours`, `analysis_status` |
| `leads` | `contractor_id`, `call_id`, `caller_name`, `caller_phone`, `service_requested`, `service_type`, `urgency`, `preferred_time`, `status` |
| `appointments` | `contractor_id`, `lead_id`, `call_id`, `google_event_id`, `starts_at`, `ends_at`, `service_address`, `notes`, `status` |
| `calendar_credentials` | `contractor_id` (UNIQUE), `access_token` (encrypted), `refresh_token` (encrypted), `token_expiry`, `calendar_id` |
| `webhook_events` | `source`, `event_type`, `external_id`, `payload` (JSONB), `processed`, `error` — unique on `(source, event_type, external_id)` |
| `notification_log` | `contractor_id`, `call_id`, `lead_id`, `channel` (sms/whatsapp/telegram/email), `recipient`, `status`, `sent_at` |
| `notification_settings` | `contractor_id` (UNIQUE), `sms_number`, `whatsapp_number`, `telegram_chat_id`, `email_address`, `notify_sms/whatsapp/telegram/email_enabled`, `notify_on_lead/emergency/general_inquiry` |
| `notifications` | `contractor_id`, `call_id`, `lead_id`, `title`, `message`, `type` (lead/emergency/payment), `is_read`, `read_at` |

## Key Conventions & Patterns

### Supabase Client Usage
- **Browser** (`lib/supabase/browser.ts`): anon key; use in Client Components for reads with RLS.
- **Server** (`lib/supabase/server.ts`): reads JWT from cookies; use in API routes and Server Components.
- **Service role** (`lib/supabase/service.ts`): bypasses RLS; use only for server mutations that must write across user boundaries. **Never import this in Client Components.**

### Webhook Architecture
- Return 200 immediately from webhook handlers.
- All downstream logic (DB writes, Inngest events, notifications) runs inside Vercel `after()`.
- Check `webhook_events` for idempotency before processing. UPSERT with the unique constraint on `(source, event_type, external_id)`.

### Inngest Jobs
- Trigger events: `retell/agent.sync`, `retell/call.classify`, `retell/call.notify`, `stripe/payment.failed`.
- All functions use idempotency keys (e.g., `retell-classify-${call.call_id}`).
- `retell-agent-sync` has 5 retries with exponential backoff; on final failure, sets `agent_sync_status = 'failed'`.

### Intent Classification (Two-Stage)
1. **Hard check** first: scan transcript for emergency keywords (gas leak, CO detector, flooding).
2. **LLM fallback**: GPT-4o-mini structured output with Zod schema if no hard match.
3. Do **not** fire notify-dispatch if intent is `no_action`.

### System Prompt Compilation
`lib/retell/system-prompt.ts` compiles the Retell LLM system prompt from:
- `contractor_settings` (trade type, supported languages, emergency keywords, business hours)
- Available calendar slots (injected by `lib/scheduling/inject-slots.ts`)

Rebuild and patch via Inngest whenever settings change.

### OAuth Tokens
- Encrypt Google refresh tokens with AES-256-GCM (`lib/crypto/tokens.ts`) before writing to `calendar_credentials`.
- Decrypt only in server-side code (API routes / Server Actions).
- `OAUTH_ENCRYPTION_KEY` must be a 64-char hex string.

### After-Hours Detection
`lib/after-hours/detect.ts` compares the call's `started_at` (UTC) against the contractor's `business_hours` in their configured timezone. Always use `date-fns-tz` for timezone conversions; never use raw `Date` math.

### Notification Dispatch
Order of preference: WhatsApp → SMS fallback if WhatsApp fails. Telegram and email are independent channels. Log every attempt to `notification_log` regardless of outcome.

### RLS Migration Convention
Every new table migration must:
1. `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;`
2. Define all four policies in the same file: `SELECT`, `INSERT`, `UPDATE`, `DELETE`.
3. Policy filter: `contractor_id = (SELECT id FROM contractors WHERE user_id = auth.uid())`.

## Middleware (Route Protection)

`middleware.ts` enforces three gates in order:
1. **Unauthenticated** → redirect to `/auth/login`
2. **Phone not captured** → redirect to `/setup/phone` (checks `contractors.phone_number`)
3. **Subscription not active** → redirect to `/pricing` (checks `subscription_status + trial_ends_at`)

## GSD Planning Workflow

Planning artifacts live in `.planning/`:
- `STATE.md` — current phase + blockers (update this first after each phase)
- `REQUIREMENTS.md` — 26 v1 REQ-IDs; reference these in commit messages
- Completed phases: `.planning/milestones/v1.0-phases/` (01–11)
- Active phases: `.planning/phases/` (12–18)

**Current status:** Phase 18 (Logo Integration). Phases 1–17 complete.

## Testing

### Unit Tests (Vitest)
```bash
npm test              # run all unit tests
npm test -- --watch   # watch mode
```
- Config: `vitest.config.ts` — jsdom environment, shims `server-only`, path alias `@/` → `./src/`
- Test files: `tests/lib/`, `tests/db/`, `tests/api/`, `tests/components/`, `tests/notifications/`, `tests/ui/`
- Mocks: `tests/__mocks__/` for openai, supabase, server-only

### E2E Tests (Playwright)
```bash
npx playwright test              # run all E2E
npx playwright test --ui         # interactive mode
```
- Config: `playwright.config.ts` — Chromium, `baseURL http://localhost:3000`, trace on retry
- Specs: `auth.spec.ts`, `phase-10-notification-settings.spec.ts`, `regression-v1-smoke.spec.ts`

### Local Supabase
```bash
npx supabase start    # API: 54321, DB: 54322, Studio: 54323
npx supabase db reset # apply all migrations fresh
```

## Critical Rules

1. **RLS on every table** — All four operation policies (SELECT, INSERT, UPDATE, DELETE) in the same migration file. Verify with an unprivileged user before merging.
2. **Webhook handlers return 200 immediately** — Processing happens in `after()`. Never block on Calendar API calls or notification sends.
3. **Service role key never reaches the browser** — Only import `lib/supabase/service.ts` in API routes and Server Components.
4. **OAuth tokens encrypted at rest** — AES-256-GCM via `lib/crypto/tokens.ts`. Decrypt only server-side.
5. **Idempotency on all webhook handlers** — Use `webhook_events` unique constraint before mutating any state.
6. **Timezone-aware scheduling** — All timestamps stored in UTC. Business hours live in contractor timezone. Use `date-fns-tz`, never raw `Date` math.
7. **Agent sync via Inngest** — Never directly call Retell API from a webhook handler. Always fire `retell/agent.sync` event.

## Environment Variables

All required variables are documented in `.env.example`. Key groupings:

| Group | Variables |
|-------|-----------|
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Retell | `RETELL_API_KEY`, `RETELL_WEBHOOK_KEY` |
| Google OAuth | `OAUTH_ENCRYPTION_KEY` (64-char hex), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` |
| Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `TWILIO_WHATSAPP_FROM`, `TWILIO_WHATSAPP_SID_NEW_LEAD`, `TWILIO_WHATSAPP_SID_EMERGENCY` |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_WEBHOOK_URL`, `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_BASIC_PLAN_ID`, `STRIPE_PROFESSIONAL_PLAN_ID`, `STRIPE_ENTERPRISE_PLAN_ID` |
| OpenAI | `OPENAI_API_KEY` |
| Inngest | `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` |
| App | `APP_URL` (public HTTPS; required for Retell webhook registration) |

## Pre-Deploy Checklist

- [ ] All new tables have RLS + 4-operation policies in the same migration
- [ ] Webhook handlers tested for idempotency (duplicate event must be a no-op)
- [ ] Service-role Supabase client not imported in any Client Component or `use client` file
- [ ] New OAuth scopes added to `lib/google/auth.ts` and re-approved in GCP
- [ ] System prompt changes trigger `retell/agent.sync` via Inngest
- [ ] Notification fallback path tested (WhatsApp failure → SMS)

## Week-1 Non-Code Actions

- [ ] Submit WhatsApp Business Account (WABA) registration and templates via Twilio — 3–7 day approval window
- [ ] Move Google OAuth app to production mode before first beta contractor connects calendar
- [ ] Verify Retell native support for Haitian Creole — if not supported, plan custom LLM endpoint fallback

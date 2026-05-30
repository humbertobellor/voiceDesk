# VoiceDesk Roadmap

<details>
<summary><strong>✅ Milestone v1.0 — Revenue-Ready MVP (SHIPPED 2026-05-24)</strong></summary>

**Goal:** A contractor can sign up, configure their AI receptionist, receive a dedicated phone number, and immediately start capturing leads, booking appointments, and receiving real-time notifications — with Stripe billing collecting revenue.
**Shipped:** 2026-05-24 | 11 phases | 55 plans | 311 commits | 21 days
**Archive:** [.planning/milestones/v1.0-mvp.md](milestones/v1.0-mvp.md)

## Phases

- [x] **Phase 1: Foundation** - Supabase schema, RLS, auth, account creation, and multi-language agent configuration (English, Spanish, Haitian Creole) ✓ 2026-05-05
- [x] **Phase 2: Provisioning** - Twilio number provisioning and Retell agent creation per contractor ✓ 2026-05-07
- [x] **Phase 3: Webhook Core** - Retell webhook handler, call persistence, and intent classification ✓ 2026-05-08
- [x] **Phase 4: Scheduling & Lead Capture** - Google Calendar OAuth, availability windows, appointment booking, and lead records ✓ 2026-05-08
- [x] **Phase 5: Notifications** - SMS, WhatsApp, and Telegram multi-channel dispatch for all call outcomes ✓ 2026-05-12
- [x] **Phase 6: Portal UI** - Contractor dashboard: call log, recordings, lead list, agent configuration, real-time updates ✓ 2026-05-12
- [x] **Phase 7: Billing & Onboarding** - Stripe Checkout, subscription gating, onboarding wizard with mandatory test call gate ✓ 2026-05-12
- [x] **Phase 8: Settings Refactor** - Remove onboarding wizard modal; move Calendar, Phone, Forwarding, and Go Live into dedicated settings tabs alongside the existing Agent Config tab ✓ 2026-05-20

---

## Phase Details

### Phase 1: Foundation

**Goal:** Contractors can create an account, the database is ready to hold all call and configuration data with zero cross-tenant leakage, and the agent configuration schema supports English, Spanish, and Haitian Creole from day one.
**Depends on:** Nothing (first phase)
**Requirements:** LANG-01, LANG-02 (schema and config layer), (schema gates all others)
**Success Criteria** (what must be TRUE):

  1. A contractor can sign up with email and password and land on a dashboard shell
  2. All database tables exist with RLS enabled and verified as an unprivileged Supabase user — no tenant can read another tenant's rows
  3. The `webhook_events` idempotency table exists with a unique constraint on `source + event_type + external_id`
  4. Agent configuration defaults (business name, hours, services, emergency keywords) are persisted to `contractor_settings` on account creation
  5. Contractor can select supported languages (English, Spanish, Haitian Creole, or all three) in agent config — selection is stored and will drive Retell agent configuration in Phase 2

**Plans:** 5 plans

- [x] 01-01-PLAN.md — Project scaffold (Next.js + deps + Tailwind + Inter) + Wave 0 test infrastructure (vitest + playwright + 5 test stubs) ✓ 2026-05-04
- [x] 01-02-PLAN.md — SQL migrations: 9 tables + RLS enable + 33 policies + LANG-02 CHECK + D-16 idempotency key + D-17 token columns ✓ 2026-05-04
- [x] 01-03-PLAN.md — [BLOCKING] supabase db push live + Supabase clients (server/browser/service) + AES-256-GCM utility + zod validations + database types ✓ 2026-05-04
- [x] 01-04-PLAN.md — Auth flow: middleware + login/signup/callback + phone capture (D-02) + account creation API (contractors + contractor_settings + notification_settings) ✓ 2026-05-04
- [x] 01-05-PLAN.md — Dashboard shell (Sidebar + SetupBanner + EmptyState + BottomTabBar + 6 page slots) + RLS isolation test seeded and passing live (D-18) ✓ 2026-05-04

**UI hint:** yes
**Notes:** Every subsequent phase depends on this schema being correct and RLS being airtight. Do not advance to Phase 2 until an unprivileged-user RLS test passes on every table. OAuth token encryption utility must be written here before any Google callback route. CRITICAL: Verify Retell's native support for Haitian Creole before Phase 2 begins — if not natively supported, a custom LLM endpoint with a Haitian Creole-capable model (e.g., GPT-4o with Creole prompting) may be required. South Florida market makes this non-optional.

---

### Phase 2: Provisioning

**Goal:** Each contractor has a dedicated Twilio phone number imported into Retell, and a Retell agent running their configured system prompt — so inbound calls can actually be answered.
**Depends on:** Phase 1
**Requirements:** (no standalone requirements at this phase — this phase delivers the infrastructure that CALL-01, ONBOARD-01, and ONBOARD-02 depend on)
**Success Criteria** (what must be TRUE):

  1. After completing provisioning, a contractor has a unique Twilio number visible in their account
  2. A test call to that number is answered by the Retell AI agent (not voicemail) within 3 rings
  3. The Retell agent uses the contractor's configured business name and service list in its greeting
  4. The provisioned number and Retell agent ID are stored in the contractor's database row and retrievable via the server API

**Plans:** 5 plans

- [x] 02-01a-PLAN.md — Wave 0 test stubs + npm install (retell-sdk, inngest) + migration SQL write ✓ 2026-05-07
- [x] 02-01b-PLAN.md — [BLOCKING] supabase db push + Haitian Creole code cleanup + VALIDATION.md sign-off ✓ 2026-05-07
- [x] 02-02-PLAN.md — Retell client singleton + system-prompt builder + language mapper ✓ 2026-05-07
- [x] 02-03-PLAN.md — Inngest client + retell-agent-sync function (with onFailure) + /api/inngest route ✓ 2026-05-07
- [x] 02-04-PLAN.md — POST /api/provisioning/create + PATCH /api/provisioning/update-agent ✓ 2026-05-07

**Wave dependency notes:**

- **Wave 1a** (`02-01a`): no dependencies — installs packages and writes migration SQL
- **Wave 1b** (`02-01b`) *(blocked on Wave 1a completion)*: pushes migration to live DB, removes HC from codebase
- **Wave 2** (`02-02`, `02-03`) *(blocked on Wave 1b completion)*: Retell utilities and Inngest setup (parallel)
- **Wave 3** (`02-04`) *(blocked on Wave 2 completion)*: provisioning API routes

**Cross-cutting constraints:**

- `import 'server-only'` required in all Retell and Inngest lib modules
- `createServiceRoleClient()` used only in API routes and Inngest functions — never in client components
- RETELL_API_KEY never prefixed with NEXT_PUBLIC_

**UI hint:** no
**Notes:** Use Retell's provisioning API (`retell.phoneNumber.create({ area_code })`) — NOT raw TwiML/SIP and NOT Twilio Account SID/Auth Token linking (that flow is not documented in Retell v2). Retell v2 architecture separates LLM entity (system prompt) from Agent entity — create LLM first (`llm.create()`), then Agent referencing LLM ID. The `retell_llm_id` column (added in this phase) is required for all future system prompt updates via `PATCH /update-retell-llm/{llm_id}`. Haitian Creole is confirmed absent from Retell's supported language codes — D-01 (HC removal) is fully executed in this phase.

---

### Phase 3: Webhook Core

**Goal:** Every completed call is persisted with its transcript, summary, and intent classification — the product engine is running and auditable.
**Depends on:** Phase 2
**Requirements:** CALL-01, CALL-02, CALL-03, CALL-04, EMRG-01, EMRG-02
**Success Criteria** (what must be TRUE):

  1. A test call produces a `calls` row in Supabase with caller name, phone, duration, transcript, AI summary, and intent classification (lead / emergency / info / no-action) within 5 minutes of call end
  2. Gas smell and CO alarm keywords always produce an `emergency` classification regardless of other call content — the classification is not overridable by agent configuration
  3. Other emergency keywords trigger a clarifying question ("Is this happening right now?") before classifying as emergency; a caller who says "no" is classified as a lead, not an emergency
  4. After-hours calls (outside contractor-configured windows) produce a `calls` row with `is_after_hours: true` and use the after-hours script branch
  5. A duplicate webhook delivery for the same call produces exactly one `calls` row — idempotency table prevents duplicates

**Plans:** 4 plans

- [x] 03-01-PLAN.md — npm install (openai, date-fns-tz) + migration SQL (analysis_status + notify_on_general_inquiry) + [BLOCKING] supabase db push + test stubs (webhook, classification, after-hours)
- [x] 03-02-PLAN.md — Foundation libs: webhook-types.ts + openai/client.ts + emergency-keywords.ts + after-hours/detect.ts ✓ 2026-05-08
- [x] 03-03-PLAN.md — Classification services (classify-intent + extract-trade) + webhook route.ts + handlers.ts (processCallEnded + processCallAnalyzed) ✓ 2026-05-08
- [x] 03-04-PLAN.md — Inngest retell-call-classify function + retell-analysis-timeout cron + register both in /api/inngest route ✓ 2026-05-08

**Wave dependency notes:**

- **Wave 1** (`03-01`): no dependencies — installs packages, writes migration SQL, runs db push, creates test stubs
- **Wave 2** (`03-02`): blocked on 03-01 — all foundation lib modules (parallel within plan)
- **Wave 3** (`03-03`): blocked on 03-02 — classification services + webhook route + handlers
- **Wave 4** (`03-04`): blocked on 03-03 — Inngest functions + route registration + full test suite green

**Cross-cutting constraints:**

- `import 'server-only'` required in all new lib and Inngest modules
- `createServiceRoleClient()` only in webhook route and Inngest functions — never in client components
- OPENAI_API_KEY never prefixed with NEXT_PUBLIC_
- contractor_id is NEVER accepted from webhook payload — always derived from agent_id lookup (T-03-02)
- `req.text()` called BEFORE `req.json()` in webhook route — `verify()` needs raw string body
- `after()` from `next/server` (NOT `@vercel/functions`) — export `maxDuration = 30` on route file
- `call_analysis.call_summary` is the summary field (NOT `call.summary`)
- `transcript_object` (array) stored in `calls.transcript` JSONB (NOT the `transcript` string)
- `duration_ms` is milliseconds — divide by 1000 for `calls.duration_seconds`

**UI hint:** no
**Notes:** Webhook handler must return HTTP 200 within 10 seconds — all downstream processing runs inside `after()` from `next/server`. `call_analyzed` is the canonical source for transcript and summary (fires 1–3 min after call end). Hard-coded emergency keywords (gas smell, CO alarm) checked before any LLM call — EMRG-02 compliance. UPSERT on `calls.retell_call_id` provides idempotency — D-05.

---

### Phase 4: Scheduling & Lead Capture

**Goal:** The AI agent can book estimate appointments into the contractor's Google Calendar during the call without double-booking, and every lead is stored for the contractor to review.
**Depends on:** Phase 3
**Requirements:** SCHED-01, SCHED-02, SCHED-03, SCHED-04
**Success Criteria** (what must be TRUE):

  1. A contractor can connect their Google Calendar via OAuth and see confirmation that the connection is active in their account
  2. The agent books an appointment slot during the call using contractor-configured availability windows (not a live Calendar API mid-call check) and the caller hears the confirmed date, time, and address before the call ends
  3. A Google Calendar event is created in the contractor's calendar within 5 minutes of call end with the correct appointment details
  4. If two calls arrive close together targeting the same slot, only one appointment is created — the second caller is offered the next open slot (DB-level lock prevents race conditions)
  5. A `leads` row is created for every call classified as lead or emergency, containing caller name, phone, issue description, appointment status, and initial status of "Pending"

**Plans:** 6 plans

- [x] 04-01-PLAN.md — npm install googleapis + migration SQL (appointment_duration_minutes, google_sync_status, booking_conflict on leads) + [BLOCKING] supabase db push + 4 Wave-0 test stubs ✓ 2026-05-08
- [x] 04-02-PLAN.md — Google OAuth lib: src/lib/google/client.ts (createOAuth2Client) + src/lib/google/auth.ts (getCalendarClient refresh-on-use) ✓ 2026-05-08
- [x] 04-03-PLAN.md — Slot computation: src/lib/scheduling/slots.ts (computeAvailableSlots) + src/lib/scheduling/inject-slots.ts (buildSlotSection) + extend buildSystemPrompt() ✓ 2026-05-08
- [x] 04-04-PLAN.md — Extend extract-trade.ts schemas: confirmed_appointment_time + service_address fields (.nullish()) + extraction prompt update ✓ 2026-05-08
- [x] 04-05-PLAN.md — Extend retell-call-classify.ts: load-contractor step + create-lead + create-appointment + create-calendar-event + trigger-agent-sync steps ✓ 2026-05-08
- [x] 04-06-PLAN.md — OAuth routes (/api/auth/google/initiate + /api/auth/google/callback) + /dashboard/connect-calendar page + dashboard success banner ✓ 2026-05-08

**Wave dependency notes:**

- **Wave 0** (`04-01`): no dependencies — installs googleapis, writes migration SQL, pushes DB, creates test stubs
- **Wave 1** (`04-02`, `04-03`) *(parallel, blocked on 04-01)*: Google OAuth libs + slot computation libs (no shared files)
- **Wave 2** (`04-04`) *(blocked on 04-02 + 04-03)*: extend classification schemas + buildSystemPrompt() signature
- **Wave 3** (`04-05`) *(blocked on 04-02 + 04-03 + 04-04)*: extend retell-call-classify Inngest function with 4 new steps
- **Wave 4** (`04-06`) *(blocked on 04-05)*: OAuth routes + connect-calendar page + dashboard banner

**Cross-cutting constraints:**

- `import 'server-only'` required in src/lib/google/client.ts, src/lib/google/auth.ts, src/lib/scheduling/slots.ts
- `import 'server-only'` NOT used in src/lib/scheduling/inject-slots.ts (pure string transform, no secrets)
- `encryptToken()`/`decryptToken()` from src/lib/crypto/tokens.ts used for ALL calendar token reads/writes
- `booking_conflict BOOLEAN` goes on LEADS table (not appointments) — UNIQUE(contractor_id, starts_at) on appointments makes a second row impossible
- `prompt: 'consent'` is REQUIRED in generateAuthUrl() — omitting causes null refresh_token on re-auth
- `tokens.expiry_date` from googleapis is MILLISECONDS (not seconds) — convert with new Date(ms).toISOString()
- `contractor_id` in OAuth callback derived from JWT user.id only — never from URL params (STRIDE: EoP)
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI never prefixed with NEXT_PUBLIC_

**UI hint:** yes (connect-calendar page + dashboard banner)
**Notes:** OAuth tokens are encrypted with AES-256-GCM before writing to `calendar_credentials` — Phase 1 encryptToken() utility required. D-10 architectural fix: booking_conflict placed on leads (not appointments) due to UNIQUE(contractor_id, starts_at) constraint — second row for same slot is impossible regardless of column values. Google OAuth app must be in Production mode before beta; CASA Tier 2 security assessment required for calendar.events scope (3-8 weeks). Slot computation is pre-computed from contractor_settings.business_hours, NOT from live Calendar API mid-call.

---

### Phase 5: Notifications

**Goal:** Contractors are alerted within 60 seconds of every call end via their preferred channels — SMS always fires, WhatsApp and Telegram fire when configured — so no lead or emergency is missed.
**Depends on:** Phase 3 (lead/emergency data), Phase 4 (appointment status for notification content)
**Requirements:** NOTIF-01, NOTIF-02, NOTIF-03, EMRG-03
**Success Criteria** (what must be TRUE):

  1. An SMS notification arrives on the contractor's phone within 60 seconds of call end for every call, containing caller name, phone number, issue summary, and appointment booking status
  2. A WhatsApp notification using a pre-approved template fires for every new lead and emergency; if WhatsApp delivery fails, an SMS fallback fires automatically within the same 60-second window
  3. A Telegram notification fires for every new lead and emergency to the contractor's linked Telegram account; the contractor can link their account during onboarding via a bot start link without any manual token entry
  4. Emergency notifications via all configured channels carry the word "EMERGENCY" prominently and include the caller's callback number; they arrive within 30 seconds of call end
  5. The `notification_log` table records send status per channel per call — failures are visible and retried by Inngest without duplicate sends

**Plans:** 5 plans

- [x] 05-01-PLAN.md — npm install (twilio, grammy) + 4 notification lib stubs (sms/whatsapp/telegram/log) + RED test scaffolds + .env.example additions ✓ 2026-05-09
- [x] 05-02-PLAN.md — Implement notification libs: real Twilio SMS, WhatsApp template sends (Content SID constants), grammY Telegram, notification_log DB helpers (GREEN tests) ✓ 2026-05-09
- [x] 05-03-PLAN.md — retell-notify-dispatch Inngest function (Promise.allSettled, D-09 WA fallback, D-12 pending-before-send) + extend retell-call-classify to fire retell/call.notify event ✓ 2026-05-09
- [x] 05-04-PLAN.md — POST /api/webhooks/telegram (grammY, upserts telegram_chat_id) + dashboard Telegram setup banner + register retellNotifyDispatch in /api/inngest/route.ts ✓ 2026-05-09
- [x] 05-05-PLAN.md — Phase 5 verification: confirm all implementations exist, verify Telegram secret_token validation wired (T-05-04-01), verify 20 tests passing, document D-07 caller_name deferral ✓ 2026-05-12

**Wave dependency notes:**

- **Wave 1** (`05-01`): no dependencies — installs packages, creates stubs, creates RED tests, documents env vars
- **Wave 2** (`05-02`): blocked on 05-01 — implements all four notification lib files (GREEN tests)
- **Wave 3** (`05-03`): blocked on 05-02 — Inngest dispatch function + classify extension
- **Wave 4** (`05-04`): blocked on 05-03 — Telegram webhook route + dashboard banner + Inngest registration
- **Wave 5** (`05-05`): verification plan — confirms all implementations and resolves verification gaps

**Cross-cutting constraints:**

- `import 'server-only'` required in all notification lib files and Inngest function
- `createServiceRoleClient()` for notification_log writes in Inngest function — never in client components
- TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, TWILIO_FROM_NUMBER, TELEGRAM_BOT_TOKEN — NEVER prefix with NEXT_PUBLIC_
- WhatsApp Content SIDs stored as TypeScript constants (WHATSAPP_CONTENT_SIDS) for v1 (D-16)
- `Promise.allSettled` mandatory for multi-channel dispatch (D-08) — one failure must not block others
- notification_log row written BEFORE send (status='pending'), updated AFTER (status='sent'/'failed') — D-12

**UI hint:** yes (dashboard Telegram setup banner)
**Notes:** CRITICAL — Submit WhatsApp Business Account (WABA) registration and notification templates (voicedesk_new_lead, voicedesk_emergency) in week 1 of build. WABA approval takes 3–7 business days. Register @VoiceDeskBot with @BotFather before Phase 5 ships. After first Vercel deploy, run: POST https://api.telegram.org/bot{TOKEN}/setWebhook with url={APP_URL}/api/webhooks/telegram to activate the webhook.

---

### Phase 6: Portal UI

**Goal:** Contractors can review every call, play recordings, manage leads, and configure their agent — all from a real-time-updating web dashboard.
**Depends on:** Phase 3 (calls data), Phase 4 (leads data), Phase 5 (notification context)
**Requirements:** PORTAL-01, PORTAL-02, PORTAL-03, PORTAL-04, PORTAL-05
**Success Criteria** (what must be TRUE):

  1. The call log shows all calls paginated, each with date, caller name, phone, duration, intent classification, and AI summary — and loads without requiring a page refresh when a new call completes
  2. Clicking any call entry plays back the recording (via 60-second TTL signed URL) and displays the full transcript in-page
  3. The lead list shows all leads with contact details, issue description, and appointment status; contractor can change a lead's status to Won, Lost, or Pending and the change persists
  4. The agent configuration form lets the contractor update business name, services offered, service area, emergency keywords, after-hours message, and agent voice — and saving the form updates the live Retell agent system prompt
  5. The dashboard updates in real time (via Supabase Realtime subscription) when a new call arrives or completes, without a page refresh — new calls appear at the top of the call log within 10 seconds of call end

**Plans:** 5 plans

- [x] 06-01-PLAN.md — React Query setup + call log table with pagination ✓ 2026-05-12
- [x] 06-02-PLAN.md — Lead list with status workflow and filtering ✓ 2026-05-12
- [x] 06-03-PLAN.md — Agent configuration tabs (Business Info | Hours | Keywords | Voice) with async Retell sync ✓ 2026-05-12
- [x] 06-04-PLAN.md — Supabase Realtime integration for live dashboard updates ✓ 2026-05-12
- [x] 06-05-PLAN.md — Call playback modal with 60s signed URL audio + transcript ✓ 2026-05-12

**Wave dependency notes:**

- **Wave 1** (`06-01`): no dependencies — installs React Query, builds call log table
- **Wave 2** (`06-02`) *(blocked on 06-01)*: lead list table with status dropdown and filters
- **Wave 3** (`06-03`) *(blocked on 06-02)*: agent config tabs with async Retell sync
- **Wave 4** (`06-04`) *(blocked on 06-01 + 06-02)*: Supabase Realtime subscription for live updates
- **Wave 5** (`06-05`) *(blocked on 06-04)*: call playback modal with signed URL audio + transcript

**Cross-cutting constraints:**

- `@tanstack/react-query` required for data fetching and cache management
- Supabase Realtime subscriptions must filter by contractor_id to prevent cross-tenant data exposure
- Recording signed URLs must have 60-second TTL — never expose raw storage URLs
- Service role key must never reach the client — all signed URLs generated server-side
- Retell agent sync triggered via Inngest after settings save (non-blocking)

**UI hint:** yes
**Notes:** Recordings are stored in a private Supabase Storage bucket. URLs must be server-generated signed URLs with 60-second TTL — never expose the storage URL directly to the browser. Service role key must never reach the client.

---

### Phase 7: Billing & Onboarding

**Goal:** Contractors can self-serve sign up with a card, complete a guided setup wizard that ends with a verified live test call, and the system enforces subscription status to protect infrastructure costs.
**Depends on:** Phase 2 (provisioning), Phase 3 (webhook, for test call detection), Phase 6 (portal shell, for wizard UI)
**Requirements:** BILL-01, BILL-02, BILL-03, ONBOARD-01, ONBOARD-02
**Success Criteria** (what must be TRUE):

  1. A new contractor can complete Stripe Checkout with a credit card, start a 14-day free trial, and land in the onboarding wizard without any manual intervention
  2. The onboarding wizard guides the contractor through agent configuration → Google Calendar connection → Twilio number provisioning → call forwarding instructions (with AT&T, Verizon, and T-Mobile carrier codes shown) in a linear, gated flow
  3. The wizard does not advance to "go live" status until an inbound test call is detected and logged for the contractor's VoiceDesk number — the portal polls every 5 seconds and auto-advances on detection
  4. A contractor with a failed payment receives a WhatsApp/SMS alert, and their Retell agent is deactivated within 72 hours of the final failed Stripe retry — they cannot incur Retell/Twilio costs on an unpaid subscription
  5. A contractor can access the Stripe Customer Portal from account settings to change plan, update payment method, or cancel — without contacting support

**Plans:** 7/7 plans complete

- [x] 07-01-PLAN.md — Stripe SDK install + lib modules (client, checkout, portal) ✓ 2026-05-12
- [x] 07-02-PLAN.md — Stripe webhook handler (checkout.completed, payment_failed, subscription.updated)
- [x] 07-03-PLAN.md — Onboarding wizard modal with 5 steps (Agent Config → Calendar → Phone → Forwarding → Test Call)
- [x] 07-04-PLAN.md — Test call verification via Supabase Realtime + 5s polling fallback
- [x] 07-05-PLAN.md — Payment failure Inngest function (deactivation + notification) + Customer Portal access

**UI hint:** yes
**Notes:** Check `subscription_status` from Supabase on every Retell agent API request — not just at login. Handle `invoice.payment_failed` Stripe webhook immediately. Stripe trial requires card-on-file (reduces abuse, matches demographics). WhatsApp opt-in consent checkbox and timestamp must be captured during onboarding for Meta compliance.

---

---

### Phase 8: Settings Refactor

**Goal:** Remove the onboarding wizard modal entirely. All setup and configuration lives in the Settings section as named tabs: Agent Config (existing), Calendar, Phone, Forwarding, and Go Live. Contractors can reach any setting at any time without a linear wizard flow.
**Depends on:** Phase 7
**Requirements:** ONBOARD-01 (re-implementation without wizard modal)
**Success Criteria** (what must be TRUE):

  1. The onboarding wizard modal and `SetupBanner` are deleted — no modal appears on first login, dashboard is clean
  2. `/setup/phone` is unchanged — provisioning continues to happen after Stripe checkout completes
  3. Settings navigation has six tabs: Agent Config · Calendar · Phone · Go Live · Account · Notifications
  4. `settings/calendar` — Google Calendar connect/disconnect works
  5. `settings/phone` — shows the provisioned VoiceDesk number (read-only) and AT&T/Verizon/T-Mobile forwarding instructions
  6. `settings/go-live` — Realtime test call detection + `markContractorLive` fires correctly; already-live contractors see confirmation state
  7. No dead imports, no orphaned wizard step components, `npm run build` exits 0

**UI hint:** yes
**Plans:** 3/3 plans complete
Plans:

- [x] 08-01-PLAN.md — Delete onboarding wizard directory, SetupBanner, and remove from dashboard layout
- [x] 08-02-PLAN.md — Create settings/calendar, settings/phone, settings/go-live pages + update Sidebar nav ✓ 2026-05-20
- [x] 08-03-PLAN.md — Dead-import audit + npm run build verification ✓ 2026-05-20

---

---

### Phase 9: Hardening & UX Polish

**Goal:** Address cross-AI review findings and close UX gaps before beta launch: add error observability, make emergency keywords configurable per contractor, fix the Telegram bot name, move phone provisioning into settings/phone so contractors can self-serve a number, and surface the provisioned number in the Sidebar.
**Depends on:** Phase 8
**Requirements:** ONBOARD-01 (settings/phone provisioning), EMRG-01 (configurable keywords), NOTIF-03 (correct Telegram bot)
**Success Criteria** (what must be TRUE):

  1. `voiceDeskTelBot` is the bot name everywhere — no reference to `voiceDeskBot` remains in source or UI
  2. Contractors can provision their Twilio/Retell phone number directly from `settings/phone` without visiting the old `/setup/phone` flow — the button calls the existing provisioning API and shows the result inline
  3. Once provisioned, the phone number is displayed in the Sidebar bottom-left between business name and email on all dashboard pages
  4. `settings/agent` → Emergency Keywords tab lets contractors add/remove custom keywords on top of the hard-coded gas smell / CO alarm baseline; changes persist to `contractor_settings`
  5. Uncaught errors in `after()` webhook processing and Inngest functions are logged with enough context (contractor_id, call_id, error message) that failures are diagnosable without a Supabase query

**UI hint:** yes
**Plans:** 2 plans
Plans:

- [ ] 09-01-PLAN.md — Telegram bot name fix (VoiceDeskBot → voiceDeskTelBot in 3 files) + structured JSON console.error at all Inngest onFailure handlers and after() catch block
- [ ] 09-02-PLAN.md — settings/phone: two-state provisioning form (area code input + Provision My Number button) + router.refresh() on success so Sidebar updates automatically

### Phase 10: Notification settings form — sms_number + whatsapp_number write UI

**Goal:** Contractors can configure all notification channels (SMS, WhatsApp, Telegram) from a single settings page — entering phone numbers, enabling/disabling channels, and controlling which call events trigger alerts.
**Requirements:** NOTIF-01, NOTIF-02, NOTIF-03, EMRG-03, PORTAL-04
**Depends on:** Phase 9
**Plans:** 5/5 plans complete

Plans:
**Wave 1**

- [x] 10-01-PLAN.md — Wave 0: migration (3 boolean enable columns) + TypeScript type extension + 4 test stubs in RED state

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 10-02-PLAN.md — PATCH /api/notification-settings + POST /api/notification-settings/telegram/unlink + React Query hooks (useNotificationSettings, useUpdateNotificationSettings, useTelegramUnlink)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 10-03-PLAN.md — TDD: computeChannels() updated with enable flag gates (notify_sms_enabled, notify_whatsapp_enabled, notify_telegram_enabled)
- [x] 10-04-PLAN.md — NotificationSettingsForm component (SMS, WhatsApp, Telegram, event toggles sections)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 10-05-PLAN.md — settings/notifications Server Component wiring + [BLOCKING] supabase db push + human verify

### Phase 11: Account page subscription load fix + BILL-03 deactivation

**Goal:** Repair the account page subscription load (silent failure, missing trialing UI, duplicate loading states) and store trial_ends_at via Stripe webhook; update BILL-03 deactivation to respect Phase 10 channel-enable flags, introduce is_active boolean, and implement auto-reactivation when payment recovers.
**Requirements**: D-01 through D-11 (from 11-CONTEXT.md)
**Depends on:** Phase 10
**Plans:** 7/7 plans complete

**Wave 1** *(schema gate — blocks all other waves)*

- [x] 11-01-PLAN.md — Migration: add is_active BOOLEAN NOT NULL DEFAULT TRUE + trial_ends_at TIMESTAMPTZ to contractors table; [BLOCKING] supabase db push; update Contractor TypeScript type

**Wave 2** *(parallel — no file conflicts, blocked on 11-01)*

- [x] 11-02-PLAN.md — payment-alert.ts: channel-flag gating (D-05 — smsEnabled/whatsappEnabled); stripe-payment-failure.ts: D-06 notification_settings join + D-08 is_active=false write (replaces agent_sync_status hack)
- [x] 11-03-PLAN.md — handlers.ts: D-04 trial_ends_at write in checkout handler + D-10 reactivation (is_active=true + Retell re-link guarded by D-11); subscription route: add trial_ends_at + is_active to response

**Wave 3** *(blocked on 11-01 + 11-03)*

- [x] 11-04-PLAN.md — middleware.ts: D-09 is_active redirect guard (deactivated → /settings/account); retell-call-classify.ts: is_active early return in load-contractor step (no leads/appointments for deactivated contractors)
- [x] 11-05-PLAN.md — account/page.tsx: D-01 error state, D-02 trialing badge + trial end date, D-03 remove duplicate loading, D-09 deactivated banner with Update Payment CTA

**Wave 4** *(TDD — blocked on 11-02 and 11-04)*

- [x] 11-06-PLAN.md — TDD: payment-alert.ts channel-flag gating (6 tests: smsEnabled/whatsappEnabled/smsNumber gates)
- [x] 11-07-PLAN.md — TDD: retell-call-classify is_active early return (3 tests: deactivated skip, active proceeds, not-found error)

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 5/5 | Complete | 2026-05-05 |
| 2. Provisioning | 5/5 | Complete | 2026-05-07 |
| 3. Webhook Core | 4/4 | Complete | 2026-05-08 |
| 4. Scheduling & Lead Capture | 6/6 | Complete | 2026-05-08 |
| 5. Notifications | 5/5 | Complete | 2026-05-12 |
| 6. Portal UI | 5/5 | Complete | 2026-05-12 |
| 7. Billing & Onboarding | 8/8 | Complete | 2026-05-20 |
| 8. Settings Refactor | 3/3 | Complete | 2026-05-20 |
| 9. Hardening & UX Polish | 2/2 | Complete | 2026-05-24 |
| 10. Notification Settings Form | 5/5 | Complete | 2026-05-24 |
| 11. Account Subscription Fix + BILL-03 | 7/7 | Complete | 2026-05-24 |

</details>

---

## Milestone v1.1 — Notifications & UI Brand

**Goal:** Complete the notification layer (email, in-app bell, Telegram self-serve activation) and apply the Wolknitive Design System across the entire application.

## Phases

- [x] **Phase 12: Notification Foundation** - DB migrations (app_notifications + email columns) + TypeScript types + email lib (completed 2026-05-25)
- [x] **Phase 13: Email Notifications** - Email channel in Inngest dispatch + payment alert email + API schema extension (completed 2026-05-25)
- [x] **Phase 14: In-App Notification Bell** - Inngest write step + React Query hooks + Supabase Realtime + NotificationBell UI (completed 2026-05-29)
- [x] **Phase 15: Telegram Activation** - Server action (activateTelegramWebhook) + settings UI card with status display (completed 2026-05-30)
- [ ] **Phase 16: Design System Sweep** - Wolknitive token extraction + globals.css @theme block + full component sweep

---

## Phase Details

### Phase 12: Notification Foundation

**Goal:** The database schema supports email notifications and in-app notification persistence, TypeScript types are updated, and a unit-tested email lib is ready for Inngest to consume — all downstream phases are unblocked.
**Depends on:** Phase 11
**Requirements:** EMAIL-01, EMAIL-05, BELL-04
**Success Criteria** (what must be TRUE):

  1. `app_notifications` table exists in Supabase with RLS using the contractor subquery pattern (`(SELECT id FROM contractors WHERE user_id = auth.uid())`) — no cross-tenant row access possible
  2. `ALTER PUBLICATION supabase_realtime ADD TABLE app_notifications` is present in the migration — Realtime events fire for inserts on this table
  3. `notification_settings` has three new columns: `notify_email_enabled BOOLEAN NOT NULL DEFAULT FALSE`, `email_address TEXT`, and `notify_on_payment_failure BOOLEAN NOT NULL DEFAULT FALSE`
  4. `src/lib/notifications/email.ts` exports `sendEmail()` with unit tests green — the function can be called with a subject/body/recipient and returns success/failure without hitting Resend in tests
  5. TypeScript database types are regenerated and `tsc` exits 0 across the entire project

**Plans:** 3/3 plans complete

Plans:
**Wave 1**

- [x] 12-01-PLAN.md — Migration SQL (app_notifications table + notification_settings email columns + notification_log channel extension) + TypeScript types (NotificationChannel | email, AppNotification interface, NotificationSettings 3 new fields)
- [x] 12-02-PLAN.md — TDD: sendEmail() transport at src/lib/notifications/email.ts (5 tests RED->GREEN, non-throwing, vi.mock resend)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 12-03-PLAN.md — [BLOCKING] supabase db push + human verify schema + tsc --noEmit + npm run test phase gate

**UI hint:** no

---

### Phase 13: Email Notifications

**Goal:** Contractors who have opted in receive email alerts for new leads, emergencies, and payment failures — delivered within 60 seconds via Resend — and all sends are logged in `notification_log`.
**Depends on:** Phase 12
**Requirements:** EMAIL-02, EMAIL-03, EMAIL-04, EMAIL-05
**Success Criteria** (what must be TRUE):

  1. A contractor with `notify_email_enabled = true` and a valid `email_address` receives an email within 60 seconds of a new lead call, containing caller phone number, service type, and appointment status
  2. An emergency call email arrives with "EMERGENCY" prominently in the subject line and body, containing the caller's callback number
  3. A Stripe payment failure triggers an email to the contractor with a direct link to the Stripe billing portal — the email fires from the existing `stripe-payment-failure` Inngest function
  4. Email sends where `email_address` is null or `notify_email_enabled = false` are silently skipped — no error, no log entry
  5. Every email attempt (success or failure) writes a `notification_log` row with `channel: 'email'` — failed sends are retried by Inngest's built-in retry without generating duplicate log entries

**Plans:** 4/4 plans complete

Plans:
**Wave 1**

- [x] 13-01-PLAN.md — npm install (@react-email/components@1.0.12 + @react-email/render@2.0.8) + three RED test scaffolds (templates, computeChannels email gate, stripe-payment-failure triple gate)

**Wave 2** *(blocked on Wave 1 completion, parallel)*

- [x] 13-02-PLAN.md — TDD: Three React Email JSX templates (LeadNotificationEmail, EmergencyNotificationEmail, PaymentFailureEmail) GREEN
- [x] 13-03-PLAN.md — TDD: computeChannels() extended with shouldSendEmail + load-notification-data select expanded GREEN

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 13-04-PLAN.md — Wire send-email step in retellNotifyDispatch + send-email-alert step in stripePaymentFailureHandler; full suite GREEN

**UI hint:** no

---

### Phase 14: In-App Notification Bell

**Goal:** Contractors see a live unread count in the dashboard header that updates in real time, can open a feed of recent notifications, and can mark all as read — with notifications surviving browser close.
**Depends on:** Phase 12
**Requirements:** BELL-01, BELL-02, BELL-03, BELL-04, EMAIL-01
**Success Criteria** (what must be TRUE):

  1. A bell icon appears in the dashboard header showing an unread badge count; when a new call is processed, the badge increments without a page refresh (Supabase Realtime delivers the update)
  2. Clicking the bell opens a popover listing the 50 most recent notifications, each showing event type, title, body excerpt, and relative time (e.g. "3 minutes ago")
  3. Clicking "Mark all read" clears the unread badge immediately and the cleared state persists across browser sessions — reopening the browser shows 0 unread for those notifications
  4. Notifications written during call processing remain visible in the feed after browser close and reopen — they are fetched from `app_notifications` on mount
  5. The Notification Settings page includes an email address input field and an "Enable email alerts" toggle — saving the form persists `notify_email_enabled` and `email_address` to `notification_settings`

**Plans:** 5/5 plans complete

Plans:

- [x] 14-01-PLAN.md — Install @radix-ui/react-popover + scaffold RED test stubs (bell-formatter, mark-all-read)
- [x] 14-02-PLAN.md — TDD: computeBellNotification() + write-bell-notification Inngest step (early-return guard restructured)
- [x] 14-03-PLAN.md — TDD: PATCH /api/notifications/mark-all-read + extend notification-settings Zod schema with email fields
- [x] 14-04-PLAN.md — React Query hooks (useNotifications, useUnreadCount, useMarkAllRead) + Supabase Realtime hook + NotificationBell component
- [x] 14-05-PLAN.md — Wire NotificationBell into Sidebar + BottomTabBar + NotificationSettingsForm Email card + human UAT

**Wave dependency notes:**

- **Wave 1** (`14-01`): no dependencies — installs @radix-ui/react-popover, writes RED test stubs
- **Wave 2** (`14-02`, `14-03`) *(blocked on Wave 1, parallel)*: TDD computeBellNotification() + Inngest step; TDD mark-all-read API route
- **Wave 3** (`14-04`) *(blocked on Wave 2)*: React Query hooks + Realtime subscription + NotificationBell component
- **Wave 4** (`14-05`) *(blocked on Wave 3)*: UI wiring into Sidebar/BottomTabBar + Email form card + human UAT (autonomous: false)

**Cross-cutting constraints:**

- Bell write in Inngest is unconditional — placed BEFORE the channel-enable early-return guard (D-04)
- Supabase Realtime subscription must include `contractor_id=eq.{contractorId}` filter (IDOR guard)
- `@radix-ui/react-popover` install must precede all component work (Wave 0 gate)
- One NotificationBell instance per viewport: Sidebar (desktop, md:flex visible) and BottomTabBar (mobile, when Sidebar is hidden)

**UI hint:** yes

---

### Phase 15: Telegram Activation

**Goal:** An admin can activate the platform Telegram webhook from the settings page with one click, and the current registration status is always visible on page load.
**Depends on:** Phase 14
**Requirements:** TEL-01, TEL-02
**Success Criteria** (what must be TRUE):

  1. The Notification Settings page shows the current Telegram webhook status on load — either the registered webhook URL or "Not registered" — fetched via `getWebhookInfo` from the grammy v1.x SDK
  2. Clicking "Activate Telegram Webhook" triggers a server action that calls `bot.api.setWebhook(url, { secret_token })` using the existing `TELEGRAM_BOT_TOKEN` env var — no new DB columns, no new packages
  3. On success, the status display updates to show the newly registered webhook URL without a page reload
  4. On failure (e.g. network error, invalid token), an error message is displayed inline — the page does not crash and the previous status remains visible

**Plans:** 2/2 plans complete

Plans:
**Wave 1**

- [x] 15-01-PLAN.md — Wave 0: RED test stubs (server action + component card) + .env.example TELEGRAM_WEBHOOK_URL entry

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 15-02-PLAN.md — activateTelegramWebhook() server action (GREEN) + page.tsx getWebhookInfo on load + NotificationSettingsForm webhook card + human UAT

**UI hint:** yes

---

### Phase 16: Design System Sweep

**Goal:** The entire application uses Wolknitive brand tokens consistently — no hardcoded hex values remain in component files, the build is clean, and all existing regression tests still pass.
**Depends on:** Phase 15
**Requirements:** BRAND-01, BRAND-02, BRAND-03, BRAND-04
**Success Criteria** (what must be TRUE):

  1. All Wolknitive color, typography, and spacing tokens are defined as CSS custom properties under `@theme {}` and `:root {}` in `globals.css` and are available as Tailwind utility class names
  2. A grep for `[#` across all component files (excluding `globals.css`) returns zero results — no hardcoded hex arbitrary Tailwind values remain
  3. All dashboard pages (call log, leads, agent config, all settings tabs, account page) and auth pages (login, signup) render using brand token classes consistently — visual inspection passes
  4. `npm run build` exits 0 with no TypeScript or Tailwind errors
  5. All 15 v1.0 regression tests pass in `tests/regression-v1-smoke.spec.ts` — no regressions introduced by the token sweep

**Plans:** TBD
**UI hint:** yes

---

## Progress Table (v1.1)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 12. Notification Foundation | 3/3 | Complete    | 2026-05-25 |
| 13. Email Notifications | 4/4 | Complete    | 2026-05-25 |
| 14. In-App Notification Bell | 5/5 | Complete   | 2026-05-29 |
| 15. Telegram Activation | 2/2 | Complete   | 2026-05-30 |
| 16. Design System Sweep | 0/TBD | Not started | - |

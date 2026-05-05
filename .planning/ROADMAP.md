# VoiceDesk Roadmap

## Milestone 1: v1.0 — Revenue-Ready MVP

**Goal:** A contractor can sign up, configure their AI receptionist (in English, Spanish, or Haitian Creole), receive a dedicated phone number, and immediately start capturing leads, booking appointments, and receiving real-time notifications — with Stripe billing collecting revenue.
**Target:** 90-day soft launch to 20–30 contractors (South Florida market: Spanish and Haitian Creole support from day one)

---

## Phases

- [ ] **Phase 1: Foundation** - Supabase schema, RLS, auth, account creation, and multi-language agent configuration (English, Spanish, Haitian Creole)
- [ ] **Phase 2: Provisioning** - Twilio number provisioning and Retell agent creation per contractor
- [ ] **Phase 3: Webhook Core** - Retell webhook handler, call persistence, and intent classification
- [ ] **Phase 4: Scheduling & Lead Capture** - Google Calendar OAuth, availability windows, appointment booking, and lead records
- [ ] **Phase 5: Notifications** - SMS, WhatsApp, and Telegram multi-channel dispatch for all call outcomes
- [ ] **Phase 6: Portal UI** - Contractor dashboard: call log, recordings, lead list, agent configuration, real-time updates
- [ ] **Phase 7: Billing & Onboarding** - Stripe Checkout, subscription gating, onboarding wizard with mandatory test call gate

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
- [ ] 01-05-PLAN.md — Dashboard shell (Sidebar + SetupBanner + EmptyState + BottomTabBar + 6 page slots) + RLS isolation test seeded and passing live (D-18)
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
**Plans:** TBD
**UI hint:** no
**Notes:** Use Retell's managed Twilio integration (link Twilio Account SID + Auth Token in Retell dashboard) — do NOT use raw TwiML/SIP. Verify exact Retell API call sequence for number import against current docs before writing provisioning code. Retell agent must be created with the contractor's configured language set — verify Haitian Creole support in Retell before this phase; fall back to custom LLM endpoint if not natively supported.

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
**Plans:** TBD
**UI hint:** no
**Notes:** Webhook handler must return HTTP 200 within 10 seconds — all downstream processing runs inside Vercel `waitUntil()`. Verify Retell webhook signature header name and `call_ended` vs `call_analyzed` event timing against live Retell docs before writing a single line of handler logic. `call_analyzed` is the canonical source for transcript and summary (fires 1–3 min after call end).

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
**Plans:** TBD
**UI hint:** no
**Notes:** OAuth tokens are encrypted with AES-256-GCM before writing to `calendar_credentials` — encryption utility from Phase 1 is required here. Request `calendar.events` + `calendar.freebusy` scopes on first grant to avoid re-auth later. Use DB-level row lock (SELECT FOR UPDATE) for booking conflict prevention. Move Google OAuth app to production mode before the first beta contractor connects — testing mode silently expires tokens after 7 days.

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
**Plans:** TBD
**UI hint:** no
**Notes:** CRITICAL — Submit WhatsApp Business Account (WABA) registration and all notification templates (emergency alert, new lead, payment failed) in week 1 of the build, in parallel with Phase 1 coding. WABA approval takes 3–7 business days. Blocking launch if started late. Use `Promise.allSettled` for multi-channel sends — one channel failure must not block others.

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
**Plans:** TBD
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
  3. The wizard does not advance to "go live" status until an inbound test call is detected on the contractor's VoiceDesk number — the portal polls every 5 seconds and auto-advances on detection
  4. A contractor with a failed payment receives a WhatsApp/SMS alert, and their Retell agent is deactivated within 72 hours of the final failed Stripe retry — they cannot incur Retell/Twilio costs on an unpaid subscription
  5. A contractor can access the Stripe Customer Portal from account settings to change plan, update payment method, or cancel — without contacting support
**Plans:** TBD
**UI hint:** yes
**Notes:** Check `subscription_status` from Supabase on every Retell agent API request — not just at login. Handle `invoice.payment_failed` Stripe webhook immediately. Stripe trial requires card-on-file (reduces abuse, matches demographics). WhatsApp opt-in consent checkbox and timestamp must be captured during onboarding for Meta compliance.

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/5 | In Progress | - |
| 2. Provisioning | 0/TBD | Not started | - |
| 3. Webhook Core | 0/TBD | Not started | - |
| 4. Scheduling & Lead Capture | 0/TBD | Not started | - |
| 5. Notifications | 0/TBD | Not started | - |
| 6. Portal UI | 0/TBD | Not started | - |
| 7. Billing & Onboarding | 0/TBD | Not started | - |

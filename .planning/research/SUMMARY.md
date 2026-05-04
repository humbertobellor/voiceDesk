# Research Summary — VoiceDesk

**Synthesized:** 2026-05-03
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md, PROJECT.md

---

## Executive Summary

VoiceDesk is a focused vertical SaaS product: an AI phone receptionist built exclusively for home-service contractors who miss 40%+ of calls while on job sites. The research confirms that the market has real pain, the chosen technology stack is sound, and the build scope is appropriately contained for a solo/small-team launch targeting revenue within 90 days. The core value chain is: Twilio receives the call → Retell handles the conversation → webhook pipeline classifies intent and persists data → Supabase notifies the contractor portal and pushes WhatsApp/SMS/Telegram alerts. Every architectural decision should protect the reliability of that chain.

The biggest differentiator over generic voice AI platforms (Synthflow, Goodcall) is vertical depth: trade-specific qualification logic for HVAC, plumbing, and electrical; emergency escalation with sensible defaults; and a configurable agent that feels like it knows the contractor's business. The competitor market is thin on this vertical focus, and contractors will pay $299–$799/month to replace a dumb answering service if the AI reliably captures leads and books jobs.

The highest-risk areas are not technical but operational: WhatsApp Business Account approval takes 3–7 business days and must start in week 1; Google OAuth apps in "testing" mode silently expire tokens after 7 days; and contractor onboarding drop-off at the call-forwarding step is the #1 churn trigger before a contractor even uses the product. Mitigating these three risks before they become launch blockers is the most leveraged early action.

---

## Recommended Stack

| Technology | Chosen Option | Why | Confidence |
|------------|---------------|-----|------------|
| Voice AI | Retell AI (v2 SDK) | Lower latency than Vapi; managed Twilio integration; custom tools for mid-call function calls | MEDIUM — verify webhook signature method name against live docs |
| Telephony | Twilio (SDK v5) | Stable API; number provisioning; WhatsApp channel; SMS fallback in one account | HIGH |
| Database + Auth | Supabase (`@supabase/ssr`) | Built-in auth, RLS, Realtime subscriptions, Storage — eliminates separate auth service | HIGH |
| Hosting | Vercel (Pro tier required) | Zero-ops; `waitUntil()` for async webhook processing; Next.js native | HIGH |
| Framework | Next.js 14 (App Router) | Server Actions + Route Handlers cover portal and API; TypeScript end-to-end | HIGH |
| Billing | Stripe Checkout + webhooks | Hosted checkout (zero PCI scope); subscription lifecycle events; Customer Portal for self-serve | HIGH |
| Calendar | Google Calendar API (`googleapis`) | OAuth 2.0; covers ~70% of small contractors; no FSM complexity | HIGH |
| WhatsApp | Twilio WhatsApp (not Meta Cloud API) | Avoids Meta business verification overhead; 5-day vs 3-week setup | MEDIUM — Meta policies change frequently |
| Telegram | grammY | Better TypeScript than node-telegram-bot-api; webhook-compatible with Vercel; actively maintained | HIGH |
| Background jobs | Inngest (free tier) | Serverless-native; handles retries and deduplication without Redis infrastructure | MEDIUM — verify free tier limits |
| Encryption | Node.js `crypto` AES-256-GCM | App-layer encryption of OAuth tokens before Supabase write | HIGH |
| Supporting libs | `zod`, `libphonenumber-js`, `date-fns-tz` | Webhook validation, phone normalization, timezone-safe appointment booking | HIGH |

---

## Table Stakes Features

A contractor will not pay $299/month if any of these are missing or unreliable:

- **24/7 inbound call answering** — must answer in under 3 rings; silent failures (call falls to voicemail anyway) are immediate churn; voice latency must feel under 1 second to the caller
- **Lead capture** — caller name, callback number, problem description; AI must confirm what it captured before ending the call
- **Appointment scheduling into Google Calendar** — the primary differentiator over human answering services; double-bookings and wrong timezones destroy trust immediately
- **Emergency escalation with real-time notification** — HVAC/plumbing/electrical emergencies (gas leak, no heat, burst pipe, burning smell) must alert the contractor within 30 seconds of call end via WhatsApp or SMS; this is a safety requirement, not a feature
- **Call log with recording playback and AI summary** — contractors must verify what the AI said and what was promised; raw transcript alone is not enough
- **Agent configuration** — business name, hours, services offered, emergency keywords, service area; a generic-sounding agent that quotes wrong hours churns immediately
- **Unique Twilio phone number per contractor** — the activation mechanism; without it there is no product
- **New-lead notification on every call** — non-emergency leads also need a prompt WhatsApp/SMS alert with caller name, phone, issue, and whether an appointment was booked
- **Self-service Stripe signup** — contractors will not call a salesperson; card-on-file free trial dramatically increases conversion in this trust-sensitive demographic

---

## Key Architecture Decisions

### Decision 1: Webhook-First Architecture — Retell Webhooks Drive All Business Logic

**Decision:** The product's core logic lives in the Retell webhook handler (`/api/webhooks/retell`), not in the portal or any polling loop. Every call outcome (lead creation, calendar booking, notification dispatch) is triggered by `call_ended` and `call_analyzed` webhook events.

**Rationale:** Retell fires events reliably after every call. Polling Retell's API for call status is wasteful and slower. The webhook is the authoritative event source.

**Implication for build order:** The webhook handler must be built and hardened before any portal UI. A working webhook → Supabase → notification pipeline with no portal is already a shippable product for early beta contractors.

---

### Decision 2: Return 200 Immediately — Process Asynchronously with `waitUntil()`

**Decision:** The Retell webhook handler verifies the signature, writes the raw payload to a `webhook_events` idempotency table, returns HTTP 200, and does all downstream work (DB writes, Calendar API, notifications) inside Vercel's `waitUntil()`.

**Rationale:** Retell expects a 200 response within ~10 seconds. Calendar API calls and Twilio SMS calls are unpredictable in latency. Any synchronous processing risks timeout → Retell retry → duplicate records and duplicate notifications.

**Implication for build order:** Implement the idempotency table (`webhook_events` with a unique constraint on `source + event_type + external_id`) in the schema migration before writing any webhook processing logic.

---

### Decision 3: Row-Level Security Enabled on Every Table from Day One

**Decision:** Every Supabase table gets RLS enabled and policies for SELECT, INSERT, UPDATE, and DELETE in the same migration that creates the table. No exceptions for development speed.

**Rationale:** A single contractor seeing another contractor's call recordings or lead data is a business-ending trust event. RLS is far harder to retrofit than to apply at schema creation. The service role key must never reach the browser.

**Implication for build order:** Schema migrations are gated: no table ships without RLS. Test RLS as an unprivileged user before each phase ships. Recordings bucket in Supabase Storage must be private with server-generated signed URLs (60-second TTL).

---

### Decision 4: Encrypt Google OAuth Tokens at the Application Layer Before Writing to Supabase

**Decision:** `access_token` and `refresh_token` are encrypted with AES-256-GCM using a `OAUTH_ENCRYPTION_KEY` env var before being written to `calendar_credentials`. Decryption happens only in server-side API routes.

**Rationale:** Supabase Postgres does not encrypt individual columns by default. A misconfigured RLS policy or a Supabase-side breach would otherwise expose every contractor's Google Calendar access. Refresh tokens are long-lived and grant write access to contractors' calendars.

**Implication for build order:** The encryption utility must be built before the Google OAuth callback route is written.

---

### Decision 5: Retell Manages Twilio Integration Natively — Do Not Use Raw TwiML SIP

**Decision:** Provision Twilio numbers through Retell's managed Twilio integration (link Twilio Account SID + Auth Token in Retell dashboard), not via custom TwiML forwarding to a Retell SIP endpoint.

**Rationale:** Raw SIP trunk configuration between Twilio and Retell requires manual IP whitelisting, SIP credential management, and TwiML app configuration that is error-prone. Retell's native integration handles this automatically.

**Implication for build order:** Twilio number provisioning and Retell agent creation are separate steps, but the linkage uses Retell's API to import the Twilio number. Verify the exact API call sequence in current Retell docs before writing provisioning code.

---

## Critical Pitfalls to Avoid

Ordered by severity and probability of causing launch failure or early churn:

### 1. Google OAuth App Left in "Testing" Mode — Silent 7-Day Token Expiry [CRITICAL]

Refresh tokens issued in Google OAuth "testing" mode expire after 7 days. A contractor who connects their calendar during beta has it stop booking silently after one week, with no error surfacing to them. **Prevention:** Move the OAuth app to production mode (or add each beta contractor's Google account as a test user under the 100-user limit) before any contractor connects their calendar. Do this before first onboarding.

### 2. WhatsApp Business Account Not Started in Week 1 — Blocks Launch [CRITICAL]

WABA verification and pre-approved template approval through Twilio takes 3–7 business days minimum. Every emergency alert must use a pre-approved template (contractors are always outside the 24-hour session window). If WABA approval is not started until after core development, it blocks launch. **Prevention:** Submit WABA registration and all notification templates (emergency alert, new lead, payment failed, weekly summary) in week 1, running in parallel with code. Build SMS as an automatic fallback for every WhatsApp notification.

### 3. Webhook Handler Blocks on Downstream Work — Retell Retries, Duplicate Records [CRITICAL]

Processing Calendar API calls, Twilio SMS sends, and Supabase writes synchronously inside the webhook handler before returning 200 causes timeouts on slow calls. Retell retries → duplicate leads, duplicate notifications. **Prevention:** `webhook_events` idempotency table with unique constraint + Vercel `waitUntil()` for all post-200 work. Build this pattern before handling a single real call.

### 4. Supabase RLS Gaps — Contractor Data Cross-Contamination [CRITICAL]

Tables created without RLS, or policies missing the INSERT operation, allow data leakage between contractors. A contractor who can see another's call log is a product-ending event. **Prevention:** Every migration includes RLS enable + all four operation policies. Test as an unprivileged user before each phase ships. Storage bucket for recordings is private; serve only server-generated signed URLs.

### 5. Call Forwarding Drop-off at Onboarding — Contractor Never Goes Live [HIGH]

The #1 drop-off point in voice AI SMB SaaS is call forwarding setup. Contractors enter wrong carrier codes, enable conditional instead of unconditional forwarding, and never get a successful first call. They pay but never go live. **Prevention:** Mandatory test call gate in onboarding — the flow does not advance until an inbound call is detected. Show carrier-specific forwarding codes (AT&T, Verizon, T-Mobile). Poll backend every 5 seconds during this step and auto-advance on detection.

### 6. Emergency Keyword False Positives — Contractor Disables Emergency Alerts [HIGH]

"My toilet has been running" triggering a 3am emergency alert causes contractors to disable emergency escalation, removing the product's most critical safety feature. **Prevention:** Two-stage detection — keyword match triggers a clarifying question ("Is this happening right now?"), then LLM classification confirms. Gas smell and CO alarm are non-configurable hard triggers. Test 20 adversarial scenarios before any contractor goes live.

### 7. Stripe Subscription Status Not Checked Per Request — Unpaid Contractors Incur Costs [HIGH]

Checking subscription status only at login means a contractor with a declined card uses Retell/Twilio infrastructure (at $0.05–$0.10/minute) for up to 72 hours on your cost. **Prevention:** Check `subscription_status` from Supabase on every agent API request. Handle `invoice.payment_failed` webhook immediately with WhatsApp alert. After 3 failed retries, deactivate the Retell agent.

---

## Build Order Recommendation

Derived from the architecture dependency graph: schema gates everything; webhook handler is the product core; portal UI is secondary to the notification pipeline.

1. **Supabase schema + RLS** — all tables, all policies, idempotency table, notification log, key indexes. Nothing else ships without this foundation.

2. **Supabase Auth + basic contractor onboarding UI** — email/password signup, `contractors` row creation, timezone capture. A `contractor_id` is required before any provisioning.

3. **Retell agent creation + Twilio number provisioning** — provision Twilio number via API, import into Retell via managed integration, create Retell LLM + agent with contractor-specific system prompt. Include post-provisioning test call verification.

4. **Retell webhook handler** — signature verification, idempotency write, return 200, `waitUntil()` skeleton. Get this running and verified with test calls before adding any business logic.

5. **Call record persistence + intent classification** — upsert `calls` row from webhook payload; keyword + LLM intent classification (lead / emergency / info / no-action); transcript and summary from `call_analyzed` event.

6. **Lead creation + Google Calendar OAuth + booking** — Google OAuth flow with `access_type: offline` and `prompt: consent`; token encryption; proactive token refresh; DB-level booking lock for concurrent conflict prevention; create `leads` row and Google Calendar event.

7. **Notification dispatch** — SMS (Twilio), WhatsApp (Twilio, pre-approved templates), Telegram (grammY); `Promise.allSettled` multi-channel send; `notification_log` status tracking; SMS always fires as fallback. Onboarding Telegram link flow.

8. **Contractor portal UI** — call log with recording playback and AI summary, lead list with status, agent configuration form, real-time updates via Supabase Realtime subscriptions.

9. **Stripe billing + subscription gating** — Stripe Checkout with trial, `checkout.session.completed` webhook triggers provisioning, subscription status enforcement on every agent API request, Customer Portal for self-serve plan changes.

10. **Onboarding wizard polish + mandatory test call gate** — guided setup with carrier-specific forwarding instructions, backend polling for first inbound call, WhatsApp confirmation on go-live, recovery flow for contractors who stall within 72 hours.

11. **Trade-specific qualification logic + business hours awareness** — HVAC/plumbing/electrical question templates injected into Retell system prompt; business hours check with after-hours vs. in-hours prompt branching.

---

## Open Questions

Decisions that need answers before or during implementation:

1. **Retell webhook retry policy** — Does Retell retry on non-200? What is the retry window and backoff? The idempotency table design assumes retries but exact behavior needs live doc verification. [VERIFY]

2. **`call_analyzed` vs `call_ended` event timing** — STACK.md says `call_analyzed` fires 1–3 minutes after call end and is the canonical source for transcript/summary. Clarify which event carries the full transcript before writing the webhook handler. [VERIFY against current Retell docs]

3. **Google OAuth scope** — Request `calendar.readonly` + `calendar.events` + `calendar.freebusy` on first grant, or just `calendar.events`? Over-scoping at first grant is better than requiring re-auth later. Product decision needed.

4. **Stripe trial with vs. without credit card** — Requiring a card blocks trial abuse but reduces top-of-funnel conversion. Research recommends card-required; confirm this matches the crowdfunding/early-adopter acquisition approach.

5. **Intent classification model** — Use LLM classification for emergencies only (high-stakes, latency acceptable) and keyword-only for lead vs. info (low-stakes)? Benchmark GPT-4o-mini vs GPT-4o for turn latency in test calls before committing.

6. **Appointment availability — real-time check vs. configured windows** — Checking Google Calendar availability mid-call requires a Retell tool call (adds cold-start latency). Alternative: contractor-configured availability windows with post-call conflict handling. Product decision: accept booking conflicts or incur latency?

7. **Vercel Pro tier** — Required for `maxDuration: 300` on webhook functions. Confirm $20/month is included in the $2,800–$3,800 budget constraint.

8. **Recording storage retention policy** — At ~4MB/call × 30 contractors × 50 calls/month = ~6GB/month in Supabase Storage. Define retention window (90 days? 1 year?) and confirm unit economics hold at scale.

9. **WhatsApp opt-in consent language** — Meta requires documented contractor opt-in to receive WhatsApp messages. Capture this in onboarding with a checkbox and timestamp. Exact wording may need legal review before Wefunder/Republic raise.

---

## Confidence Assessment

| Area | Confidence | Key Gaps |
|------|------------|----------|
| Stack selection | HIGH | Inngest free tier limits need verification; Retell SDK exact method names need live doc check |
| Feature priorities | HIGH | Competitor pricing/features may have shifted since Aug 2025 training cutoff |
| Architecture patterns | HIGH | Retell webhook event names, payload shapes, and retry policy need live verification |
| Critical pitfalls | HIGH | WhatsApp/Meta policy specifics are MEDIUM — policy changes frequently |
| Build order | HIGH | Dependencies are clear; no significant sequencing uncertainty |

**Overall confidence: HIGH** — with the caveat that Retell-specific implementation details (webhook signature header name, exact event names, LLM model options) must be verified against current docs before writing the webhook handler.

---

## Sources (Aggregated)

- Retell AI API docs (training data through Aug 2025) — MEDIUM confidence; live verification blocked during research
- Twilio Node.js SDK v5 — HIGH confidence; stable API
- Supabase App Router integration (`@supabase/ssr`) — HIGH confidence
- Google OAuth 2.0 refresh token behavior — HIGH confidence; well-documented and stable
- Stripe API 2024-06-20 — HIGH confidence; version pinning is confirmed best practice
- Telegram Bot API / grammY — HIGH confidence; stable
- WhatsApp Business API via Twilio — MEDIUM confidence; Meta policies change frequently
- Goodcall, Synthflow, AnswerConnect, Ruby Receptionist, Smith.ai feature/pricing — MEDIUM confidence; training data through mid-2025
- Contractor demographic preferences — MEDIUM confidence; extrapolated from Jobber/Housecall Pro community patterns
- TCPA inbound exemption — HIGH confidence on principle; verify current FCC guidance

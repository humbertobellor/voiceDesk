---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: — Revenue-Ready MVP
current_plan: All 5 plans complete
status: completed
stopped_at: Phase 7 context gathered
last_updated: "2026-05-13T03:48:12.291Z"
progress:
  total_phases: 7
  completed_phases: 6
  total_plans: 36
  completed_plans: 35
  percent: 97
---

# VoiceDesk — Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-03)
**Core value:** Every missed call is lost revenue — VoiceDesk ensures contractors never lose a booked job to voicemail again.
**Current focus:** Phase 7 — Billing & Onboarding (next)

---

## Current Phase

Phase: 7 — Billing & Onboarding
Status: Complete ✓
Started: 2026-05-12
Completed: 2026-05-12
Target: —

Current Plan: All 5 plans complete

---

## Phase History

| Phase | Plan | Completed | Duration | Summary |
|-------|------|-----------|----------|---------|
| 01-foundation | 01 | 2026-05-04 | 6 min | Next.js scaffold, Tailwind v4, Wave 0 tests |
| 01-foundation | 02 | 2026-05-04 | 12 min | 9 Supabase tables + 33 RLS policies + LANG-02 CHECK + D-16 idempotency |
| 01-foundation | 03 | 2026-05-04 | 15 min | Migrations pushed live; AES-256-GCM crypto; Supabase clients; zod schemas; DB types |
| 01-foundation | 04 | 2026-05-04 | 35 min | Auth flow: middleware + login/signup + OAuth callback + phone capture + account creation API |
| 01-foundation | 05 | 2026-05-04 | — | Dashboard shell + Sidebar + RLS isolation tests (19/19 pass) — phase complete |
| 04-scheduling | 01 | 2026-05-08 | 12 min | googleapis installed, Phase 4 migration live, 4 Wave-0 TDD stub files (19 RED tests) |
| 04-scheduling | 02 | 2026-05-08 | — | Google OAuth lib (createOAuth2Client) + getCalendarClient (refresh-on-use) |
| 04-scheduling | 03 | 2026-05-08 | ~7 min | computeAvailableSlots() + buildSlotSection() + buildSystemPrompt() extended |
| 04-scheduling | 04 | 2026-05-08 | ~3 min | extract-trade.ts schemas extended: confirmed_appointment_time + service_address (D-11); 18/18 tests pass |
| 04-scheduling | 05 | 2026-05-08 | ~20 min | retell-call-classify extended: create-lead (D-12), create-appointment (D-10), create-calendar-event (D-14/D-15), trigger-agent-sync (D-08) |
| 04-scheduling | 06 | 2026-05-08 | ~30 min | Google Calendar OAuth: initiate/callback routes + connect-calendar page + dashboard banners; human UAT verified; SCHED-01 complete |
| 05-notifications | 01 | 2026-05-09 | — | npm install (twilio, grammy) + 4 notification lib stubs + RED test scaffolds + .env.example additions |
| 05-notifications | 02 | 2026-05-09 | — | Implement notification libs: real Twilio SMS, WhatsApp template sends, grammY Telegram, notification_log DB helpers |
| 05-notifications | 03 | 2026-05-09 | — | retell-notify-dispatch Inngest function (Promise.allSettled, D-09 WA fallback, D-12 pending-before-send) |
| 05-notifications | 04 | 2026-05-09 | — | POST /api/webhooks/telegram (grammY, upserts telegram_chat_id) + dashboard Telegram setup banner |
| 05-notifications | 05 | 2026-05-12 | — | Verification plan: implementation exists, 20 tests pass, T-05-04-01 secret_token wired — phase complete |
| 06-portal-ui | 01 | 2026-05-12 | ~15 min | React Query installed; client hooks (useCalls, useCallById); provider + ContractorContext; CallLogTable with pagination |
| 06-portal-ui | 02 | 2026-05-12 | ~10 min | Lead list: StatusBadge dropdown, LeadFilters, LeadTable with status workflow |
| 06-portal-ui | 03 | 2026-05-12 | ~15 min | Agent config: 4 tabs (Business Info, Hours, Keywords, Voice) with Retell sync on save |
| 06-portal-ui | 04 | 2026-05-12 | ~8 min | Real-time: Supabase Realtime subscriptions for calls/leads, cache invalidation on INSERT |
| 06-portal-ui | 05 | 2026-05-12 | ~10 min | Recordings: /api/recordings route with 60s signed URLs; CallPlaybackModal with audio + transcript |
| 07-billing-onboarding | 01 | 2026-05-12 | ~5 min | Stripe SDK install + lib modules: client.ts singleton, checkout.ts (14-day trial), portal.ts, types/stripe.ts |
| 07-billing-onboarding | 02 | 2026-05-12 | — | Stripe webhook handler: route.ts + handlers.ts (checkout.completed, payment_failed, subscription.updated), idempotency via webhook_events |
| 07-billing-onboarding | 03 | 2026-05-12 | ~15 min | Onboarding wizard: 5-step modal (Agent Config → Calendar → Phone → Forwarding → Go Live) with tab navigation |
| 07-billing-onboarding | 04 | 2026-05-12 | — | Test call verification: Supabase Realtime subscription to calls table, auto-advance on call detection |
| 07-billing-onboarding | 05 | 2026-05-12 | ~5 min | Payment failure handling: Inngest function for deactivation + SMS/WhatsApp alert + Customer Portal button in settings |

---

## Blockers

- [ ] **WhatsApp WABA approval** — Submit WABA registration and all notification templates (emergency alert, new lead, payment failed) in week 1 of build. Approval takes 3–7 business days. Blocks Phase 5 launch if started late. Do not wait for Phase 5 to begin this.
- [ ] **Google OAuth app production mode** — Move OAuth app from "testing" mode to production mode before the first beta contractor connects their calendar. Testing mode silently expires refresh tokens after 7 days with no visible error. Do this before Phase 4 ships.
- [ ] **Retell webhook event names** — Verify signature header name, exact event names (`call_ended` vs `call_analyzed`), payload shapes, and retry policy against live Retell docs before writing a single line of webhook handler logic in Phase 3.

---

## Performance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Phases complete | 7 | 1 |
| Plans complete | 5 | 5 |
| Requirements delivered | 24 | 1 |
| Beta contractors | 20–30 | 0 |

---

## Accumulated Context

### Key Decisions Locked

- Retell managed Twilio integration — NOT raw TwiML/SIP
- Webhook-first architecture — all business logic in `call_ended` / `call_analyzed` handlers
- Return HTTP 200 immediately, process async via Vercel `waitUntil()`
- RLS on every table from day one, tested as unprivileged user before each phase ships
- AES-256-GCM encryption of Google OAuth tokens before Supabase write
- Contractor-configured availability windows (not live Calendar API mid-call) for appointment booking
- Stripe trial requires card-on-file
- Intent classification: keyword match + LLM confirmation for emergencies; gas smell and CO alarm are non-configurable hard triggers
- Background jobs via Inngest (not raw Vercel cron or queue)
- Next.js 16.2.4 used (RESEARCH.md assumption A1 — current stable, not capped at 14)
- Tailwind CSS v4 uses @import 'tailwindcss' (not v3 @tailwind directives)
- SUPABASE_SERVICE_ROLE_KEY never gets NEXT_PUBLIC_ prefix — enforced by .env.example grep
- Wave 0 stub pattern: test files import future modules; stubs throw "not yet implemented" for correct TDD RED phase flow
- src/lib/crypto/tokens.ts stub (throw-on-call) added in Plan 01 so tsc exits 0; Plan 03 replaces with real AES-256-GCM
- LANG-02 enforced at DB layer: supported_languages <@ ARRAY['en','es','ht'] AND array_length >= 1 (Pitfall 5 pattern)
- RLS policies use (SELECT auth.uid()) wrapper — not bare auth.uid() — for query plan caching (40 occurrences in migration 2)
- webhook_events deny-all RLS (Pattern C): USING(false)/WITH CHECK(false) for authenticated and anon; service role bypasses automatically
- JSONB defaults appear in migration 1 (canonical) AND migration 3 (re-affirmation guard) — both must be updated together

### Key Decisions Locked (Phase 4 Plan 05 additions)

- D-12 intent filter: shouldCreate = lead || emergency || (info && durationMs >= 15000); no_action → no lead row
- D-10 confirmed: booking_conflict on leads (not appointments); 23505 UNIQUE violation → leads.booking_conflict=true + status='new'
- D-15: getCalendarClient null → google_sync_status='skipped'; function continues (not a failure path)
- Risk 4 mitigation: rawTime.replace(/Z$/, '') strips trailing Z; LLM times treated as contractor-local, not UTC
- compute-sync-payload wrapped in step.run for Inngest memoization — consistent slot list on retry
- appointment_duration_minutes added to ContractorSettings TypeScript type (was missing; exists in DB migration)
- BusinessHours index signature [day: string] added to database.ts to satisfy slots.ts BusinessHours import

### Key Decisions Locked (Phase 7 Plan 01 additions)

- D-02: 14-day no-card trial via payment_method_collection='if_required' and trial_period_days=14
- D-04: Stripe Customer Portal accessible via stripe.billingPortal.sessions.create()
- Stripe API version 2026-04-22.dahlia (latest for stripe ^22.1.0)

### Key Decisions Locked (Phase 4 additions)

- googleapis@^171.4.0 installed as production dependency for Google Calendar API + OAuth2Client
- booking_conflict placed on leads table (NOT appointments) per D-10 — UNIQUE constraint on appointments(contractor_id, starts_at) makes a second same-slot row impossible regardless of column values
- google_sync_status NOT NULL DEFAULT 'pending' CHECK enum on appointments — mirrors analysis_status pattern from Phase 3; no ambiguous NULL state
- CASA Tier 2 restricted-scope notice required for calendar.events scope before beta contractors connect — documented in .env.example
- Wave-0 TDD stubs use vi.hoisted + vi.mock for googleapis and supabase service — all 19 stubs throw 'not yet implemented'
- appointmentFields shared object used to spread confirmed_appointment_time + service_address into all four extraction schemas (D-11) — avoids duplication, ensures parity across HvacSchema/PlumbingSchema/ElectricalSchema/GeneralSchema
- confirmed_appointment_time and service_address use .nullish() NOT .optional() per OpenAI structured outputs requirement; prompt instructs ISO format YYYY-MM-DDTHH:MM:SS without timezone suffix

### Architecture Reference

- Stack: Retell, Twilio, Supabase, Next.js 16 (App Router), Vercel Pro, Stripe, Inngest, grammY (Telegram)
- Webhook: `/api/webhooks/retell` → idempotency check → return 200 → `waitUntil()` → DB + Calendar + Notifications
- Storage: Supabase Storage (private bucket, 60-second TTL signed URLs for recordings)
- Auth: Supabase Auth (`@supabase/ssr`), service role key server-only

### Key Decisions Locked (Phase 3 additions)

- `after()` from `next/server` replaces `waitUntil()` from `@vercel/functions` — canonical for Next.js 15.1+; `@vercel/functions` not installed
- Retell webhook signature: `import { verify } from 'retell-sdk'` (named export, async); header `x-retell-signature`; `req.text()` must precede `req.json()`
- Retell payload: summary is `call_analysis.call_summary`; duration is `duration_ms` (ms); transcript array is `transcript_object`
- Retell delivery: 10s timeout per attempt, up to 3 retries (4 total); `call_analyzed` can arrive before `call_ended` — UPSERT handles race
- Intent classification: GPT-4o-mini (classification) → GPT-4o (trade extraction); `zodResponseFormat` from `openai/helpers/zod` for structured output
- Hard emergency keywords (gas smell, CO alarm) are TypeScript constants — checked before any LLM call; cannot be overridden
- `export const maxDuration = 30` on webhook route file (Vercel segment config)
- contractor lookup uses `agent_id` from payload — never `contractor_id` from payload (security: T-03-02)
- `openai` and `date-fns-tz` not yet installed — Wave 0 must install before handler code

### Open Questions (from research — RESOLVED for Phase 3)

- ~~Retell webhook retry policy~~ → 10s timeout, 3 retries (4 total attempts); confirmed from live docs
- ~~`call_analyzed` vs `call_ended` timing~~ → `call_analyzed` carries full transcript; fires 1–3 min after call end
- Google OAuth scope — `calendar.events` + `calendar.freebusy` vs narrower scope (Phase 4)
- Recording retention window — 90 days vs 1 year (Phase 6 decision)
- WhatsApp opt-in consent wording — may need legal review before Wefunder/Republic raise

---

## Session Continuity

_Use this section to log the last known state before ending a session, so the next session can resume without re-reading everything._

Last session: 2026-05-13T01:17:59.040Z
Stopped at: Phase 7 context gathered
Resume: /gsd-execute-phase 5 — Phase 5 Notifications execution

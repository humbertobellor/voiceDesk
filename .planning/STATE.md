---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: — Revenue-Ready MVP
current_plan: —
status: Ready to execute
stopped_at: Phase 3 planned — 4 plans in 4 waves, verification passed, ready to execute
last_updated: "2026-05-08T00:00:00.000Z"
progress:
  total_phases: 7
  completed_phases: 2
  total_plans: 14
  completed_plans: 5
  percent: 14
---

# VoiceDesk — Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-03)
**Core value:** Every missed call is lost revenue — VoiceDesk ensures contractors never lose a booked job to voicemail again.
**Current focus:** Phase 02 — Provisioning (ready to plan)

---

## Current Phase

Phase: 3 — Webhook Core
Status: Ready to execute
Started: 2026-05-08
Target: —

Current Plan: —

---

## Phase History

| Phase | Plan | Completed | Duration | Summary |
|-------|------|-----------|----------|---------|
| 01-foundation | 01 | 2026-05-04 | 6 min | Next.js scaffold, Tailwind v4, Wave 0 tests |
| 01-foundation | 02 | 2026-05-04 | 12 min | 9 Supabase tables + 33 RLS policies + LANG-02 CHECK + D-16 idempotency |
| 01-foundation | 03 | 2026-05-04 | 15 min | Migrations pushed live; AES-256-GCM crypto; Supabase clients; zod schemas; DB types |
| 01-foundation | 04 | 2026-05-04 | 35 min | Auth flow: middleware + login/signup + OAuth callback + phone capture + account creation API |
| 01-foundation | 05 | 2026-05-04 | — | Dashboard shell + Sidebar + RLS isolation tests (19/19 pass) — phase complete |

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

Last session: 2026-05-08T00:00:00Z
Stopped at: Phase 3 planned — 4 plans, 4 waves, verification passed
Resume: /gsd-execute-phase 3 — Webhook Core ready to execute

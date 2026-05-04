---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: — Revenue-Ready MVP
status: Not Started
last_updated: "2026-05-04T10:05:56.609Z"
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 5
  completed_plans: 0
  percent: 0
---

# VoiceDesk — Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-03)
**Core value:** Every missed call is lost revenue — VoiceDesk ensures contractors never lose a booked job to voicemail again.
**Current focus:** Phase 1

---

## Current Phase

Phase: 1 — Foundation
Status: Not Started
Started: —
Target: —

---

## Phase History

(none yet)

---

## Blockers

- [ ] **WhatsApp WABA approval** — Submit WABA registration and all notification templates (emergency alert, new lead, payment failed) in week 1 of build. Approval takes 3–7 business days. Blocks Phase 5 launch if started late. Do not wait for Phase 5 to begin this.
- [ ] **Google OAuth app production mode** — Move OAuth app from "testing" mode to production mode before the first beta contractor connects their calendar. Testing mode silently expires refresh tokens after 7 days with no visible error. Do this before Phase 4 ships.
- [ ] **Retell webhook event names** — Verify signature header name, exact event names (`call_ended` vs `call_analyzed`), payload shapes, and retry policy against live Retell docs before writing a single line of webhook handler logic in Phase 3.

---

## Performance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Phases complete | 7 | 0 |
| Requirements delivered | 24 | 0 |
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

### Architecture Reference

- Stack: Retell, Twilio, Supabase, Next.js 14 (App Router), Vercel Pro, Stripe, Inngest, grammY (Telegram)
- Webhook: `/api/webhooks/retell` → idempotency check → return 200 → `waitUntil()` → DB + Calendar + Notifications
- Storage: Supabase Storage (private bucket, 60-second TTL signed URLs for recordings)
- Auth: Supabase Auth (`@supabase/ssr`), service role key server-only

### Open Questions (from research)

- Retell webhook retry policy — exact retry window and backoff (verify live docs)
- `call_analyzed` vs `call_ended` — confirm which carries full transcript
- Google OAuth scope — `calendar.events` + `calendar.freebusy` vs narrower scope
- Intent classification model — GPT-4o-mini vs GPT-4o for turn latency (benchmark before Phase 3)
- Recording retention window — 90 days vs 1 year (unit economics at 30 contractors × 50 calls/month ≈ 6GB/month)
- WhatsApp opt-in consent wording — may need legal review before Wefunder/Republic raise

---

## Session Continuity

_Use this section to log the last known state before ending a session, so the next session can resume without re-reading everything._

Last session: 2026-05-04T04:34:31.649Z

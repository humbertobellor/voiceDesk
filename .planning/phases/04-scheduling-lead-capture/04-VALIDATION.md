---
phase: 4
slug: scheduling-lead-capture
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-08
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npx vitest run tests/lib/scheduling.test.ts tests/lib/classification.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/lib/scheduling.test.ts tests/lib/classification.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-W0-01 | W0 | 0 | SCHED-01 | — | N/A | unit stub | `npx vitest run tests/lib/scheduling.test.ts` | ❌ W0 | ⬜ pending |
| 4-W0-02 | W0 | 0 | SCHED-04 | — | N/A | unit stub | `npx vitest run tests/lib/booking.test.ts` | ❌ W0 | ⬜ pending |
| 4-W0-03 | W0 | 0 | SCHED-01 | — | N/A | unit stub | `npx vitest run tests/lib/leads.test.ts` | ❌ W0 | ⬜ pending |
| 4-W0-04 | W0 | 0 | SCHED-01 | — | N/A | unit stub | `npx vitest run tests/lib/oauth.test.ts` | ❌ W0 | ⬜ pending |
| 4-slot-01 | slot | 2 | SCHED-01 | — | N/A | unit | `npx vitest run tests/lib/scheduling.test.ts` | ❌ W0 | ⬜ pending |
| 4-slot-02 | slot | 2 | SCHED-02 | — | N/A | unit | `npx vitest run tests/lib/scheduling.test.ts` | ❌ W0 | ⬜ pending |
| 4-extract-01 | classify | 3 | SCHED-03 | — | N/A | unit | `npx vitest run tests/lib/classification.test.ts` | extends | ⬜ pending |
| 4-conflict-01 | booking | 3 | SCHED-04 | — | N/A | unit | `npx vitest run tests/lib/booking.test.ts` | ❌ W0 | ⬜ pending |
| 4-lead-01 | classify | 3 | SCHED-01 | — | N/A | unit | `npx vitest run tests/lib/leads.test.ts` | ❌ W0 | ⬜ pending |
| 4-google-01 | calendar | 4 | SCHED-01 | — | N/A | unit | `npx vitest run tests/lib/booking.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lib/scheduling.test.ts` — stubs for SCHED-01, SCHED-02 (slot computation pure function — no DB)
- [ ] `tests/lib/booking.test.ts` — stubs for SCHED-04 (UNIQUE conflict → `booking_conflict` flag, `google_sync_status` state transitions)
- [ ] `tests/lib/leads.test.ts` — stubs for SCHED-01 (lead creation rules from D-12, status assignment: 'booked' vs 'new')
- [ ] `tests/lib/oauth.test.ts` — stubs for token refresh logic (expiry buffer detection, mock `googleapis` `refreshAccessToken`)

*Wave 0 must create all stubs before any implementation tasks execute.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Google OAuth round-trip: contractor clicks Connect, authorizes, redirected to `/dashboard?calendarConnected=1` | SCHED-01 (connect prerequisite) | Requires real Google OAuth app credentials and browser session | Run dev server, navigate to `/dashboard/connect-calendar`, click button, complete Google auth, verify redirect and `calendar_credentials` row in Supabase |
| Retell agent verbally confirms appointment slot during call | SCHED-03 | Requires live Retell call with system prompt containing injected slots | Place test call to provisioned number, book an appointment, verify agent reads back correct date/time/address |
| Google Calendar event appears in contractor's calendar after call | SCHED-01 | Requires live Google Calendar API call and calendar access | After test call with booking, verify Google Calendar event created within 5 minutes with correct title, time, and description |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

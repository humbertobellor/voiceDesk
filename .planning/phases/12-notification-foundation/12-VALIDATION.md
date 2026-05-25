---
phase: 12
slug: notification-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-24
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.5 |
| **Config file** | vitest.config.ts (inherited from Phase 1) |
| **Quick run command** | `npm run test -- tests/notifications/email.test.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- tests/notifications/email.test.ts`
- **After every plan wave:** Run `npm run test` + `tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green + `tsc --noEmit` exits 0
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | EMAIL-01, BELL-04 | T-12-01 | RLS subquery pattern on app_notifications; 'email' channel in notification_log constraint | migration | `supabase db push` | ❌ W0 | ⬜ pending |
| 12-01-02 | 01 | 1 | EMAIL-01 | — | notify_email_enabled defaults FALSE; email_address nullable | migration | `supabase db push` | ❌ W0 | ⬜ pending |
| 12-02-01 | 02 | 2 | EMAIL-05 | T-12-02 | sendEmail() never throws; returns {success, messageId?, error?} | unit | `npm run test -- tests/notifications/email.test.ts` | ❌ W0 | ⬜ pending |
| 12-02-02 | 02 | 2 | EMAIL-05 | — | Missing credentials return {success: false} not throw | unit | `npm run test -- tests/notifications/email.test.ts` | ❌ W0 | ⬜ pending |
| 12-03-01 | 03 | 3 | EMAIL-01, EMAIL-05, BELL-04 | — | tsc --noEmit exits 0; NotificationChannel includes 'email' | typecheck | `tsc --noEmit` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/notifications/email.test.ts` — 5 unit tests for sendEmail() covering success, API error, exception, missing RESEND_API_KEY, missing RESEND_FROM_ADDRESS
- [ ] `src/lib/notifications/email.ts` — sendEmail() function stub with `import 'server-only'`
- [ ] `src/types/database.ts` — NotificationChannel extended with 'email'; AppNotification interface; NotificationSettings with 3 new fields

*Wave 0 items can be in RED state (stubs) at plan start — they must exist so test runner can find them.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Supabase Realtime fires on app_notifications INSERT | BELL-04 | Requires browser + Supabase Realtime subscription wired (Phase 14) | After migration is pushed, open Supabase Studio → Table Editor → app_notifications → insert a row. Confirm Realtime channel receives the event in a browser console subscription. |
| RLS blocks cross-tenant read | BELL-04 | Requires two separate Supabase auth sessions | Using anon key and a second contractor's JWT, attempt SELECT on app_notifications. Must return 0 rows. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

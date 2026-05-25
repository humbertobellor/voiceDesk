---
phase: 05-notifications
plan: 01
subsystem: notifications
tags: [stub, tdd, twilio, grammy, wave-1]
dependency_graph:
  requires: [04-scheduling/04-01]
  provides: [notification-stubs, notification-tests]
  affects: [05-02, 05-03, 05-04]
tech_stack:
  added: [twilio, grammy]
  patterns: [server-only, stub-first-tdd, wave-0-pattern]
key_files:
  created:
    - src/lib/notifications/sms.ts
    - src/lib/notifications/whatsapp.ts
    - src/lib/notifications/telegram.ts
    - src/lib/notifications/log.ts
    - tests/notifications/sms.test.ts
    - tests/notifications/whatsapp.test.ts
    - tests/notifications/telegram.test.ts
    - tests/notifications/log.test.ts
  modified:
    - package.json
    - package-lock.json
    - .env.example
decisions:
  - "Test files placed in tests/notifications/ (not src/tests/notifications/) to match vitest config include pattern tests/**/*.test.ts"
  - "server-only import on all four lib stubs enforces server-side constraint per T-05-01-02 and T-05-01-03"
  - "No NEXT_PUBLIC_ prefix on any notification secret — enforced by .env.example grep gate (T-05-01-01)"
metrics:
  duration: ~8 minutes
  completed: "2026-05-09"
  tasks_completed: 2
  files_created: 8
  files_modified: 3
---

# Phase 5 Plan 01: Notification Package Installation + Stubs Summary

**One-liner:** Twilio SDK v5 + grammY installed; four server-only notification stubs with typed signatures and 5 RED test cases confirming stub-throw behavior.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install packages + update .env.example | 8edaff3 | package.json, package-lock.json, .env.example |
| 2 | Create notification library stubs + RED tests | d956882 | 4 lib stubs, 4 test files |

## What Was Built

**Package installations:**
- `twilio` (Twilio Node.js SDK v5) — imported and verified via `node -e "require('twilio')"`
- `grammy` (grammY Telegram Bot Framework) — imported and verified

**Environment documentation (5 new vars in .env.example, none with NEXT_PUBLIC_ prefix):**
- `TWILIO_ACCOUNT_SID` — Twilio account identifier
- `TWILIO_AUTH_TOKEN` — Twilio auth secret
- `TWILIO_WHATSAPP_FROM` — WABA-approved WhatsApp sender (format: whatsapp:+1XXXXXXXXXX)
- `TWILIO_FROM_NUMBER` — Outbound SMS E.164 number
- `TELEGRAM_BOT_TOKEN` — @VoiceDeskBot token from @BotFather

**Notification lib stubs (src/lib/notifications/):**
- `sms.ts` — exports `sendSms(SendSmsParams): Promise<SendSmsResult>` — throws `not yet implemented`
- `whatsapp.ts` — exports `sendWhatsApp(SendWhatsAppParams): Promise<SendWhatsAppResult>` — throws `not yet implemented`
- `telegram.ts` — exports `sendTelegram(SendTelegramParams): Promise<SendTelegramResult>` — throws `not yet implemented`
- `log.ts` — exports `writeNotificationLog` + `updateNotificationLog` — both throw `not yet implemented`

All stubs: `import 'server-only'` at top, typed async signatures ready for Wave 2 implementation.

**Test scaffolds (tests/notifications/):**
- 4 test files, 5 test cases — all passing (assert stubs throw 'not yet implemented')
- `tsc --noEmit` clean

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test file path corrected from src/tests/ to tests/**
- **Found during:** Task 2
- **Issue:** Plan specified `src/tests/notifications/*.test.ts` but vitest config `include` pattern is `tests/**/*.test.ts`. Files placed in `src/tests/` would be silently skipped by the test runner.
- **Fix:** Placed test files in `tests/notifications/` to match the established project test structure and vitest config.
- **Files modified:** tests/notifications/sms.test.ts, tests/notifications/whatsapp.test.ts, tests/notifications/telegram.test.ts, tests/notifications/log.test.ts
- **Commit:** d956882

## Known Stubs

All four lib files are intentional stubs for Wave 1. Wave 2 (05-02) will replace the throws with real Twilio and grammY API calls.

| Stub | File | Reason |
|------|------|--------|
| sendSms — throws | src/lib/notifications/sms.ts | Wave 1 stub; Wave 2 implements real Twilio SMS |
| sendWhatsApp — throws | src/lib/notifications/whatsapp.ts | Wave 1 stub; Wave 2 implements WABA template send |
| sendTelegram — throws | src/lib/notifications/telegram.ts | Wave 1 stub; Wave 2 implements grammY bot.api.sendMessage |
| writeNotificationLog — throws | src/lib/notifications/log.ts | Wave 1 stub; Wave 2 implements Supabase insert |
| updateNotificationLog — throws | src/lib/notifications/log.ts | Wave 1 stub; Wave 2 implements Supabase update |

These stubs are intentional — the plan objective is to establish TypeScript import contracts for downstream waves. The plan goal is fully achieved.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. All four stubs import `server-only` — credentials never reach the browser. `.env.example` documentation confirmed free of `NEXT_PUBLIC_` prefix on any notification secret (T-05-01-01 mitigated).

## Self-Check: PASSED

- [x] src/lib/notifications/sms.ts — exists
- [x] src/lib/notifications/whatsapp.ts — exists
- [x] src/lib/notifications/telegram.ts — exists
- [x] src/lib/notifications/log.ts — exists
- [x] tests/notifications/sms.test.ts — exists
- [x] tests/notifications/whatsapp.test.ts — exists
- [x] tests/notifications/telegram.test.ts — exists
- [x] tests/notifications/log.test.ts — exists
- [x] Commit 8edaff3 — packages + .env.example
- [x] Commit d956882 — stubs + tests
- [x] 5/5 tests passing
- [x] tsc --noEmit clean

---
phase: 05-notifications
plan: 02
subsystem: notifications
tags: [twilio, grammy, tdd, notification-lib, wave-2]
dependency_graph:
  requires: [05-01]
  provides: [sms-impl, whatsapp-impl, telegram-impl, notification-log-impl]
  affects: [05-03]
tech_stack:
  added: []
  patterns: [server-only, twilio-messages-create, grammy-bot-api, supabase-service-role, content-sid-constants]
key_files:
  created: []
  modified:
    - src/lib/notifications/log.ts
    - src/lib/notifications/sms.ts
    - src/lib/notifications/whatsapp.ts
    - src/lib/notifications/telegram.ts
    - tests/notifications/log.test.ts
    - tests/notifications/sms.test.ts
    - tests/notifications/whatsapp.test.ts
    - tests/notifications/telegram.test.ts
decisions:
  - "WHATSAPP_CONTENT_SIDS stored as TypeScript constants (not env vars) per D-16"
  - "updateNotificationLog is non-fatal on DB error: logs but does not throw, preventing cascading retry on a logging failure"
  - "vi.hoisted() required for grammY Bot constructor mock in vitest — arrow function factories are not constructors"
  - "TWILIO_WHATSAPP_FROM env var already includes whatsapp: prefix per D-17; recipient gets whatsapp: prepended in sendWhatsApp"
metrics:
  duration: ~3 minutes
  completed: "2026-05-09"
  tasks_completed: 2
  files_created: 0
  files_modified: 8
---

# Phase 5 Plan 02: Notification Library Implementations Summary

**One-liner:** Four notification library stubs replaced with real implementations — Twilio SMS, Twilio WhatsApp template with Content SIDs, grammY Telegram bot.api.sendMessage, and Supabase notification_log DB helpers.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement log.ts and sms.ts with real Twilio SMS | 1190be2 | src/lib/notifications/log.ts, src/lib/notifications/sms.ts, tests/notifications/log.test.ts, tests/notifications/sms.test.ts |
| 2 | Implement whatsapp.ts and telegram.ts with Content SID constants | 6043e9d | src/lib/notifications/whatsapp.ts, src/lib/notifications/telegram.ts, tests/notifications/whatsapp.test.ts, tests/notifications/telegram.test.ts |

## What Was Built

**log.ts — notification_log DB helpers:**
- `writeNotificationLog`: inserts pending row before send, returns UUID string (D-12: write-before-send pattern)
- `updateNotificationLog`: updates status to sent/failed with sent_at/error; non-fatal on DB update error (logs, never throws)
- Uses `createServiceRoleClient()` for all DB operations (T-05-02-02: bypasses RLS safely server-side only)

**sms.ts — Twilio SMS:**
- `sendSms`: validates TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER env vars; constructs `twilio(sid, token)` client; calls `messages.create({ to, from, body })`; returns `{ sid, status }`
- EMRG-03: emergency keyword enforcement delegated to dispatch function caller

**whatsapp.ts — Twilio WhatsApp templates:**
- `sendWhatsApp`: adds `whatsapp:` prefix to recipient `to`; uses `TWILIO_WHATSAPP_FROM` as `from` (D-17: already prefixed)
- `WHATSAPP_CONTENT_SIDS` constant: `{ new_lead: 'HXplaceholder_new_lead', emergency: 'HXplaceholder_emergency' }` (D-16: TypeScript constants, not env vars)
- D-14: new_lead variables `{{1}}`=callerPhone, `{{2}}`=serviceRequested, `{{3}}`=bookingStatus (defaults to "No appointment booked")
- D-15: emergency variables `{{1}}`=callerPhone, `{{2}}`=serviceRequested only
- `contentVariables` serialized as JSON string per Twilio Content API requirement

**telegram.ts — grammY Telegram bot:**
- `sendTelegram`: creates `new Bot(TELEGRAM_BOT_TOKEN)`, calls `bot.api.sendMessage(chatId, message)`, returns `{ messageId }`
- D-22: per-request Bot instance (not persistent polling) — compatible with serverless

**Tests: 14/14 GREEN** (plan anticipated 13; telegram gained 1 additional behavior test)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed grammY Bot constructor mock in vitest**
- **Found during:** Task 2 test run
- **Issue:** The plan's test code used `vi.fn().mockImplementation(() => ...)` for the `Bot` class mock, but an arrow function factory cannot be used as a `new` constructor — vitest raised "is not a constructor". A second attempt using `vi.fn(function () { ... })` outside the `vi.mock` factory failed because `vi.mock` is hoisted before variable initialization.
- **Fix:** Used `vi.hoisted()` to declare `mockSendMessage` in the hoisted scope, then referenced it inside the `vi.mock('grammy', () => ...)` factory. `Bot` mock uses `vi.fn(function () { ... })` as a proper constructor.
- **Files modified:** tests/notifications/telegram.test.ts
- **Commit:** 6043e9d

## Known Stubs

`WHATSAPP_CONTENT_SIDS` contains `HXplaceholder_*` values that must be replaced with real Twilio Content SIDs after WABA template approval:
- `new_lead: 'HXplaceholder_new_lead'` — replace with real SID from Twilio Console after `voicedesk_new_lead` template approval
- `emergency: 'HXplaceholder_emergency'` — replace with real SID from Twilio Console after `voicedesk_emergency` template approval

These are intentional placeholders (D-16). The plan goal is fully achieved — the implementation is complete and correct; real SIDs are a deployment-time substitution requiring WABA approval (tracked as blocker in STATE.md).

## Threat Surface Scan

No new network endpoints or auth paths introduced. All four lib files import `server-only` — credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, TELEGRAM_BOT_TOKEN) never reach the browser.

All STRIDE mitigations from the plan's threat model are confirmed present:
- T-05-02-01: Auth tokens read from process.env, never logged or returned; `import 'server-only'` on all files
- T-05-02-02: `createServiceRoleClient` used only in log.ts (server-only); no client-side path to notification_log
- T-05-02-03: contentVariables sourced from DB rows (already validated on insert), not from raw request params
- T-05-02-04: TELEGRAM_BOT_TOKEN server-side only; `import 'server-only'` prevents browser bundle inclusion
- T-05-02-05: Accepted — low volume at v1 scale

## Self-Check: PASSED

- [x] src/lib/notifications/log.ts — exists and implements writeNotificationLog + updateNotificationLog
- [x] src/lib/notifications/sms.ts — exists and implements sendSms with Twilio
- [x] src/lib/notifications/whatsapp.ts — exists and exports WHATSAPP_CONTENT_SIDS + sendWhatsApp
- [x] src/lib/notifications/telegram.ts — exists and implements sendTelegram with grammY
- [x] tests/notifications/log.test.ts — updated, 4 GREEN tests
- [x] tests/notifications/sms.test.ts — updated, 4 GREEN tests
- [x] tests/notifications/whatsapp.test.ts — updated, 4 GREEN tests
- [x] tests/notifications/telegram.test.ts — updated, 2 GREEN tests
- [x] Commit 1190be2 — log.ts + sms.ts implementations
- [x] Commit 6043e9d — whatsapp.ts + telegram.ts implementations
- [x] 14/14 tests passing
- [x] tsc --noEmit clean
- [x] server-only imports: 4 files x 1 each = 4 confirmed
- [x] WHATSAPP_CONTENT_SIDS exported with new_lead and emergency keys
- [x] notification_log table name correct in log.ts

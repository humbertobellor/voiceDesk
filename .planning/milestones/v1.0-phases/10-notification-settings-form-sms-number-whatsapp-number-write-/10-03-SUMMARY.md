---
phase: 10-notification-settings-form-sms-number-whatsapp-number-write
plan: "03"
subsystem: notification-dispatch
tags: [tdd, green-phase, enable-flags, inngest, wave-3]
dependency_graph:
  requires:
    - 10-01 (schema migration + RED test stubs)
    - 10-02 (API routes + React Query hooks)
  provides:
    - src/inngest/functions/retell-notify-dispatch.ts (computeChannels with enable-flag gates)
  affects:
    - Wave 4+ (UI form — channels now respected at dispatch time)
tech_stack:
  added: []
  patterns:
    - Enable flag AND-gate: `settings?.notify_X_enabled === true` strict equality check
    - Extended Pick<> type to include new enable-flag columns alongside existing prefs
key_files:
  created: []
  modified:
    - src/inngest/functions/retell-notify-dispatch.ts
    - tests/notifications/notify-dispatch.test.ts
decisions:
  - "makeSettings() helper updated to include enable flags (all true) so Phase 5 tests remain GREEN after type extension — existing tests represent the 'channel enabled and configured' happy path"
  - "Strict === true check used for enable flags (per plan spec); safe because migration has NOT NULL DEFAULT so undefined is impossible at runtime"
  - "Inngest SELECT updated to named column list (not select('*')) to be explicit about what the function loads"
metrics:
  duration_minutes: 5
  completed_date: "2026-05-23T22:31:00Z"
  tasks_completed: 1
  tasks_total: 1
  files_created: 0
  files_modified: 2
---

# Phase 10 Plan 03: computeChannels() Enable Flag Gates Summary

**One-liner:** computeChannels() extended with notify_sms_enabled / notify_whatsapp_enabled / notify_telegram_enabled AND-gates — all 17 dispatch tests GREEN including 4 new Phase 10 enable-flag tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | GREEN — gate channels on enable flags | 8cacb75 | src/inngest/functions/retell-notify-dispatch.ts, tests/notifications/notify-dispatch.test.ts |

## What Was Built

**computeChannels() changes in `src/inngest/functions/retell-notify-dispatch.ts`:**

1. Extended `Pick<NotificationSettings, ...>` type to include three new fields:
   - `notify_sms_enabled`
   - `notify_whatsapp_enabled`
   - `notify_telegram_enabled`

2. Added `=== true` AND-gate after the null check for each channel:
   - `shouldSendSms`: `settings?.sms_number != null && settings?.notify_sms_enabled === true && (...intent checks)`
   - `shouldSendWhatsApp`: `settings?.whatsapp_number != null && settings?.notify_whatsapp_enabled === true && (...intent checks)`
   - `shouldSendTelegram`: `settings?.telegram_chat_id != null && settings?.notify_telegram_enabled === true && (...intent checks)`

3. Inngest function DB SELECT updated to include the three new columns alongside existing ones (named list, not `select('*')`)

**SELECT verification (T-10-07 mitigation):**
`grep` confirms `notify_sms_enabled` appears in both the Pick<> type at line 39 and the Inngest SELECT at line 123. All three enable columns are explicitly listed.

**Test file `tests/notifications/notify-dispatch.test.ts`:**
- `makeSettings()` helper extended to include the enable flags with defaults matching Phase 5 expectations (all `true` so "configured + enabled" tests remain GREEN)
- All 17 tests pass: 13 Phase 5 + 4 Phase 10 enable-flag tests

## Deviations from Plan

### Auto-corrected Issues

**1. [Rule 1 - Bug] makeSettings() helper lacked enable flags causing Phase 5 test failures**
- **Found during:** Task 1 GREEN verification
- **Issue:** After adding `=== true` gates to computeChannels(), Phase 5 tests (which use `makeSettings()` without the enable flags) began failing because `undefined === true` evaluates to `false`, suppressing channels that Phase 5 tests expected to fire.
- **Fix:** Extended `makeSettings()` to include `notify_sms_enabled: true`, `notify_whatsapp_enabled: true`, `notify_telegram_enabled: true`. This matches the "channel enabled and configured" semantics that all Phase 5 tests assume. The `makeSettingsWithEnableFlags()` helper (added in Plan 10-01) provides the test harness for the new disable feature.
- **Files modified:** tests/notifications/notify-dispatch.test.ts
- **Commit:** 8cacb75

## TDD Gate Compliance

Wave 3 is the GREEN phase of the TDD cycle:
- RED commit (Plan 10-01): 925ec0a — Phase 10 enable-flag tests established, failing
- GREEN commit (Plan 10-03): 8cacb75 — implementation makes all 17 tests pass
- `tsc --noEmit` exits 0

## Known Stubs

None — computeChannels() is fully implemented. No placeholder data or TODO patterns.

## Threat Flags

None — no new network endpoints or auth paths introduced. T-10-05, T-10-06, T-10-07 mitigated as planned:
- T-10-05: Enable flags are DB-sourced (loaded in Inngest step, not from call payload)
- T-10-06: NOT NULL DEFAULT in migration prevents NULL values; `=== true` safely returns false for absent columns (moot at runtime but safe in tests)
- T-10-07: SELECT grep confirms all three columns present in notification_settings query

## Self-Check: PASSED

- [x] `src/inngest/functions/retell-notify-dispatch.ts` Pick<> type includes `notify_sms_enabled`
- [x] `src/inngest/functions/retell-notify-dispatch.ts` Pick<> type includes `notify_whatsapp_enabled`
- [x] `src/inngest/functions/retell-notify-dispatch.ts` Pick<> type includes `notify_telegram_enabled`
- [x] shouldSendSms gate includes `settings?.notify_sms_enabled === true`
- [x] shouldSendWhatsApp gate includes `settings?.notify_whatsapp_enabled === true`
- [x] shouldSendTelegram gate includes `settings?.notify_telegram_enabled === true`
- [x] Inngest SELECT loads `notify_sms_enabled, notify_whatsapp_enabled, notify_telegram_enabled`
- [x] All 4 Phase 10 enable-flag tests GREEN
- [x] All 13 Phase 5 dispatch tests GREEN (17 total)
- [x] `npx tsc --noEmit` exits 0
- [x] Commit 8cacb75 exists in git log

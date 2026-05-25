---
phase: 10-notification-settings-form-sms-number-whatsapp-number-write
plan: "01"
subsystem: notification-settings
tags: [tdd, schema, types, test-stubs, wave-0]
dependency_graph:
  requires: []
  provides:
    - supabase/migrations/20260523000015_phase10_notification_settings.sql
    - src/types/database.ts#NotificationSettings (3 new boolean fields)
    - tests/ui/notification-settings-form.test.tsx (RED stubs)
    - tests/api/notification-settings.test.ts (RED stubs)
    - tests/api/notification-settings-telegram-unlink.test.ts (RED stubs)
    - tests/notifications/notify-dispatch.test.ts (Phase 10 block appended)
  affects:
    - retell-notify-dispatch.ts (downstream — must add enable-flag checks in Plan 10-02)
tech_stack:
  added: []
  patterns:
    - ADD COLUMN IF NOT EXISTS idempotent migration pattern (per D-02)
    - NotificationSettings TypeScript interface extension
    - Wave 0 TDD stub pattern (throw 'not yet implemented')
    - makeSettingsWithEnableFlags helper for Phase 10 test cases
key_files:
  created:
    - supabase/migrations/20260523000015_phase10_notification_settings.sql
    - tests/ui/notification-settings-form.test.tsx
    - tests/api/notification-settings.test.ts
    - tests/api/notification-settings-telegram-unlink.test.ts
  modified:
    - src/types/database.ts
    - tests/notifications/notify-dispatch.test.ts
decisions:
  - "Test files placed under tests/ directory (actual project pattern) not src/ (plan frontmatter was incorrect)"
  - "makeSettingsWithEnableFlags helper added alongside existing makeSettings to avoid breaking existing Phase 5 tests"
  - "Phase 10 describe block appended at end of notify-dispatch.test.ts; existing 13 tests untouched"
metrics:
  duration_minutes: 3
  completed_date: "2026-05-23T21:18:58Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 2
---

# Phase 10 Plan 01: Wave 0 Schema, Types, and RED Test Stubs Summary

**One-liner:** Idempotent migration adds 3 NOT NULL boolean channel-enable columns (SMS opt-out, WhatsApp/Telegram opt-in); TypeScript interface extended; 20 Wave 0 test stubs established in RED state across 4 test files.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migration SQL + TypeScript type extension | c5d21e4 | supabase/migrations/20260523000015_phase10_notification_settings.sql, src/types/database.ts |
| 2 | Create Wave 0 test stubs (RED state) | 925ec0a | tests/ui/notification-settings-form.test.tsx, tests/api/notification-settings.test.ts, tests/api/notification-settings-telegram-unlink.test.ts, tests/notifications/notify-dispatch.test.ts |

## What Was Built

**Task 1 — Migration + Types:**
- `20260523000015_phase10_notification_settings.sql` adds three columns using `ADD COLUMN IF NOT EXISTS` for idempotency per existing migration pattern:
  - `notify_sms_enabled BOOLEAN NOT NULL DEFAULT TRUE` (opt-out — SMS assumed default per D-02)
  - `notify_whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE` (opt-in per D-02)
  - `notify_telegram_enabled BOOLEAN NOT NULL DEFAULT FALSE` (opt-in per D-02)
  - COMMENT ON COLUMN for each explaining the D-02 rationale
- Existing RLS policies in `20260504000002_rls_policies.sql` cover new columns automatically (no new policies needed)
- `src/types/database.ts` NotificationSettings interface extended with three new boolean fields after `notify_on_general_inquiry`

**Task 2 — RED Test Stubs:**
- `tests/ui/notification-settings-form.test.tsx` — 7 stubs for NotificationSettingsForm component (all throw "not yet implemented")
- `tests/api/notification-settings.test.ts` — 6 stubs for PATCH /api/notification-settings endpoint
- `tests/api/notification-settings-telegram-unlink.test.ts` — 3 stubs for POST /api/notification-settings/telegram/unlink endpoint
- `tests/notifications/notify-dispatch.test.ts` extended with `describe('Phase 10: channel enable flags')` block containing 4 new tests

**RED state verification:**
- All 16 stub tests (form + API routes) fail with "not yet implemented"
- 3 of 4 Phase 10 dispatch tests fail (RED — computeChannels() doesn't check enable flags yet)
- 1 Phase 10 dispatch test passes (shouldSendSms=true when enabled=true and number present — matches existing behavior)
- All 13 existing Phase 5 dispatch tests pass (unchanged)
- `tsc --noEmit` exits 0

## Deviations from Plan

### Auto-corrected Issues

**1. [Rule 1 - Bug] Test file paths in plan frontmatter used src/ not tests/ directory**
- **Found during:** Task 2 setup
- **Issue:** Plan `files_modified` listed test files under `src/components/notification/`, `src/app/api/notification-settings/`, `src/inngest/functions/` — but the project's `vitest.config.ts` only includes `tests/**/*.test.*`. Tests placed in `src/` would not be discovered by the test runner.
- **Fix:** Created test files under the actual project convention:
  - `tests/ui/notification-settings-form.test.tsx` (not `src/components/...`)
  - `tests/api/notification-settings.test.ts` (not `src/app/api/...`)
  - `tests/api/notification-settings-telegram-unlink.test.ts` (not `src/app/api/...`)
  - Extended `tests/notifications/notify-dispatch.test.ts` (existing file at correct path)
- **Files modified:** As listed above
- **Commits:** 925ec0a

## TDD Gate Compliance

Plan type is `execute` with `tdd="true"` on Task 2. Wave 0 follows RED phase protocol:
- RED commit exists: 925ec0a (`test(10-01): add Wave 0 RED test stubs for notification settings`)
- GREEN commit will be in Plan 10-02 (implementation)
- Tests are intentionally failing — this is the required RED baseline

## Known Stubs

None in production code. All stubs are in test files (intentional RED state per TDD protocol).

## Threat Flags

None — this plan only adds migration SQL and test stubs. No new network endpoints, auth paths, or file access patterns introduced in this plan. (T-10-01 and T-10-02 threats from plan's threat model will be mitigated in Plans 10-02/10-03 when the API routes are implemented.)

## Self-Check: PASSED

- [x] `supabase/migrations/20260523000015_phase10_notification_settings.sql` exists
- [x] Migration contains `ADD COLUMN IF NOT EXISTS notify_sms_enabled BOOLEAN NOT NULL DEFAULT TRUE`
- [x] Migration contains `ADD COLUMN IF NOT EXISTS notify_whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE`
- [x] Migration contains `ADD COLUMN IF NOT EXISTS notify_telegram_enabled BOOLEAN NOT NULL DEFAULT FALSE`
- [x] `src/types/database.ts` NotificationSettings contains `notify_sms_enabled: boolean`
- [x] `src/types/database.ts` NotificationSettings contains `notify_whatsapp_enabled: boolean`
- [x] `src/types/database.ts` NotificationSettings contains `notify_telegram_enabled: boolean`
- [x] `tests/ui/notification-settings-form.test.tsx` exists with 7 describe/it blocks
- [x] `tests/api/notification-settings.test.ts` exists with 6 describe/it blocks
- [x] `tests/api/notification-settings-telegram-unlink.test.ts` exists with 3 describe/it blocks
- [x] `tests/notifications/notify-dispatch.test.ts` contains `Phase 10: channel enable flags` block with 4 new tests
- [x] Existing Phase 5 tests not removed or modified (13 pass)
- [x] Phase 10 enable-flag tests are RED (3 fail)
- [x] `tsc --noEmit` exits 0
- [x] Commits c5d21e4 and 925ec0a exist in git log

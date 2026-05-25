---
phase: "12-notification-foundation"
plan: 1
subsystem: "notifications/schema"
tags: ["migration", "schema", "typescript", "rls", "realtime"]
dependency_graph:
  requires: []
  provides:
    - "app_notifications table with 9 columns, CHECK constraint, RLS, Realtime pub, index"
    - "notification_settings email opt-in columns (notify_email_enabled, email_address, notify_on_payment_failure)"
    - "notification_log CHECK constraint extended to include 'email'"
    - "NotificationChannel type includes 'email'"
    - "AppNotification interface exported"
    - "NotificationSettings interface has 3 new email fields"
  affects:
    - "src/lib/notifications/log.ts (NotificationChannel now includes 'email')"
    - "tests/ui/notification-settings-form.test.tsx (test fixture updated)"
tech_stack:
  added: []
  patterns:
    - "Contractor subquery RLS pattern on app_notifications (D-04)"
    - "CHECK constraint for event_type (not Postgres ENUM) — easier to extend"
    - "ALTER PUBLICATION supabase_realtime ADD TABLE — required for Phase 14 Realtime badge"
key_files:
  created:
    - path: "supabase/migrations/20260525000017_phase12_notification_foundation.sql"
      purpose: "Phase 12 schema: app_notifications table, notification_settings email columns, notification_log channel extension"
  modified:
    - path: "src/types/database.ts"
      purpose: "NotificationChannel | 'email', AppNotification interface, NotificationSettings 3 new fields"
    - path: "tests/ui/notification-settings-form.test.tsx"
      purpose: "Added required email fields to makeSettings factory (Rule 1 auto-fix)"
decisions:
  - "D-05: ALTER PUBLICATION supabase_realtime ADD TABLE app_notifications included in migration — silent failure if omitted"
  - "D-04: Contractor subquery RLS pattern used for app_notifications (not direct auth.uid() comparison)"
  - "D-07 gate rule: shouldSendEmail must check email_address IS NOT NULL AND notify_email_enabled = TRUE (both required)"
  - "CHECK constraint for event_type (not Postgres ENUM) — allows future extension without ALTER TYPE"
metrics:
  duration: "4 minutes"
  completed: "2026-05-25T03:32:40Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 2
---

# Phase 12 Plan 1: Notification Foundation Schema + Types Summary

**One-liner:** Migration creates `app_notifications` table with RLS + Realtime pub, extends `notification_settings` with email opt-in columns, and updates TypeScript types to include `'email'` channel and `AppNotification` interface.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write Phase 12 migration SQL | 18af12b | supabase/migrations/20260525000017_phase12_notification_foundation.sql |
| 2 | Update TypeScript database types | e940f4d | src/types/database.ts, tests/ui/notification-settings-form.test.tsx |

## What Was Built

### Migration: `supabase/migrations/20260525000017_phase12_notification_foundation.sql`

- `CREATE TABLE app_notifications` with 9 columns (id, contractor_id, event_type, title, body, is_read, read_at, created_at)
- `event_type CHECK (event_type IN ('lead', 'emergency', 'payment_failure', 'system'))` — CHECK constraint, not ENUM (extensible without ALTER TYPE)
- `ALTER TABLE app_notifications ENABLE ROW LEVEL SECURITY`
- 4 RLS policies using contractor subquery pattern: `contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid()))`
- `ALTER PUBLICATION supabase_realtime ADD TABLE app_notifications` — critical for Phase 14 Realtime badge updates
- `CREATE INDEX idx_app_notifications_contractor_id_created_at ON app_notifications(contractor_id, created_at DESC)` — for Phase 14 ORDER BY queries
- `ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS notify_email_enabled`, `email_address`, `notify_on_payment_failure` (D-06)
- `COMMENT ON COLUMN` for all three documenting D-06 and the two-part gate rule (D-07)
- `ALTER TABLE notification_log DROP CONSTRAINT notification_log_channel_check, ADD CONSTRAINT ... CHECK (channel IN ('sms', 'whatsapp', 'telegram', 'email'))` — unblocks Phase 13 email logging

### TypeScript Types: `src/types/database.ts`

- `NotificationChannel` extended from `'sms' | 'whatsapp' | 'telegram'` to `'sms' | 'whatsapp' | 'telegram' | 'email'`
- New `AppNotification` interface exported (BELL-04: in-app notification persistence)
- `NotificationSettings` interface extended with `notify_email_enabled: boolean`, `email_address: string | null`, `notify_on_payment_failure: boolean`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed NotificationSettings test fixture missing required fields**
- **Found during:** Task 2 typecheck (`tsc --noEmit`)
- **Issue:** `tests/ui/notification-settings-form.test.tsx` `makeSettings()` factory returned `NotificationSettings` without the three new required fields (`notify_email_enabled`, `email_address`, `notify_on_payment_failure`). TypeScript error: `Type 'boolean | undefined' is not assignable to type 'boolean'`.
- **Fix:** Added the three new fields with their zero/null defaults to the `makeSettings()` factory object.
- **Files modified:** `tests/ui/notification-settings-form.test.tsx`
- **Commit:** e940f4d (included in Task 2 commit)
- **Test result:** 7/7 tests pass after fix.

## Known Stubs

None — migration SQL and TypeScript types are complete with no placeholders.

## Threat Flags

No new threat surface beyond what is covered in the plan's threat model (T-12-01 through T-12-04).

## Self-Check: PASSED

- [x] `supabase/migrations/20260525000017_phase12_notification_foundation.sql` exists at worktree path
- [x] `src/types/database.ts` contains `NotificationChannel = 'sms' | 'whatsapp' | 'telegram' | 'email'`
- [x] `src/types/database.ts` exports `AppNotification` interface
- [x] `src/types/database.ts` `NotificationSettings` has all 3 new email fields
- [x] Commit `18af12b` exists (Task 1)
- [x] Commit `e940f4d` exists (Task 2)
- [x] `tsc --noEmit` exits 0
- [x] 7/7 notification-settings-form tests pass

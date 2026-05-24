---
phase: 11-account-page-subscription-load-fix-bill-03-deactivation
plan: "02"
subsystem: notifications-billing
tags: [tdd, notifications, payment-failure, channel-flags, inngest, billing]
dependency_graph:
  requires:
    - 11-01 (is_active: boolean in Contractor type; RED test stubs in tests/notifications/payment-alert.test.ts)
  provides:
    - sendPaymentFailureAlert with D-05 channel-flag gating (smsEnabled/whatsappEnabled)
    - stripe-payment-failure.ts D-06 join (all four notification_settings channel fields)
    - stripe-payment-failure.ts D-08 is_active=false + subscription_status=past_due atomic write
    - 6 GREEN tests for D-05 channel-flag gating
  affects:
    - src/lib/notifications/payment-alert.ts
    - src/inngest/functions/stripe-payment-failure.ts
    - tests/notifications/payment-alert.test.ts
tech_stack:
  added: []
  patterns:
    - Channel-flag gate pattern: check enabled && hasNumber before Twilio call
    - ns?.[0] array-join extraction for notification_settings
    - DEFAULT TRUE / DEFAULT FALSE fallback for nullable ns
    - Atomic DB write for is_active + subscription_status in a single .update()
key_files:
  created: []
  modified:
    - src/lib/notifications/payment-alert.ts
    - src/inngest/functions/stripe-payment-failure.ts
    - tests/notifications/payment-alert.test.ts
decisions:
  - D-05: Channel-flag gating — SMS/WhatsApp each gated independently by notify_sms_enabled/notify_whatsapp_enabled
  - D-06: load-contractor select expanded to include sms_number, whatsapp_number, notify_sms_enabled, notify_whatsapp_enabled
  - D-08: mark-agent-inactive now writes is_active=false + subscription_status=past_due atomically; update-subscription-status step removed
metrics:
  duration: "~5 minutes"
  completed: "2026-05-24T14:08:29Z"
  tasks_completed: 2
  files_created: 0
  files_modified: 3
---

# Phase 11 Plan 02: Channel-flag gating (D-05) + D-06 join + D-08 is_active write — Summary

**One-liner:** payment-alert.ts rewritten with smsEnabled/whatsappEnabled channel-flag gates (6 RED stubs now GREEN); stripe-payment-failure.ts updated to fetch all four notification_settings fields (D-06) and write is_active=false atomically with subscription_status=past_due (D-08).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement payment-alert.ts D-05 channel-flag gating (GREEN) | 09faa53 | src/lib/notifications/payment-alert.ts, tests/notifications/payment-alert.test.ts |
| 2 | Update stripe-payment-failure.ts — D-06 join + D-08 is_active write | 4d9f4ee | src/inngest/functions/stripe-payment-failure.ts |

## Verification Results

- `payment-alert.ts` `SendPaymentFailureAlertParams` has `smsNumber`, `smsEnabled`, `whatsappNumber`, `whatsappEnabled` fields
- SMS gate: `if (!smsEnabled || !smsNumber)` → warn log + skip; independent of WhatsApp gate
- WhatsApp gate: `if (whatsappEnabled && whatsappNumber)` → only fires when both truthy
- Warn log: `[payment-alert] SMS skipped for contractor ${contractorId}: smsEnabled=..., hasNumber=...` (T-11-02-02)
- All 6 tests in `tests/notifications/payment-alert.test.ts` pass (GREEN)
- `stripe-payment-failure.ts` load-contractor select includes all four notification_settings fields (D-06)
- `send-payment-alert` step resolves `smsNumber = ns?.sms_number ?? contractor.phone_number ?? null`
- `send-payment-alert` passes `smsEnabled: ns?.notify_sms_enabled ?? true` (DEFAULT TRUE)
- `send-payment-alert` passes `whatsappEnabled: ns?.notify_whatsapp_enabled ?? false` (DEFAULT FALSE)
- `mark-agent-inactive` writes `{ is_active: false, subscription_status: 'past_due' }` atomically (D-08)
- `update-subscription-status` step removed — functionality merged into step 3
- `npx tsc --noEmit` exits 0

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

Note: The worktree was based on commit `5e0a4fe` (phase 10) but required Plan 01 artifacts. A `git merge main` brought the worktree up to `95aac43` before task execution. This is normal sequential-wave setup, not a deviation.

## Known Stubs

None. All fields are wired to DB columns and notification_settings rows.

## Threat Flags

None. No new network endpoints introduced. The channel-flag gates are pure logic within the existing payment alert helper and Inngest function. The `is_active` column was added in Plan 01 (D-07); this plan writes to it as designed.

## Self-Check: PASSED

- [x] `src/lib/notifications/payment-alert.ts` has `smsNumber`, `smsEnabled`, `whatsappNumber`, `whatsappEnabled` fields
- [x] `tests/notifications/payment-alert.test.ts` has 6 passing tests (GREEN)
- [x] `src/inngest/functions/stripe-payment-failure.ts` includes `notify_sms_enabled` in select
- [x] `src/inngest/functions/stripe-payment-failure.ts` has `is_active: false` in mark-agent-inactive
- [x] `update-subscription-status` step not present in stripe-payment-failure.ts
- [x] Commits 09faa53 (Task 1) and 4d9f4ee (Task 2) present in git log
- [x] `npx tsc --noEmit` exits 0

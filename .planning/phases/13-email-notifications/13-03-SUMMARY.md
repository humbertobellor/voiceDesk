---
phase: 13-email-notifications
plan: "03"
subsystem: notifications
tags: [tdd, wave-2, email, computeChannels, inngest]
dependency_graph:
  requires:
    - "13-01 (RED test scaffolds — computeChannels-email.test.ts)"
  provides:
    - "computeChannels() returns shouldSendEmail: boolean"
    - "load-notification-data select includes notify_email_enabled and email_address"
    - "Early-exit guard checks all four channels including email"
    - "tests/inngest/computeChannels-email.test.ts (GREEN — 6 tests)"
    - "tests/notifications/notify-dispatch.test.ts (no regression — 17 tests)"
  affects:
    - "src/inngest/functions/retell-notify-dispatch.ts (Plan 04 email dispatch step wiring)"
tech_stack:
  added: []
  patterns:
    - "TDD GREEN phase: RED tests from Plan 01 driven to GREEN"
    - "Triple-gate pattern: email_address != null AND notify_email_enabled = true AND intent matches"
    - "T-13-03-02 threat mitigation: all-four-channel early-exit guard"
key_files:
  created: []
  modified:
    - "src/inngest/functions/retell-notify-dispatch.ts (computeChannels extension + DB select + guard)"
    - "tests/notifications/notify-dispatch.test.ts (email field defaults in helpers + updated toEqual assertions)"
decisions:
  - "shouldSendEmail follows identical intent rules to SMS/Telegram (lead + emergency always, info only with notify_on_general_inquiry=true)"
  - "Existing toEqual assertions updated with shouldSendEmail: false (email_address: null default ensures no regression)"
  - "Early-exit guard updated to include !shouldSendEmail per T-13-03-02 — email-only contractors must not be silently skipped"
metrics:
  duration: "~12 minutes"
  completed_date: "2026-05-25T03:45:00Z"
  tasks_completed: 1
  files_changed: 2
---

# Phase 13 Plan 03: Extend computeChannels() with Email Gating

**One-liner:** Extended computeChannels() to return shouldSendEmail using triple-gate (address + flag + intent), expanded DB select, and updated early-exit guard — driving 6 RED tests from Plan 01 to GREEN with zero regression.

## What Was Built

**Task 1 — GREEN: computeChannels() email channel extension**

Changes to `src/inngest/functions/retell-notify-dispatch.ts`:

| Change | Location | Description |
|--------|----------|-------------|
| Pick<> expansion | computeChannels() signature | Added `notify_email_enabled` and `email_address` to Pick<NotificationSettings, ...> |
| Return type | computeChannels() return | Added `shouldSendEmail: boolean` to return type |
| Early-return block | no_action/unknown path | Added `shouldSendEmail: false` to the returned object |
| shouldSendEmail logic | After shouldSendTelegram | Triple-gate: address != null AND enabled = true AND intent matches preference flags |
| DB select | load-notification-data step | Added `notify_email_enabled` and `email_address` to the select string |
| Destructure | Line ~160 | Added `shouldSendEmail` to destructure from computeChannels() |
| Early-exit guard | Line ~164 | Added `!shouldSendEmail` to the four-channel guard (T-13-03-02 mitigation) |

Changes to `tests/notifications/notify-dispatch.test.ts`:

- `makeSettings()` helper: added `notify_email_enabled: false` and `email_address: null` to defaults and Pick<> type
- `makeSettingsWithEnableFlags()` helper: same additions
- All `toEqual()` assertions: added `shouldSendEmail: false` (email defaults to null in all existing tests — no behavior change)

## Test Results

| Suite | Before Plan | After Plan | Delta |
|-------|-------------|------------|-------|
| computeChannels-email.test.ts | 6 RED (failing) | 6 GREEN (passing) | +6 |
| notify-dispatch.test.ts | 17 GREEN | 17 GREEN | 0 (no regression) |

## Deviations from Plan

None — plan executed exactly as written.

The only non-obvious step was updating the `toEqual` assertions in `notify-dispatch.test.ts` to include `shouldSendEmail: false`. This was required because `computeChannels()` now returns a 4-key object and `toEqual` performs strict equality on all keys. Since `email_address` defaults to `null` in all existing test cases, `shouldSendEmail` is `false` for all existing assertions — no behavioral change, only type-level correctness.

## Threat Model Coverage

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-13-03-02 | Early-exit guard updated to check `!shouldSendSms && !shouldSendWhatsApp && !shouldSendTelegram && !shouldSendEmail` — email-only contractors will not be silently skipped when Plan 04 wires the send-email step |

## Known Stubs

None — this plan extends a pure computation function. The `shouldSendEmail` flag is computed correctly but not yet consumed (no send-email step.run() block). Plan 04 wires the actual email send. This is intentional by design — Plan 03 scopes exclusively to the gating logic.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes. The DB select expansion adds two columns to an existing SELECT from the same `notification_settings` table using the same service role client.

## Self-Check: PASSED

- [x] `src/inngest/functions/retell-notify-dispatch.ts` exists: FOUND
- [x] `tests/notifications/notify-dispatch.test.ts` exists: FOUND
- [x] Commit 26d6789 (feat - GREEN implementation): FOUND
- [x] `computeChannels-email.test.ts`: 6 tests pass GREEN: VERIFIED
- [x] `notify-dispatch.test.ts`: 17 tests pass GREEN (no regression): VERIFIED
- [x] `grep -c "shouldSendEmail" retell-notify-dispatch.ts` returns 7 (>= 3): VERIFIED
- [x] `npx tsc --noEmit` exits 0 (excluding pre-existing templates.test.ts RED): VERIFIED
- [x] load-notification-data select includes `notify_email_enabled` and `email_address`: VERIFIED
- [x] Early-exit guard includes `!shouldSendEmail`: VERIFIED

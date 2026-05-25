---
phase: 05-notifications
plan: 03
subsystem: notifications
tags: [inngest, sms, whatsapp, telegram, dispatch, tdd, wave-3]
dependency_graph:
  requires: [05-01, 05-02]
  provides: [notify-dispatch-function, classify-notify-trigger]
  affects: [05-04]
tech_stack:
  added: []
  patterns: [inngest-createFunction, promise-allSettled, write-before-send, whatsapp-fallback-sms]
key_files:
  created:
    - src/inngest/functions/retell-notify-dispatch.ts
    - tests/notifications/notify-dispatch.test.ts
  modified:
    - src/inngest/functions/retell-call-classify.ts
    - src/app/api/inngest/route.ts
decisions:
  - "retellNotifyDispatch registered in Inngest route immediately (Rule 2: function unreachable until registered)"
  - "Test literal type narrowing fixed with explicit :boolean annotation and (value as boolean) cast — tsc strict mode rejects false===true comparison on narrowed literals"
  - "D-09 WhatsApp fallback swallows original error after fallback attempt — D-08 allSettled semantics prevent double-throw"
metrics:
  duration: ~4 minutes
  completed: "2026-05-09"
  tasks_completed: 2
  files_created: 2
  files_modified: 2
---

# Phase 5 Plan 03: Notify Dispatch Function Summary

**One-liner:** retell-notify-dispatch Inngest function wires SMS/WhatsApp/Telegram dispatch with Promise.allSettled isolation, D-09 WhatsApp→SMS fallback, and D-12 pending-before-send notification_log pattern; retell-call-classify extended with Step 9 to fire retell/call.notify.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create retell-notify-dispatch Inngest function | 89f5bff | src/inngest/functions/retell-notify-dispatch.ts, tests/notifications/notify-dispatch.test.ts, src/app/api/inngest/route.ts |
| 2 | Extend retell-call-classify.ts to fire retell/call.notify event | d0322b5 | src/inngest/functions/retell-call-classify.ts |

## What Was Built

**retell-notify-dispatch.ts — Core notification dispatch function:**
- `retellNotifyDispatch`: Inngest function with `retries:5`, `idempotency: 'event.data.callId'`, `onFailure` handler
- Step 1 (`load-notification-data`): loads call, lead, notification_settings from DB in parallel via `Promise.all`
- D-03: returns early for `no_action` intent (hang-ups, wrong numbers, spam)
- D-05/D-06 dispatch matrix: SMS fires for lead/emergency/info; WhatsApp+Telegram fire for lead/emergency + info when `notify_on_general_inquiry=true`
- Step 2 (`dispatch-notifications`): all channels dispatched via `Promise.allSettled` — one failure does not block others
- D-09: WhatsApp failure triggers immediate SMS fallback to `sms_number` within same step invocation
- D-12: `writeNotificationLog` (status='pending') before each send; `updateNotificationLog` (sent/failed) after
- EMRG-03: emergency SMS body: `"EMERGENCY: New call from [phone] — [issue]. Call back immediately."`
- EMRG-03: emergency Telegram body: `"⚠️ EMERGENCY: New call from [phone] — [issue]. Call back immediately."`

**retell-call-classify.ts — Step 9 extension:**
- Added `step.sendEvent('trigger-notify', { name: 'retell/call.notify', data: { callId, contractorId } })` after trigger-agent-sync block
- D-01: fires independently from agent sync — notify failures do not re-run classification
- D-03: fires after every classification including no_action; intent filtering inside dispatch function
- 3 total `step.sendEvent` calls confirmed (trigger-agent-sync + trigger-notify)

**src/app/api/inngest/route.ts — Registration:**
- `retellNotifyDispatch` imported and added to the served functions array

**Tests: 6/6 GREEN** (20/20 total across all notification tests)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Registered retellNotifyDispatch in Inngest route**
- **Found during:** Task 1 completion
- **Issue:** The plan did not instruct registering the new function in `src/app/api/inngest/route.ts`. Without registration, Inngest cannot discover or invoke the function — it would exist but never fire.
- **Fix:** Added import and registration of `retellNotifyDispatch` in the serve call alongside the existing three functions.
- **Files modified:** src/app/api/inngest/route.ts
- **Commit:** 89f5bff

**2. [Rule 1 - Bug] Fixed TypeScript literal narrowing in test file**
- **Found during:** Task 1 tsc check
- **Issue:** Test variables `notify_on_general_inquiry = false/true` were inferred as literal types `false`/`true` by TypeScript strict mode. The comparisons `false === true` and similar triggered TS2367 ("comparison appears unintentional").
- **Fix:** Added explicit `: boolean` annotation and `(value as boolean)` cast to prevent literal narrowing; removed `=== true` comparison in favor of direct boolean reference.
- **Files modified:** tests/notifications/notify-dispatch.test.ts
- **Commit:** 89f5bff

## Known Stubs

None — all notification channels are fully wired. The only known stub is `WHATSAPP_CONTENT_SIDS` containing `HXplaceholder_*` values (carried forward from Plan 02, requires WABA approval before production use).

## Threat Surface Scan

No new network endpoints or auth paths introduced. `retell-notify-dispatch.ts` imports `server-only` — credentials never reach the browser. All STRIDE mitigations from the plan's threat model are present:
- T-05-03-01: Event fired only from within classify (server-side Inngest function)
- T-05-03-02: contractorId sourced from classify function, validated non-null before use
- T-05-03-03: Accepted — caller_phone sent to contractor's own configured number only
- T-05-03-04: retries:5 with exponential backoff; partial failures re-throw from dispatch step
- T-05-03-05: notification_settings loaded via service role from DB; values set only by authenticated contractor

## Self-Check: PASSED

- [x] src/inngest/functions/retell-notify-dispatch.ts — exists, exports retellNotifyDispatch
- [x] tests/notifications/notify-dispatch.test.ts — exists, 6/6 tests GREEN
- [x] src/inngest/functions/retell-call-classify.ts — contains "retell/call.notify" step.sendEvent
- [x] src/app/api/inngest/route.ts — retellNotifyDispatch registered
- [x] Commit 89f5bff — dispatch function + tests + route registration
- [x] Commit d0322b5 — classify Step 9 extension
- [x] 20/20 tests passing (all notification tests)
- [x] tsc --noEmit clean
- [x] Promise.allSettled confirmed in retell-notify-dispatch.ts
- [x] EMERGENCY in SMS/Telegram bodies confirmed
- [x] retell/call.notify in both classify (trigger) and dispatch (listener)

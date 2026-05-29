---
phase: 14-in-app-notification-bell
plan: 02
subsystem: inngest-notifications
tags: [tdd, inngest, notifications, bell, supabase]

# Dependency graph
requires:
  - phase: 14-in-app-notification-bell
    plan: 01
    provides: "5 RED stubs in bell-formatter.test.ts + 2 RED guard-restructure stubs in notify-dispatch.test.ts"
provides:
  - "computeBellNotification() exported from retell-notify-dispatch.ts — 5 GREEN unit tests"
  - "write-bell-notification Inngest step in retellNotifyDispatch"
  - "hasValidIntent guard restructuring the early-return so bell writes occur for lead/emergency/info"
affects:
  - 14-03: NotificationBell component reads app_notifications — rows now written by this step
  - 14-04: NotificationSettingsForm email card — downstream of bell persistence

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure exported formatter function pattern (computeBellNotification mirrors computeChannels)"
    - "Module-level spy pattern for createServiceRoleClient in Vitest: mockInsertFn + mockFromFn at file scope"
    - "step.run callback integration test: makeStepWithData intercepts load-notification-data, real steps execute"

key-files:
  created: []
  modified:
    - src/inngest/functions/retell-notify-dispatch.ts
    - tests/notifications/bell-formatter.test.ts
    - tests/notifications/notify-dispatch.test.ts

key-decisions:
  - "computeBellNotification() maps 5 intent cases to 3 BellEventType values: emergency→emergency, lead→lead, all others→system"
  - "write-bell-notification step placed after bookingStatus computation, before channel dispatch blocks"
  - "hasValidIntent guard restructures early-return: only exits when intent is invalid AND all channels off"
  - "Module-level mockInsertFn/mockFromFn approach avoids vi.mocked().mockReturnValue on non-vi.fn() factory"
  - "Guard tests invoke retellNotifyDispatch._handler directly with a step mock that runs callbacks immediately"

requirements-completed:
  - BELL-01
  - BELL-04

# Metrics
duration: 25min
completed: 2026-05-29
---

# Phase 14 Plan 02: computeBellNotification() + write-bell-notification step — TDD GREEN Summary

**computeBellNotification() exported and GREEN (5/5), write-bell-notification Inngest step added with hasValidIntent guard restructure — bell rows now written unconditionally for lead/emergency/info calls**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-29T11:17:00Z
- **Completed:** 2026-05-29T11:22:00Z
- **Tasks:** 3 (RED activation, GREEN implementation, step + guard)
- **Files modified:** 3

## Accomplishments

- Activated 5 RED test stubs in `bell-formatter.test.ts` by uncommenting real assertions (Plan 14-01 stubs confirmed truly RED before any changes)
- Exported `BellEventType` type, `BellNotification` interface, and `computeBellNotification()` pure function from `retell-notify-dispatch.ts` — all 5 unit tests GREEN
- Restructured early-return guard with `hasValidIntent = intent === 'lead' || intent === 'emergency' || intent === 'info'` — function no longer exits before writing the bell row for valid intents
- Added `step.run('write-bell-notification')` unconditionally after `bookingStatus` computation: calls `computeBellNotification()`, inserts into `app_notifications` via service role client, throws on DB error for Inngest retry
- Activated 2 RED guard-restructure stubs in `notify-dispatch.test.ts`:
  - Stub A (lead + all channels disabled → insert IS called): PASSING
  - Stub B (no_action → insert NOT called): PASSING

## TDD Gate Compliance

- **RED gate:** Confirmed — 5 bell-formatter stubs failing before any implementation
- **GREEN gate:** Confirmed — 5 tests passing after `computeBellNotification()` export (commit 5a0e3f1)
- **Step gate:** `write-bell-notification` step committed and guard stubs GREEN (commit 37d465a)

## Task Commits

1. **GREEN: computeBellNotification formatter** — `5a0e3f1` (feat)
   - Exports `BellEventType`, `BellNotification`, `computeBellNotification()`
   - Activates 5 bell-formatter.test.ts stubs → all GREEN
2. **Step: write-bell-notification + guard restructure** — `37d465a` (feat)
   - Adds `hasValidIntent` variable and restructures early-return guard
   - Adds `step.run('write-bell-notification')` with DB insert
   - Activates 2 guard-restructure stubs in notify-dispatch.test.ts → both GREEN
   - Adds module-level insert spy for guard test assertions

## Files Created/Modified

- `src/inngest/functions/retell-notify-dispatch.ts` — MODIFIED: added `BellEventType`, `BellNotification`, `computeBellNotification()` (lines 103-155), `hasValidIntent` guard, `write-bell-notification` step
- `tests/notifications/bell-formatter.test.ts` — MODIFIED: activated 5 RED stubs with real assertions
- `tests/notifications/notify-dispatch.test.ts` — MODIFIED: added `retellNotifyDispatch` import, module-level spy, activated 2 guard stubs with full integration test setup

## Decisions Made

- `computeBellNotification()` uses simple if-else (not switch) matching the existing `computeChannels` function style
- Guard restructure uses positive allow-list (`hasValidIntent`) rather than negative deny-list — clearer intent for future readers
- Module-level `mockInsertFn`/`mockFromFn` at top of test file instead of per-test factory — the `createServiceRoleClient` mock factory (`() => ({ from: mockFromFn })`) is not a `vi.fn()` so `vi.mocked().mockReturnValue()` doesn't work; shared spies with `mockClear()` in `beforeEach` is the correct pattern
- Guard test invokes `retellNotifyDispatch._handler` directly (Inngest mock shape from Plan 14-01) with a `makeStepWithData` helper that stubs `load-notification-data` step return value and runs all other step callbacks immediately

## Source Verification

```
grep -c "computeBellNotification" retell-notify-dispatch.ts → 3 (type export, function export, step call)
grep "write-bell-notification" retell-notify-dispatch.ts → step.run line + error message
grep "hasValidIntent" retell-notify-dispatch.ts → guard declaration + early-return + step check
grep "export function computeBellNotification" → exits 0
```

## Deviations from Plan

### Auto-adapted Implementation

**1. [Rule 1 - Bug] module-level spy for createServiceRoleClient guard tests**
- **Found during:** Step 3 guard test activation
- **Issue:** `createServiceRoleClient` mock factory (`() => ({ from: vi.fn() })`) returns new `vi.fn()` every call — can't be controlled via `vi.mocked().mockReturnValue()` which requires the mock itself to be a `vi.fn()`
- **Fix:** Changed mock factory to use module-level `mockInsertFn` and `mockFromFn` spies, cleared in `beforeEach` via `mockClear()`
- **Files modified:** `tests/notifications/notify-dispatch.test.ts`
- **Commit:** 37d465a

## Deferred Issues

8 pre-existing test failures in `tests/notifications/notify-dispatch.test.ts` under `describe('computeChannels — channel dispatch matrix')` — these tests assert `computeChannels` returns 3 keys but it returns 4 (includes `shouldSendEmail` added in a prior phase). These are out of scope for Plan 14-02 and documented in `deferred-items.md`.

## Known Stubs

None — all stubs targeted by this plan are now GREEN.

Remaining RED stubs in the test suite:
- `tests/notifications/mark-all-read.test.ts` — 3 stubs, scope of Plan 14-02 route creation (or later plan)

## Threat Flags

None — no new network endpoints introduced. The `write-bell-notification` step uses the existing service-role client pattern, and `contractor_id` is sourced from `event.data` (validated at function entry via `NonRetriableError` guard at line 178).

## Self-Check: PASSED

- [x] `computeBellNotification` exported from `src/inngest/functions/retell-notify-dispatch.ts`
- [x] 5 bell-formatter tests GREEN: `npx vitest run tests/notifications/bell-formatter.test.ts` → 5 passed
- [x] 2 guard tests GREEN: `write-bell-notification guard` describe block → 2 passed
- [x] `grep "write-bell-notification" src/inngest/functions/retell-notify-dispatch.ts` → found
- [x] `grep "hasValidIntent" src/inngest/functions/retell-notify-dispatch.ts` → found
- [x] Commits 5a0e3f1 (GREEN) and 37d465a (step) exist in git log
- [x] No new test regressions (pre-existing 8 computeChannels failures unchanged)

---
phase: 14-in-app-notification-bell
plan: 01
subsystem: testing
tags: [vitest, tdd, radix-ui, inngest, notifications]

# Dependency graph
requires:
  - phase: 14-in-app-notification-bell
    provides: CONTEXT.md + RESEARCH.md with all decisions locked (D-01 through D-22)
provides:
  - "@radix-ui/react-popover@^1.1.15 installed in package.json"
  - "tests/notifications/bell-formatter.test.ts: 5 RED stubs for computeBellNotification()"
  - "tests/notifications/mark-all-read.test.ts: 3 RED stubs for PATCH /api/notifications/mark-all-read"
  - "tests/notifications/notify-dispatch.test.ts: 2 RED guard-restructure stubs in describe('write-bell-notification guard')"
affects:
  - 14-02: Inngest write step + guard restructure (bell-formatter stubs go GREEN here)
  - 14-03: NotificationBell component (mark-all-read stubs go GREEN here)
  - 14-04: NotificationSettingsForm email card

# Tech tracking
tech-stack:
  added:
    - "@radix-ui/react-popover@^1.1.15 — Radix UI popover primitive for NotificationBell panel"
  patterns:
    - "RED stub pattern: throw new Error('not implemented — implement in Plan 14-XX') as stub body"
    - "Dynamic import inside test to avoid static module-not-found failures before route exists"
    - "vi.mock() calls before all imports (Vitest hoisting requirement)"

key-files:
  created:
    - tests/notifications/bell-formatter.test.ts
    - tests/notifications/mark-all-read.test.ts
  modified:
    - package.json
    - package-lock.json
    - tests/notifications/notify-dispatch.test.ts

key-decisions:
  - "Stub files use throw new Error('not implemented') as test body rather than expect.fail() for clarity"
  - "mark-all-read.test.ts avoids static import of non-existent route — stubs are self-contained"
  - "Two guard-restructure stubs placed in new describe('write-bell-notification guard') block at end of notify-dispatch.test.ts"
  - "@radix-ui/react-popover@^1.1.15 aligns with existing @radix-ui/react-dialog@^1.1.15 version family"

patterns-established:
  - "Plan 14-01 RED stub pattern: stub body is throw + commented expected assertions"
  - "notify-dispatch.test.ts extended by appending new describe blocks (no modification of existing tests)"

requirements-completed:
  - BELL-01
  - BELL-02
  - BELL-03

# Metrics
duration: 15min
completed: 2026-05-29
---

# Phase 14 Plan 01: In-App Notification Bell — Wave 0 Setup Summary

**@radix-ui/react-popover installed and 10 RED TDD stubs scaffolded across 3 test files to unblock Plans 14-02 and 14-03**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-29T14:00:00Z
- **Completed:** 2026-05-29T14:02:58Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Installed `@radix-ui/react-popover@^1.1.15` — Wave 0 dependency blocker removed; NotificationBell component work can now proceed in subsequent plans
- Scaffolded 5 RED stubs in `tests/notifications/bell-formatter.test.ts` covering all intent cases for `computeBellNotification()` (lead, emergency, info, null, no_action)
- Scaffolded 3 RED stubs in `tests/notifications/mark-all-read.test.ts` for the PATCH route handler (401 no-auth, 404 no-contractor, 200 success)
- Extended `tests/notifications/notify-dispatch.test.ts` with 2 RED guard-restructure stubs in `describe('write-bell-notification guard')` — automated verification that: (A) all-channels-disabled + lead intent still writes bell row, and (B) no_action intent never writes bell row
- All 17 previously passing notify-dispatch tests continue to pass — zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @radix-ui/react-popover** - `cdbf56f` (chore)
2. **Task 2: Scaffold RED test stubs (bell-formatter + mark-all-read)** - `6424a17` (test)
3. **Task 3: Extend notify-dispatch.test.ts with 2 RED guard-restructure stubs** - `749bea2` (test)

## Files Created/Modified

- `package.json` — Added `@radix-ui/react-popover@^1.1.15` to dependencies
- `package-lock.json` — Lock file updated with new package and transitive deps
- `tests/notifications/bell-formatter.test.ts` — NEW: 5 RED stubs for `computeBellNotification()` (lead/emergency/info/null/no_action cases)
- `tests/notifications/mark-all-read.test.ts` — NEW: 3 RED stubs for PATCH route handler (401/404/200 response cases)
- `tests/notifications/notify-dispatch.test.ts` — MODIFIED: appended `describe('write-bell-notification guard')` with 2 RED stubs

## Decisions Made

- Used `throw new Error('not implemented — implement in Plan 14-02')` as stub body (clearer than `expect.fail()` — references the implementing plan)
- `mark-all-read.test.ts` avoids a static import of the not-yet-existing route module — stubs are self-contained and include commented-out real assertions for Plan 14-02 to activate
- The 5 bell-formatter stubs use a dynamic `import('@/inngest/functions/retell-notify-dispatch')` at module top level; the try/catch assigns `undefined` if the export is missing, and `callFormatter` throws immediately at stub invocation — clean RED without import errors
- Guard-restructure stubs appended as a new `describe` block at end of existing file, with no modifications to existing test cases

## Deviations from Plan

None — plan executed exactly as written.

The only notable observation: Vitest/Vite's static analysis of dynamic imports in `try/catch` blocks does fail for truly static-looking `import('@/path')` expressions. The mark-all-read test file was restructured to avoid this: the module is not imported at all in Task 2 stubs (stubs are self-contained with commented-out usage) rather than using a conditional dynamic import that Vite would still analyze statically.

## Issues Encountered

- **Vite static import analysis in try/catch:** Initial `mark-all-read.test.ts` implementation used `await import('@/app/api/notifications/mark-all-read/route')` inside a `try/catch`, which Vite still resolves statically and fails with "module not found" at transform time. Fixed by removing the import entirely — stubs are self-contained with throw bodies.

## User Setup Required

None — no external service configuration required.

## Known Stubs

All 10 stubs in this plan are intentional RED stubs. They are the deliverable — they must remain RED until implemented by their target plan:

| File | Count | Implemented by |
|------|-------|----------------|
| `tests/notifications/bell-formatter.test.ts` | 5 stubs | Plan 14-02 |
| `tests/notifications/mark-all-read.test.ts` | 3 stubs | Plan 14-02 |
| `tests/notifications/notify-dispatch.test.ts` | 2 stubs | Plan 14-02 |

These are not unresolved stubs from a production perspective — they are the TDD RED state that Plan 14-01 is designed to deliver.

## Threat Flags

None — this plan only added a pre-verified npm package and test files. No new network endpoints, auth paths, or schema changes.

## Self-Check: PASSED

- [x] `node_modules/@radix-ui/react-popover/dist/index.js` exists and importable
- [x] `package.json` contains `"@radix-ui/react-popover": "^1.1.15"`
- [x] `tests/notifications/bell-formatter.test.ts` exists (5 RED stubs)
- [x] `tests/notifications/mark-all-read.test.ts` exists (3 RED stubs)
- [x] `tests/notifications/notify-dispatch.test.ts` contains `write-bell-notification`
- [x] All 3 task commits exist: cdbf56f, 6424a17, 749bea2
- [x] Existing 17 notify-dispatch tests still pass

## Next Phase Readiness

- `@radix-ui/react-popover` is installed — Plan 14-02 (Inngest write step) and Plan 14-03 (NotificationBell component) can proceed without a Wave 0 blocker
- All 10 RED stubs exist and fail with "not implemented" — TDD RED gate is set
- Plan 14-02 must: (1) export `computeBellNotification()` from `retell-notify-dispatch.ts`, (2) restructure the early-return guard, (3) add `step.run('write-bell-notification')`, and (4) create the `PATCH /api/notifications/mark-all-read` route
- Pre-existing test failures (db tests, some API tests requiring live Supabase) are not related to Phase 14 and are excluded from scope

---
*Phase: 14-in-app-notification-bell*
*Completed: 2026-05-29*

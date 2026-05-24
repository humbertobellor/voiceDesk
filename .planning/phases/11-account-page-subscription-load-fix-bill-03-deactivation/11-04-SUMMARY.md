---
phase: 11-account-page-subscription-load-fix-bill-03-deactivation
plan: "04"
subsystem: auth-enforcement
tags: [middleware, inngest, tdd, deactivation, is_active, d-09]
dependency_graph:
  requires:
    - 11-01 (is_active column + TypeScript type + RED test stubs)
    - 11-02 (D-05 channel-flag gating, payment-alert tests GREEN)
    - 11-03 (D-08 is_active write in handleSubscriptionUpdated/handleSubscriptionDeleted)
  provides:
    - middleware is_active redirect guard (D-09)
    - retell-call-classify is_active early return (D-09)
    - 3 D-09 tests GREEN (was RED from Plan 01)
  affects:
    - middleware.ts
    - src/inngest/functions/retell-call-classify.ts
    - tests/lib/retell-call-classify.test.ts
tech_stack:
  added: []
  patterns:
    - Sentinel return value (_deactivated) to exit Inngest multi-step function early
    - Server-side is_active enforcement in Next.js middleware (cannot be bypassed client-side)
    - Structured JSON log for audit trail on skipped Inngest runs
key_files:
  created: []
  modified:
    - middleware.ts
    - src/inngest/functions/retell-call-classify.ts
    - tests/lib/retell-call-classify.test.ts
decisions:
  - "D-09: is_active enforcement placed at two server-side layers: middleware (dashboard access) and Inngest step (call processing). Client cannot bypass either."
  - "Sentinel return value { ...data, _deactivated: true } chosen over NonRetriableError for is_active=false — the call happened; this is not an error, just a skip."
  - "/settings/account exempt from middleware is_active redirect to prevent redirect loop."
metrics:
  duration: "~5 minutes"
  completed: "2026-05-24T10:14:00Z"
  tasks_completed: 2
  files_created: 0
  files_modified: 3
---

# Phase 11 Plan 04: is_active enforcement — middleware + retell-call-classify (D-09) — Summary

**One-liner:** Server-side is_active enforcement at two layers: middleware redirects deactivated contractors' dashboard requests to /settings/account, and retell-call-classify returns early skipping all lead/appointment/calendar steps for deactivated contractors.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | middleware.ts — is_active redirect guard (D-09) | 6781c2f | middleware.ts |
| 2 | retell-call-classify.ts — is_active early return + GREEN tests | 678bebc | src/inngest/functions/retell-call-classify.ts, tests/lib/retell-call-classify.test.ts |

## Verification Results

- `grep -n "is_active\|settings/account" middleware.ts`: both contractor selects include `is_active`, redirect guard present with `/settings/account` exemption
- `npx vitest run tests/lib/retell-call-classify.test.ts --reporter verbose`: 3 tests passed (was 3 failing RED stubs)
- `npx tsc --noEmit`: exits 0 after both tasks

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All RED stubs from Plan 01 for D-09 are now GREEN.

## Threat Flags

None. Both enforcement points are server-side (middleware runs before any page render; Inngest step uses service role client). No new network endpoints or trust boundary changes introduced.

## Self-Check: PASSED

- [x] `middleware.ts` contains `is_active` in both contractor selects (lines 41, 56)
- [x] `middleware.ts` redirects to `/settings/account` when `contractor.is_active === false`
- [x] `middleware.ts` exempts `/settings/account` path from redirect (prevents loop)
- [x] `src/inngest/functions/retell-call-classify.ts` load-contractor select includes `is_active`
- [x] `retell-call-classify.ts` returns `{ ...data, _deactivated: true }` when `!data.is_active`
- [x] `retell-call-classify.ts` checks `_deactivated` sentinel after step.run and returns early
- [x] `tests/lib/retell-call-classify.test.ts`: 3 D-09 tests passing (GREEN)
- [x] `npx tsc --noEmit`: exits 0
- [x] Commits 6781c2f and 678bebc present in git log

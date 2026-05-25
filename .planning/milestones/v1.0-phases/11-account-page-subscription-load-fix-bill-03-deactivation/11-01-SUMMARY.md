---
phase: 11-account-page-subscription-load-fix-bill-03-deactivation
plan: "01"
subsystem: database-schema
tags: [schema, types, tdd, migration, supabase]
dependency_graph:
  requires: []
  provides:
    - contractors.is_active column (D-07)
    - contractors.trial_ends_at column (D-04)
    - Contractor TypeScript type fields
    - RED test stubs for Plans 02 (D-05) and 04 (D-09)
  affects:
    - src/types/database.ts
    - All code referencing Contractor type
tech_stack:
  added: []
  patterns:
    - ALTER TABLE ... ADD COLUMN IF NOT EXISTS (idempotent migrations)
    - RED-phase TDD stubs (throw new Error("not yet implemented"))
key_files:
  created:
    - supabase/migrations/20260524000016_phase11_is_active_trial_ends_at.sql
    - tests/notifications/payment-alert.test.ts
    - tests/lib/retell-call-classify.test.ts
  modified:
    - src/types/database.ts
decisions:
  - D-07: is_active BOOLEAN NOT NULL DEFAULT TRUE replaces agent_sync_status='failed' hack for deactivation
  - D-04: trial_ends_at TIMESTAMPTZ nullable; populated by handleSubscriptionUpdated on trialing status
  - Test files placed in tests/ not src/ per vitest.config.ts include pattern
metrics:
  duration: "~2 minutes"
  completed: "2026-05-24T05:26:08Z"
  tasks_completed: 3
  files_created: 3
  files_modified: 1
---

# Phase 11 Plan 01: Schema additions (is_active, trial_ends_at) + RED test stubs — Summary

**One-liner:** Idempotent migration adding `is_active` (BILL-03 deactivation flag) and `trial_ends_at` (trial display) to contractors table, TypeScript types updated, and 9 RED stubs placed for Plans 02 and 04.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migration SQL for is_active and trial_ends_at | 8f4a2ff | supabase/migrations/20260524000016_phase11_is_active_trial_ends_at.sql |
| 2 | Push migration + update TypeScript types | 533969b | src/types/database.ts |
| 3 | RED-state test stubs for Plans 02 and 04 | 243142b | tests/notifications/payment-alert.test.ts, tests/lib/retell-call-classify.test.ts |

## Verification Results

- Migration file: both `ADD COLUMN IF NOT EXISTS` clauses present with `COMMENT ON COLUMN` for each
- `supabase db push`: exited 0, migration applied successfully
- `src/types/database.ts`: Contractor interface now has `is_active: boolean` and `trial_ends_at: string | null`
- `npx tsc --noEmit`: exits 0, zero new errors
- `tests/notifications/payment-alert.test.ts`: 6 RED stubs, all failing with "not yet implemented"
- `tests/lib/retell-call-classify.test.ts`: 3 RED stubs (D-09 block), all failing with "not yet implemented"
- Total: 9 tests failing — confirmed RED state

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test files relocated from src/ to tests/**
- **Found during:** Task 3
- **Issue:** Plan specified `src/lib/notifications/payment-alert.test.ts` and `src/inngest/functions/retell-call-classify.test.ts`, but `vitest.config.ts` `include` pattern only picks up `tests/**/*.test.ts`. Files in `src/` would not be discovered or run.
- **Fix:** Created files at `tests/notifications/payment-alert.test.ts` and `tests/lib/retell-call-classify.test.ts` — directories consistent with existing test organization (tests/notifications/ already exists with 5 files).
- **Files modified:** tests/notifications/payment-alert.test.ts, tests/lib/retell-call-classify.test.ts
- **Commit:** 243142b

## Known Stubs

- `tests/notifications/payment-alert.test.ts` — 6 stubs throw "not yet implemented"; GREEN implementation is Plan 02 (D-05 channel-flag gating)
- `tests/lib/retell-call-classify.test.ts` — 3 stubs throw "not yet implemented"; GREEN implementation is Plan 04 (D-09 is_active early return guard)

These stubs are intentional RED-phase artifacts per TDD protocol. They are not blocking — Plans 02 and 04 own the GREEN implementations.

## Threat Flags

None. Migration is additive-only (ADD COLUMN IF NOT EXISTS). No new network endpoints, auth paths, or trust boundary changes introduced.

## Self-Check: PASSED

- [x] `supabase/migrations/20260524000016_phase11_is_active_trial_ends_at.sql` exists
- [x] `src/types/database.ts` contains `is_active: boolean` and `trial_ends_at: string | null`
- [x] `tests/notifications/payment-alert.test.ts` exists
- [x] `tests/lib/retell-call-classify.test.ts` exists
- [x] Commits 8f4a2ff, 533969b, 243142b all present in git log

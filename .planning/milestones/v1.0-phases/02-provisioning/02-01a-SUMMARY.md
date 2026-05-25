---
phase: 02-provisioning
plan: 01a
subsystem: database
tags: [retell-sdk, inngest, migration, vitest, haitian-creole-removal, agent-sync-status]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "Supabase schema (contractors, contractor_settings, calls tables with LANG-02 constraints)"

provides:
  - "retell-sdk@5.18.0 and inngest@4.3.0 installed and importable by all subsequent Phase 2 plans"
  - "supabase/migrations/20260506000004_agent_sync_status.sql: agent_sync_status + retell_llm_id columns + HC constraint removal (ready for 02-01b db push)"
  - "Wave 0 RED stub: tests/lib/validations.test.ts fails until 02-01b removes 'ht' from zod enum"
  - "Wave 0 stub: tests/db/provisioning.test.ts ready to run after 02-01b pushes migration"
  - ".env.example: RETELL_API_KEY added without NEXT_PUBLIC_ prefix"

affects:
  - 02-01b
  - 02-02
  - 02-03
  - 02-04
  - 02-05

# Tech tracking
tech-stack:
  added:
    - "retell-sdk@5.18.0 — Retell AI TypeScript SDK for LLM + agent + phone number CRUD"
    - "inngest@4.3.0 — durable background job queue for Retell agent sync retries"
  patterns:
    - "Wave 0 RED anchor pattern: stubs import live modules and make assertions that fail until downstream cleanup task changes the behavior"
    - "T-02-01 threat mitigation: data migration UPDATEs placed before DROP CONSTRAINT + ADD CONSTRAINT in migration SQL"
    - "T-02-02 threat mitigation: server-only API key added to .env.example without NEXT_PUBLIC_ prefix"

key-files:
  created:
    - "supabase/migrations/20260506000004_agent_sync_status.sql"
    - "tests/lib/validations.test.ts"
    - "tests/db/provisioning.test.ts"
  modified:
    - "package.json"
    - "package-lock.json"
    - ".env.example"

key-decisions:
  - "Migration SQL file is written here but NOT pushed to live DB — push happens in 02-01b Task 3 (dependency sequencing)"
  - "Wave 0 stubs intentionally RED — validations.test.ts will remain failing until 02-01b Task 4 removes 'ht' from zod enum"
  - "retell_llm_id column added alongside agent_sync_status to prevent Pitfall 2 (LLM ID lost after provisioning)"
  - "twilio npm package NOT installed per RESEARCH.md Assumption A4 — provisioning goes through Retell API only"
  - "Data migrations (array_remove 'ht', JSONB key removal) run BEFORE DROP CONSTRAINT per T-02-01 threat register"

patterns-established:
  - "Wave 0 RED anchor: test stub imports future module and asserts behavior that only becomes true after downstream cleanup"
  - "Migration ordering: data migration UPDATE statements before CHECK constraint changes prevents violating new constraint on existing rows"

requirements-completed:
  - LANG-01

# Metrics
duration: 2min
completed: 2026-05-06
---

# Phase 02-01a: Provisioning Dependencies Summary

**npm retell-sdk@5.18.0 + inngest@4.3.0 installed; migration 20260506000004 written with agent_sync_status + retell_llm_id columns and HC constraint removal; Wave 0 RED stubs created**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-06T23:49:10Z
- **Completed:** 2026-05-06T23:51:51Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Installed `retell-sdk@5.18.0` and `inngest@4.3.0` — both packages are now importable by all Wave 2 plans
- Wrote `supabase/migrations/20260506000004_agent_sync_status.sql` with proper data migration ordering (D-01 HC cleanup + D-12 new columns) — file ready for `supabase db push` in 02-01b
- Created Wave 0 RED test stubs anchoring TDD cycle: `validations.test.ts` (fails until HC zod removal), `provisioning.test.ts` (meaningful after db push)

## Task Commits

Each task was committed atomically:

1. **Task 0: Wave 0 test stubs (RED anchors)** - `f8c883c` (test)
2. **Task 1: Install retell-sdk + inngest, update .env.example** - `97f4334` (chore)
3. **Task 2: Write migration 20260506000004_agent_sync_status.sql** - `6043d3b` (feat)

## Files Created/Modified

- `tests/lib/validations.test.ts` - Wave 0 RED anchor: asserts `['ht']` is rejected by `languageSchema`; fails until 02-01b Task 4
- `tests/db/provisioning.test.ts` - Wave 0 stub: queries `agent_sync_status` and `retell_llm_id` columns; meaningful after 02-01b db push
- `supabase/migrations/20260506000004_agent_sync_status.sql` - ALTER TABLE contractors ADD COLUMN agent_sync_status + retell_llm_id; removes 'ht' from all CHECK constraints and defaults (data migration before constraint change)
- `package.json` - Added `retell-sdk@^5.18.0` and `inngest@^4.3.0` dependencies
- `package-lock.json` - Updated lockfile with 2 new packages and transitive dependencies
- `.env.example` - Added `RETELL_API_KEY=your-retell-api-key-here` (no NEXT_PUBLIC_ prefix, T-02-02 mitigation)

## Decisions Made

- Migration SQL file written here, `supabase db push` deferred to 02-01b to enable parallel Wave 1 execution (plans 02-02, 02-03 don't need the live columns yet)
- Twilio npm package NOT installed per RESEARCH.md Assumption A4 — Phase 2 provisioning goes through Retell's API (`retell.phoneNumber.create()`), not direct Twilio SDK calls
- Wave 0 stubs intentionally RED — validations.test.ts asserting `['ht']` rejection fails because `languageSchema` still uses `z.enum(['en','es','ht'])`; this is the correct TDD RED state

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — all 3 tasks completed cleanly without blockers.

## User Setup Required

Add `RETELL_API_KEY` to your `.env.local` (server-only, no NEXT_PUBLIC_ prefix):
```bash
RETELL_API_KEY=your-actual-retell-api-key
```
Obtain from the Retell AI dashboard at https://dashboard.retellai.com

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| `languageSchema` still accepts `'ht'` | `tests/lib/validations.test.ts` | 11-16 | RED anchor — 02-01b Task 4 will change `z.enum(['en','es','ht'])` to `z.enum(['en','es'])`, making this test green |
| `agent_sync_status` column not in live DB | `tests/db/provisioning.test.ts` | 11-31 | Integration stub — meaningful only after 02-01b Task 3 runs `supabase db push` |

## Next Phase Readiness

- 02-01b can now proceed: depends_on this plan; migration SQL exists at the expected path
- All subsequent Wave 2 plans can import `retell-sdk` and `inngest` — packages are installed
- `RETELL_API_KEY` environment variable documented; contractor must add actual key to `.env.local`

---
*Phase: 02-provisioning*
*Completed: 2026-05-06*

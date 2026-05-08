---
phase: 03-webhook-core
plan: 02
subsystem: api
tags: [openai, date-fns-tz, webhooks, after-hours, emergency-keywords, retell, typescript, vitest]

# Dependency graph
requires:
  - phase: 03-01
    provides: openai and date-fns-tz packages in package.json, RED test stubs for after-hours and classification, migration SQL

provides:
  - src/lib/retell/webhook-types.ts — RetellCallPayload and RetellWebhookEvent typed interfaces
  - src/lib/classification/emergency-keywords.ts — HARD_EMERGENCY_KEYWORDS constants, hasHardEmergencyKeyword function
  - src/lib/openai/client.ts — getOpenAIClient() singleton with OPENAI_API_KEY env guard
  - src/lib/after-hours/detect.ts — detectAfterHours() DST-safe after-hours detection via date-fns-tz

affects: [03-03-classification, 03-04-inngest-jobs, 04-scheduling, 05-notifications]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-only singleton pattern: import 'server-only' + let _client: T | null = null + lazy init with env guard"
    - "DST-safe timezone arithmetic: toZonedTime() from date-fns-tz + getDay/getHours/getMinutes from date-fns"
    - "EMRG-02 hard-coded safety check: case-insensitive keyword scan runs before LLM, cannot be overridden by contractor config"

key-files:
  created:
    - src/lib/retell/webhook-types.ts
    - src/lib/classification/emergency-keywords.ts
    - src/lib/openai/client.ts
    - src/lib/after-hours/detect.ts
    - tests/lib/after-hours.test.ts
    - tests/lib/classification.test.ts
  modified:
    - package.json

key-decisions:
  - "OPENAI_API_KEY env guard throws Error('OPENAI_API_KEY is not set') — identical pattern to RETELL_API_KEY guard in client.ts"
  - "detectAfterHours treats exactly-at-close as after-hours (currentMinutes >= closeMinutes) and exactly-at-open as within hours"
  - "HARD_EMERGENCY_KEYWORDS are EN+ES only — Haitian Creole omitted pending Retell native support verification (Week-1 action item)"
  - "RetellCallPayload.duration_ms is in milliseconds — consumers must divide by 1000; field name preserved from SDK"
  - "DAY_NAMES array maps getDay() index 0-6 to JSONB key names (sunday...saturday) matching contractor_settings business_hours schema"

patterns-established:
  - "Server-only singleton: all lib/*.ts files start with import 'server-only' — prevents Next.js client bundle leak"
  - "BusinessHours JSONB shape: { [day]: { open: 'HH:MM', close: 'HH:MM', enabled: boolean } } — matches contractor_settings schema"

requirements-completed: [CALL-04, EMRG-01, EMRG-02]

# Metrics
duration: 8min
completed: 2026-05-08
---

# Phase 3 Plan 02: Foundation Library Layer Summary

**Server-only OpenAI singleton + DST-safe after-hours detection + EMRG-02 hard-coded gas/CO emergency keyword check + typed Retell webhook payload interfaces**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-08T06:55:00Z
- **Completed:** 2026-05-08T07:03:00Z
- **Tasks:** 2 (Task 1 brought over from main repo; Task 2 implemented)
- **Files modified:** 7

## Accomplishments
- Four server-only library modules created — all start with `import 'server-only'`
- `detectAfterHours` handles DST correctly via `toZonedTime` from `date-fns-tz` — 6 tests passing
- `hasHardEmergencyKeyword` matches EN/ES gas-smell and CO-alarm keywords case-insensitively — 5 tests passing
- `getOpenAIClient()` singleton never exposes `OPENAI_API_KEY` to browser bundle (no `NEXT_PUBLIC_` prefix)
- All new TypeScript files clean (pre-existing provisioning TS errors are out of scope, logged as deferred)

## Task Commits

Each task was committed atomically:

1. **Task 2: openai/client.ts + after-hours/detect.ts** - `32bb943` (feat)

**Plan metadata:** (docs commit created by orchestrator)

## Files Created/Modified
- `src/lib/retell/webhook-types.ts` — RetellCallPayload and RetellWebhookEvent typed interfaces (brought from main repo Task 1)
- `src/lib/classification/emergency-keywords.ts` — HARD_EMERGENCY_KEYWORDS EN+ES constants; hasHardEmergencyKeyword() (brought from main repo Task 1)
- `src/lib/openai/client.ts` — server-only OpenAI singleton with OPENAI_API_KEY guard
- `src/lib/after-hours/detect.ts` — DST-safe after-hours detection using date-fns-tz toZonedTime
- `tests/lib/classification.test.ts` — real assertions for hasHardEmergencyKeyword (5 green); stubs for classifyIntent/extractTradeData
- `tests/lib/after-hours.test.ts` — 6 real assertions for detectAfterHours (all green, including DST edge case)
- `package.json` — added openai and date-fns-tz dependencies (were in main repo but not worktree)

## Decisions Made
- `detectAfterHours` boundary: exactly at open (08:00) = within hours; exactly at close (18:00) = after-hours. This matches the natural interpretation: close time is exclusive upper bound.
- DST test uses Monday Nov 3, 2025 (first weekday after fall-back) at 23:00 UTC = 18:00 EST — tests that the close-boundary works correctly post-DST transition.
- `HARD_EMERGENCY_KEYWORDS` omits Haitian Creole because Retell native Creole support is unverified (Week-1 action item in CLAUDE.md). Will add in Phase 5 if confirmed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree was created before Task 1 commits merged to main**
- **Found during:** Task 2 setup
- **Issue:** The worktree branch was created from an older main state (before a01c6f7 merged webhook-types.ts and emergency-keywords.ts). Files needed for Task 2's dependencies were missing.
- **Fix:** Brought Task 1 files (webhook-types.ts, emergency-keywords.ts, updated classification.test.ts) from main repo HEAD into the worktree; also added openai and date-fns-tz to worktree package.json (they were in main repo's package.json but not the worktree's copy).
- **Files modified:** package.json, src/lib/retell/webhook-types.ts, src/lib/classification/emergency-keywords.ts, tests/lib/classification.test.ts
- **Verification:** `npx vitest run tests/lib/classification.test.ts` — 5 hasHardEmergencyKeyword tests pass
- **Committed in:** 32bb943 (single atomic commit with all Task 2 files)

---

**Total deviations:** 1 auto-fixed (blocking — worktree state mismatch)
**Impact on plan:** Worktree catch-up was necessary and correct. All four lib files now exist with correct implementations and passing tests.

## Issues Encountered
- Pre-existing TypeScript errors in `src/app/api/provisioning/create/route.ts` and `src/app/api/provisioning/update-agent/route.ts` — these existed before this plan and are out of scope. Logged as deferred.

## Known Stubs
None — all stub tests in classification.test.ts and after-hours.test.ts that remain "not yet implemented" are intentional placeholders for future plans (classifyIntent in 03-03, extractTradeData in 03-03). The `detectAfterHours` and `hasHardEmergencyKeyword` tests are fully implemented.

## Threat Flags
No new threat surface introduced. All four lib files are server-only. OPENAI_API_KEY has no NEXT_PUBLIC_ prefix. T-03-03 (Information Disclosure) mitigated as planned.

## Next Phase Readiness
- Plan 03-03 can immediately import `getOpenAIClient` from `@/lib/openai/client` for the classify-intent LLM call
- Plan 03-03 can import `hasHardEmergencyKeyword` from `@/lib/classification/emergency-keywords` for EMRG-02 pre-check
- Plan 03-04 (Inngest jobs) can import `detectAfterHours` from `@/lib/after-hours/detect`
- Plan 03-03 (webhook handler) can use `RetellWebhookEvent` / `RetellCallPayload` types from `@/lib/retell/webhook-types`

---
*Phase: 03-webhook-core*
*Completed: 2026-05-08*

## Self-Check: PASSED

All created files verified present. Commit 32bb943 verified in git log. All four lib files have `import 'server-only'`. No `NEXT_PUBLIC_` prefix on actual env vars (comment warning is expected). Critical field names `call_summary`, `duration_ms`, `transcript_object` present in webhook-types.ts.

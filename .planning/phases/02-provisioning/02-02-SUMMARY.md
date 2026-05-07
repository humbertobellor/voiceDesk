---
phase: 02-provisioning
plan: 02
subsystem: api
tags: [retell, typescript, vitest, tdd, language, system-prompt, server-only]

# Dependency graph
requires:
  - phase: 02-01b
    provides: "Language TypeScript type narrowed to 'en' | 'es', ContractorSettings interface, retell-sdk installed"
provides:
  - "getRetellClient() server-only Retell SDK singleton with RETELL_API_KEY guard"
  - "toRetellLanguage() mapper: ['en'] → 'en-US' (string), ['en','es'] → ['en-US','es-ES'] (array)"
  - "buildSystemPrompt(settings) → system prompt string with EN/ES language branching"
  - "buildBeginMessage(settings) → bilingual or English-only opening message"
  - "11 unit tests (4 language mapper + 7 system prompt) all GREEN"
  - "server-only vitest shim enabling unit testing of server-only modules"
affects: [02-03, 02-04, 03-webhook-core, 06-portal-ui]

# Tech tracking
tech-stack:
  added:
    - "tests/__mocks__/server-only.ts: vitest shim for server-only imports"
    - "vitest.config.ts: server-only alias for unit testing"
  patterns:
    - "D-05: single Retell agent per contractor with language branching inside system prompt"
    - "D-04/D-06/D-07: professional+warm persona, never hang up without lead capture, after-hours still captures lead"
    - "Retell locale code mapping: ISO-639-1 'en'/'es' → Retell 'en-US'/'es-ES'"
    - "server-only shim pattern: alias 'server-only' in vitest.config.ts for unit testability"

key-files:
  created:
    - src/lib/retell/client.ts
    - src/lib/retell/system-prompt.ts
    - tests/lib/retell-language-mapper.test.ts
    - tests/lib/system-prompt.test.ts
    - tests/__mocks__/server-only.ts
  modified:
    - vitest.config.ts

key-decisions:
  - "Added server-only vitest shim (Rule 3 auto-fix): server-only module throws in non-Next.js environments; aliased to empty shim in vitest.config.ts so server-side modules remain unit-testable without mocking each test file individually"
  - "toRetellLanguage returns string for single-language input and string[] for multi-language: matches Retell API requirement (RESEARCH.md Pattern 3)"
  - "system-prompt.ts does NOT import 'server-only': contains no secrets (business config data only); server boundary enforced by client.ts"

patterns-established:
  - "server-only vitest shim: alias in vitest.config.ts resolves -> tests/__mocks__/server-only.ts (empty export) — reusable for all future server-only lib modules"
  - "Language branching in system prompt: single agent with hasSpanish flag controls greeting, instructions, and begin_message"
  - "Singleton pattern: let _client: Retell | null = null with lazy init and env-var guard at call time (mirrors createServiceRoleClient pattern)"

requirements-completed:
  - LANG-01

# Metrics
duration: 12min
completed: 2026-05-07
---

# Phase 2 Plan 02: Retell Client + System Prompt Builder Summary

**Retell server-only SDK singleton with locale-code mapper and bilingual system prompt compiler — 11 unit tests GREEN, tsc clean, Wave 3 provisioning routes unblocked**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-07T00:15:53Z
- **Completed:** 2026-05-07T00:27:00Z
- **Tasks:** 2 (both TDD: RED → GREEN)
- **Files modified:** 6

## Accomplishments

- Created `src/lib/retell/client.ts` with `getRetellClient()` server-only singleton and `toRetellLanguage()` locale mapper; `import 'server-only'` enforced as first import
- Created `src/lib/retell/system-prompt.ts` with `buildSystemPrompt()` (LANG-01 language branching, D-04–D-07 persona rules) and `buildBeginMessage()` (bilingual or English-only opening)
- 11 unit tests all GREEN: 4 for `toRetellLanguage()` (locale mapping) + 7 for system prompt builder (5 `buildSystemPrompt` + 2 `buildBeginMessage`)
- Added `server-only` vitest shim to `vitest.config.ts` so server-only modules are unit-testable without `vi.mock` in every test file

## Task Commits

Each task was committed atomically:

1. **Task 1: Retell client singleton + language mapper + 4 tests** - `da517ee` (feat)
2. **Task 2: System prompt builder + 7 tests** - `77a4bfb` (feat)

## Files Created/Modified

- `src/lib/retell/client.ts` - getRetellClient() singleton (server-only, RETELL_API_KEY guard); toRetellLanguage() ISO-639-1 → Retell locale mapper
- `src/lib/retell/system-prompt.ts` - buildSystemPrompt() with EN/ES language branching (D-04–D-07); buildBeginMessage() bilingual opener
- `tests/lib/retell-language-mapper.test.ts` - 4 unit tests for toRetellLanguage() all locale mapping cases
- `tests/lib/system-prompt.test.ts` - 7 unit tests for buildSystemPrompt() and buildBeginMessage()
- `tests/__mocks__/server-only.ts` - Empty shim for server-only import in test environments
- `vitest.config.ts` - Added server-only alias pointing to shim

## Decisions Made

- Used vitest.config.ts alias to shim `server-only` globally rather than `vi.mock('server-only')` in each test file — cleaner, one-time fix, consistent with Next.js + Vitest best practice
- `toRetellLanguage([])` returns `[]` (empty array) rather than crashing — defensive for unknown future caller patterns
- `system-prompt.ts` deliberately omits `import 'server-only'`: the module contains only business configuration logic (no secrets); server boundary is enforced at the `client.ts` layer which holds the API key

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added server-only vitest shim to unblock test imports**
- **Found during:** Task 1 (retell-language-mapper.test.ts RED phase)
- **Issue:** `import 'server-only'` at the top of `client.ts` throws `"This module cannot be imported from a Client Component module"` in Vitest/jsdom environment. Without a shim, any test importing `@/lib/retell/client` would error before running a single assertion.
- **Fix:** Created `tests/__mocks__/server-only.ts` (empty `export {}`) and added alias `'server-only': path.resolve(__dirname, './tests/__mocks__/server-only.ts')` to `vitest.config.ts`. The plan's test file imports `@/lib/retell/client` directly — this was the minimal fix required to make that import resolve.
- **Files modified:** `tests/__mocks__/server-only.ts` (new), `vitest.config.ts` (modified)
- **Verification:** All 4 language mapper tests pass after fix; server-only module still throws in real Next.js browser bundle (shim only applies in Vitest)
- **Committed in:** `da517ee` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking)
**Impact on plan:** Fix essential for testability. No scope creep. The shim is reusable for all future server-only lib modules (Twilio client, Inngest functions, etc.).

## Issues Encountered

None beyond the `server-only` shim (documented above as deviation).

## User Setup Required

None — no external service configuration required for this plan. `RETELL_API_KEY` env var is needed at runtime (Wave 3 provisioning routes) but not required for these utility modules or their unit tests.

## Known Stubs

None — both modules produce real output from real ContractorSettings inputs. No hardcoded placeholders or TODO markers.

## Threat Flags

No new network endpoints, auth paths, or file access patterns introduced. Threat mitigations T-02-04, T-02-05, T-02-06 (from plan threat model) all implemented:
- T-02-04: `import 'server-only'` at top of client.ts
- T-02-05: Error message is generic (`'RETELL_API_KEY is not set'`) — key value never included in thrown error
- T-02-06: system-prompt.ts accepted as non-secret (business config data)

## Next Phase Readiness

- Wave 3 plans (02-03: Inngest provisioning job, 02-04: API routes) can now import `getRetellClient`, `toRetellLanguage`, `buildSystemPrompt`, `buildBeginMessage` directly
- All 11 unit tests GREEN; `npx tsc --noEmit` exits 0
- server-only shim in vitest.config.ts covers future server-only modules (Twilio client, etc.)

## Self-Check: PASSED

- `src/lib/retell/client.ts` exists: FOUND
- `src/lib/retell/system-prompt.ts` exists: FOUND
- `tests/lib/retell-language-mapper.test.ts` exists: FOUND
- `tests/lib/system-prompt.test.ts` exists: FOUND
- `tests/__mocks__/server-only.ts` exists: FOUND
- Task 1 commit `da517ee`: FOUND
- Task 2 commit `77a4bfb`: FOUND

---
*Phase: 02-provisioning*
*Completed: 2026-05-07*

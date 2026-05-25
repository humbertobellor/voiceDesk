---
phase: 02-provisioning
plan: 04
subsystem: api
tags: [retell, inngest, nextjs, typescript, vitest, tdd, provisioning, phone-number, agent-sync]

# Dependency graph
requires:
  - phase: 02-02
    provides: "getRetellClient() server-only singleton; toRetellLanguage() locale mapper; buildSystemPrompt() + buildBeginMessage() prompt builders"
  - phase: 02-03
    provides: "inngest client singleton (export const inngest) at @/inngest/client; retellAgentSync durable function listening on 'retell/agent.sync'"
provides:
  - "POST /api/provisioning/create — full provisioning flow: LLM + agent + phone number via Retell SDK; persists all IDs to contractors table"
  - "PATCH /api/provisioning/update-agent — re-sync Retell LLM from already-persisted contractor_settings; queues Inngest retry on Retell failure"
  - "10 unit tests GREEN: 5 for create route (401/400/409/422/200) + 5 for update-agent (401/404/200-fail/200-ok/call-order)"
  - "Phase 2 functionally complete: contractor can call POST to get a live Retell phone number + agent"
affects: [07-billing, 06-portal-ui, 03-webhook-core]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-09: POST /api/provisioning/create triggered by Phase 7 onboarding wizard"
    - "D-10: 422 with area code suggestions [786, 954, 561] on Retell phoneNumber.create failure — no auto-fallback"
    - "D-11: Supabase write is LAST after all 3 Retell calls succeed (exception to DB-first rule for provisioning create)"
    - "D-11 re-sync: PATCH /update-agent reads already-persisted settings (D-11 satisfied by Phase 6 caller writing first)"
    - "D-12: agent_sync_status='pending' written BEFORE retell.llm.update(); Inngest retry queued on failure"
    - "twilio_number_sid stores E.164 phone_number as Retell's internal number reference (not a Twilio PN... SID)"
    - "Contractor identity always from JWT user.id — never accept contractor_id from request body"

key-files:
  created:
    - src/app/api/provisioning/create/route.ts
    - src/app/api/provisioning/update-agent/route.ts
    - tests/api/provisioning.test.ts

key-decisions:
  - "Cast toRetellLanguage() return value to `any` for Retell SDK strict language union type — runtime value is always a valid locale code; TypeScript cast bridges our string type to SDK's undocumented union (Rule 1 fix)"
  - "PATCH update-agent is intentionally re-sync-only: does NOT write to contractor_settings — D-11 is satisfied at Phase 6 level by the calling sequence"
  - "twilio_number_sid stores E.164 phone_number (not a true Twilio SID) — this is Retell's internal number reference (RESEARCH.md Open Question 2 resolved)"

patterns-established:
  - "Provisioning route pattern: auth (getUser) → validate (zod) → load contractor by user_id → idempotency check → external API calls → DB write"
  - "Retell provisioning sequence: llm.create() → agent.create() → phoneNumber.create() → contractors.update()"
  - "Graceful degradation pattern: PATCH returns 200 regardless of Retell outcome; Inngest handles retry asynchronously"
  - "Call-order testing pattern: use callOrder array + updateCallCount to verify pending precedes retell.llm.update()"

requirements-completed:
  - LANG-01

# Metrics
duration: 5min
completed: 2026-05-07
---

# Phase 2 Plan 04: Provisioning API Routes Summary

**POST + PATCH provisioning routes with Retell LLM/agent/phone creation, DB-last write, and Inngest retry on sync failure — 10 unit tests GREEN, tsc clean, Phase 2 complete**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-07T00:29:59Z
- **Completed:** 2026-05-07T00:35:00Z
- **Tasks:** 2 (both TDD: RED → GREEN)
- **Files created:** 3

## Accomplishments

- Created `src/app/api/provisioning/create/route.ts`: full provisioning flow (LLM → agent → phone number via Retell SDK, DB write last, 422 with area code suggestions on no-availability)
- Created `src/app/api/provisioning/update-agent/route.ts`: intentionally re-sync-only (reads already-persisted settings, sets pending before Retell call, queues Inngest retry on failure, always returns 200)
- 10 unit tests all GREEN: 5 for create (401/400/409/422/200) + 5 for update-agent (401/404/200-fail/200-ok/call-order verification)
- TypeScript compiles clean (`npx tsc --noEmit` exits 0)

## Task Commits

Each task was committed atomically:

1. **Task 1: POST /api/provisioning/create + tests file** - `8257900` (feat)
2. **Task 2: PATCH /api/provisioning/update-agent** - `d813987` (feat)

## Files Created/Modified

- `src/app/api/provisioning/create/route.ts` — POST route: auth → zod validate area_code → load contractor by JWT user_id → idempotency check (retell_agent_id) → llm.create() → agent.create() → phoneNumber.create() → contractors.update() with all IDs
- `src/app/api/provisioning/update-agent/route.ts` — PATCH route: auth → load contractor + settings by JWT user_id → check retell_llm_id (404 if null) → write pending → retell.llm.update() → write synced (or queue Inngest retry) → always 200 { ok: true }
- `tests/api/provisioning.test.ts` — 10 unit tests covering all error codes for both routes; call-order test verifies pending precedes retell.llm.update(); all Retell SDK and Supabase calls mocked

## Decisions Made

- Used `as any` cast for `language` field in `retell.agent.create()` — Retell SDK declares `language` as a large strict union type, but our `toRetellLanguage()` returns `string`. Runtime value is always a valid locale code (e.g., `'en-US'`); the `as any` cast with eslint-disable comment bridges the type gap without affecting runtime behavior.
- PATCH route takes `_req: Request` (unused parameter) — body is intentionally ignored; all data comes from DB (re-sync-only design per D-11)
- `twilio_number_sid` stores the E.164 phone number returned by Retell's `phoneNumber.create()` — this is not a Twilio SID (which would be `PN...` format); it serves as Retell's internal phone number identifier for number management operations

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cast Retell `language` field via `any` for strict SDK union type**
- **Found during:** Task 1 (GREEN phase — `npx tsc --noEmit`)
- **Issue:** Retell SDK declares `agent.create()` `language` parameter as a long strict union type (`'en-US' | 'es-ES' | 'multi' | ...`). The plan's `as string` cast does not satisfy TypeScript's strict type checking — TS error: `Type 'string' is not assignable to type '"en-US" | "es-ES" | ...`.
- **Fix:** Changed `as string` to `as any` with an eslint-disable comment explaining the cast. Runtime behavior is identical — `toRetellLanguage()` always returns a valid Retell locale code.
- **Files modified:** `src/app/api/provisioning/create/route.ts`
- **Verification:** `npx tsc --noEmit` exits 0; all 5 create route tests pass
- **Committed in:** `8257900` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — TypeScript strict type incompatibility between our mapper return type and Retell SDK's strict union)
**Impact on plan:** Minimal — single line change. No behavior change. Required for `tsc --noEmit` to exit 0.

## Issues Encountered

None beyond the TypeScript strict type fix documented above as a deviation.

## User Setup Required

None — no external service configuration required for this plan. Runtime requires:
- `RETELL_API_KEY` — needed when `POST /api/provisioning/create` is actually called (Phase 7 onboarding wizard)
- `INNGEST_SIGNING_KEY` — needed in production for Inngest event delivery verification (already required by Plan 03)

## Known Stubs

None — both routes are complete implementations. No hardcoded placeholders, TODO markers, or empty data flows.

## Threat Flags

No new threat surface beyond what was planned. All STRIDE mitigations implemented:
- T-02-10: Contractor loaded via `user_id` from JWT; `contractor_id` never accepted from request body (both routes)
- T-02-11: `z.string().regex(/^\d{3}$/)` validates area_code before any Retell call
- T-02-12: `if (contractor.retell_agent_id)` → 409 prevents duplicate provisioning
- T-02-13: Same JWT-based ownership check in PATCH route
- T-02-14: Error logging uses only error messages and contractor IDs — never API key values or request bodies

## Next Phase Readiness

- Phase 2 is functionally complete: all five plans (01a, 01b, 02, 03, 04) delivered
- Phase 7's onboarding wizard can call `POST /api/provisioning/create` to provision a live Retell phone number + agent for a contractor
- Phase 6's settings save action can call `PATCH /api/provisioning/update-agent` after writing new settings to Supabase
- All 10 provisioning unit tests GREEN; `npx tsc --noEmit` exits 0
- Pre-existing integration test failures in `tests/db/` remain (require live Supabase connection) — out of scope for this plan

## Self-Check: PASSED

- `src/app/api/provisioning/create/route.ts` exists: FOUND
- `src/app/api/provisioning/update-agent/route.ts` exists: FOUND
- `tests/api/provisioning.test.ts` exists: FOUND
- Task 1 commit `8257900`: FOUND
- Task 2 commit `d813987`: FOUND

---
*Phase: 02-provisioning*
*Completed: 2026-05-07*

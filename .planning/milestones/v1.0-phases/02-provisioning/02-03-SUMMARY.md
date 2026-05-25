---
phase: 02-provisioning
plan: 03
subsystem: infra
tags: [inngest, background-jobs, retell, typescript, server-only, retry, durable-functions]

# Dependency graph
requires:
  - phase: 02-02
    provides: "getRetellClient() server-only singleton importable from @/lib/retell/client"
  - phase: 02-01b
    provides: "createServiceRoleClient() from @/lib/supabase/service"
provides:
  - "inngest client singleton (id: 'voicedesk') at src/inngest/client.ts — server-only"
  - "retellAgentSync durable function at event 'retell/agent.sync' with retries:5 and onFailure handler"
  - "Inngest serve endpoint at /api/inngest (GET, POST, PUT) — ready to receive Inngest events"
  - "D-12: onFailure handler sets agent_sync_status='failed' after all 5 retries exhausted"
affects: [02-04, 03-webhook-core, 06-portal-ui]

# Tech tracking
tech-stack:
  added:
    - "inngest@4.3.0: already installed; createFunction v4 2-arg API with triggers array in options"
  patterns:
    - "D-12: 5-retry exponential backoff via Inngest for Retell LLM sync failures"
    - "onFailure handler accesses original event via event.data.event.data (FailureEventPayload shape)"
    - "inngest v4 createFunction 2-arg API: (options with triggers array, handler) — not 3-arg legacy form"
    - "server-only import boundary enforced on both inngest/client.ts and inngest/functions/retell-agent-sync.ts"

key-files:
  created:
    - src/inngest/client.ts
    - src/inngest/functions/retell-agent-sync.ts
    - src/app/api/inngest/route.ts

key-decisions:
  - "inngest v4 uses 2-arg createFunction(options, handler) with triggers array in options — not the 3-arg (options, trigger, handler) form shown in RESEARCH.md Pattern 4 which is the legacy API"
  - "onFailure handler accesses original payload via event.data.event.data.contractorId (FailureEventPayload wraps the original event under data.event)"
  - "NonRetriableError thrown for corrupt event data (missing contractorId/llmId/compiledPrompt) to prevent pointless retry cycles"

patterns-established:
  - "Inngest function pattern: createFunction({ id, retries, triggers, onFailure }, handler) with server-only guard"
  - "FailureEventPayload shape: event.data.event is the original event payload; cast event.data.event.data for typed access"

requirements-completed:
  - LANG-01

# Metrics
duration: 10min
completed: 2026-05-07
---

# Phase 2 Plan 03: Inngest Infrastructure Summary

**Inngest durable retry backbone for Retell agent sync — 5-retry function with onFailure status write, serve endpoint wired, tsc clean, Wave 3 update-agent route unblocked**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-07T00:17:30Z
- **Completed:** 2026-05-07T00:27:30Z
- **Tasks:** 2 (both completed)
- **Files modified:** 3

## Accomplishments

- Created `src/inngest/client.ts` with `export const inngest = new Inngest({ id: 'voicedesk' })` and `import 'server-only'` boundary
- Created `src/inngest/functions/retell-agent-sync.ts` with `retries: 5`, `onFailure` handler (sets `agent_sync_status='failed'`), `NonRetriableError` guard for corrupt data, two durable steps (patch-retell-llm, set-synced-status)
- Created `src/app/api/inngest/route.ts` exporting `GET`, `POST`, `PUT` from `serve()` with `retellAgentSync` registered
- `npx tsc --noEmit` exits 0 — all three files compile cleanly

## Task Commits

Each task was committed atomically:

1. **Task 1: Create retell-agent-sync Inngest function and client singleton** - `f7a9ab0` (feat)
2. **Task 2: Create Inngest serve route** - `cf924ef` (feat)

## Files Created/Modified

- `src/inngest/client.ts` - Inngest client singleton (server-only, id: 'voicedesk')
- `src/inngest/functions/retell-agent-sync.ts` - Durable retry function for Retell LLM sync (retries:5, onFailure sets agent_sync_status='failed', NonRetriableError guard)
- `src/app/api/inngest/route.ts` - Inngest serve endpoint (GET, POST, PUT) for receiving Inngest events

## Decisions Made

- Used inngest v4 2-arg `createFunction(options, handler)` API with `triggers` array inside options — RESEARCH.md Pattern 4 showed the legacy 3-arg form which TypeScript rejects in v4
- `onFailure` handler accesses original event payload via `event.data.event.data` (not directly `event.data`) because Inngest wraps the failure context in `FailureEventPayload` which nests the original event under `data.event`
- `NonRetriableError` thrown when `contractorId`, `llmId`, or `compiledPrompt` are missing — corrupt event data should not retry (no point; same result each time)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated createFunction to inngest v4 2-arg API**
- **Found during:** Task 1 (TypeScript compile of retell-agent-sync.ts)
- **Issue:** RESEARCH.md Pattern 4 shows 3-arg `createFunction(options, trigger, handler)` which is the legacy API. inngest v4 only accepts 2-arg form `(options, handler)` with `triggers` array inside options. TypeScript reported `Expected 2 arguments, but got 3`.
- **Fix:** Moved `{ event: 'retell/agent.sync' }` from 2nd arg to `triggers: [{ event: 'retell/agent.sync' }]` inside options object.
- **Files modified:** `src/inngest/functions/retell-agent-sync.ts`
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** `f7a9ab0` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed onFailure handler to access contractorId via FailureEventPayload nesting**
- **Found during:** Task 1 (TypeScript compile of retell-agent-sync.ts)
- **Issue:** Plan code used `event.data.contractorId` in the onFailure handler, but Inngest's `FailureEventPayload` shape wraps the original event under `event.data.event` — so the original payload is at `event.data.event.data.contractorId`. TypeScript reported `Property 'contractorId' does not exist on type '{ function_id: string; run_id: string; error: JsonError; event: EventPayload<any>; }'`.
- **Fix:** Cast original payload via `(event.data.event.data as { contractorId: string }).contractorId`
- **Files modified:** `src/inngest/functions/retell-agent-sync.ts`
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** `f7a9ab0` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bug in plan code vs actual inngest v4 API)
**Impact on plan:** Both fixes necessary for TypeScript compilation. No scope creep. Function behavior identical to plan intent.

## Issues Encountered

None beyond the two inngest v4 API shape mismatches documented above as deviations.

## User Setup Required

None — no external service configuration required for this plan. Inngest events are delivered to `/api/inngest` which the SDK handles. For local development, run `npx inngest-cli@latest dev` alongside `npm run dev` to use the Inngest dev UI.

## Known Stubs

None — all three files are complete implementations with no hardcoded placeholders.

## Threat Flags

No new threat surface beyond what was planned. Threat mitigations implemented as specified:
- T-02-07: `import 'server-only'` in both inngest/client.ts and retell-agent-sync.ts
- T-02-08: NonRetriableError thrown for corrupt/missing event data fields
- T-02-09: /api/inngest is a public endpoint — Inngest signs payloads via INNGEST_SIGNING_KEY (accepted risk in dev)

## Next Phase Readiness

- Wave 3 route `PATCH /api/provisioning/update-agent` can now call `inngest.send({ name: 'retell/agent.sync', data: {...} })` safely
- All three Inngest infrastructure files in place; `npx tsc --noEmit` exits 0
- Inngest serve endpoint at `/api/inngest` ready to receive events from Inngest cloud or local dev server

## Self-Check: PASSED

- `src/inngest/client.ts` exists: FOUND
- `src/inngest/functions/retell-agent-sync.ts` exists: FOUND
- `src/app/api/inngest/route.ts` exists: FOUND
- Task 1 commit `f7a9ab0`: FOUND
- Task 2 commit `cf924ef`: FOUND

---
*Phase: 02-provisioning*
*Completed: 2026-05-07*

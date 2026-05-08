---
phase: 04-scheduling-lead-capture
plan: "05"
subsystem: api
tags: [inngest, supabase, google-calendar, lead-capture, scheduling, appointment-booking]

# Dependency graph
requires:
  - phase: 04-scheduling-lead-capture
    plan: "02"
    provides: getCalendarClient (refresh-on-use Google Calendar client factory)
  - phase: 04-scheduling-lead-capture
    plan: "03"
    provides: computeAvailableSlots + buildSystemPrompt + buildSlotSection
  - phase: 04-scheduling-lead-capture
    plan: "04"
    provides: extract-trade.ts schemas extended with confirmed_appointment_time + service_address (D-11)
provides:
  - retell-call-classify Inngest function extended with full booking pipeline (steps 5-9)
  - Lead records created per D-12 intent filter (lead/emergency/info>=15s)
  - Appointment records with UTC time conversion (local→UTC via fromZonedTime)
  - D-10 booking conflict handling (23505 UNIQUE violation → leads.booking_conflict=true)
  - Google Calendar event creation with D-15 null-safe skip and D-14 synced status
  - Agent sync trigger (retell/agent.sync) with updated slot computation after booking
  - onFailure handler extended to set google_sync_status=failed on pending appointments
affects:
  - 04-scheduling-lead-capture-06 (Plan 06 — agent sync handler that consumes retell/agent.sync)
  - 05-notifications (lead/appointment records ready for notification dispatch)
  - 06-portal (leads + appointments tables populated for Phase 6 portal views)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Inngest step.run memoization wrapping all DB operations (idempotent on retry)
    - fromZonedTime(new Date(localStr), timezone) for contractor-local → UTC conversion
    - 23505 UNIQUE constraint catch branch → booking_conflict on leads (not appointments)
    - getCalendarClient null-safety (D-15): null return → google_sync_status=skipped
    - step.sendEvent memoized agent sync trigger after slot recomputation

key-files:
  created: []
  modified:
    - src/inngest/functions/retell-call-classify.ts
    - src/types/database.ts
    - tests/lib/system-prompt.test.ts

key-decisions:
  - "D-12: shouldCreate = lead || emergency || (info && durationMs >= 15000); no_action gets no lead row"
  - "D-10: booking_conflict on leads table (NOT appointments) — UNIQUE on appointments(contractor_id, starts_at) prevents second row"
  - "D-15: getCalendarClient null → google_sync_status=skipped, function continues (not a failure)"
  - "Risk 4 mitigation: rawTime.replace(/Z$/, '') before Date.parse — treats LLM time as contractor-local, not UTC"
  - "appointment_duration_minutes added to ContractorSettings type (was missing from types/database.ts)"
  - "BusinessHours index signature [day: string] added to database.ts to satisfy slots.ts import"

patterns-established:
  - "Pattern: Inngest booking pipeline — load-contractor → classify → extract → persist → lead → appointment → calendar → agent-sync"
  - "Pattern: confirmed_appointment_time flows from LLM extraction (D-11) through create-appointment (D-09) to Calendar API (D-14)"
  - "Pattern: onFailure handler extended per phase — Phase 3 set analysis_failed; Phase 4 additionally sets google_sync_status=failed"

requirements-completed:
  - SCHED-01
  - SCHED-02
  - SCHED-03
  - SCHED-04

# Metrics
duration: ~20min
completed: 2026-05-08
---

# Phase 4 Plan 05: Inngest Booking Pipeline Summary

**retell-call-classify extended with full booking pipeline: lead creation (D-12), appointment booking with conflict handling (D-10), Google Calendar sync (D-14/D-15), and agent prompt rebuild trigger (D-08)**

## Performance

- **Duration:** ~20 min (split across two sessions)
- **Started:** 2026-05-08T20:20:00Z
- **Completed:** 2026-05-08
- **Tasks:** 2 of 2
- **Files modified:** 3

## Accomplishments

- Extended `retell-call-classify` Inngest function with 5 new sequential steps implementing the full Phase 4 booking pipeline
- Implemented D-12 intent filter: lead/emergency always create leads; info only if call >= 15s; no_action skips (no DB write)
- Appointment booking with D-10 conflict detection: 23505 UNIQUE violation sets `leads.booking_conflict=true` and returns gracefully
- Google Calendar event creation with D-15 null-safe path (no calendar connected → status=skipped) and D-14 sync on success
- Agent prompt rebuild triggered via `retell/agent.sync` event after recomputing available slots

## Task Commits

Each task was committed atomically:

1. **Task 1: Add load-contractor step and extend imports** - `21c84d3` (feat)
2. **Task 2: Add create-lead, create-appointment, create-calendar-event, compute-sync-payload, trigger-agent-sync** - `1c4ae38` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/inngest/functions/retell-call-classify.ts` - Extended with 5 new Inngest steps (load-contractor, create-lead, create-appointment, create-calendar-event, compute-sync-payload + trigger-agent-sync); onFailure handler extended to set google_sync_status=failed
- `src/types/database.ts` - Added `appointment_duration_minutes: number` to ContractorSettings; added `[day: string]` index signature to BusinessHours
- `tests/lib/system-prompt.test.ts` - Added `appointment_duration_minutes: 120` to mock ContractorSettings fixture

## Decisions Made

- **D-10 placement:** booking_conflict set on `leads` table (not `appointments`) — UNIQUE constraint on appointments(contractor_id, starts_at) makes a second same-slot row impossible regardless of column values
- **D-15 implementation:** getCalendarClient returns null when no calendar_credentials row exists; function sets google_sync_status=skipped and continues (not an error condition)
- **Risk 4 mitigation:** rawTime.replace(/Z$/, '') strips trailing Z before Date.parse — LLM-extracted times are contractor-local, not UTC; avoids silent off-by-timezone-offset bugs
- **compute-sync-payload wrapped in step.run:** Inngest memoizes DB query on retry; consistent slot list used for agent sync even if trigger-agent-sync step retries

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing appointment_duration_minutes in ContractorSettings type**
- **Found during:** Task 2 (TypeScript compile check)
- **Issue:** `ContractorSettings` in `src/types/database.ts` was missing the `appointment_duration_minutes` field that exists in the DB migration (`20260508000008_phase4_scheduling.sql`). TypeScript error: `Property 'appointment_duration_minutes' does not exist on type 'ContractorSettings'`
- **Fix:** Added `appointment_duration_minutes: number` to ContractorSettings interface
- **Files modified:** src/types/database.ts, tests/lib/system-prompt.test.ts (fixture updated)
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** 1c4ae38

**2. [Rule 1 - Bug] BusinessHours index signature missing — type mismatch with slots.ts**
- **Found during:** Task 2 (TypeScript compile check)
- **Issue:** `database.ts` `BusinessHours` had named day properties but no `[day: string]` index signature. `slots.ts` imports `BusinessHours` from `after-hours/detect.ts` which has the index signature. TypeScript error: `Index signature for type 'string' is missing in type 'BusinessHours'`
- **Fix:** Added `[day: string]: BusinessHoursDay` index signature to the `BusinessHours` interface in database.ts
- **Files modified:** src/types/database.ts
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** 1c4ae38

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs — missing type fields from DB schema)
**Impact on plan:** Both fixes necessary for TypeScript correctness. No scope creep. The `appointment_duration_minutes` field was always intended in ContractorSettings (migration added it in Plan 01 of Phase 4).

## Issues Encountered

- Previous session ended mid-execution after Task 1 (load-contractor step). Task 2 code was already present in the file from that session — the only work needed was resolving the two TypeScript errors that prevented `tsc --noEmit` from passing.

## User Setup Required

None — no external service configuration required for this plan.

## Next Phase Readiness

- Phase 4 core booking pipeline complete: lead records, appointment records, Google Calendar sync, and agent prompt rebuild all wired
- Plan 06 (retell-agent-sync handler for `retell/agent.sync` event) is the remaining Phase 4 plan
- Phase 5 (notifications) can use the `leads` and `appointments` tables that are now being populated
- `booking_conflict=true` leads will be surfaced in the Phase 6 portal for contractor follow-up

---
*Phase: 04-scheduling-lead-capture*
*Completed: 2026-05-08*

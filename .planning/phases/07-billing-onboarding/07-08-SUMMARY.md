---
phase: 07-billing-onboarding
plan: 08
subsystem: api
tags: [inngest, stripe, supabase, realtime, date-fns-tz, middleware, security]

# Dependency graph
requires:
  - phase: 07-billing-onboarding
    provides: Stripe billing, onboarding wizard, Inngest notification dispatch, scheduling slots
provides:
  - defense-in-depth UPDATE filters on markContractorLive and useUpdateLeadStatus
  - from_number typed as optional in RetellCallPayload
  - test call Realtime subscription gated by enabled prop
  - DST-safe slot arithmetic via addDays + fromZonedTime
  - Inngest event-level idempotency for retell/call.notify
  - middleware exclusion of api/webhooks/ from auth round-trip
  - recordings route 404 guard for missing /recordings/ segment
  - nullable token_expiry column in calendar_credentials
  - emergency keyword fallback in system prompt builder
  - correct normalizePhoneNumber for 11-digit E.164 numbers
affects: [phase-08, retell-webhooks, stripe-billing, scheduling, notifications]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Defense-in-depth: duplicate WHERE filters at both SELECT (ownership check) and UPDATE layers"
    - "Inngest idempotency via event id field (not function config idempotency key string)"
    - "DST-safe slot arithmetic: addDays on UTC Date, fromZonedTime for local-to-UTC conversion"
    - "Realtime subscription gating via enabled prop to prevent premature subscriptions"

key-files:
  created:
    - supabase/migrations/20260520000013_fix_calendar_token_expiry_nullable.sql
  modified:
    - src/app/actions/onboarding.ts
    - src/lib/retell/webhook-types.ts
    - src/lib/query/client.tsx
    - src/components/onboarding/steps/TestCallStep.tsx
    - src/lib/realtime/testCallVerification.ts
    - src/app/api/stripe/checkout/route.ts
    - src/inngest/functions/retell-call-classify.ts
    - src/lib/scheduling/slots.ts
    - src/inngest/functions/retell-notify-dispatch.ts
    - middleware.ts
    - src/app/api/recordings/route.ts
    - src/lib/stripe/client.ts
    - src/lib/retell/system-prompt.ts
    - src/app/api/onboarding/create-account/route.ts

key-decisions:
  - "useUpdateLeadStatus reads contractorId from useContractor() hook context rather than requiring callers to pass it — avoids API change at all call sites"
  - "Inngest idempotency moved to event id field on send (retell-call-classify) rather than function config idempotency key (retell-notify-dispatch) — correct v3 API"
  - "slots.ts DST fix: removed nowInTz fake-local basis entirely; all arithmetic on real UTC Dates, fromZonedTime only for constructing slot boundaries from local hour strings"
  - "TestCallStep Realtime subscription default: enabled defaults to false in the hook so it never opens until explicitly activated"

patterns-established:
  - "Ownership verification pattern: SELECT .eq('user_id') then UPDATE .eq('id').eq('user_id') — ownership verified at both layers"
  - "DST-safe timezone arithmetic: addDays(now, offset) for UTC day, format for local date string, fromZonedTime(localString, tz) for UTC boundaries"

requirements-completed:
  - BILL-01
  - BILL-02
  - BILL-03
  - ONBOARD-01

# Metrics
duration: 18min
completed: 2026-05-20
---

# Phase 7 Plan 08: MEDIUM+LOW Code Review Findings Summary

**14 surgical fixes closing all MEDIUM and LOW findings from FULL-REVIEW.md — defense-in-depth query filters, DST-safe slot arithmetic, Inngest idempotency correction, and 6 low-severity correctness patches**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-05-20T12:40:00Z
- **Completed:** 2026-05-20T12:58:00Z
- **Tasks:** 3
- **Files modified:** 15 (14 source + 1 new migration)

## Accomplishments
- Closed all 8 MEDIUM findings (M-12 through M-18): ownership filters, type safety, test-call gating, DST slots, onFailure logging, idempotency, middleware, checkout env var pattern
- Closed all 6 LOW findings (L-19 through L-25): recording guard, nullable schema, Stripe comment, keyword fallback, phone normalization
- Full build (`npm run build`) passes with 0 errors; TypeScript clean (`tsc --noEmit` exits 0)

## Task Commits

1. **Task 1: Defense-in-depth query filters and type safety (M-12, M-14, M-15)** - `b898456` (fix)
2. **Task 2: Behavioral correctness fixes (M-13, M-16, M-17, M-18, L-24, L-25)** - `d593ef4` (fix)
3. **Task 3: Low-severity correctness fixes (L-19, L-20, L-21, L-22, L-23)** - `f2578fd` (fix)

## Files Created/Modified

- `src/app/actions/onboarding.ts` - Added `.eq('user_id', user.id)` to UPDATE chain (M-12 defense-in-depth)
- `src/lib/retell/webhook-types.ts` - Changed `from_number` to `string | undefined` (M-14 type safety)
- `src/lib/query/client.tsx` - `useUpdateLeadStatus` reads `contractorId` from `useContractor()` and adds `.eq('contractor_id', contractorId)` filter (M-15 defense-in-depth)
- `src/components/onboarding/steps/TestCallStep.tsx` - Passes `enabled={status === 'detecting'}` to hook (M-13)
- `src/lib/realtime/testCallVerification.ts` - Added `enabled?: boolean` option; useEffect gated on `if (!enabled) return` (M-13)
- `src/app/api/stripe/checkout/route.ts` - Removed `TIER_PRICE_MAP`; uses `STRIPE_${tier.toUpperCase()}_PLAN_ID` template literal (M-16)
- `src/inngest/functions/retell-call-classify.ts` - Added `console.error` in `onFailure` (M-17); added `id: \`retell-notify-${callId}\`` on trigger-notify event (L-24)
- `src/lib/scheduling/slots.ts` - DST-safe arithmetic: `addDays(now, dayOffset)` + `fromZonedTime(localDateStr, timezone)` for all slot boundaries; no more `setHours`/`setMinutes` on fake-local dates (M-18)
- `src/inngest/functions/retell-notify-dispatch.ts` - Removed `idempotency: 'event.data.callId'` literal-string key from function config (L-24)
- `middleware.ts` - Extended matcher negative lookahead to exclude `api/webhooks/` (L-25)
- `src/app/api/recordings/route.ts` - Returns 404 when `recording_url` lacks `/recordings/` segment (L-19)
- `supabase/migrations/20260520000013_fix_calendar_token_expiry_nullable.sql` - `ALTER TABLE calendar_credentials ALTER COLUMN token_expiry DROP NOT NULL` (L-20)
- `src/lib/stripe/client.ts` - Added cold-start key-rotation comment above singleton (L-21)
- `src/lib/retell/system-prompt.ts` - Fallback to `'gas smell, CO alarm'` with `console.warn` when emergency keywords empty (L-22)
- `src/app/api/onboarding/create-account/route.ts` - `normalizePhoneNumber` only strips country code `1` when digit count is 11 (L-23)

## Decisions Made

- `useUpdateLeadStatus` gets `contractorId` from `useContractor()` hook context (closure) rather than requiring callers to pass it in `mutationFn` args. This avoids an API-breaking change at `StatusBadge.tsx` (the only call site, which doesn't have `contractorId` in scope).
- DST fix in `slots.ts` fully removes the `nowInTz` fake-local variable as the arithmetic basis. All day-offset computation uses `addDays(now, dayOffset)` on the real UTC `Date`, with `toZonedTime` only for day-of-week lookup and `fromZonedTime` for constructing true UTC slot boundaries from local hour strings.
- Inngest idempotency moved to event-level `id` field on the `step.sendEvent` call in `retell-call-classify.ts`. The `idempotency` config key in `retell-notify-dispatch.ts` was a literal string `'event.data.callId'` (not an expression), so it was not resolving to the actual `callId` value.

## Deviations from Plan

None - plan executed exactly as written. All 14 fixes applied as specified.

## Issues Encountered

- Pre-existing test failures (23 tests across 9 files throwing `Error: not yet implemented`) were present before this plan's changes. Confirmed via `git stash` that the same failures existed on prior commit. These are stub tests from earlier TDD RED phases — they are out of scope for this plan and not caused by any change here.

## Known Stubs

None — all changes in this plan are defensive fixes, not new features. No UI rendering stubs introduced.

## Threat Flags

No new security-relevant surface introduced. All changes are purely defensive/correctness fixes on existing endpoints and functions.

## Next Phase Readiness

- All MEDIUM and LOW code review findings resolved — codebase is clean for beta launch
- Pre-existing stub tests (scheduling, booking, oauth, leads) remain to be implemented in a future TDD plan
- `npm run build` exits 0; TypeScript clean

## Self-Check: PASSED

- All 14 modified/created files confirmed present
- Commits b898456, d593ef4, f2578fd confirmed in git log
- `npm run build` exits 0
- `tsc --noEmit` exits 0
- Pre-existing test failures (23) unchanged before/after this plan

---
*Phase: 07-billing-onboarding*
*Completed: 2026-05-20*

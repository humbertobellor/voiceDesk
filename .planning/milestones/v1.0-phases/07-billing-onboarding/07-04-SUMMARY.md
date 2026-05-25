---
phase: 07-billing-onboarding
plan: 04
subsystem: onboarding
tags:
  - realtime
  - test-call
  - verification
  - supabase
dependency_graph:
  requires:
    - 07-03 (Phone Provisioning Step)
  provides:
    - ONBOARD-02 (Test call verification via portal)
  affects:
    - src/components/onboarding/steps/
    - src/lib/realtime/
    - supabase/migrations/
tech_stack:
  added:
    - Supabase Realtime subscription (INSERT)
    - 5-second polling fallback
  patterns:
    - Use callsSubscription.ts as reference pattern
    - Filter by contractor_id for tenant isolation
key_files:
  created:
    - src/lib/realtime/testCallVerification.ts (hook)
    - supabase/migrations/20260512000009_add_calls_to_realtime.sql
  modified:
    - src/components/onboarding/steps/TestCallStep.tsx
decisions:
  - Realtime subscription is primary detection path
  - Polling fallback activates after 5s if subscription fails
  - Auto-advance after 1.5s delay post-verification
metrics:
  duration: "~5 min"
  completed_date: "2026-05-12"
---

# Phase 7 Plan 4: Test Call Verification via Supabase Realtime

## Summary

Implemented test call verification using Supabase Realtime subscription. The wizard now automatically advances when a test call is detected.

## Tasks Executed

### Task 1: Create useTestCallVerification hook

Created `src/lib/realtime/testCallVerification.ts`:
- Uses Supabase browser client for realtime subscription
- Subscribes to 'calls' table with INSERT event
- Filters by contractor_id (D-08 tenant isolation)
- Returns { isConnected, testCallDetected, detectedCallId, subscriptionStatus }
- Cleanup: unsubscribes on unmount

### Task 2: Verify calls table has realtime enabled

Created migration `20260512000009_add_calls_to_realtime.sql`:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE calls;
```
This ensures realtime subscriptions don't silently fail.

### Task 3: Integrate hook into TestCallStep

Updated `src/components/onboarding/steps/TestCallStep.tsx`:
- Imports useTestCallVerification from hook
- Shows connection status indicator (Realtime/Polling)
- Auto-advances after 1.5s delay post-verification
- Removed old polling stub placeholder

### Task 4: Add polling fallback for reliability

Enhanced useTestCallVerification to include 5-second polling:
- Primary: Supabase Realtime subscription
- Fallback: setInterval polling every 5 seconds
- Fallback activates if subscription status !== 'SUBSCRIBED'
- Ensures wizard advances even if Realtime has issues

## Success Criteria Verified

- Supabase Realtime subscription filters by contractor_id (D-08)
- Any call INSERT triggers verification (D-09)
- 5-second polling fallback as backup
- Wizard auto-advances on detection (1.5s delay)
- TypeScript compilation passes

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None - all threats were mitigated per threat model:
- T-07-04-01: Filter by contractor_id prevents cross-tenant data exposure
- T-07-04-02: 5s polling interval is reasonable, subscription is primary path

## Self-Check: PASSED

- [x] testCallVerification.ts created
- [x] TestCallStep.tsx updated
- [x] Migration created
- [x] TypeScript compilation passes
- [x] Commit 2ad9676 exists
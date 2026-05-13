---
phase: 07-billing-onboarding
plan: 06
type: gap-closure
wave: 1
subsystem: billing-onboarding
tags: [stripe, inngest, onboarding, wizard, review-fix]
dependency_graph:
  requires: []
  provides: [BILL-03, ONBOARD-02]
  affects: [handlers.ts, stripe-payment-failure.ts, OnboardingWizard.tsx, testCallVerification.ts, checkout.ts]
tech_stack:
  added: [inngest-events]
  patterns: [server-actions, api-routes]
key_files:
  created:
    - src/app/actions/onboarding.ts
    - src/app/api/stripe/checkout/route.ts
    - supabase/migrations/20260513000010_add_contractor_is_live.sql
  modified:
    - src/app/api/webhooks/stripe/handlers.ts
    - src/components/onboarding/OnboardingWizard.tsx
    - src/components/onboarding/steps/TestCallStep.tsx
decisions: []
metrics:
  duration: "~5 min"
  completed: "2026-05-12"
  tasks_completed: 5
  files_changed: 6
---

# Phase 7 Plan 06: Gap Closure - Review Fixes Summary

**Gap closure for Phase 7 billing and onboarding - fixes critical bugs identified in external reviews.**

## One-Liner

Fixed Inngest data contract mismatch, added wizard gating bypass fix, created checkout API route, added is_live database column with server action for test call verification.

## Tasks Completed

| Task | Description | Status |
|------|-------------|--------|
| 1 | Fix Inngest data contract mismatch | Done |
| 2 | Fix wizard gating bypass | Done |
| 3 | Add checkout API route | Done |
| 4 | Add go_live status to database | Done |
| 5 | Add price ID configuration | Done |

## Fixes Applied

### 1. Inngest Data Contract Mismatch (BLOCKER)

**Issue:** `handlers.ts` sent `customerId` but `stripe-payment-failure.ts` expected `stripeCustomerId`. Also missing `failureReason`.

**Fix:** Updated handlers.ts to send:
- `stripeCustomerId: customerId` (renamed field)
- `failureReason: invoice.hosted_invoice_url ?? undefined` (added field)

### 2. Wizard Gating Bypass (BLOCKER)

**Issue:** "Complete Setup" button could be clicked before test call verification.

**Fix:** Added `canComplete` check in OnboardingWizard that requires `testCallVerified` on final step. Button disabled until verification detected.

### 3. No Checkout API Route (WARNING)

**Issue:** `checkout.ts` library existed but no API route triggered it.

**Fix:** Created POST /api/stripe/checkout route with tier→priceId mapping from STRIPE_BASIC_PRICE_ID, STRIPE_PRO_PRICE_ID, STRIPE_ENTERPRISE_PRICE_ID env vars.

### 4. No Go-Live Status in Database (WARNING)

**Issue:** Test call verification didn't update any status in contractors table.

**Fix:**
- Created migration to add `is_live` BOOLEAN DEFAULT false to contractors table
- Created server action `markContractorLive()` to update the status
- TestCallStep calls this action when verification is detected

### 5. Price ID Configuration (SUGGESTION)

**Status:** Already present in .env.example - verified mapping in checkout route.

## Deviations from Plan

None - all fixes applied as specified in REVIEWS.md

## Auth Gates

None - no authentication gates encountered

## Known Stubs

None

## Self-Check: PASSED

- All 5 tasks completed
- TypeScript compiles without errors
- Migration file created
- Server action created
- API route created
- Gating logic implemented
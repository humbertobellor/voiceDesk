---
phase: 07-billing-onboarding
plan: 01
subsystem: payments
tags: [stripe, checkout, subscriptions, billing]

# Dependency graph
requires: []
provides:
  - Stripe SDK installed (stripe ^22.1.0)
  - Stripe client singleton (src/lib/stripe/client.ts)
  - Checkout session creation with 14-day trial (src/lib/stripe/checkout.ts)
  - Customer portal session creation (src/lib/stripe/portal.ts)
  - Stripe type definitions (src/types/stripe.ts)
affects: [stripe-webhooks, onboarding-wizard, payment-failure-handler]

# Tech tracking
tech-stack:
  added: [stripe ^22.1.0]
  patterns: [server-only singleton pattern, Stripe Checkout hosted redirect, Stripe Customer Portal API]

key-files:
  created:
    - src/lib/stripe/client.ts - Stripe client singleton
    - src/lib/stripe/checkout.ts - Checkout session creation with 14-day trial
    - src/lib/stripe/portal.ts - Customer portal session creation
    - src/types/stripe.ts - TypeScript type definitions
  modified:
    - package.json - Added stripe dependency
    - .env.example - Added 5 Stripe env vars

key-decisions:
  - "D-02: No-card 14-day trial via payment_method_collection='if_required' and trial_period_days=14"
  - "D-04: Customer portal accessible via stripe.billingPortal.sessions.create()"

patterns-established:
  - "Server-only singleton: getStripeClient() following retell/client.ts pattern"
  - "Checkout with trial: createCheckoutSession(contractorId, priceId) returns URL"
  - "Portal session: createPortalSession(customerId, returnUrl) returns URL"

requirements-completed: [BILL-01]

# Metrics
duration: 5min
completed: 2026-05-12
---

# Phase 7 Plan 1: Stripe SDK Install + Lib Modules Summary

**Stripe SDK installed with checkout session creation (14-day trial) and customer portal modules**

## Performance

- **Duration:** ~5 min
- **Completed:** 2026-05-12
- **Tasks:** 6 (all completed)
- **Files modified:** 7

## Accomplishments

- Installed Stripe SDK (stripe ^22.1.0)
- Added 5 Stripe environment variables to .env.example
- Created Stripe client singleton following existing retell/client.ts pattern
- Implemented checkout session creation with 14-day trial (D-02: no card required)
- Implemented customer portal session for subscription management (D-04)
- Created TypeScript type definitions for Stripe integration

## Task Commits

Single commit for all tasks (atomic implementation of foundational Stripe infrastructure):

- **4f98e24** - `feat(07-01): install Stripe SDK and create lib modules`

## Files Created/Modified

- `package.json` - Added stripe ^22.1.0 dependency
- `package-lock.json` - Updated with stripe package
- `.env.example` - Added STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_BASIC_PRICE_ID, STRIPE_PRO_PRICE_ID, STRIPE_ENTERPRISE_PRICE_ID
- `src/lib/stripe/client.ts` - Stripe singleton with getStripeClient()
- `src/lib/stripe/checkout.ts` - createCheckoutSession() with 14-day trial
- `src/lib/stripe/portal.ts` - createPortalSession() for subscription management
- `src/types/stripe.ts` - StripePriceId, CreateCheckoutSessionParams, CreatePortalSessionParams types

## Decisions Made

- Used Stripe API version 2026-04-22.dahlia (latest available)
- Configuration parameter in portal.ts uses undefined (not null) for TypeScript compatibility
- Followed existing project patterns: server-only imports, singleton pattern, service role client for database access

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fix Stripe API version**
- **Found during:** Task 3 (Create Stripe client singleton)
- **Issue:** Initial apiVersion '2025-04-30.basil' not compatible with installed stripe package
- **Fix:** Changed to '2026-04-22.dahlia' which is the correct version for stripe ^22.1.0
- **Files modified:** src/lib/stripe/client.ts
- **Verification:** tsc --noEmit passes
- **Committed in:** 4f98e24

**2. [Rule 1 - Bug] Fix TypeScript null type error**
- **Found during:** Task 5 (Create customer portal module)
- **Issue:** configuration: null not assignable to string | undefined type
- **Fix:** Changed to configuration: undefined (let Stripe use default)
- **Files modified:** src/lib/stripe/portal.ts
- **Verification:** tsc --noEmit passes
- **Committed in:** 4f98e24

---

**Total deviations:** 2 auto-fixed (both Rule 1 - bug fixes for TypeScript compilation)
**Impact on plan:** Both fixes necessary for code to compile. No functional impact, no scope creep.

## Issues Encountered

- None

## User Setup Required

**External services require manual configuration.** Manual setup needed before Phase 7 is fully operational:

1. **Stripe Dashboard Configuration:**
   - Create 3 subscription products: Basic ($299/mo), Professional ($499/mo), Enterprise ($799/mo)
   - Enable Customer Portal in Stripe Settings → Customer Portal → Enable
   - Get price IDs for each tier

2. **Environment Variables to add to .env.local:**
   - STRIPE_SECRET_KEY (from Stripe Dashboard → Developers → API keys)
   - STRIPE_WEBHOOK_SECRET (from Stripe Dashboard → Developers → Webhooks)
   - STRIPE_BASIC_PRICE_ID, STRIPE_PRO_PRICE_ID, STRIPE_ENTERPRISE_PRICE_ID (from product price IDs)

3. **Verification:**
   - Run `npm list stripe` to confirm SDK installed
   - Check `.env.local` has all 5 Stripe variables
   - Test checkout: import { createCheckoutSession } from '@/lib/stripe/checkout'

## Next Phase Readiness

- Stripe SDK and foundational lib modules complete
- Ready for Stripe webhook handler implementation (next plan)
- Integration points identified:
  - Checkout: from signup flow → createCheckoutSession(contractorId, priceId)
  - Portal: from settings page → createPortalSession(customerId, returnUrl)
- Type definitions available for future stripe-webhooks plan

---
*Phase: 07-billing-onboarding*
*Completed: 2026-05-12*
---
phase: 07-billing-onboarding
plan: 02
subsystem: billing-webhooks
tags: [stripe, webhook, idempotency, subscription]
dependency_graph:
  requires:
    - 07-01
  provides:
    - stripe-webhook-endpoint
    - subscription-status-sync
  affects:
    - inngest-functions
    - contractors-table
tech_stack:
  added:
    - stripe (v19.1.0)
  patterns:
    - Webhook signature verification via constructEvent
    - after() deferred processing per CLAUDE.md rule 2
    - Idempotency via webhook_events unique constraint
key_files:
  created:
    - src/app/api/webhooks/stripe/route.ts (76 lines)
    - src/app/api/webhooks/stripe/handlers.ts (206 lines)
decisions:
  - Used stripe.webhooks.constructEvent() for signature verification (security)
  - Implemented idempotency via webhook_events table (duplicate prevention)
  - Trigger Inngest event for payment failure (Plan 5 handles deactivation)
metrics:
  duration: 15 minutes
  completed_date: 2026-05-12
---

# Phase 7 Plan 2: Stripe Webhook Handler Summary

## Objective

Created Stripe webhook handler at `POST /api/webhooks/stripe` to process checkout.session.completed, invoice.payment_failed, and customer.subscription.updated events. Persists subscription status to contractor record with idempotency protection.

## Tasks Completed

### Task 1: Create Stripe webhook route

Created `src/app/api/webhooks/stripe/route.ts` following the Retell webhook pattern:

- Uses `req.text()` before verification (raw body required)
- Verifies Stripe signature with `constructEvent()`
- Returns 200 immediately, processes in `after()` per CLAUDE.md rule 2
- Dispatches to appropriate handler based on event.type
- Includes logging for traceability (T-07-02-03)

### Task 2: Create webhook handler functions

Created `src/app/api/webhooks/stripe/handlers.ts` with three handlers:

1. **handleCheckoutCompleted**: Extracts contractor_id from metadata, UPSERTs contractor with stripe_customer_id, stripe_subscription_id, sets subscription_status='trialing' (D-02: 14-day no-card trial)

2. **handlePaymentFailed**: Finds contractor by stripe_customer_id, triggers Inngest event `stripe/payment.failed` for deactivation+notification (D-10, D-11)

3. **handleSubscriptionUpdated**: Maps Stripe status to internal status (trialing/trialing, active/active, past_due/past_due, canceled/canceled)

All handlers include idempotency via `webhook_events` table with unique constraint on source+event_type+external_id (T-07-02-02).

### Task 3: Inngest event trigger

The handlers.ts file already sends `stripe/payment.failed` event to Inngest. The Inngest function that handles this event (deactivation + notification) will be implemented in Plan 5.

## Verification

- Files created at correct paths
- TypeScript compilation attempted (pre-existing errors in other files, no stripe-specific errors)
- Follows CLAUDE.md rule 2: webhook returns 200 immediately, processing in after()
- Idempotency via webhook_events table (T-07-02-02)

## Deviation: None

Plan executed exactly as written.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: webhook-spoofing | route.ts | Uses constructEvent() for signature verification (mitigated) |
| threat_flag: duplicate-processing | handlers.ts | Idempotency via webhook_events table (mitigated) |
| threat_flag: non-repudiation | route.ts | Logs all events with external_id for traceability (mitigated) |

## Self-Check: PASSED

- Files created: src/app/api/webhooks/stripe/route.ts (exists), src/app/api/webhooks/stripe/handlers.ts (exists)
- Commit exists: 9d859e7 (verified via git log)
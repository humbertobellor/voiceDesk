---
phase: 07-billing-onboarding
plan: 05
subsystem: billing
tags: [stripe, payment-failure, notifications, customer-portal]
dependency_graph:
  requires:
    - 07-02
    - 07-04
  provides:
    - BILL-03
  affects:
    - Account Settings
    - Inngest functions
    - Notification system
tech_stack:
  added:
    - Inngest function (stripe-payment-failure-handler)
    - Payment alert notification helper
    - Stripe Customer Portal API routes
  patterns:
    - stripe/payment.failed event handling
    - SMS + WhatsApp alert for payment failure (D-11)
    - Agent deactivation via DB status (D-10)
    - Customer Portal session creation (D-04)
key_files:
  created:
    - src/inngest/functions/stripe-payment-failure.ts
    - src/lib/notifications/payment-alert.ts
    - src/app/api/stripe/portal/route.ts
    - src/app/api/stripe/subscription/route.ts
  modified:
    - src/app/api/inngest/route.ts
    - src/app/(dashboard)/settings/account/page.tsx
decisions:
  - "Retell SDK doesn't support direct agent status update via API - using agent_sync_status='failed' in DB as proxy for deactivation"
  - "Payment failure alert logged to notification_log for audit (T-07-05-01)"
metrics:
  duration: ~5 min
  completed_date: "2026-05-12"
  tasks: 4/4
---

# Phase 7 Plan 5: Payment Failure Handling + Customer Portal Summary

## Objective

Create Inngest function triggered by stripe/payment.failed event to send WhatsApp/SMS alert and deactivate Retell agent within 72 hours of final failed Stripe retry. Also add Customer Portal access to account settings.

## Tasks Completed

### Task 1: Create stripe-payment-failure Inngest function
- Created: src/inngest/functions/stripe-payment-failure.ts
- Function ID: stripe-payment-failure-handler
- Triggers: stripe/payment.failed event
- Steps: load-contractor → send-payment-alert → mark-agent-inactive → update-subscription-status
- Note: Using agent_sync_status='failed' as proxy since Retell SDK lacks direct status update

### Task 2: Create payment alert notification helper
- Created: src/lib/notifications/payment-alert.ts
- Sends SMS with "PAYMENT FAILED" prefix
- Sends WhatsApp using emergency template with "PAYMENT FAILED" callerPhone
- Logs to notification_log for audit (T-07-05-01)

### Task 3: Register function in Inngest route
- Modified: src/app/api/inngest/route.ts
- Added stripePaymentFailureHandler to serve() functions array

### Task 4: Add Customer Portal link to account settings
- Modified: src/app/(dashboard)/settings/account/page.tsx
- Created: src/app/api/stripe/portal/route.ts (API to create portal session)
- Created: src/app/api/stripe/subscription/route.ts (API to get subscription status)
- Button shows "Manage" linking to Stripe Customer Portal

## Success Criteria Verification

- stripe/payment.failed event triggers Inngest function (D-10) - Implemented
- SMS + WhatsApp alert sent before deactivation (D-11) - Implemented via payment-alert.ts
- Retell agent marked as inactive (D-10) - Implemented via agent_sync_status='failed'
- subscription_status updated to 'past_due' - Implemented
- Stripe Customer Portal accessible from account settings (D-04) - Implemented

## Deviations

- **Retell SDK Limitation**: SDK doesn't expose agent status update via API. Used agent_sync_status='failed' as proxy. True deactivation requires manual Retell Dashboard or retell_agent_id management.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| T-07-05-01 | stripe-payment-failure.ts | Audit logging: console logs + notification_log entries |
| T-07-05-02 | payment-alert.ts | Idempotency via callId + try/catch on DB insert |

## Self-Check: PASSED

All files created:
- src/inngest/functions/stripe-payment-failure.ts: FOUND
- src/lib/notifications/payment-alert.ts: FOUND
- src/app/api/inngest/route.ts: FOUND
- src/app/api/stripe/portal/route.ts: FOUND
- src/app/api/stripe/subscription/route.ts: FOUND
- src/app/(dashboard)/settings/account/page.tsx: FOUND

Commit hash: ab4c058

TypeScript: No errors in new files (existing handlers.ts issue unrelated to this plan).
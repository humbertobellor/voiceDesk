import { describe, it, expect } from 'vitest'

/**
 * Unit tests for the D-08 triple-gate predicate used in stripe-payment-failure.ts
 * step.run('send-email-alert').
 *
 * These tests define the expected contract for the payment failure email gate
 * BEFORE the implementation step is written in Plan 13-02.
 *
 * The predicate is inlined here (not imported) because the Inngest function does
 * not export it separately.  The inline copy documents the exact contract and
 * will be verified against the implementation in Plan 13-02's integration tests.
 *
 * D-08: Payment failure email gating is a triple gate:
 *   (ns?.email_address != null) &&
 *   (ns?.notify_email_enabled === true) &&
 *   (ns?.notify_on_payment_failure === true)
 * All three must be true, or the email step is silently skipped (no log entry).
 */

/** Minimal shape of notification_settings fields relevant to payment failure email gating. */
interface PaymentFailureEmailGateFields {
  email_address: string | null
  notify_email_enabled: boolean
  notify_on_payment_failure: boolean
}

/**
 * Inline triple-gate predicate — mirrors D-08 implementation contract.
 * This function documents what the stripe-payment-failure Inngest step must check.
 */
function shouldSendPaymentFailureEmail(ns: PaymentFailureEmailGateFields | null | undefined): boolean {
  return (
    ns?.email_address != null &&
    ns?.notify_email_enabled === true &&
    ns?.notify_on_payment_failure === true
  )
}

describe('stripe-payment-failure email triple gate (D-08)', () => {
  it('all three gates true → email is gated as SHOULD send', () => {
    const ns: PaymentFailureEmailGateFields = {
      email_address: 'contractor@example.com',
      notify_email_enabled: true,
      notify_on_payment_failure: true,
    }
    expect(shouldSendPaymentFailureEmail(ns)).toBe(true)
  })

  it('notify_on_payment_failure=false → email is gated as SHOULD NOT send', () => {
    const ns: PaymentFailureEmailGateFields = {
      email_address: 'contractor@example.com',
      notify_email_enabled: true,
      notify_on_payment_failure: false,
    }
    expect(shouldSendPaymentFailureEmail(ns)).toBe(false)
  })
})

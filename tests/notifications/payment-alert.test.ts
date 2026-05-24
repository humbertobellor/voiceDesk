// payment-alert.test.ts
// RED phase stubs: these tests fail until Plan 02 implements D-05 channel-flag gating.
// DO NOT implement the production code here — that belongs in payment-alert.ts (Plan 02).
import { describe, it } from 'vitest'

describe('sendPaymentFailureAlert — channel-flag gating (D-05)', () => {
  it('calls sendSms when smsEnabled=true and smsNumber is provided', () => {
    throw new Error('not yet implemented')
  })

  it('does NOT call sendSms when smsEnabled=false', () => {
    throw new Error('not yet implemented')
  })

  it('does NOT call sendSms when smsNumber is null', () => {
    throw new Error('not yet implemented')
  })

  it('calls sendWhatsApp when whatsappEnabled=true and whatsappNumber is provided', () => {
    throw new Error('not yet implemented')
  })

  it('does NOT call sendWhatsApp when whatsappEnabled=false', () => {
    throw new Error('not yet implemented')
  })

  it('sends SMS even if WhatsApp is disabled (channels are independent)', () => {
    throw new Error('not yet implemented')
  })
})

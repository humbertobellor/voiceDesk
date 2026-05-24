// tests/notifications/payment-alert.test.ts
// GREEN phase: D-05 channel-flag gating tests for sendPaymentFailureAlert.
// Tests verify that SMS and WhatsApp are each gated by their respective enable flags
// and that channels are independent (failure/skip in one does not affect the other).
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/notifications/sms', () => ({ sendSms: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/notifications/whatsapp', () => ({ sendWhatsApp: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn(() => ({ insert: vi.fn().mockResolvedValue({ error: null }) })),
  })),
}))

import { sendPaymentFailureAlert } from '@/lib/notifications/payment-alert'
import { sendSms } from '@/lib/notifications/sms'
import { sendWhatsApp } from '@/lib/notifications/whatsapp'

const mockSendSms = sendSms as ReturnType<typeof vi.fn>
const mockSendWhatsApp = sendWhatsApp as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

describe('sendPaymentFailureAlert — channel-flag gating (D-05)', () => {
  it('calls sendSms when smsEnabled=true and smsNumber is provided', async () => {
    await sendPaymentFailureAlert({
      contractorId: 'c1',
      smsNumber: '+15555551234',
      smsEnabled: true,
      whatsappNumber: null,
      whatsappEnabled: false,
    })
    expect(mockSendSms).toHaveBeenCalledOnce()
    expect(mockSendSms).toHaveBeenCalledWith(
      expect.objectContaining({ to: '+15555551234' })
    )
  })

  it('does NOT call sendSms when smsEnabled=false', async () => {
    await sendPaymentFailureAlert({
      contractorId: 'c2',
      smsNumber: '+15555551234',
      smsEnabled: false,
      whatsappNumber: null,
      whatsappEnabled: false,
    })
    expect(mockSendSms).not.toHaveBeenCalled()
  })

  it('does NOT call sendSms when smsNumber is null', async () => {
    await sendPaymentFailureAlert({
      contractorId: 'c3',
      smsNumber: null,
      smsEnabled: true,
      whatsappNumber: null,
      whatsappEnabled: false,
    })
    expect(mockSendSms).not.toHaveBeenCalled()
  })

  it('calls sendWhatsApp when whatsappEnabled=true and whatsappNumber is provided', async () => {
    await sendPaymentFailureAlert({
      contractorId: 'c4',
      smsNumber: null,
      smsEnabled: false,
      whatsappNumber: '+15555559999',
      whatsappEnabled: true,
    })
    expect(mockSendWhatsApp).toHaveBeenCalledOnce()
    expect(mockSendWhatsApp).toHaveBeenCalledWith(
      expect.objectContaining({ to: '+15555559999' })
    )
  })

  it('does NOT call sendWhatsApp when whatsappEnabled=false', async () => {
    await sendPaymentFailureAlert({
      contractorId: 'c5',
      smsNumber: null,
      smsEnabled: false,
      whatsappNumber: '+15555559999',
      whatsappEnabled: false,
    })
    expect(mockSendWhatsApp).not.toHaveBeenCalled()
  })

  it('sends SMS even if WhatsApp is disabled (channels are independent)', async () => {
    await sendPaymentFailureAlert({
      contractorId: 'c6',
      smsNumber: '+15555551234',
      smsEnabled: true,
      whatsappNumber: '+15555559999',
      whatsappEnabled: false,
    })
    expect(mockSendSms).toHaveBeenCalledOnce()
    expect(mockSendWhatsApp).not.toHaveBeenCalled()
  })
})

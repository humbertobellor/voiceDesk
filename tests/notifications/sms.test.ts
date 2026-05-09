import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

// Mock twilio default export
const mockMessagesCreate = vi.fn()
vi.mock('twilio', () => ({
  default: vi.fn(() => ({
    messages: { create: mockMessagesCreate },
  })),
}))

import { sendSms } from '@/lib/notifications/sms'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.TWILIO_ACCOUNT_SID = 'ACtest'
  process.env.TWILIO_AUTH_TOKEN = 'auth_test'
  process.env.TWILIO_FROM_NUMBER = '+15550000000'
})

describe('sendSms', () => {
  it('calls Twilio messages.create with correct params', async () => {
    mockMessagesCreate.mockResolvedValue({ sid: 'SM123', status: 'queued' })
    const result = await sendSms({ to: '+15551234567', body: 'New call from +15559999999 — AC repair.', contractorId: 'c1', callId: 'call-1' })
    expect(result).toEqual({ sid: 'SM123', status: 'queued' })
    expect(mockMessagesCreate).toHaveBeenCalledWith({
      to: '+15551234567',
      from: '+15550000000',
      body: 'New call from +15559999999 — AC repair.',
    })
  })

  it('throws when TWILIO_ACCOUNT_SID is missing', async () => {
    delete process.env.TWILIO_ACCOUNT_SID
    await expect(sendSms({ to: '+15551234567', body: 'test', contractorId: 'c1', callId: null })).rejects.toThrow('TWILIO_ACCOUNT_SID')
  })

  it('throws when TWILIO_AUTH_TOKEN is missing', async () => {
    delete process.env.TWILIO_AUTH_TOKEN
    await expect(sendSms({ to: '+15551234567', body: 'test', contractorId: 'c1', callId: null })).rejects.toThrow('TWILIO_AUTH_TOKEN')
  })

  it('throws when TWILIO_FROM_NUMBER is missing', async () => {
    delete process.env.TWILIO_FROM_NUMBER
    await expect(sendSms({ to: '+15551234567', body: 'test', contractorId: 'c1', callId: null })).rejects.toThrow('TWILIO_FROM_NUMBER')
  })
})

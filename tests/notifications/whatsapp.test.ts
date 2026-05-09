import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const mockMessagesCreate = vi.fn()
vi.mock('twilio', () => ({
  default: vi.fn(() => ({
    messages: { create: mockMessagesCreate },
  })),
}))

import { sendWhatsApp, WHATSAPP_CONTENT_SIDS } from '@/lib/notifications/whatsapp'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.TWILIO_ACCOUNT_SID = 'ACtest'
  process.env.TWILIO_AUTH_TOKEN = 'auth_test'
  process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+15550000000'
})

describe('sendWhatsApp', () => {
  it('sends new_lead template with correct content variables', async () => {
    mockMessagesCreate.mockResolvedValue({ sid: 'SM456', status: 'queued' })
    const result = await sendWhatsApp({
      to: '+15551234567',
      templateType: 'new_lead',
      callerPhone: '+15559999999',
      serviceRequested: 'AC repair',
      bookingStatus: 'Appointment booked for 2026-05-10 10:00 AM',
      contractorId: 'c1',
      callId: 'call-1',
    })
    expect(result).toEqual({ sid: 'SM456', status: 'queued' })
    const call = mockMessagesCreate.mock.calls[0][0]
    expect(call.to).toBe('whatsapp:+15551234567')
    expect(call.from).toBe('whatsapp:+15550000000')
    expect(call.contentSid).toBe(WHATSAPP_CONTENT_SIDS.new_lead)
    const vars = JSON.parse(call.contentVariables)
    expect(vars['1']).toBe('+15559999999')
    expect(vars['2']).toBe('AC repair')
    expect(vars['3']).toBe('Appointment booked for 2026-05-10 10:00 AM')
  })

  it('sends emergency template with two variables', async () => {
    mockMessagesCreate.mockResolvedValue({ sid: 'SM789', status: 'queued' })
    await sendWhatsApp({
      to: '+15551234567',
      templateType: 'emergency',
      callerPhone: '+15559999999',
      serviceRequested: 'gas smell',
      contractorId: 'c1',
      callId: 'call-2',
    })
    const call = mockMessagesCreate.mock.calls[0][0]
    expect(call.contentSid).toBe(WHATSAPP_CONTENT_SIDS.emergency)
    const vars = JSON.parse(call.contentVariables)
    expect(vars['1']).toBe('+15559999999')
    expect(vars['2']).toBe('gas smell')
    expect(vars['3']).toBeUndefined()
  })

  it('throws when TWILIO_WHATSAPP_FROM is missing', async () => {
    delete process.env.TWILIO_WHATSAPP_FROM
    await expect(
      sendWhatsApp({ to: '+15551234567', templateType: 'new_lead', callerPhone: '+1555', serviceRequested: 'test', contractorId: 'c1', callId: null })
    ).rejects.toThrow('TWILIO_WHATSAPP_FROM')
  })
})

describe('WHATSAPP_CONTENT_SIDS', () => {
  it('has new_lead and emergency keys', () => {
    expect(WHATSAPP_CONTENT_SIDS).toHaveProperty('new_lead')
    expect(WHATSAPP_CONTENT_SIDS).toHaveProperty('emergency')
  })
})

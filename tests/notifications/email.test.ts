import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const mockEmailsSend = vi.fn()
vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: { send: mockEmailsSend },
  })),
}))

import { sendEmail } from '@/lib/notifications/email'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.RESEND_API_KEY = 're_test_key'
  process.env.RESEND_FROM_ADDRESS = 'noreply@voicedesk.app'
})

describe('sendEmail', () => {
  it('returns success with messageId on successful send', async () => {
    mockEmailsSend.mockResolvedValue({ data: { id: 'msg_123' }, error: null })
    const result = await sendEmail({
      to: 'contractor@example.com',
      subject: 'New Lead',
      html: '<p>Caller: John</p>',
    })
    expect(result).toEqual({ success: true, messageId: 'msg_123' })
    expect(mockEmailsSend).toHaveBeenCalledWith({
      from: 'noreply@voicedesk.app',
      to: 'contractor@example.com',
      subject: 'New Lead',
      html: '<p>Caller: John</p>',
    })
  })

  it('returns failure when Resend returns error', async () => {
    mockEmailsSend.mockResolvedValue({
      data: null,
      error: { message: 'Invalid email address' },
    })
    const result = await sendEmail({
      to: 'invalid-email',
      subject: 'Test',
      html: '<p>Test</p>',
    })
    expect(result).toEqual({ success: false, error: 'Invalid email address' })
  })

  it('returns failure when Resend throws', async () => {
    mockEmailsSend.mockRejectedValue(new Error('Network timeout'))
    const result = await sendEmail({
      to: 'contractor@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    })
    expect(result).toEqual({ success: false, error: 'Network timeout' })
  })

  it('returns failure when RESEND_API_KEY is missing', async () => {
    delete process.env.RESEND_API_KEY
    const result = await sendEmail({
      to: 'contractor@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Resend credentials not configured')
  })

  it('returns failure when RESEND_FROM_ADDRESS is missing', async () => {
    delete process.env.RESEND_FROM_ADDRESS
    const result = await sendEmail({
      to: 'contractor@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Resend credentials not configured')
  })
})

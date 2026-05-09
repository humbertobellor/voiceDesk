import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock server-only so the module loads in test env
vi.mock('server-only', () => ({}))

// Mock createServiceRoleClient
const mockSingle = vi.fn()
const mockSelect = vi.fn(() => ({ single: mockSingle }))
const mockInsert = vi.fn(() => ({ select: mockSelect }))
const mockUpdate = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }))
const mockFrom = vi.fn((table: string) => {
  if (table === 'notification_log') {
    return { insert: mockInsert, update: mockUpdate }
  }
  return {}
})

vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({ from: mockFrom }),
}))

import { writeNotificationLog, updateNotificationLog } from '@/lib/notifications/log'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('writeNotificationLog', () => {
  it('inserts a pending row and returns the id', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'log-uuid-1' }, error: null })
    const id = await writeNotificationLog({
      contractorId: 'c1',
      callId: 'call-1',
      channel: 'sms',
      recipient: '+15551234567',
      message: 'Test SMS body',
    })
    expect(id).toBe('log-uuid-1')
    expect(mockFrom).toHaveBeenCalledWith('notification_log')
  })

  it('throws if DB insert returns error', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } })
    await expect(
      writeNotificationLog({ contractorId: 'c1', callId: null, channel: 'sms', recipient: '+1555', message: 'test' })
    ).rejects.toThrow('DB error')
  })
})

describe('updateNotificationLog', () => {
  it('resolves without throwing when update succeeds', async () => {
    mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    await expect(
      updateNotificationLog('log-uuid-1', { status: 'sent', sentAt: new Date().toISOString() })
    ).resolves.toBeUndefined()
  })

  it('does not throw when update fails (non-fatal)', async () => {
    mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: { message: 'update failed' } }) })
    // Should log the error but NOT throw
    await expect(
      updateNotificationLog('log-uuid-1', { status: 'failed', error: 'Twilio error' })
    ).resolves.toBeUndefined()
  })
})

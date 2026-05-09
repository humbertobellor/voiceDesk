import { describe, it, expect } from 'vitest'
import { writeNotificationLog, updateNotificationLog } from '@/lib/notifications/log'

describe('writeNotificationLog', () => {
  it('throws not yet implemented', async () => {
    await expect(
      writeNotificationLog({ contractorId: 'c1', callId: null, channel: 'sms', recipient: '+1555', message: 'test' })
    ).rejects.toThrow('not yet implemented')
  })
})

describe('updateNotificationLog', () => {
  it('throws not yet implemented', async () => {
    await expect(
      updateNotificationLog('log-id-1', { status: 'sent', sentAt: new Date().toISOString() })
    ).rejects.toThrow('not yet implemented')
  })
})

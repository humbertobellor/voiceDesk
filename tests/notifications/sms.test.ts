import { describe, it, expect } from 'vitest'
import { sendSms } from '@/lib/notifications/sms'

describe('sendSms', () => {
  it('throws not yet implemented', async () => {
    await expect(
      sendSms({ to: '+15551234567', body: 'test', contractorId: 'c1', callId: null })
    ).rejects.toThrow('not yet implemented')
  })
})

import { describe, it, expect } from 'vitest'
import { sendTelegram } from '@/lib/notifications/telegram'

describe('sendTelegram', () => {
  it('throws not yet implemented', async () => {
    await expect(
      sendTelegram({ chatId: '123456789', message: 'test', contractorId: 'c1', callId: null })
    ).rejects.toThrow('not yet implemented')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const { mockSendMessage } = vi.hoisted(() => {
  const mockSendMessage = vi.fn()
  return { mockSendMessage }
})

vi.mock('grammy', () => {
  class MockBot {
    api = { sendMessage: mockSendMessage }
    command = vi.fn()
  }
  return {
    Bot: MockBot,
  }
})

import { sendTelegram } from '@/lib/notifications/telegram'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.TELEGRAM_BOT_TOKEN = 'test_bot_token:123456'
})

describe('sendTelegram', () => {
  it('calls bot.api.sendMessage with chatId and message', async () => {
    mockSendMessage.mockResolvedValue({ message_id: 42, chat: { id: 123456789 } })
    const result = await sendTelegram({
      chatId: '123456789',
      message: 'New call from +15559999999 — AC repair. No appointment booked.',
      contractorId: 'c1',
      callId: 'call-1',
    })
    expect(result).toEqual({ messageId: 42 })
    expect(mockSendMessage).toHaveBeenCalledWith('123456789', 'New call from +15559999999 — AC repair. No appointment booked.')
  })

  it('throws when TELEGRAM_BOT_TOKEN is missing', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN
    await expect(
      sendTelegram({ chatId: '123456789', message: 'test', contractorId: 'c1', callId: null })
    ).rejects.toThrow('TELEGRAM_BOT_TOKEN')
  })
})

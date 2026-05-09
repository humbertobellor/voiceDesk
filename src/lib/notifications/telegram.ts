import 'server-only'
import { Bot } from 'grammy'

export interface SendTelegramParams {
  chatId: string   // Telegram chat_id stored in notification_settings.telegram_chat_id
  message: string  // Plain text — no template approval needed for Telegram
  contractorId: string
  callId: string | null
}

export interface SendTelegramResult {
  messageId: number
}

// D-18: Single @VoiceDeskBot for the entire platform. One TELEGRAM_BOT_TOKEN env var.
// D-22: grammY webhook mode (not polling) — Bot instance is created per-request, not persistent.
// NOTIF-03: Sends plain text notification to contractor's linked Telegram account.
export async function sendTelegram(params: SendTelegramParams): Promise<SendTelegramResult> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) throw new Error('[sendTelegram] TELEGRAM_BOT_TOKEN is not set')

  const bot = new Bot(botToken)
  const result = await bot.api.sendMessage(params.chatId, params.message)

  return { messageId: result.message_id }
}

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

// IN-03: Module-level singleton — bot token is constant; no need to instantiate on every call.
// Consistent with the webhook handler's module-level `const bot = new Bot(...)` pattern.
let _bot: Bot | null = null
function getBot(): Bot {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('[sendTelegram] TELEGRAM_BOT_TOKEN is not set')
  if (!_bot) _bot = new Bot(token)
  return _bot
}

// D-18: Single @voiceDeskTelBot for the entire platform. One TELEGRAM_BOT_TOKEN env var.
// D-22: grammY webhook mode (not polling) — Bot instance reused across calls via singleton.
// NOTIF-03: Sends plain text notification to contractor's linked Telegram account.
export async function sendTelegram(params: SendTelegramParams): Promise<SendTelegramResult> {
  const result = await getBot().api.sendMessage(params.chatId, params.message)
  return { messageId: result.message_id }
}

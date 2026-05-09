import 'server-only'

export interface SendTelegramParams {
  chatId: string   // Telegram chat_id stored in notification_settings.telegram_chat_id
  message: string  // Plain text — no template approval needed for Telegram
  contractorId: string
  callId: string | null
}

export interface SendTelegramResult {
  messageId: number
}

export async function sendTelegram(_params: SendTelegramParams): Promise<SendTelegramResult> {
  throw new Error('not yet implemented')
}

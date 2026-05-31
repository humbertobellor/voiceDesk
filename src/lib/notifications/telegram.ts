import 'server-only'
import { Bot } from 'grammy'
import { createServiceRoleClient } from '@/lib/supabase/service'

export interface SendTelegramParams {
  chatId: string   // Telegram chat_id stored in notification_settings.telegram_chat_id
  message: string  // Plain text — no template approval needed for Telegram
  contractorId: string
  callId: string | null
}

export interface SendTelegramResult {
  messageId: number
}

// CR-01 + CR-02: Single Bot singleton for the entire platform. Token-keyed so rotation
// is detected immediately. The /start command is registered here so both the webhook
// route (which calls getBot()) and any future command-registration code share the same
// Bot instance and the same handler set.
//
// WR-02 (race safety): Bot construction is synchronous — there is no `await` inside the
// initialization block. Node.js is single-threaded; a second concurrent invocation cannot
// interleave with the synchronous `if (!_bot || ...)` block. On a cold start, the first
// call to getBot() completes the synchronous init and assigns `_bot` before any awaited
// continuation can re-enter. Subsequent concurrent calls read the already-populated `_bot`
// and return immediately. No async lock is required.
let _bot: Bot | null = null
let _cachedToken: string | null = null

/**
 * Returns the shared grammY Bot singleton for the platform bot.
 *
 * Throws if TELEGRAM_BOT_TOKEN is not set.
 * Recreates the Bot instance when the token has changed (handles secret rotation).
 * The /start command handler is registered here so any caller of getBot() shares the
 * same handler registration.
 */
export function getBot(): Bot {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('[getBot] TELEGRAM_BOT_TOKEN is not set')

  // Recreate instance when token has rotated. Initialization is synchronous so
  // no concurrent call can observe a partially-constructed singleton (see WR-02 note above).
  if (!_bot || _cachedToken !== token) {
    const bot = new Bot(token)

    // D-19: Handle /start <contractor_uuid> — sent by Telegram when contractor clicks the deep link.
    // Deep link format: https://t.me/<botUsername>?start=<contractor_uuid>
    // Telegram delivers this as message.text = "/start <contractor_uuid>"
    bot.command('start', async (ctx) => {
      const text = ctx.message?.text ?? ''
      // Extract the payload after "/start " (the contractor UUID)
      const parts = text.split(' ')
      const contractorId = parts[1]?.trim()

      if (!contractorId) {
        await ctx.reply('❌ Invalid link. Please use the setup link from your VoiceDesk dashboard.')
        return
      }

      const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      if (!UUID_V4_REGEX.test(contractorId)) {
        await ctx.reply('❌ Invalid link. Please use the setup link from your VoiceDesk dashboard.')
        return
      }

      const chatId = ctx.chat.id.toString()

      // Verify contractor exists before upsert to distinguish invalid UUIDs from DB errors
      const db = createServiceRoleClient()
      const { data: contractor } = await db
        .from('contractors')
        .select('id')
        .eq('id', contractorId)
        .maybeSingle()

      if (!contractor) {
        await ctx.reply('❌ Invalid link. Please use the setup link from your VoiceDesk dashboard.')
        return
      }

      // D-20: Upsert telegram_chat_id — re-linking always overwrites; no error if already linked
      const { error } = await db
        .from('notification_settings')
        .upsert(
          {
            contractor_id: contractorId,
            telegram_chat_id: chatId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'contractor_id' }
        )

      if (error) {
        console.error('[getBot/start] upsert failed for contractorId:', contractorId, error.message)
        await ctx.reply('❌ Connection failed. Please try the link again or contact support.')
        return
      }

      // D-19: Confirmation message
      await ctx.reply('✅ VoiceDesk connected. You will receive call alerts here.')
    })

    _bot = bot
    _cachedToken = token
  }

  return _bot
}

// D-18: Single @voiceDeskTelBot for the entire platform. One TELEGRAM_BOT_TOKEN env var.
// D-22: grammY webhook mode (not polling) — Bot instance reused across calls via singleton.
// NOTIF-03: Sends plain text notification to contractor's linked Telegram account.
export async function sendTelegram(params: SendTelegramParams): Promise<SendTelegramResult> {
  const result = await getBot().api.sendMessage(params.chatId, params.message)
  return { messageId: result.message_id }
}

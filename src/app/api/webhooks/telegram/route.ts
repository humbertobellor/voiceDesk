// src/app/api/webhooks/telegram/route.ts
// Telegram bot webhook handler for @voiceDeskTelBot.
// D-22: grammY webhook mode (not polling — serverless compatible).
// D-19: Processes /start <contractor_uuid> messages from Telegram deep link.
// D-20: Upserts telegram_chat_id — re-linking always overwrites.
// Security: grammY webhookCallback validates the secret_token header set via setWebhook registration.
// Note: Unlike retell/route.ts, this is synchronous — grammY handles the response inline (no after() needed).
import 'server-only'
import { Bot, webhookCallback } from 'grammy'
import { createServiceRoleClient } from '@/lib/supabase/service'

// Validate env var at module load — fails fast before any request is processed
const botToken = process.env.TELEGRAM_BOT_TOKEN
if (!botToken) {
  console.error('[webhook/telegram] TELEGRAM_BOT_TOKEN is not set — bot will not function')
}

const bot = new Bot(botToken ?? 'placeholder')

// D-19: Handle /start <contractor_uuid> — sent by Telegram when contractor clicks the deep link
// Deep link format: https://t.me/voiceDeskTelBot?start=<contractor_uuid>
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

  // D-20: Upsert telegram_chat_id — re-linking always overwrites; no error if already linked
  const db = createServiceRoleClient()
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
    console.error('[webhook/telegram] upsert failed for contractorId:', contractorId, error.message)
    await ctx.reply('❌ Connection failed. Please try the link again or contact support.')
    return
  }

  // D-19: Confirmation message (per 05-CONTEXT.md specifics section)
  await ctx.reply('✅ VoiceDesk connected. You will receive call alerts here.')
})

// grammY webhookCallback wraps the bot handler in a standard Web API Request/Response handler
// D-22: Use 'std/http' adapter for Next.js App Router (Web API Request/Response)
// T-05-04-01: 5th param validates X-Telegram-Bot-Api-Secret-Token header sent by Telegram.
// Set TELEGRAM_WEBHOOK_SECRET to any strong random string, pass the same value to setWebhook.
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
if (!webhookSecret) {
  throw new Error(
    '[webhook/telegram] TELEGRAM_WEBHOOK_SECRET is required — set this env var before deploying. ' +
    'Without it, grammY skips signature validation and any HTTP client can inject bot updates.'
  )
}
const handleUpdate = webhookCallback(bot, 'std/http', undefined, undefined, webhookSecret)

export async function POST(req: Request) {
  // Guard missing bot token — return 503 so Telegram retries later
  if (!botToken) {
    console.error('[webhook/telegram] cannot process update — TELEGRAM_BOT_TOKEN not set')
    return new Response('Service Unavailable', { status: 503 })
  }

  try {
    return await handleUpdate(req)
  } catch (err) {
    console.error('[webhook/telegram] handleUpdate error:', err instanceof Error ? err.message : err)
    // Return 200 to prevent Telegram from retrying malformed updates indefinitely
    return new Response('OK', { status: 200 })
  }
}

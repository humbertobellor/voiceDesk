// src/app/api/webhooks/telegram/route.ts
// Telegram bot webhook handler for @voiceDeskTelBot.
// D-22: grammY webhook mode (not polling — serverless compatible).
// D-19: Processes /start <contractor_uuid> messages from Telegram deep link.
// D-20: Upserts telegram_chat_id — re-linking always overwrites.
// Security: grammY webhookCallback validates the secret_token header set via setWebhook registration.
// Note: Unlike retell/route.ts, this is synchronous — grammY handles the response inline (no after() needed).
// CR-01: Uses getBot() singleton from telegram.ts — no separate Bot instance. The /start command
// handler is registered inside getBot() so all callers share a single, consistent Bot object.
import 'server-only'
import { webhookCallback } from 'grammy'
import { getBot } from '@/lib/notifications/telegram'

// grammY webhookCallback wraps the bot handler in a standard Web API Request/Response handler
// D-22: Use 'std/http' adapter for Next.js App Router (Web API Request/Response)
// T-05-04-01: 5th param validates X-Telegram-Bot-Api-Secret-Token header sent by Telegram.
// Set TELEGRAM_WEBHOOK_SECRET to any strong random string, pass the same value to setWebhook.

export async function POST(req: Request) {
  // Guard missing webhook secret — return 503 so Telegram retries later
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[webhook/telegram] TELEGRAM_WEBHOOK_SECRET is not set — rejecting update')
    return new Response('Service Unavailable', { status: 503 })
  }

  // CR-01: Use the shared singleton — fail fast if token is missing
  let bot: ReturnType<typeof getBot>
  try {
    bot = getBot()
  } catch {
    console.error('[webhook/telegram] TELEGRAM_BOT_TOKEN is not set — rejecting update')
    return new Response('Service Unavailable', { status: 503 })
  }

  const handleUpdate = webhookCallback(bot, 'std/http', undefined, undefined, webhookSecret)
  try {
    return await handleUpdate(req)
  } catch (err) {
    console.error('[webhook/telegram] handleUpdate error:', err instanceof Error ? err.message : err)
    // Return 200 to prevent Telegram from retrying malformed updates indefinitely
    return new Response('OK', { status: 200 })
  }
}

// src/app/(dashboard)/settings/notifications/actions.ts
// Server actions for the Notification Settings page.
//
// TEL-01 / TEL-02: activateTelegramWebhook() registers the platform-level
// Telegram webhook with the Bot API. Validates authentication, contractor
// ownership, and env vars before calling the Telegram API. Never throws —
// always returns a discriminated union result so the client can display inline
// errors without crashing.
'use server'
import 'server-only'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { getBot } from '@/lib/notifications/telegram'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ActivateResult =
  | { ok: true; webhookInfo: Record<string, unknown> }
  | { ok: false; error: string }

// ─────────────────────────────────────────────────────────────────────────────
// Action
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registers the platform-level Telegram webhook with the Bot API.
 *
 * Security model (STRIDE T-15-02-01 through T-15-02-05):
 * - Validates the caller's JWT via createSupabaseServer().auth.getUser()
 * - Confirms the caller owns a contractor record before proceeding
 * - Reads TELEGRAM_WEBHOOK_URL and TELEGRAM_WEBHOOK_SECRET from server-only env
 * - Passes secret_token to setWebhook so the webhook handler can verify origin
 * - Returns only the non-secret webhook URL to the client
 *
 * @returns ActivateResult — never throws; caller handles { ok: false } inline.
 */
export async function activateTelegramWebhook(): Promise<ActivateResult> {
  // 1. Authentication: validate JWT (ASVS V4.1)
  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  // 2. Authorization: confirm contractor ownership (ASVS V4.2)
  const serviceClient = createServiceRoleClient()
  const { data: contractor, error: cErr } = await serviceClient
    .from('contractors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (cErr || !contractor) return { ok: false, error: 'Contractor not found.' }

  // 3. Env var validation: webhook URL (ASVS V5.1)
  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL
  if (!webhookUrl) return { ok: false, error: 'Telegram webhook URL not configured.' }
  if (!webhookUrl.startsWith('https://'))
    return { ok: false, error: 'Webhook URL must be HTTPS.' }

  // 4. Env var validation: webhook secret
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!webhookSecret) return { ok: false, error: 'Telegram webhook secret not configured.' }

  // 5. Register webhook with Telegram Bot API
  try {
    await getBot().api.setWebhook(webhookUrl, { secret_token: webhookSecret })
    const webhookInfo = await getBot().api.getWebhookInfo()
    return { ok: true, webhookInfo: webhookInfo as unknown as Record<string, unknown> }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[activateTelegramWebhook]:', message)
    return { ok: false, error: 'Failed to activate webhook. Please try again.' }
  }
}

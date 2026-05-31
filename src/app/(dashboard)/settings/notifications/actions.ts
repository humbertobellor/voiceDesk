'use server'
// src/app/(dashboard)/settings/notifications/actions.ts
// Server actions for the Notification Settings page.
//
// TEL-01 / TEL-02: activateTelegramWebhook() registers the platform-level
// Telegram webhook with the Bot API. Validates authentication, contractor
// ownership, and env vars before calling the Telegram API. Never throws —
// always returns a discriminated union result so the client can display inline
// errors without crashing.
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
  // CR-03: Validate URL structure and restrict hostname to the known app deployment host
  // to prevent SSRF via a misconfigured or injected TELEGRAM_WEBHOOK_URL env var.
  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL
  if (!webhookUrl) return { ok: false, error: 'Telegram webhook URL not configured.' }

  let parsedWebhookUrl: URL
  try {
    parsedWebhookUrl = new URL(webhookUrl)
  } catch {
    return { ok: false, error: 'Telegram webhook URL is not a valid URL.' }
  }
  if (parsedWebhookUrl.protocol !== 'https:') {
    return { ok: false, error: 'Webhook URL must be HTTPS.' }
  }

  // Determine the expected hostname from build-time / runtime env vars.
  // NEXT_PUBLIC_APP_URL is preferred (explicit project setting); VERCEL_URL is the
  // auto-injected Vercel deployment URL (no protocol prefix). Falls back to a hardcoded
  // known production hostname so a missing env does not silently accept any URL.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL ?? null
  let allowedHostname: string | null = null
  if (appUrl) {
    try {
      // NEXT_PUBLIC_APP_URL may include a protocol; VERCEL_URL does not.
      allowedHostname = new URL(appUrl.startsWith('http') ? appUrl : `https://${appUrl}`).hostname
    } catch {
      // Malformed app URL env — fall through and use hardcoded fallback below
    }
  }
  if (!allowedHostname) {
    allowedHostname = 'voicedesk.vercel.app'
  }

  if (parsedWebhookUrl.hostname !== allowedHostname) {
    console.error(
      '[activateTelegramWebhook] webhook URL hostname rejected:',
      parsedWebhookUrl.hostname,
      'expected:',
      allowedHostname,
    )
    return { ok: false, error: 'Webhook URL host does not match expected application host.' }
  }

  // 4. Env var validation: webhook secret
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!webhookSecret) return { ok: false, error: 'Telegram webhook secret not configured.' }

  // 5. Register webhook with Telegram Bot API
  // WR-02: Separate setWebhook and getWebhookInfo try/catch so a transient failure
  // reading back the webhook info does not report the registration as failed.
  // setWebhook is the authoritative step; getWebhookInfo is best-effort.
  try {
    await getBot().api.setWebhook(webhookUrl, { secret_token: webhookSecret })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[activateTelegramWebhook] setWebhook failed:', message)
    return { ok: false, error: 'Failed to activate webhook. Please try again.' }
  }

  // Best-effort: read back the registered info; fall back to the URL we just set.
  let webhookInfo: Record<string, unknown> = { url: webhookUrl }
  try {
    webhookInfo = (await getBot().api.getWebhookInfo()) as unknown as Record<string, unknown>
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[activateTelegramWebhook] getWebhookInfo failed (non-fatal):', message)
    // Registration succeeded; return the URL we registered rather than failing the action.
  }

  return { ok: true, webhookInfo }
}

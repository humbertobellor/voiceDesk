// src/app/api/webhooks/retell/route.ts
// Retell AI webhook handler — single route dispatching call_ended + call_analyzed events.
// D-01: Single route, dispatches by event.event type.
// CRITICAL: verify() called BEFORE parsing payload (req.text() not req.json()).
// CRITICAL: Returns HTTP 200 immediately — all downstream processing in after() (CLAUDE.md rule 2).
// Security: T-03-01 — verify() rejects forged webhooks with 401 before any payload access.
// Security: T-03-02 — contractor lookup by agent_id, never by contractor_id from payload.
import 'server-only'
import { createHmac, timingSafeEqual } from 'crypto'
import { after } from 'next/server'
import { processCallEnded, processCallAnalyzed } from './handlers'
import type { RetellWebhookEvent } from '@/lib/retell/webhook-types'

// Vercel segment config — after() budget must cover: 1 Supabase write + 1 Inngest send
export const maxDuration = 30
export const runtime = 'nodejs'

// Retell signs webhooks as HMAC-SHA256(body + timestamp, apiKey).
// Using Node.js crypto directly — bypasses Web Crypto API (globalThis.crypto.subtle).
function verifyRetellHmac(rawBody: string, apiKey: string, signature: string): {
  valid: boolean
  diagnostics: Record<string, unknown>
} {
  const FIVE_MINUTES = 5 * 60 * 1000
  const diag: Record<string, unknown> = {}

  const match = /^v=(\d+),d=([a-f0-9]+)$/.exec(signature)
  if (!match) {
    diag['reason'] = 'bad_sig_format'
    return { valid: false, diagnostics: diag }
  }

  const poststamp = Number(match[1])
  const postDigest = match[2]
  const now = Date.now()
  diag['time_diff_ms'] = Math.abs(now - poststamp)

  if (Math.abs(now - poststamp) > FIVE_MINUTES) {
    diag['reason'] = 'expired'
    return { valid: false, diagnostics: diag }
  }

  // Variant A: body + timestamp (SDK default algorithm)
  const macA = createHmac('sha256', apiKey).update(rawBody + poststamp).digest('hex')
  // Variant B: timestamp + body (alternative order)
  const macB = createHmac('sha256', apiKey).update(String(poststamp) + rawBody).digest('hex')

  diag['expected_prefix'] = postDigest.substring(0, 16)
  diag['varA_body_ts_prefix'] = macA.substring(0, 16)
  diag['varB_ts_body_prefix'] = macB.substring(0, 16)

  const matchA = macA.length === postDigest.length &&
    timingSafeEqual(Buffer.from(macA), Buffer.from(postDigest))
  const matchB = macB.length === postDigest.length &&
    timingSafeEqual(Buffer.from(macB), Buffer.from(postDigest))

  if (matchA) diag['reason'] = 'matched_body_ts'
  else if (matchB) diag['reason'] = 'matched_ts_body'
  else diag['reason'] = 'hmac_mismatch'

  return { valid: matchA || matchB, diagnostics: diag }
}

export async function POST(req: Request) {
  // CR-04: Guard missing env var — undefined passed to crypto throws TypeError → HTTP 500
  const retellApiKey = process.env.RETELL_API_KEY
  if (!retellApiKey) {
    console.error('[webhook/retell] RETELL_API_KEY is not set — cannot verify signature')
    return new Response('Internal Server Error', { status: 500 })
  }

  // MUST call req.text() BEFORE req.json() — verify() needs the raw string body
  const rawBody = await req.text()
  const signature = req.headers.get('x-retell-signature') ?? ''

  // T-03-01: Verify HMAC signature before trusting any payload content
  const { valid: isValid, diagnostics } = verifyRetellHmac(rawBody, retellApiKey, signature)
  if (!isValid) {
    console.error('[voicedesk]', JSON.stringify({
      event: 'webhook.retell.signature_failed',
      full_signature: signature,
      body_length: rawBody.length,
      content_encoding: req.headers.get('content-encoding'),
      content_length: req.headers.get('content-length'),
      ...diagnostics,
    }))
    return new Response('Unauthorized', { status: 401 })
  }

  // WR-04: Guard malformed-but-authentic body
  let event: RetellWebhookEvent
  try {
    event = JSON.parse(rawBody) as RetellWebhookEvent
  } catch {
    console.error('[webhook/retell] malformed JSON body after signature verification')
    return new Response('Bad Request', { status: 400 })
  }

  // Return 200 immediately — critical architecture rule (CLAUDE.md)
  // All downstream processing deferred to after()
  after(async () => {
    try {
      if (event.event === 'call_ended') {
        await processCallEnded(event.call)
      } else if (event.event === 'call_analyzed') {
        await processCallAnalyzed(event.call)
      }
      // call_started, transcript_updated, transfer_* — no-op (not subscribed to these events)
    } catch (err) {
      console.error('[voicedesk]', JSON.stringify({
        event: 'webhook.retell.after.failed',
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      }))
    }
  })

  return new Response('OK', { status: 200 })
}

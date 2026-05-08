// src/app/api/webhooks/retell/route.ts
// Retell AI webhook handler — single route dispatching call_ended + call_analyzed events.
// D-01: Single route, dispatches by event.event type.
// CRITICAL: verify() called BEFORE parsing payload (req.text() not req.json()).
// CRITICAL: Returns HTTP 200 immediately — all downstream processing in after() (CLAUDE.md rule 2).
// Security: T-03-01 — verify() rejects forged webhooks with 401 before any payload access.
// Security: T-03-02 — contractor lookup by agent_id, never by contractor_id from payload.
import 'server-only'
import { after } from 'next/server'
import { verify } from 'retell-sdk'
import { processCallEnded, processCallAnalyzed } from './handlers'
import type { RetellWebhookEvent } from '@/lib/retell/webhook-types'

// Vercel segment config — after() budget must cover: 1 Supabase write + 1 Inngest send
export const maxDuration = 30
export const runtime = 'nodejs'

export async function POST(req: Request) {
  // MUST call req.text() BEFORE req.json() — verify() needs the raw string body
  const rawBody = await req.text()
  const signature = req.headers.get('x-retell-signature') ?? ''

  // T-03-01: Verify HMAC signature before trusting any payload content
  const isValid = await verify(rawBody, process.env.RETELL_API_KEY!, signature)
  if (!isValid) {
    console.error('[webhook/retell] invalid signature — rejecting request')
    return new Response('Unauthorized', { status: 401 })
  }

  const event = JSON.parse(rawBody) as RetellWebhookEvent

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
      console.error('[webhook/retell] after() processing error:', err instanceof Error ? err.message : err)
    }
  })

  return new Response('OK', { status: 200 })
}

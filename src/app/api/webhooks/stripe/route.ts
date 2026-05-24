// src/app/api/webhooks/stripe/route.ts
// Stripe webhook handler — processes checkout.session.completed, invoice.payment_failed, customer.subscription.updated.
// D-01: Single route, dispatches by event.type.
// CRITICAL: Verify signature BEFORE parsing payload (req.text() not req.json()).
// CRITICAL: Returns HTTP 200 immediately — all downstream processing in after() (CLAUDE.md rule 2).
// Security: T-07-02-01 — constructEvent() rejects forged webhooks with 401 before any payload access.
// Security: T-07-02-03 — Log all webhook events before processing, include external_id in logs.
import 'server-only'
import { after } from 'next/server'
import { getStripeClient } from '@/lib/stripe/client'
import {
  handleCheckoutCompleted,
  handlePaymentFailed,
  handleSubscriptionUpdated,
} from './handlers'
import type Stripe from 'stripe'

type StripeEvent = Stripe.Event
type CheckoutSession = Stripe.Checkout.Session
type Invoice = Stripe.Invoice
type Subscription = Stripe.Subscription

// Vercel segment config — after() budget must cover: 1 Supabase write + 1 Inngest send
export const maxDuration = 30
export const runtime = 'nodejs'

export async function POST(req: Request) {
  // CR-04: Guard missing env var — undefined passed to crypto throws TypeError → HTTP 500
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[webhook/stripe] STRIPE_WEBHOOK_SECRET is not set — cannot verify signature')
    return new Response('Internal Server Error', { status: 500 })
  }

  // MUST call req.text() BEFORE req.json() — constructEvent() needs the raw string body
  const rawBody = await req.text()
  const signature = req.headers.get('stripe-signature') ?? ''

  let event: StripeEvent

  // T-07-02-01: Verify Stripe signature before trusting any payload content
  try {
    const stripe = getStripeClient()
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    console.error(
      '[webhook/stripe] signature verification failed:',
      err instanceof Error ? err.message : err
    )
    return new Response('Unauthorized', { status: 401 })
  }

  // T-07-02-03: Log webhook event with external_id for traceability
  console.log(`[webhook/stripe] received event: ${event.type}, id: ${event.id}`)

  // Return 200 immediately — critical architecture rule (CLAUDE.md)
  // All downstream processing deferred to after()
  after(async () => {
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutCompleted(event.data.object as CheckoutSession)
          break
        case 'invoice.payment_failed':
          await handlePaymentFailed(event.data.object as Invoice)
          break
        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(
            event.data.object as Subscription,
            event.id  // CR-02: evt_... is unique per delivery; sub_... is not
          )
          break
        default:
          console.log(`[webhook/stripe] unhandled event type: ${event.type}`)
      }
    } catch (err) {
      console.error(
        '[webhook/stripe] after() processing error:',
        err instanceof Error ? err.message : err
      )
    }
  })

  return new Response('OK', { status: 200 })
}
// POST /api/stripe/checkout
// Creates a Stripe Checkout session for subscription with 14-day trial.
// Accepts: { tier: 'basic' | 'professional' | 'enterprise' }
// contractorId is derived from the authenticated session — never from the request body.
import 'server-only'
import { NextResponse } from 'next/server'
import { createCheckoutSession } from '@/lib/stripe/checkout'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

const TIER_PRICE_MAP: Record<string, string> = {
  basic: 'STRIPE_BASIC_PLAN_ID',
  professional: 'STRIPE_PROFESSIONAL_PLAN_ID',
  enterprise: 'STRIPE_ENTERPRISE_PLAN_ID',
}

export async function POST(request: Request) {
  try {
    // Auth guard: derive contractor from session, not request body
    const supabase = await createSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { tier } = body

    if (!tier) {
      return NextResponse.json({ error: 'Missing tier' }, { status: 400 })
    }

    if (!TIER_PRICE_MAP[tier]) {
      return NextResponse.json(
        { error: `Invalid tier: ${tier}. Must be basic, professional, or enterprise` },
        { status: 400 }
      )
    }

    const priceId = process.env[TIER_PRICE_MAP[tier]]
    if (!priceId) {
      console.error(`[stripe/checkout] missing price ID for tier: ${tier}`)
      return NextResponse.json({ error: `Price ID not configured for tier: ${tier}` }, { status: 500 })
    }

    // Derive contractorId from session — prevents IDOR
    const db = createServiceRoleClient()
    const { data: contractor, error: contractorError } = await db
      .from('contractors')
      .select('id, subscription_status')
      .eq('user_id', user.id)
      .maybeSingle()

    if (contractorError || !contractor) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })
    }

    const BLOCKED_STATUSES = ['active', 'trialing', 'past_due'] as const
    if (BLOCKED_STATUSES.includes(contractor.subscription_status as typeof BLOCKED_STATUSES[number])) {
      return NextResponse.json(
        { error: 'A subscription already exists for this account. Visit billing settings to manage your plan.' },
        { status: 400 }
      )
    }

    const checkoutUrl = await createCheckoutSession({
      contractorId: contractor.id,
      priceId,
    })

    return NextResponse.json({ url: checkoutUrl })
  } catch (error) {
    console.error('[stripe/checkout] error:', error)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}

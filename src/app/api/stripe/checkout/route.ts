// POST /api/stripe/checkout
// Creates a Stripe Checkout session for subscription with 14-day trial.
// Accepts: { contractorId: string, tier: 'basic' | 'professional' | 'enterprise' }
import 'server-only'
import { NextResponse } from 'next/server'
import { createCheckoutSession } from '@/lib/stripe/checkout'
import { createServiceRoleClient } from '@/lib/supabase/service'

// Map tier names to environment variable names for price IDs
const TIER_PRICE_MAP: Record<string, string> = {
  basic: 'STRIPE_BASIC_PLAN_ID',
  professional: 'STRIPE_PROFESSIONAL_PLAN_ID',
  enterprise: 'STRIPE_ENTERPRISE_PLAN_ID',
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { contractorId, tier } = body

    if (!contractorId || !tier) {
      return NextResponse.json(
        { error: 'Missing contractorId or tier' },
        { status: 400 }
      )
    }

    // Validate tier
    if (!TIER_PRICE_MAP[tier]) {
      return NextResponse.json(
        { error: `Invalid tier: ${tier}. Must be basic, professional, or enterprise` },
        { status: 400 }
      )
    }

    // Get price ID from environment variable
    const priceId = process.env[TIER_PRICE_MAP[tier]]
    if (!priceId) {
      console.error(`[stripe/checkout] missing price ID for tier: ${tier}`)
      return NextResponse.json(
        { error: `Price ID not configured for tier: ${tier}` },
        { status: 500 }
      )
    }

    // Verify contractor exists and is in correct state for checkout
    const db = createServiceRoleClient()
    const { data: contractor, error: contractorError } = await db
      .from('contractors')
      .select('id, subscription_status')
      .eq('id', contractorId)
      .maybeSingle()

    if (contractorError || !contractor) {
      return NextResponse.json(
        { error: 'Contractor not found' },
        { status: 404 }
      )
    }

    // Only block if they have an active subscription - allow trialing to proceed (e.g., upgrade flow)
    // Also allow if status is null/undefined (new subscriber)
    if (contractor.subscription_status === 'active') {
      return NextResponse.json(
        { error: 'Contractor already has an active subscription' },
        { status: 400 }
      )
    }

    // Create Stripe checkout session
    const checkoutUrl = await createCheckoutSession({
      contractorId,
      priceId,
    })

    return NextResponse.json({ url: checkoutUrl })
  } catch (error) {
    console.error('[stripe/checkout] error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
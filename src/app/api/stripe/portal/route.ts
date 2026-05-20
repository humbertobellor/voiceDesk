// src/app/api/stripe/portal/route.ts
// API route to create Stripe Customer Portal session.
// D-04: Customer portal for subscription management per CONTEXT.md decisions.
import { NextRequest, NextResponse } from 'next/server'
import { createPortalSession } from '@/lib/stripe/portal'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get contractor for this user
    const { data: contractor, error: contractorError } = await supabase
      .from('contractors')
      .select('id, stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (contractorError || !contractor) {
      return NextResponse.json(
        { error: 'Contractor not found' },
        { status: 404 }
      )
    }

    if (!contractor.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No Stripe customer found' },
        { status: 400 }
      )
    }

    // Create portal session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL
    if (!appUrl) {
      console.error('[stripe/portal] NEXT_PUBLIC_APP_URL / APP_URL env var is not set')
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
    }
    const returnUrl = new URL('/settings/account', appUrl).toString()

    const portalUrl = await createPortalSession({
      customerId: contractor.stripe_customer_id,
      returnUrl,
    })

    return NextResponse.json({ url: portalUrl })
  } catch (error) {
    console.error('[stripe/portal] Error creating session:', error)
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    )
  }
}
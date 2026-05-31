'use client'

import { useState, useEffect } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

const TIERS = [
  {
    id: 'basic',
    name: 'Basic',
    price: '$299',
    period: '/month',
    description: 'Perfect for small contractors',
    features: [
      'Up to 100 calls/month',
      'Basic analytics',
      'Email support',
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    price: '$499',
    period: '/month',
    description: 'Best for growing businesses',
    features: [
      'Unlimited calls',
      'Advanced analytics',
      'Priority support',
      'SMS notifications',
    ],
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$799',
    period: '/month',
    description: 'For large teams',
    features: [
      'Everything in Professional',
      'Dedicated account manager',
      'Custom integrations',
      'White-label options',
    ],
  },
]

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [contractorId, setContractorId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true) // Track initial data load

  useEffect(() => {
    // Get current user and their contractor ID
    const supabase = createSupabaseBrowser()
    supabase.auth.getUser()
      .then(({ data: { user } }) => {
        if (!user) {
          // Not logged in, redirect to signup
          window.location.href = '/auth/signup'
          return
        }
        // Query for contractor
        return supabase
          .from('contractors')
          .select('id, subscription_status')
          .eq('user_id', user.id)
          .maybeSingle()
          .then(({ data, error }) => {
            setIsLoading(false)
            if (error) {
              console.error('[pricing] error fetching contractor:', error)
              return
            }
            if (data) {
              setContractorId(data.id)
              // Only redirect if subscription is ACTIVE (not trialing, not setup in progress)
              // This allows users to resubscribe if their trial ended
              if (data.subscription_status === 'active') {
                window.location.href = '/dashboard'
              }
            }
          })
      })
      .catch((err: Error) => {
        // getUser() network failure — stop the infinite loading spinner
        setIsLoading(false)
        setError('Failed to load account details.')
        console.error({ error: 'getUser failed', message: err?.message })
      })
  }, [])

  const handleSubscribe = async (tier: string) => {
    if (!contractorId) {
      setError('No contractor found. Please complete phone setup first.')
      return
    }

    setLoading(tier)
    setError(null)

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to create checkout session')
      }

      // Redirect to Stripe
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(null)
    }
  }

  // Show loading while checking auth and subscription status
  if (isLoading) {
    return (
      <main className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-highlight" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-bg py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-fg-1 mb-4">
            Choose your plan
          </h1>
          <p className="text-lg text-fg-3">
            Start with a 14-day free trial. No credit card required.
          </p>
        </div>

        {error && (
          <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-4 text-center mb-8 max-w-md mx-auto">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`relative bg-bg-elevated border rounded-xl p-6 ${
                tier.popular
                  ? 'border-highlight ring-2 ring-highlight/20'
                  : 'border-rule'
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-highlight text-fg-on-dark text-xs font-bold px-3 py-1 rounded-full">
                  MOST POPULAR
                </div>
              )}

              <h2 className="text-xl font-semibold text-fg-1 mb-2">
                {tier.name}
              </h2>
              <div className="mb-4">
                <span className="text-3xl font-bold text-fg-1">
                  {tier.price}
                </span>
                <span className="text-fg-3">{tier.period}</span>
              </div>
              <p className="text-sm text-fg-3 mb-6">{tier.description}</p>

              <ul className="space-y-3 mb-6">
                {tier.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-fg-1">
                    <Check className="w-4 h-4 text-highlight" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleSubscribe(tier.id)}
                disabled={loading === tier.id || !contractorId}
                className={`w-full ${
                  tier.popular
                    ? 'bg-highlight text-fg-on-dark hover:bg-highlight/90'
                    : 'bg-rule text-fg-1 hover:bg-rule-strong'
                }`}
              >
                {loading === tier.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Start free trial'
                )}
              </Button>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-fg-3 mt-8">
          Cancel anytime. No questions asked.
        </p>
      </div>
    </main>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { CreditCard, ExternalLink, Loader2 } from 'lucide-react'

// D-04: Customer Portal accessible from account settings per CONTEXT.md decisions.

interface SubscriptionStatus {
  stripe_customer_id?: string | null
  subscription_status?: string | null
  trial_ends_at?: string | null
  is_active?: boolean
}

export default function AccountPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)

  // Load subscription data on mount
  useEffect(() => {
    async function loadSubscription() {
      try {
        const res = await fetch('/api/stripe/subscription')
        if (!res.ok) {
          // D-01: Differentiate load failure from "no subscription"
          setLoadError(true)
        } else {
          const data = await res.json()
          setSubscription(data)
        }
      } catch {
        // D-01: Network error also sets loadError
        setLoadError(true)
      } finally {
        setLoaded(true)
      }
    }
    loadSubscription()
  }, [])

  const handleManageSubscription = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to create portal session')
      }

      const data = await res.json()
      // Redirect to Stripe Customer Portal
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open portal')
      setIsLoading(false)
    }
  }

  const hasStripeCustomer = subscription?.stripe_customer_id && loaded

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-fg-on-dark mb-1">Account &amp; Billing</h1>
        <p className="text-sm text-fg-3">Manage your plan and billing details</p>
        <div className="border-b border-rule mt-6" />
      </div>

      {/* D-09: Deactivated service banner — shown when is_active=false */}
      {loaded && subscription?.is_active === false && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-red-300 mb-2">
            Service suspended. Update your payment method to restore your VoiceDesk agent.
          </p>
          <button
            onClick={handleManageSubscription}
            disabled={isLoading}
            className="px-4 py-2 bg-red-700 hover:bg-red-600 disabled:bg-fg-4 text-white text-sm font-medium rounded-md transition-colors"
          >
            {isLoading ? 'Opening...' : 'Update Payment'}
          </button>
        </div>
      )}

      {/* D-01: Load error banner — shown when fetch returned non-ok or threw */}
      {loaded && loadError && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 mb-6">
          <p className="text-sm text-red-400">Failed to load subscription details. Please refresh the page.</p>
        </div>
      )}

      {/* Subscription Status */}
      <div className="bg-bg-elevated rounded-lg p-4 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <CreditCard className="w-5 h-5 text-fg-4" />
          <span className="text-sm font-medium text-fg-on-dark">Subscription</span>
        </div>
        <div className="pl-8">
          <p className="text-sm text-fg-3">
            Status:{' '}
            <span
              className={`font-medium ${
                subscription?.subscription_status === 'active'
                  ? 'text-green-400'
                  : subscription?.subscription_status === 'past_due'
                  ? 'text-yellow-400'
                  : subscription?.subscription_status === 'trialing'
                  ? 'text-indigo-400'
                  : 'text-fg-3'
              }`}
            >
              {loaded ? (loadError ? '—' : subscription?.subscription_status ?? 'No subscription') : 'Loading...'}
            </span>
          </p>
          {/* D-02: Trial end date — shown only when trialing and trial_ends_at is set */}
          {loaded && subscription?.subscription_status === 'trialing' && subscription?.trial_ends_at && (
            <p className="text-xs text-fg-4 mt-1">
              Trial ends{' '}
              {new Date(subscription.trial_ends_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                timeZone: 'UTC',
              })}
            </p>
          )}
        </div>
      </div>

      {/* Manage Subscription Button */}
      <div className="bg-bg-elevated rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-fg-on-dark">Manage Subscription</h2>
            <p className="text-xs text-fg-3 mt-1">
              {hasStripeCustomer
                ? 'Update payment method, change plan, or cancel subscription'
                : 'No Stripe customer linked'}
            </p>
          </div>

          {loaded && hasStripeCustomer && (
            <button
              onClick={handleManageSubscription}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover disabled:bg-fg-4 text-white text-sm font-medium rounded-md transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Opening...
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4" />
                  Manage
                </>
              )}
            </button>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-400 mt-3 pl-14">{error}</p>
        )}
      </div>
      {/* D-03: Duplicate loading block removed — inline 'Loading...' in status span is the only indicator */}
    </div>
  )
}

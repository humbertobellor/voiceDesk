'use client'

import { useState } from 'react'
import { CreditCard, ExternalLink, Loader2 } from 'lucide-react'

// D-04: Customer Portal accessible from account settings per CONTEXT.md decisions.

interface SubscriptionStatus {
  stripe_customer_id?: string | null
  subscription_status?: string | null
}

export default function AccountPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null)
  const [loaded, setLoaded] = useState(false)

  // Load subscription data on mount
  useState(() => {
    async function loadSubscription() {
      try {
        const res = await fetch('/api/stripe/subscription')
        if (res.ok) {
          const data = await res.json()
          setSubscription(data)
        }
      } catch (err) {
        console.error('Failed to load subscription:', err)
      } finally {
        setLoaded(true)
      }
    }
    loadSubscription()
  })

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
        <h1 className="text-xl font-semibold text-[#F8FAFC] mb-1">Account & Billing</h1>
        <p className="text-sm text-[#94A3B8]">Manage your plan and billing details</p>
        <div className="border-b border-[#334155] mt-6" />
      </div>

      {/* Subscription Status */}
      <div className="bg-[#1E293B] rounded-lg p-4 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <CreditCard className="w-5 h-5 text-[#64748B]" />
          <span className="text-sm font-medium text-[#F8FAFC]">Subscription</span>
        </div>
        <div className="pl-8">
          <p className="text-sm text-[#94A3B8]">
            Status:{' '}
            <span
              className={`font-medium ${
                subscription?.subscription_status === 'active'
                  ? 'text-green-400'
                  : subscription?.subscription_status === 'past_due'
                  ? 'text-yellow-400'
                  : 'text-[#94A3B8]'
              }`}
            >
              {loaded ? subscription?.subscription_status ?? 'No subscription' : 'Loading...'}
            </span>
          </p>
        </div>
      </div>

      {/* Manage Subscription Button */}
      <div className="bg-[#1E293B] rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-[#F8FAFC]">Manage Subscription</h2>
            <p className="text-xs text-[#94A3B8] mt-1">
              {hasStripeCustomer
                ? 'Update payment method, change plan, or cancel subscription'
                : 'No Stripe customer linked'}
            </p>
          </div>

          {loaded && hasStripeCustomer && (
            <button
              onClick={handleManageSubscription}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-[#3B82F6] hover:bg-[#2563EB] disabled:bg-[#64748B] text-white text-sm font-medium rounded-md transition-colors"
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

      {!loaded && (
        <div className="text-center py-8 text-[#64748B]">
          Loading subscription details...
        </div>
      )}
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { OnboardingWizard } from './OnboardingWizard'

interface OnboardingWizardWrapperProps {
  contractorId: string
}

export function OnboardingWizardWrapper({ contractorId }: OnboardingWizardWrapperProps) {
  const [showWizard, setShowWizard] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkSubscriptionStatus()
  }, [contractorId])

  const checkSubscriptionStatus = async () => {
    try {
      const response = await fetch(`/api/contractor/status?contractor_id=${contractorId}`)
      if (response.ok) {
        const data = await response.json()
        // Show wizard if subscription is not active
        if (data.subscription_status !== 'active') {
          setShowWizard(true)
        }
      }
    } catch (error) {
      console.error('Failed to check subscription status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = () => {
    setShowWizard(false)
  }

  if (loading) {
    return null // Don't render anything while checking
  }

  if (!showWizard) {
    return null
  }

  return <OnboardingWizard contractorId={contractorId} onComplete={handleComplete} />
}
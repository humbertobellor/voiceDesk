'use client'

import { useState, useEffect } from 'react'
import { OnboardingWizard } from './OnboardingWizard'

interface OnboardingWizardWrapperProps {
  contractorId: string
  voiceDeskNumber?: string | null
}

export function OnboardingWizardWrapper({ contractorId, voiceDeskNumber }: OnboardingWizardWrapperProps) {
  const [showWizard, setShowWizard] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkSubscriptionStatus()
  }, [])

  const checkSubscriptionStatus = async () => {
    try {
      const response = await fetch('/api/contractor/status')
      if (response.ok) {
        const data = await response.json()
        // Show wizard only if not yet live AND subscription is not active
        if (!data.is_live && data.subscription_status !== 'active') {
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
    return null
  }

  if (!showWizard) {
    return null
  }

  return (
    <OnboardingWizard
      contractorId={contractorId}
      voiceDeskNumber={voiceDeskNumber}
      onComplete={handleComplete}
    />
  )
}

'use client'

import { useState, useEffect } from 'react'
import { Phone, CheckCircle, Loader2, PhoneIncoming, Wifi, WifiOff } from 'lucide-react'
import { useTestCallVerification } from '@/lib/realtime/testCallVerification'
import { markContractorLive } from '@/app/actions/onboarding'

interface TestCallStepProps {
  contractorId: string
  voiceDeskNumber?: string
  onComplete?: () => void
  onVerified?: () => void // Callback when test call is detected
}

export function TestCallStep({ contractorId, voiceDeskNumber = '+1 (555) 123-4567', onComplete, onVerified }: TestCallStepProps) {
  const [status, setStatus] = useState<'waiting' | 'detecting' | 'verified'>('waiting')

  // Use Supabase Realtime subscription for test call detection
  const { isConnected, testCallDetected, subscriptionStatus } = useTestCallVerification({
    contractorId,
    onTestCallDetected: async (callId) => {
      setStatus('verified')
      onVerified?.() // Notify parent component that verification is complete

      // FIXED: Mark contractor as live in database
      const result = await markContractorLive(contractorId)
      if (!result.ok) {
        console.error('[TestCallStep] failed to mark contractor as live:', result.error)
      }
    }
  })

  // Auto-advance after verification
  useEffect(() => {
    if (status === 'verified' && onComplete) {
      const timer = setTimeout(() => {
        onComplete()
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [status, onComplete])

  const handleStartTest = () => {
    setStatus('detecting')
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-white mb-1">Test Call</h3>
        <p className="text-sm text-gray-400">Make a test call to verify your VoiceDesk setup is working correctly.</p>
      </div>

      {status === 'verified' ? (
        <div className="p-6 bg-green-900/20 rounded-xl border border-green-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/20 rounded-full">
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-white font-medium">Test Call Verified!</p>
              <p className="text-sm text-green-300 mt-1">
                Your VoiceDesk is now live. Customers can call your business number.
              </p>
            </div>
          </div>

          <button
            onClick={onComplete}
            className="mt-6 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
          >
            Complete Setup
          </button>
        </div>
      ) : status === 'detecting' ? (
        <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700">
          <div className="flex items-center gap-4">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
            <div className="flex-1">
              <p className="text-white font-medium">Listening for calls...</p>
              <p className="text-sm text-gray-400 mt-1">
                Call your VoiceDesk number now. We'll detect when the call connects.
              </p>
            </div>
            {/* Connection status indicator */}
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <Wifi className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-green-400">Realtime</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs text-yellow-400">Polling</span>
                </>
              )}
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-900/20 rounded-lg border border-blue-700">
            <p className="text-center text-2xl font-bold text-blue-400">{voiceDeskNumber}</p>
            <p className="text-center text-sm text-gray-400 mt-2">Call this number to test</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Phone Number to Call */}
          <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700">
            <div className="flex items-center gap-4 mb-4">
              <PhoneIncoming className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-white font-medium">Call Your VoiceDesk Number</p>
                <p className="text-sm text-gray-400">We'll detect when you call and verify everything is working.</p>
              </div>
            </div>

            <div className="p-4 bg-blue-900/20 rounded-lg border border-blue-700">
              <p className="text-center text-3xl font-bold text-blue-400">{voiceDeskNumber}</p>
            </div>
          </div>

          {/* Start Test Button */}
          <button
            onClick={handleStartTest}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            I've Called - Detect Test Call
          </button>
        </div>
      )}
    </div>
  )
}
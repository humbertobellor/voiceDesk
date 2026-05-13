'use client'

import { useState, useEffect } from 'react'
import { Phone, CheckCircle, Loader2, PhoneIncoming } from 'lucide-react'

interface TestCallStepProps {
  contractorId: string
  voiceDeskNumber?: string
  onComplete?: () => void
}

export function TestCallStep({ contractorId, voiceDeskNumber = '+1 (555) 123-4567', onComplete }: TestCallStepProps) {
  const [status, setStatus] = useState<'waiting' | 'detecting' | 'verified'>('waiting')
  const [polling, setPolling] = useState(false)

  // Poll for test call verification (stub - full Realtime integration in Plan 4)
  useEffect(() => {
    if (status === 'detecting') {
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`/api/test-call/verify?contractor_id=${contractorId}`)
          if (response.ok) {
            const data = await response.json()
            if (data.verified) {
              setStatus('verified')
              clearInterval(interval)
            }
          }
        } catch (error) {
          // Continue polling
        }
      }, 3000)

      return () => clearInterval(interval)
    }
  }, [status, contractorId])

  const handleStartTest = () => {
    setStatus('detecting')
    setPolling(true)
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
            <div>
              <p className="text-white font-medium">Waiting for Test Call...</p>
              <p className="text-sm text-gray-400 mt-1">
                Call your VoiceDesk number now. We'll detect when the call connects.
              </p>
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

          {/* Placeholder Note */}
          <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700">
            <p className="text-sm text-gray-400">
              <strong>Note:</strong> Full Realtime call detection will be implemented in Plan 4.
              This is a UI stub to guide the onboarding flow.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
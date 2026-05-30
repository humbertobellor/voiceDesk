'use client'
// src/app/(dashboard)/settings/go-live/page.tsx
// Test call detection + markContractorLive + already-live confirmation state.
// D-14, D-15: Uses useTestCallVerification with enabled gate; handles is_live = true gracefully.
import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, Loader2, Phone, PhoneIncoming, Wifi, WifiOff } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { useContractor } from '@/contexts/ContractorContext'
import { useTestCallVerification } from '@/lib/realtime/testCallVerification'
import { markContractorLive } from '@/app/actions/onboarding'

type GoLiveStatus = 'loading' | 'already-live' | 'waiting' | 'detecting' | 'verified'

export default function GoLivePage() {
  const { contractorId } = useContractor()
  const [status, setStatus] = useState<GoLiveStatus>('loading')
  const [twilioNumber, setTwilioNumber] = useState<string | null>(null)

  // Fetch contractor state on mount
  useEffect(() => {
    if (!contractorId) return

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    async function fetchContractor() {
      const { data, error } = await supabase
        .from('contractors')
        .select('twilio_number, is_live')
        .eq('id', contractorId!)
        .maybeSingle()

      if (error || !data) {
        setStatus('waiting') // degrade gracefully; user can try the test call
        return
      }
      setTwilioNumber(data.twilio_number ?? null)
      setStatus(data.is_live === true ? 'already-live' : 'waiting')
    }

    fetchContractor()
  }, [contractorId])

  const handleTestCallDetected = useCallback(async (_callId: string) => {
    if (!contractorId) return
    const result = await markContractorLive(contractorId)
    if (result.ok) {
      setStatus('verified')
    } else {
      console.error('[GoLive] markContractorLive failed:', result.error)
      setStatus('waiting')
    }
  }, [contractorId])

  const { isConnected, subscriptionStatus } = useTestCallVerification({
    contractorId: contractorId ?? '',
    enabled: status === 'detecting' && !!contractorId,
    onTestCallDetected: handleTestCallDetected,
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-fg-on-dark mb-1">Go Live</h1>
        <p className="text-sm text-fg-3">
          Make a test call to verify your setup, then activate your VoiceDesk.
        </p>
        <div className="border-b border-rule mt-6" />
      </div>

      {/* Loading state */}
      {status === 'loading' && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-fg-4" />
        </div>
      )}

      {/* Already-live state */}
      {status === 'already-live' && (
        <div className="bg-bg-elevated rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
            <div>
              <h2 className="text-lg font-semibold text-fg-on-dark">You're Live!</h2>
              <p className="text-sm text-fg-3">
                Your VoiceDesk is active. Customers calling your business number are being answered by your AI receptionist.
              </p>
            </div>
          </div>
          {twilioNumber && (
            <div className="mt-4 border-t border-rule pt-4">
              <p className="text-xs text-fg-3 mb-1">Your VoiceDesk Number</p>
              <p className="text-xl font-bold text-highlight">{twilioNumber}</p>
            </div>
          )}
        </div>
      )}

      {/* Waiting state */}
      {status === 'waiting' && (
        <div className="space-y-4">
          {twilioNumber && (
            <div className="bg-bg-elevated rounded-lg p-4">
              <p className="text-xs text-fg-3 mb-1">Your VoiceDesk Number</p>
              <p className="text-2xl font-bold text-highlight">{twilioNumber}</p>
              <p className="text-sm text-fg-3 mt-2">
                Make sure call forwarding is set up from your business number to the number above.
              </p>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Phone className="w-5 h-5 text-fg-4" />
            <p className="text-sm text-fg-3">
              Forward your business number to your VoiceDesk number, then call it to make a test call.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStatus('detecting')}
            className="w-full sm:w-auto px-6 py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg transition-colors min-h-[48px]"
          >
            I've Called — Detect Test Call
          </button>
        </div>
      )}

      {/* Detecting state */}
      {status === 'detecting' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-accent" />
            <span className="text-sm text-fg-on-dark font-medium">Listening for calls...</span>
          </div>

          <div className="flex items-center gap-2">
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4 text-green-400" />
                <span className="text-xs text-green-400">Realtime connected</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-yellow-400">
                  {subscriptionStatus === 'error' ? 'Polling' : 'Connecting...'}
                </span>
              </>
            )}
          </div>

          {twilioNumber && (
            <div className="bg-bg-elevated rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <PhoneIncoming className="w-4 h-4 text-fg-4" />
                <p className="text-xs text-fg-3">Waiting for call to</p>
              </div>
              <p className="text-xl font-bold text-highlight">{twilioNumber}</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setStatus('waiting')}
            className="text-sm text-fg-3 hover:text-fg-on-dark underline"
          >
            Cancel and try again
          </button>
        </div>
      )}

      {/* Verified state */}
      {status === 'verified' && (
        <div className="bg-bg-elevated rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-8 h-8 text-green-400" />
            <div>
              <h2 className="text-lg font-semibold text-fg-on-dark">Test Call Verified!</h2>
              <p className="text-sm text-fg-3">Your VoiceDesk is now live.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

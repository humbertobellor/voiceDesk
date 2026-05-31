'use client'
// src/app/(dashboard)/settings/phone/page.tsx
// Two-state VoiceDesk number page:
//   State A (twilio_number is null)  — area-code input + "Provision My Number" button
//   State B (twilio_number is set)   — number display + carrier call-forwarding instructions
// Security invariant: fetch body sends { area_code } only; contractor_id is never included.
// The API (create/route.ts line 26-27) derives contractor_id from supabase.auth.getUser().
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Phone, Copy, Check, PhoneForwarded, Loader2 } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { useContractor } from '@/contexts/ContractorContext'

const CARRIERS = [
  { id: 'att', name: 'AT&T', code: '*72', instructions: 'Dial *72 followed by the phone number' },
  { id: 'verizon', name: 'Verizon', code: '*72', instructions: 'Dial *72 followed by the phone number' },
  { id: 'tmobile', name: 'T-Mobile', code: '**21*', instructions: 'Dial **21* then the full number then # and press Call (e.g. **21*+13055551234#)' },
  { id: 'other', name: 'Other', code: 'varies', instructions: 'Check with your carrier for unconditional call forwarding codes' },
]

export default function PhoneSettingsPage() {
  const { contractorId } = useContractor()
  const router = useRouter()
  const [twilioNumber, setTwilioNumber] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [areaCode, setAreaCode] = useState('')
  const [isProvisioning, setIsProvisioning] = useState(false)
  const [provisionError, setProvisionError] = useState<string | null>(null)

  useEffect(() => {
    if (!contractorId) return

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    async function fetchNumber() {
      const { data, error } = await supabase
        .from('contractors')
        .select('twilio_number')
        .eq('id', contractorId!)
        .maybeSingle()
      if (error) return
      if (data) setTwilioNumber(data.twilio_number ?? null)
    }

    fetchNumber()
  }, [contractorId])

  const handleCopy = () => {
    if (!twilioNumber) return
    navigator.clipboard.writeText(twilioNumber)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleProvision() {
    if (!areaCode.match(/^\d{3}$/)) {
      setProvisionError('Enter a valid 3-digit area code.')
      return
    }
    setIsProvisioning(true)
    setProvisionError(null)
    try {
      const res = await fetch('/api/provisioning/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area_code: areaCode }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok) {
        // CR-04: Guard against missing twilio_number in response (API change or proxy mangle)
        if (!json?.twilio_number) {
          setProvisionError('Provisioning succeeded but number was not returned. Refresh the page.')
          return
        }
        setTwilioNumber(json.twilio_number)
        router.refresh()   // Triggers layout re-run so Sidebar picks up new number
        return
      }
      if (res.status === 409) {
        setProvisionError('Number already provisioned — refresh page.')
      } else if (res.status === 422) {
        // WR-03: Use the API error message so the correct reason is shown (area code vs onboarding)
        setProvisionError(json.error ?? 'Area code unavailable. Try: 786, 954, or 561.')
      } else {
        setProvisionError(json.error ?? 'Provisioning failed. Please try again.')
      }
    } catch {
      setProvisionError('Network error. Please try again.')
    } finally {
      setIsProvisioning(false)
    }
  }

  const digitsOnly = twilioNumber?.replace(/\D/g, '') ?? ''

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-fg-1 mb-1">Phone Number</h1>
        <p className="text-sm text-fg-3">
          Your dedicated VoiceDesk number and call forwarding instructions.
        </p>
        <div className="border-b border-rule mt-6" />
      </div>

      {/* Section A — VoiceDesk Number Display */}
      <div className="bg-bg-elevated rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Phone className="w-4 h-4 text-fg-4" />
          <span className="text-sm text-fg-3">Your VoiceDesk Number</span>
        </div>
        <div className="flex items-center gap-3">
          {twilioNumber ? (
            <>
              <span className="text-2xl font-bold text-highlight">{twilioNumber}</span>
              <button
                type="button"
                onClick={handleCopy}
                aria-label="Copy phone number"
                className="p-1.5 rounded-md text-fg-3 hover:text-fg-1 hover:bg-rule transition-colors"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </>
          ) : (
            <div className="w-full">
              <p className="text-sm text-fg-3 mb-3">
                No number assigned yet. Enter your preferred area code to provision your VoiceDesk number.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={3}
                  placeholder="305"
                  value={areaCode}
                  onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  aria-label="Area code"
                  className="w-20 px-3 py-2 bg-bg border border-rule rounded-md text-fg-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-highlight focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={handleProvision}
                  disabled={isProvisioning || areaCode.length !== 3}
                  className="flex items-center gap-2 px-4 py-2 bg-highlight hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-fg-on-dark text-sm font-semibold rounded-md transition-colors"
                >
                  {isProvisioning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Provisioning...
                    </>
                  ) : (
                    'Provision My Number'
                  )}
                </button>
              </div>
              {provisionError && (
                <p role="alert" className="mt-2 text-sm text-danger">{provisionError}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Section B — Carrier Forwarding Instructions (only shown when number is provisioned) */}
      {twilioNumber && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <PhoneForwarded className="w-4 h-4 text-fg-4" />
            <h2 className="text-sm font-semibold text-fg-1">Call Forwarding Setup</h2>
          </div>
          <p className="text-sm text-fg-3 mb-4">
            Forward calls from your existing business number to your VoiceDesk number using these carrier codes.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CARRIERS.map((carrier) => (
              <div key={carrier.id} className="bg-bg-elevated rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-fg-1">{carrier.name}</span>
                  <code className="text-xs bg-bg text-highlight px-2 py-0.5 rounded font-mono">
                    {carrier.code}
                  </code>
                </div>
                <p className="text-xs text-fg-3 mb-2">{carrier.instructions}</p>
                {carrier.code !== 'varies' && (
                  <p className="text-xs text-fg-4 font-mono">
                    Example: {carrier.code}{digitsOnly}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Advisory box */}
          <div className="mt-4 bg-highlight/10 border border-highlight/30 rounded-lg p-4">
            <p className="text-xs text-highlight">
              After entering the forwarding code, wait for a confirmation tone or message.
              Test by calling your old business number — it should ring your VoiceDesk number.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

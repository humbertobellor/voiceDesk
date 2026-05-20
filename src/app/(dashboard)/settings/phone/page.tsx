'use client'
// src/app/(dashboard)/settings/phone/page.tsx
// Read-only VoiceDesk number display + carrier call-forwarding instructions.
// D-11: No provisioning or edit controls — number is assigned during onboarding.
import { useState, useEffect } from 'react'
import { Phone, Copy, Check, PhoneForwarded } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { useContractor } from '@/contexts/ContractorContext'

const CARRIERS = [
  { id: 'att', name: 'AT&T', code: '*72', instructions: 'Dial *72 followed by the phone number' },
  { id: 'verizon', name: 'Verizon', code: '*72', instructions: 'Dial *72 followed by the phone number' },
  { id: 'tmobile', name: 'T-Mobile', code: '##21#', instructions: 'Dial ##21# followed by the phone number and call button' },
  { id: 'other', name: 'Other', code: 'varies', instructions: 'Check with your carrier for unconditional call forwarding codes' },
]

export default function PhoneSettingsPage() {
  const { contractorId } = useContractor()
  const [twilioNumber, setTwilioNumber] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!contractorId) return

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    async function fetchNumber() {
      const { data } = await supabase
        .from('contractors')
        .select('twilio_number')
        .eq('id', contractorId!)
        .maybeSingle()
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

  const digitsOnly = twilioNumber?.replace(/\D/g, '') ?? ''

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#F8FAFC] mb-1">Phone Number</h1>
        <p className="text-sm text-[#94A3B8]">
          Your dedicated VoiceDesk number and call forwarding instructions.
        </p>
        <div className="border-b border-[#334155] mt-6" />
      </div>

      {/* Section A — VoiceDesk Number Display */}
      <div className="bg-[#1E293B] rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Phone className="w-4 h-4 text-[#64748B]" />
          <span className="text-sm text-[#94A3B8]">Your VoiceDesk Number</span>
        </div>
        <div className="flex items-center gap-3">
          {twilioNumber ? (
            <>
              <span className="text-2xl font-bold text-[#F97316]">{twilioNumber}</span>
              <button
                type="button"
                onClick={handleCopy}
                aria-label="Copy phone number"
                className="p-1.5 rounded-md text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#334155] transition-colors"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </>
          ) : (
            <span className="text-2xl font-bold text-[#64748B]">Not yet provisioned</span>
          )}
        </div>
      </div>

      {/* Section B — Carrier Forwarding Instructions */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <PhoneForwarded className="w-4 h-4 text-[#64748B]" />
          <h2 className="text-sm font-semibold text-[#F8FAFC]">Call Forwarding Setup</h2>
        </div>
        <p className="text-sm text-[#94A3B8] mb-4">
          Forward calls from your existing business number to your VoiceDesk number using these carrier codes.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CARRIERS.map((carrier) => (
            <div key={carrier.id} className="bg-[#1E293B] rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-[#F8FAFC]">{carrier.name}</span>
                <code className="text-xs bg-[#0F172A] text-[#F97316] px-2 py-0.5 rounded font-mono">
                  {carrier.code}
                </code>
              </div>
              <p className="text-xs text-[#94A3B8] mb-2">{carrier.instructions}</p>
              {twilioNumber && carrier.code !== 'varies' && (
                <p className="text-xs text-[#64748B] font-mono">
                  Example: {carrier.code}{digitsOnly}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Advisory box */}
        <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <p className="text-xs text-yellow-300">
            After entering the forwarding code, wait for a confirmation tone or message.
            Test by calling your old business number — it should ring your VoiceDesk number.
          </p>
        </div>
      </div>
    </div>
  )
}

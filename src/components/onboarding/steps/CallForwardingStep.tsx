'use client'

import { useState } from 'react'
import { PhoneForwarded, Check, Copy } from 'lucide-react'

interface CallForwardingStepProps {
  contractorId: string
  voiceDeskNumber?: string
  onComplete?: () => void
}

const CARRIERS = [
  { id: 'att', name: 'AT&T', code: '*72', instructions: 'Dial *72 followed by the phone number' },
  { id: 'verizon', name: 'Verizon', code: '*72', instructions: 'Dial *72 followed by the phone number' },
  { id: 'tmobile', name: 'T-Mobile', code: '##21#', instructions: 'Dial ##21# followed by the phone number and call button' },
  { id: 'other', name: 'Other', code: 'varies', instructions: 'Check with your carrier for unconditional call forwarding codes' }
]

export function CallForwardingStep({ contractorId, voiceDeskNumber = '+1 (555) 123-4567', onComplete }: CallForwardingStepProps) {
  const [confirmed, setConfirmed] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyNumber = () => {
    navigator.clipboard.writeText(voiceDeskNumber.replace(/\D/g, ''))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-white mb-1">Call Forwarding</h3>
        <p className="text-sm text-gray-400">Set up call forwarding from your existing business number to your VoiceDesk number.</p>
      </div>

      {/* VoiceDesk Number Display */}
      <div className="p-6 bg-blue-900/20 rounded-xl border border-blue-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400 mb-1">Your VoiceDesk Number</p>
            <p className="text-2xl font-bold text-blue-400">{voiceDeskNumber}</p>
          </div>
          <button
            onClick={copyNumber}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Copy number"
          >
            {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Carrier Instructions */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <PhoneForwarded className="w-5 h-5 text-gray-400" />
          <p className="text-sm font-medium text-white">Forwarding Codes by Carrier</p>
        </div>

        <div className="grid gap-3">
          {CARRIERS.map((carrier) => (
            <div
              key={carrier.id}
              className="p-4 bg-gray-800/50 rounded-lg border border-gray-700"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-white">{carrier.name}</span>
                <code className="px-2 py-1 bg-gray-700 rounded text-sm text-blue-400 font-mono">
                  {carrier.code}
                </code>
              </div>
              <p className="text-sm text-gray-400">{carrier.instructions}</p>
              {voiceDeskNumber && (
                <p className="text-sm text-blue-300 mt-2 font-mono">
                  Example: {carrier.code}{voiceDeskNumber.replace(/\D/g, '')}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="p-4 bg-yellow-900/20 rounded-lg border border-yellow-700">
        <p className="text-sm text-yellow-200">
          <strong>Important:</strong> After entering the forwarding code, wait for a confirmation tone or message.
          Test by calling your old business number - it should ring your VoiceDesk number.
        </p>
      </div>

      {/* Confirmation Checkbox */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-300">
            I've set up call forwarding on my business phone
          </span>
        </label>
      </div>

      <button
        onClick={onComplete}
        disabled={!confirmed}
        className={`px-6 py-2.5 font-medium rounded-lg transition-colors ${
          confirmed
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
        }`}
      >
        Continue
      </button>
    </div>
  )
}
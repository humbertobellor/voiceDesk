'use client'

import { useState, useEffect } from 'react'
import { Phone, Check, Loader2, AlertCircle } from 'lucide-react'
import { createSupabaseBrowser } from '@/lib/supabase/browser'

interface PhoneProvisioningStepProps {
  contractorId: string
  onComplete?: () => void
}

interface ProvisionedNumber {
  phoneNumber: string
  sid: string
}

interface ContractorData {
  area_code: string | null
}

export function PhoneProvisioningStep({ contractorId, onComplete }: PhoneProvisioningStepProps) {
  const [status, setStatus] = useState<'idle' | 'provisioning' | 'ready' | 'error'>('idle')
  const [provisionedNumber, setProvisionedNumber] = useState<ProvisionedNumber | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [contractorData, setContractorData] = useState<ContractorData | null>(null)
  const [loadingAreaCode, setLoadingAreaCode] = useState(true)

  useEffect(() => {
    fetchContractorData()
  }, [contractorId])

  const fetchContractorData = async () => {
    try {
      const supabase = createSupabaseBrowser()
      const { data: contractor } = await supabase
        .from('contractors')
        .select('area_code')
        .eq('id', contractorId)
        .maybeSingle()
      if (contractor?.area_code) {
        setContractorData(contractor)
      }
    } catch (err) {
      console.error('Failed to fetch contractor data:', err)
    } finally {
      setLoadingAreaCode(false)
    }
  }

  const handleProvision = async () => {
    if (!contractorData?.area_code) {
      setError('Area code not configured. Please go back and set your area code in agent settings.')
      setStatus('error')
      return
    }

    setStatus('provisioning')
    setError(null)

    try {
      const response = await fetch('/api/provisioning/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractor_id: contractorId,
          area_code: contractorData.area_code
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to provision phone number')
      }

      setProvisionedNumber({
        phoneNumber: data.twilio_number,
        sid: data.twilio_number
      })
      setStatus('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setStatus('error')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-white mb-1">Phone Number</h3>
        <p className="text-sm text-gray-400">Provision a dedicated VoiceDesk phone number for your business.</p>
      </div>

      <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700">
        {status === 'ready' && provisionedNumber ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/20 rounded-full">
                <Check className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-white font-medium">Phone Number Ready</p>
                <p className="text-2xl font-bold text-blue-400 mt-1">{provisionedNumber.phoneNumber}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-700">
              <p className="text-sm text-gray-400">
                This is your dedicated VoiceDesk number. Calls to this number will be answered by your AI receptionist.
              </p>
            </div>

            <button
              onClick={onComplete}
              className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
            >
              Continue
            </button>
          </div>
        ) : status === 'provisioning' ? (
          <div className="flex items-center gap-4">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
            <div>
              <p className="text-white font-medium">Provisioning Phone Number...</p>
              <p className="text-sm text-gray-400">This may take up to 30 seconds</p>
            </div>
          </div>
        ) : status === 'error' ? (
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
            <div>
              <p className="text-white font-medium">Provisioning Failed</p>
              <p className="text-sm text-gray-400 mt-1">{error}</p>
              <button
                onClick={() => setStatus('idle')}
                className="mt-3 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : loadingAreaCode ? (
          <div className="flex items-center gap-4">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
            <div>
              <p className="text-white font-medium">Loading...</p>
              <p className="text-sm text-gray-400">Fetching your area code</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-blue-400 mt-0.5" />
              <div>
                <p className="text-white font-medium">Provision VoiceDesk Number</p>
                <p className="text-sm text-gray-400 mt-1">
                  We'll assign a dedicated phone number to your business. This number will be used by customers to reach your AI receptionist.
                </p>
              </div>
            </div>

            <button
              onClick={handleProvision}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              <Phone className="w-4 h-4" />
              Provision Phone Number
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
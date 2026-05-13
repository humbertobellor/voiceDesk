'use client'

import { useState, useEffect } from 'react'
import { Calendar, Check, ExternalLink, Loader2 } from 'lucide-react'

interface CalendarConnectStepProps {
  contractorId: string
  onComplete?: () => void
}

export function CalendarConnectStep({ contractorId, onComplete }: CalendarConnectStepProps) {
  const [status, setStatus] = useState<'pending' | 'connecting' | 'connected'>('pending')
  const [calendarEmail, setCalendarEmail] = useState<string | null>(null)

  useEffect(() => {
    // Check if calendar is already connected
    checkCalendarStatus()
  }, [contractorId])

  const checkCalendarStatus = async () => {
    try {
      const response = await fetch(`/api/calendar/status?contractor_id=${contractorId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.connected) {
          setStatus('connected')
          setCalendarEmail(data.email)
        }
      }
    } catch (error) {
      console.error('Failed to check calendar status:', error)
    }
  }

  const handleConnect = () => {
    setStatus('connecting')
    // Redirect to Google OAuth
    window.location.href = `/api/auth/google/initiate?contractor_id=${contractorId}&redirect=/dashboard/onboarding`
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-white mb-1">Google Calendar</h3>
        <p className="text-sm text-gray-400">Connect your Google Calendar so VoiceDesk can check availability and book appointments.</p>
      </div>

      <div className="p-6 bg-gray-800/50 rounded-xl border border-gray-700">
        {status === 'connected' ? (
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/20 rounded-full">
              <Check className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-white font-medium">Calendar Connected</p>
              <p className="text-sm text-gray-400">{calendarEmail}</p>
            </div>
          </div>
        ) : status === 'connecting' ? (
          <div className="flex items-center gap-4">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
            <div>
              <p className="text-white font-medium">Connecting...</p>
              <p className="text-sm text-gray-400">Redirecting to Google sign-in</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-blue-400 mt-0.5" />
              <div>
                <p className="text-white font-medium">Connect Google Calendar</p>
                <p className="text-sm text-gray-400 mt-1">
                  VoiceDesk needs access to your calendar to check availability and book appointments on your behalf.
                </p>
              </div>
            </div>

            <button
              onClick={handleConnect}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Connect Google Calendar
            </button>
          </div>
        )}
      </div>

      {status === 'connected' && (
        <div className="flex items-center gap-3">
          <button
            onClick={onComplete}
            className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
          >
            Continue
          </button>
        </div>
      )}
    </div>
  )
}
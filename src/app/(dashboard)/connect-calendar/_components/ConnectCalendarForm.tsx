// src/app/(dashboard)/connect-calendar/_components/ConnectCalendarForm.tsx
// Client component — Google Calendar connect button with success/error feedback.
// D-01: Minimal UI — button + connection status. Phase 6 replaces with full Settings section.
// D-03: Success redirected from /dashboard?calendarConnected=1 — this page does not handle success params.
// Clicking the button navigates to /api/auth/google/initiate which handles the OAuth redirect.
'use client'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ConnectCalendarFormProps {
  isConnected: boolean
}

export function ConnectCalendarForm({ isConnected }: ConnectCalendarFormProps) {
  const [isNavigating, setIsNavigating] = useState(false)

  const handleConnect = () => {
    setIsNavigating(true)
    window.location.href = '/api/auth/google/initiate'
  }

  return (
    <div className="bg-bg-elevated border border-rule rounded-xl p-6 max-w-[480px]">
      {isConnected && (
        <div
          role="status"
          className="bg-success/10 border border-success/30 text-success rounded-lg p-3 text-sm mb-4"
        >
          Google Calendar is connected. Click below to reconnect if needed.
        </div>
      )}
      <p className="text-sm text-fg-3 mb-4">
        Connect your Google Calendar to allow Koolable to book estimate appointments automatically.
        Your calendar events will only be created — not read or deleted.
      </p>
      <Button
        disabled={isNavigating}
        className="bg-highlight text-fg-on-dark hover:bg-highlight/90 min-h-[44px] font-semibold w-full"
        onClick={handleConnect}
      >
        {isNavigating
          ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Redirecting to Google...</>
          : isConnected
            ? 'Reconnect Google Calendar'
            : 'Connect Google Calendar'
        }
      </Button>
    </div>
  )
}

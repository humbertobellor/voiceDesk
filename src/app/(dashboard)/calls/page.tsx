'use client'

import { useState } from 'react'
import { useContractor } from '@/contexts/ContractorContext'
import { useCallsSubscription } from '@/lib/realtime/callsSubscription'
import { CallLogTable } from '@/components/calls/CallLogTable'
import { CallPlaybackModal } from '@/components/calls/CallPlaybackModal'

export default function CallsPage() {
  const { contractorId } = useContractor()
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null)
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')

  // Set up real-time subscription
  useCallsSubscription(contractorId ?? '', (callId) => {
    // New call arrived - could show a notification
    console.log('New call:', callId)
  })

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-fg-on-dark mb-1">Calls</h1>
            <p className="text-sm text-fg-3">Recent inbound calls</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success flex-shrink-0"></span>
            <span className="text-xs text-fg-3">Live</span>
          </div>
        </div>
        <div className="border-b border-rule mt-6" />
      </div>

      <CallLogTable onCallClick={(callId) => setSelectedCallId(callId)} />

      {selectedCallId && (
        <CallPlaybackModal
          callId={selectedCallId}
          onClose={() => setSelectedCallId(null)}
        />
      )}
    </div>
  )
}
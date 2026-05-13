'use client'

import { useState } from 'react'
import { PhoneCall, Clock, User, Phone, ChevronLeft, ChevronRight } from 'lucide-react'
import { useCalls, useCallsCount } from '@/lib/query/client'
import type { Call, CallIntent } from '@/types/database'

const INTENT_COLORS: Record<CallIntent, string> = {
  lead: 'bg-blue-100 text-blue-800',
  emergency: 'bg-red-100 text-red-800',
  info: 'bg-gray-100 text-gray-800',
  no_action: 'bg-gray-100 text-gray-600',
  unknown: 'bg-yellow-100 text-yellow-800'
}

const INTENT_LABELS: Record<CallIntent, string> = {
  lead: 'Lead',
  emergency: 'Emergency',
  info: 'Info',
  no_action: 'No Action',
  unknown: 'Unknown'
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

interface CallLogTableProps {
  onCallClick?: (callId: string) => void
}

export function CallLogTable({ onCallClick }: CallLogTableProps) {
  const [page, setPage] = useState(1)
  const limit = 50

  const { data, isLoading, error } = useCalls(page, limit)
  const { data: countData } = useCallsCount()

  const calls = data?.calls ?? []
  const total = countData ?? 0
  const totalPages = Math.ceil(total / limit)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-red-400 py-8 text-center">
        Failed to load calls: {error.message}
      </div>
    )
  }

  if (calls.length === 0) {
    return (
      <div className="text-gray-400 py-12 text-center">
        <PhoneCall className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No calls yet</p>
        <p className="text-sm mt-1">Calls will appear here when they come in</p>
      </div>
    )
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm text-gray-400 border-b border-gray-700">
              <th className="pb-3 pr-4"><Clock className="w-4 h-4 inline" /> Date</th>
              <th className="pb-3 pr-4"><User className="w-4 h-4 inline" /> Caller</th>
              <th className="pb-3 pr-4"><Phone className="w-4 h-4 inline" /> Phone</th>
              <th className="pb-3 pr-4">Duration</th>
              <th className="pb-3 pr-4">Intent</th>
              <th className="pb-3">Summary</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((call) => (
              <tr
                key={call.id}
                onClick={() => onCallClick?.(call.id)}
                className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer transition-colors"
              >
                <td className="py-3 pr-4 text-sm text-gray-300">
                  {formatDate(call.started_at)}
                </td>
                <td className="py-3 pr-4 text-sm text-white">
                  {call.caller_name || 'Unknown'}
                </td>
                <td className="py-3 pr-4 text-sm text-gray-300 font-mono">
                  {call.caller_phone || '--'}
                </td>
                <td className="py-3 pr-4 text-sm text-gray-300">
                  {formatDuration(call.duration_seconds)}
                </td>
                <td className="py-3 pr-4">
                  {call.intent && (
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${INTENT_COLORS[call.intent]}`}>
                      {INTENT_LABELS[call.intent]}
                    </span>
                  )}
                </td>
                <td className="py-3 text-sm text-gray-400 max-w-xs truncate">
                  {call.summary || '--'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
          <div className="text-sm text-gray-400">
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} calls
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-300">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
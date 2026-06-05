'use client'

import { useState } from 'react'
import { User, Phone, Wrench, Calendar, FileText, ChevronLeft, ChevronRight } from 'lucide-react'
import { useLeads, useLeadsCount, type LeadFilters } from '@/lib/query/client'
import { StatusBadge } from './StatusBadge'

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

interface LeadTableProps {
  filters: LeadFilters
}

export function LeadTable({ filters }: LeadTableProps) {
  const [page, setPage] = useState(1)
  const limit = 50

  const { data, isLoading, error } = useLeads(filters, page, limit)
  const { data: countData } = useLeadsCount(filters)

  const leads = data?.leads ?? []
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
        Failed to load leads: {error.message}
      </div>
    )
  }

  if (leads.length === 0) {
    return (
      <div className="text-gray-400 py-12 text-center">
        <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No leads yet</p>
        <p className="text-sm mt-1">Leads will appear here when calls are classified as potential customers</p>
      </div>
    )
  }

  return (
    <div>
      <div className="w-full">
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm text-gray-400 border-b border-gray-700">
              <th className="pb-3 pr-4"><User className="w-4 h-4 inline" /> Name</th>
              <th className="pb-3 pr-4"><Phone className="w-4 h-4 inline" /> Phone</th>
              <th className="pb-3 pr-4"><Wrench className="w-4 h-4 inline" /> Service</th>
              <th className="pb-3 pr-4">Status</th>
              <th className="pb-3 pr-4"><Calendar className="w-4 h-4 inline" /> Created</th>
              <th className="pb-3"><FileText className="w-4 h-4 inline" /> Notes</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr
                key={lead.id}
                className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
              >
                <td className="py-3 pr-4 text-sm text-white">
                  {lead.caller_name || 'Unknown'}
                </td>
                <td className="py-3 pr-4 text-sm text-gray-300 font-mono">
                  {lead.caller_phone}
                </td>
                <td className="py-3 pr-4 text-sm text-gray-300">
                  {lead.service_requested || lead.service_type || '--'}
                </td>
                <td className="py-3 pr-4">
                  <StatusBadge status={lead.status} leadId={lead.id} />
                </td>
                <td className="py-3 pr-4 text-sm text-gray-300">
                  {formatDate(lead.created_at)}
                </td>
                <td className="py-3 text-sm text-gray-400 max-w-xs truncate">
                  {lead.notes ? lead.notes.slice(0, 50) + (lead.notes.length > 50 ? '...' : '') : '--'}
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
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} leads
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

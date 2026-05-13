'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useUpdateLeadStatus } from '@/lib/query/client'
import type { LeadStatus } from '@/types/database'

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-blue-100 text-blue-800 border-blue-200',
  contacted: 'bg-orange-100 text-orange-800 border-orange-200',
  booked: 'bg-green-100 text-green-800 border-green-200',
  won: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  lost: 'bg-gray-100 text-gray-600 border-gray-200'
}

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  booked: 'Booked',
  won: 'Won',
  lost: 'Lost'
}

const STATUS_OPTIONS: LeadStatus[] = ['new', 'contacted', 'booked', 'won', 'lost']

interface StatusBadgeProps {
  status: LeadStatus
  leadId: string
}

export function StatusBadge({ status, leadId }: StatusBadgeProps) {
  const [isOpen, setIsOpen] = useState(false)
  const updateStatus = useUpdateLeadStatus()

  const handleStatusChange = async (newStatus: LeadStatus) => {
    await updateStatus.mutateAsync({ leadId, newStatus })
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium border ${STATUS_COLORS[status]} hover:opacity-80 transition-opacity`}
      >
        {STATUS_LABELS[status]}
        <ChevronDown className="w-3 h-3" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-10 mt-1 w-36 bg-gray-800 border border-gray-700 rounded-lg shadow-lg py-1">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => handleStatusChange(option)}
                disabled={option === status || updateStatus.isPending}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-700 disabled:opacity-50 ${option === status ? 'text-gray-400 cursor-default' : 'text-white'}`}
              >
                {STATUS_LABELS[option]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
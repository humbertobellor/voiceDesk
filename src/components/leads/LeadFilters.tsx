'use client'

import { useState } from 'react'
import { Filter, X } from 'lucide-react'
import type { LeadFilters } from '@/lib/query/client'
import type { LeadStatus, TradeType } from '@/types/database'

const STATUS_OPTIONS: { value: LeadStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'booked', label: 'Booked' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' }
]

const SERVICE_OPTIONS: { value: TradeType | 'general' | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'general', label: 'General' }
]

interface LeadFiltersProps {
  filters: LeadFilters
  onFilterChange: (filters: LeadFilters) => void
}

export function LeadFiltersComponent({ filters, onFilterChange }: LeadFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleStatusChange = (statusStr: string) => {
    const status = statusStr ? (statusStr.split(',') as LeadStatus[]) : undefined
    onFilterChange({ ...filters, status })
  }

  const handleServiceTypeChange = (serviceTypeStr: string) => {
    const serviceType = serviceTypeStr ? (serviceTypeStr.split(',') as TradeType[]) : undefined
    onFilterChange({ ...filters, serviceType })
  }

  const handleDateFromChange = (dateFrom: string) => {
    onFilterChange({ ...filters, dateFrom: dateFrom || undefined })
  }

  const handleDateToChange = (dateTo: string) => {
    onFilterChange({ ...filters, dateTo: dateTo || undefined })
  }

  const clearFilters = () => {
    onFilterChange({})
  }

  const hasActiveFilters = !!(
    filters.status?.length ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.serviceType?.length
  )

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${isExpanded ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'}`}
        >
          <Filter className="w-4 h-4" />
          <span className="text-sm">Filters</span>
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-2 py-1 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="flex flex-wrap gap-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Status</label>
            <select
              value={filters.status?.[0] || ''}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">From Date</label>
            <input
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => handleDateFromChange(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">To Date</label>
            <input
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => handleDateToChange(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Service Type</label>
            <select
              value={filters.serviceType?.[0] || ''}
              onChange={(e) => handleServiceTypeChange(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
            >
              {SERVICE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  )
}
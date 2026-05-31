'use client'

import { useState } from 'react'
import { useContractor } from '@/contexts/ContractorContext'
import { useLeadsSubscription } from '@/lib/realtime/leadsSubscription'
import { LeadFiltersComponent } from '@/components/leads/LeadFilters'
import { LeadTable } from '@/components/leads/LeadTable'
import type { LeadFilters } from '@/lib/query/client'

export default function LeadsPage() {
  const { contractorId } = useContractor()
  const [filters, setFilters] = useState<LeadFilters>({})

  // Set up real-time subscription for live indicator
  useLeadsSubscription(contractorId ?? '', (_leadId) => {
    // New lead arrived — trigger query invalidation via the subscription hook
  })

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-fg-1 mb-1">Leads</h1>
            <p className="text-sm text-fg-3">Qualified leads from incoming calls</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success flex-shrink-0"></span>
            <span className="text-xs text-fg-3">Live</span>
          </div>
        </div>
        <div className="border-b border-rule mt-6" />
      </div>

      <LeadFiltersComponent filters={filters} onFilterChange={setFilters} />
      <LeadTable filters={filters} />
    </div>
  )
}
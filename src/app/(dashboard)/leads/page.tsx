import { Users } from 'lucide-react'
import { EmptyState } from '@/components/dashboard/EmptyState'

export const metadata = { title: 'Leads — VoiceDesk' }

export default function LeadsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#F8FAFC] mb-1">Leads</h1>
        <p className="text-sm text-[#94A3B8]">Qualified leads from incoming calls</p>
        <div className="border-b border-[#334155] mt-6" />
      </div>
      <EmptyState
        icon={Users}
        heading="No leads yet"
        body="Leads will appear here when callers ask to book a job. Complete setup to go live."
        cta={{ label: 'Complete Setup', href: '/settings/agent' }}
      />
    </div>
  )
}

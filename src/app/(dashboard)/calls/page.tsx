import { PhoneCall } from 'lucide-react'
import { EmptyState } from '@/components/dashboard/EmptyState'

export const metadata = { title: 'Calls — VoiceDesk' }

export default function CallsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#F8FAFC] mb-1">Calls</h1>
        <p className="text-sm text-[#94A3B8]">Recent inbound calls</p>
        <div className="border-b border-[#334155] mt-6" />
      </div>
      <EmptyState
        icon={PhoneCall}
        heading="No calls yet"
        body="Your AI receptionist isn't active yet. Complete setup to start answering calls."
        cta={{ label: 'Complete Setup', href: '/settings/agent' }}
      />
    </div>
  )
}

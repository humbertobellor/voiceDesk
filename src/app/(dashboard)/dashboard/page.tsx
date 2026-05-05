import { LayoutDashboard } from 'lucide-react'
import { EmptyState } from '@/components/dashboard/EmptyState'

export const metadata = { title: 'Dashboard — VoiceDesk' }

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#F8FAFC] mb-1">Dashboard</h1>
        <p className="text-sm text-[#94A3B8]">Overview of your AI receptionist</p>
        <div className="border-b border-[#334155] mt-6" />
      </div>
      <EmptyState
        icon={LayoutDashboard}
        heading="Your dashboard is ready"
        body="Once your setup is complete, you'll see today's calls, active leads, and your agent status here."
      />
    </div>
  )
}

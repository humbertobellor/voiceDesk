import { Bell } from 'lucide-react'
import { EmptyState } from '@/components/dashboard/EmptyState'

export const metadata = { title: 'Notifications — VoiceDesk' }

export default function NotificationsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#F8FAFC] mb-1">Notifications</h1>
        <p className="text-sm text-[#94A3B8]">Manage your notification channels</p>
        <div className="border-b border-[#334155] mt-6" />
      </div>
      <EmptyState
        icon={Bell}
        heading="Set up notifications"
        body="Add your WhatsApp and Telegram accounts to receive instant call alerts."
      />
    </div>
  )
}

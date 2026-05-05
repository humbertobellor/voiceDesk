import { CreditCard } from 'lucide-react'
import { EmptyState } from '@/components/dashboard/EmptyState'

export const metadata = { title: 'Account & Billing — VoiceDesk' }

export default function AccountPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#F8FAFC] mb-1">Account & Billing</h1>
        <p className="text-sm text-[#94A3B8]">Manage your plan and billing details</p>
        <div className="border-b border-[#334155] mt-6" />
      </div>
      <EmptyState
        icon={CreditCard}
        heading="Account & Billing"
        body="Manage your plan, payment method, and subscription here."
      />
    </div>
  )
}

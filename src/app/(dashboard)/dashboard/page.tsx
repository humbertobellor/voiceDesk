// src/app/(dashboard)/dashboard/page.tsx
// D-03: Displays calendarConnected=1 success banner when redirected from OAuth callback.
// Also shows calendarError param as an error banner.
import { LayoutDashboard } from 'lucide-react'
import { EmptyState } from '@/components/dashboard/EmptyState'

export const metadata = { title: 'Dashboard — VoiceDesk' }

interface DashboardPageProps {
  searchParams: Promise<{ calendarConnected?: string; calendarError?: string }>
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams
  const calendarConnected = params.calendarConnected === '1'
  const calendarError = params.calendarError

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#F8FAFC] mb-1">Dashboard</h1>
        <p className="text-sm text-[#94A3B8]">Overview of your AI receptionist</p>
        <div className="border-b border-[#334155] mt-6" />
      </div>
      {calendarConnected && (
        <div
          role="status"
          className="bg-[#16A34A]/10 border border-[#16A34A]/30 text-[#16A34A] rounded-lg p-3 text-sm mb-4"
        >
          Google Calendar connected successfully. Appointments will now sync automatically.
        </div>
      )}
      {calendarError && (
        <div
          role="alert"
          className="bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] rounded-lg p-3 text-sm mb-4"
        >
          {calendarError === 'state_mismatch'
            ? 'Calendar connection failed: security check failed. Please try again.'
            : calendarError === 'missing_tokens'
              ? 'Calendar connection failed: authorization was incomplete. Please reconnect and allow all permissions.'
              : `Calendar connection failed: ${calendarError}. Please try again.`}
        </div>
      )}
      <EmptyState
        icon={LayoutDashboard}
        heading="Your dashboard is ready"
        body="Once your setup is complete, you'll see today's calls, active leads, and your agent status here."
      />
    </div>
  )
}

// src/app/(dashboard)/dashboard/page.tsx
// D-03: Displays calendarConnected=1 success banner when redirected from OAuth callback.
// Also shows calendarError param as an error banner.
// D-21: Telegram setup banner auto-dismisses when telegram_chat_id is populated.
import { LayoutDashboard } from 'lucide-react'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { createSupabaseServer } from '@/lib/supabase/server'

export const metadata = { title: 'Dashboard — VoiceDesk' }

interface DashboardPageProps {
  searchParams: Promise<{ calendarConnected?: string; calendarError?: string }>
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams
  const calendarConnected = params.calendarConnected === '1'
  const calendarError = params.calendarError

  // Load Telegram link status to determine whether to show setup banner
  // D-21: Banner auto-dismisses when telegram_chat_id IS NOT NULL
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  let telegramLinked = false
  let contractorId: string | null = null
  if (user) {
    // Get contractor_id for the current user (contractors table PK — used in deep link)
    const { data: contractor } = await supabase
      .from('contractors')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (contractor) {
      contractorId = contractor.id
      const { data: notifSettings } = await supabase
        .from('notification_settings')
        .select('telegram_chat_id')
        .eq('contractor_id', contractor.id)
        .maybeSingle()
      telegramLinked = notifSettings?.telegram_chat_id != null
    }
  }

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
              : 'Calendar connection failed. Please try again.'}
        </div>
      )}
      {!telegramLinked && (
        <div
          role="status"
          className="bg-[#1E3A5F]/40 border border-[#3B82F6]/30 text-[#93C5FD] rounded-lg p-3 text-sm mb-4"
        >
          <span className="font-medium">Link Telegram for instant call alerts.</span>{' '}
          <a
            href={`https://t.me/voiceDeskTelBot?start=${contractorId ?? ''}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[#60A5FA] transition-colors"
          >
            Connect @voiceDeskTelBot
          </a>
          {' '}to receive SMS, WhatsApp, and Telegram notifications within 60 seconds of every call.
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

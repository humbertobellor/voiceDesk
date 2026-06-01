// src/app/(dashboard)/settings/calendar/page.tsx
// Server Component — checks Google Calendar connection status, renders ConnectCalendarForm.
// Follows the connect-calendar page pattern: createSupabaseServer() auth + calendar_credentials check.
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { ConnectCalendarForm } from '@/app/(dashboard)/connect-calendar/_components/ConnectCalendarForm'

export const metadata = { title: 'Calendar — Koolable' }

export default async function CalendarSettingsPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: contractor } = await supabase
    .from('contractors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!contractor) redirect('/setup/phone')

  // Check calendar connection — RLS enforces ownership via user session
  const { data: creds } = await supabase
    .from('calendar_credentials')
    .select('contractor_id')
    .eq('contractor_id', contractor.id)
    .maybeSingle()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-fg-1 mb-1">Calendar</h1>
        <p className="text-sm text-fg-3">
          Connect your Google Calendar to allow Koolable to book appointments automatically.
        </p>
        <div className="border-b border-rule mt-6" />
      </div>
      <ConnectCalendarForm isConnected={!!creds} />
    </div>
  )
}

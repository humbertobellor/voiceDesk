// src/app/(dashboard)/connect-calendar/page.tsx
// Server Component — checks calendar connection status, renders ConnectCalendarForm.
// D-01: Minimal page — button + connection status. Phase 6 embeds this in Settings.
// Auth pattern: createSupabaseServer() for user check; user's own client for calendar_credentials read (RLS).
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { ConnectCalendarForm } from './_components/ConnectCalendarForm'

export const metadata = { title: 'Connect Calendar — VoiceDesk' }

export default async function ConnectCalendarPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: contractor } = await supabase
    .from('contractors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!contractor) redirect('/setup/phone')

  // Check calendar connection — use user's own Supabase client (RLS enforces ownership)
  const { data: creds } = await supabase
    .from('calendar_credentials')
    .select('contractor_id')
    .eq('contractor_id', contractor.id)
    .maybeSingle()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-fg-1 mb-1">Connect Google Calendar</h1>
        <p className="text-sm text-fg-3">
          Allow VoiceDesk to book appointments directly into your Google Calendar.
        </p>
        <div className="border-b border-rule mt-6" />
      </div>
      <ConnectCalendarForm isConnected={!!creds} />
    </div>
  )
}

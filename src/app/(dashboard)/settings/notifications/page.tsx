// src/app/(dashboard)/settings/notifications/page.tsx
// Server Component — fetches notification_settings for the authenticated contractor
// and passes them as props to NotificationSettingsForm.
// Pattern: identical to settings/calendar/page.tsx (auth → contractor → settings → render).
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { NotificationSettingsForm } from '@/components/notification/NotificationSettingsForm'

export const metadata = { title: 'Notifications — VoiceDesk' }

export default async function NotificationsPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: contractor } = await supabase
    .from('contractors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!contractor) redirect('/setup/phone')

  // Fetch notification settings — RLS enforces ownership via user session
  const { data: settings } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('contractor_id', contractor.id)
    .maybeSingle()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#F8FAFC] mb-1">Notifications</h1>
        <p className="text-sm text-[#94A3B8]">Configure how and where you receive call alerts.</p>
        <div className="border-b border-[#334155] mt-6" />
      </div>
      {settings && <NotificationSettingsForm initialSettings={settings} />}
    </div>
  )
}

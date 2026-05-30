// src/app/(dashboard)/settings/notifications/page.tsx
// Server Component — fetches notification_settings for the authenticated contractor
// and passes them as props to NotificationSettingsForm.
// Pattern: identical to settings/calendar/page.tsx (auth → contractor → settings → render).
//
// TEL-01: Fetches Telegram webhook status on load via getBot().api.getWebhookInfo().
// On error (missing token or API failure), passes null so the card renders a graceful fallback.
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { getBot } from '@/lib/notifications/telegram'
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

  // Fetch Telegram webhook status for the webhook card (D-07, D-08).
  // Passes null if TELEGRAM_BOT_TOKEN is missing or the API call fails.
  let initialWebhookInfo: Record<string, unknown> | null = null
  try {
    initialWebhookInfo = (await getBot().api.getWebhookInfo()) as unknown as Record<string, unknown>
  } catch (err) {
    console.error(
      '[NotificationsPage] getWebhookInfo failed:',
      err instanceof Error ? err.message : String(err),
    )
  }

  // Fetch notification settings — RLS enforces ownership via user session
  const { data: settings } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('contractor_id', contractor.id)
    .maybeSingle()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-fg-on-dark mb-1">Notifications</h1>
        <p className="text-sm text-fg-3">Configure how and where you receive call alerts.</p>
        <div className="border-b border-rule mt-6" />
      </div>
      {settings ? (
        <NotificationSettingsForm
          initialSettings={settings}
          initialWebhookInfo={initialWebhookInfo}
        />
      ) : (
        // WR-05: Show an explicit message rather than rendering nothing when the
        // notification_settings row does not exist (e.g. new contractor whose row
        // was not created during onboarding, or a row that was deleted).
        <p className="text-sm text-fg-3">
          Notification settings are not yet configured. Please contact support.
        </p>
      )}
    </div>
  )
}

// src/app/api/notification-settings/telegram/unlink/route.ts
// POST — unlinks the Telegram chat for the authenticated contractor.
//
// Sets telegram_chat_id = NULL for the contractor's notification_settings row.
// contractor_id is ALWAYS derived from getUser() session (IDOR guard).
// No request body is required or used.
//
// Threat mitigations:
//   T-10-01 (Elevation of Privilege): contractor_id from session, never from body
//   T-10-04 (NULL contractor_id): getUser() null → 401 before any DB access
import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

/**
 * POST /api/notification-settings/telegram/unlink
 *
 * Clears the telegram_chat_id for the authenticated contractor's notification settings.
 * No request body is needed — contractor identity comes from the session.
 *
 * @returns 200 with updated NotificationSettings row, or 401/404/500 on errors.
 */
export async function POST() {
  // 1. Auth — getUser() validates JWT; never use getSession()
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Contractor lookup — service role to bypass RLS for the join
  const serviceClient = createServiceRoleClient()
  const { data: contractor, error: loadErr } = await serviceClient
    .from('contractors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (loadErr || !contractor) {
    if (loadErr) console.error('[notification-settings/telegram/unlink] contractor load failed:', loadErr.message)
    return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })
  }

  // 3. Clear telegram_chat_id — filter by contractor.id from session (IDOR guard)
  const { data, error: updateErr } = await serviceClient
    .from('notification_settings')
    .update({
      telegram_chat_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('contractor_id', contractor.id)
    .select()
    .single()

  if (updateErr) {
    console.error('[notification-settings/telegram/unlink] update failed:', updateErr.message)
    throw updateErr
  }

  return NextResponse.json(data, { status: 200 })
}

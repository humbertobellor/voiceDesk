// src/app/api/notifications/mark-all-read/route.ts
// PATCH — marks all unread notifications as read for the authenticated contractor.
//
// IDOR guard: contractor_id is ALWAYS derived from getUser() session.
// The request body is ignored entirely (no body parsing).
//
// Threat mitigations:
//   T-14-03-01 (IDOR): contractor_id in WHERE clause from session lookup, never from body
//   T-14-03-02 (Spoofing): getUser() server-side auth check; 401 for any unauthenticated request
import 'server-only'
import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

/**
 * PATCH /api/notifications/mark-all-read
 *
 * Marks all unread notifications for the authenticated contractor as read.
 * Sets is_read=true and read_at=NOW() for all rows where is_read=false.
 * contractor_id is derived from the authenticated session (never from request body).
 *
 * @param _req - Next.js Request (body is ignored)
 * @returns 200 { ok: true } on success, or 401/404/500 on errors.
 */
export async function PATCH(_req: Request) {
  // 1. Auth — getUser() validates JWT; never use getSession()
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Contractor lookup — use service role to bypass RLS for the join
  const serviceClient = createServiceRoleClient()
  const { data: contractor, error: loadErr } = await serviceClient
    .from('contractors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (loadErr || !contractor) {
    if (loadErr) console.error('[mark-all-read] contractor load failed:', loadErr.message)
    return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })
  }

  // 3. Mark all unread notifications as read — contractor_id from session (IDOR guard)
  const { error: updateErr } = await serviceClient
    .from('app_notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('contractor_id', contractor.id)
    .eq('is_read', false)

  if (updateErr) {
    console.error('[mark-all-read] update failed:', updateErr.message)
    return NextResponse.json({ error: 'Failed to mark notifications as read' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}

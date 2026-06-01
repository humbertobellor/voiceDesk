// src/app/api/notifications/[id]/mark-as-read/route.ts
// PATCH — marks a single notification as read for the authenticated contractor.
//
// IDOR guard: contractor_id is ALWAYS derived from getUser() session.
// The request body is ignored entirely. The notification ID is extracted from the
// route parameter and verified to belong to the authenticated contractor before update.
//
// Idempotency: The UPDATE statement on a single row is idempotent.
// Re-submitting the same request (e.g. on network retry) is safe — the row is either
// already marked is_read=true (no change), or will be marked now. Both outcomes succeed.
//
// Threat mitigations:
//   T-17-02-01 (IDOR): contractor_id in WHERE clause from session lookup, never from body.
//                      Notification verified to belong to contractor before update.
//   T-17-02-02 (Elevation of Privilege): is_read only set server-side in UPDATE.
//                                       Optimistic client update is visual-only.
//   T-17-02-03 (Double-submit): Single-row UPDATE is idempotent. No duplicate writes.
import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

/**
 * PATCH /api/notifications/[id]/mark-as-read
 *
 * Marks a single notification as read for the authenticated contractor.
 * Sets is_read=true and read_at=NOW().
 *
 * Path parameter [id] is the notification ID (extracted from the URL).
 * contractor_id is derived from the authenticated session (never from request body).
 *
 * @param _req - Next.js Request (body is ignored)
 * @param context - Route context with params: { id: string }
 * @returns 200 { ok: true } on success, or 401/403/404/500 on errors.
 */
export async function PATCH(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: notificationId } = await context.params

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
    if (loadErr) console.error('[mark-notification-as-read] contractor load failed:', loadErr.message)
    return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })
  }

  // 3. IDOR guard: Verify the notification exists and belongs to this contractor.
  //    Use SELECT with both id AND contractor_id in WHERE clause.
  const { data: notification, error: selectErr } = await serviceClient
    .from('app_notifications')
    .select('id, is_read')
    .eq('id', notificationId)
    .eq('contractor_id', contractor.id)
    .maybeSingle()

  if (selectErr) {
    console.error('[mark-notification-as-read] select failed:', selectErr.message)
    return NextResponse.json({ error: 'Failed to verify notification ownership' }, { status: 500 })
  }

  if (!notification) {
    // Notification not found OR does not belong to this contractor (IDOR violation)
    // Return 403 (Forbidden) — the resource exists but access is denied
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 4. Idempotent UPDATE: Set is_read=true and read_at=NOW() for this notification.
  //    WHERE clause includes both id AND contractor_id to prevent accidental writes
  //    to other contractors' notifications.
  const { error: updateErr } = await serviceClient
    .from('app_notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('contractor_id', contractor.id)

  if (updateErr) {
    console.error('[mark-notification-as-read] update failed:', updateErr.message)
    return NextResponse.json({ error: 'Failed to mark notification as read' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}

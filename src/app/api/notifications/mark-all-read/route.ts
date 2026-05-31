// src/app/api/notifications/mark-all-read/route.ts
// PATCH — marks all unread notifications as read for the authenticated contractor.
//
// IDOR guard: contractor_id is ALWAYS derived from getUser() session.
// The request body is ignored entirely (no body parsing).
//
// Row-count cap: the UPDATE is scoped to at most MARK_ALL_READ_LIMIT rows per
// request. This bounds DB lock contention and protects against bulk writes caused
// by contractors with unusually large unread backlogs or double-submit retries.
//
// Threat mitigations:
//   T-14-03-01 (IDOR): contractor_id in WHERE clause from session lookup, never from body
//   T-14-03-02 (Spoofing): getUser() server-side auth check; 401 for any unauthenticated request
import 'server-only'
import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

/** Maximum number of notification rows updated per request. */
const MARK_ALL_READ_LIMIT = 200

/**
 * PATCH /api/notifications/mark-all-read
 *
 * Marks up to MARK_ALL_READ_LIMIT unread notifications for the authenticated
 * contractor as read. Sets is_read=true and read_at=NOW().
 * contractor_id is derived from the authenticated session (never from request body).
 *
 * The update is implemented as a two-step SELECT-then-UPDATE to allow a row-count
 * cap, since PostgREST does not expose UPDATE ... LIMIT directly.
 * The second write is accidentally idempotent: rows already marked is_read=true are
 * excluded by the SELECT, so re-submitting the request after a network retry is safe.
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

  // 3. Select up to MARK_ALL_READ_LIMIT unread notification IDs.
  //    Selecting IDs first allows LIMIT to bound the subsequent UPDATE scope.
  const { data: unreadRows, error: selectErr } = await serviceClient
    .from('app_notifications')
    .select('id')
    .eq('contractor_id', contractor.id)
    .eq('is_read', false)
    .limit(MARK_ALL_READ_LIMIT)

  if (selectErr) {
    console.error('[mark-all-read] select failed:', selectErr.message)
    return NextResponse.json({ error: 'Failed to mark notifications as read' }, { status: 500 })
  }

  // No unread notifications — nothing to do (idempotent success)
  if (!unreadRows || unreadRows.length === 0) {
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  // 4. Update only the selected rows — contractor_id from session (IDOR guard)
  const ids = unreadRows.map((row) => row.id)
  const { error: updateErr } = await serviceClient
    .from('app_notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .in('id', ids)

  if (updateErr) {
    console.error('[mark-all-read] update failed:', updateErr.message)
    return NextResponse.json({ error: 'Failed to mark notifications as read' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}

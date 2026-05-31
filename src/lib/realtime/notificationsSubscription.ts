'use client'

/**
 * useNotificationsSubscription — Supabase Realtime hook for live notification updates.
 *
 * Subscribes to INSERT events on app_notifications filtered by contractor_id.
 * On each insert, invalidates React Query caches for the notifications list and
 * unread count, causing the NotificationBell to reflect the new row without a
 * manual refresh.
 *
 * Security: The filter `contractor_id=eq.{contractorId}` ensures the subscription
 * receives only rows belonging to the authenticated contractor. Combined with the
 * app_notifications_select_own RLS policy, cross-tenant Realtime events are blocked
 * at both the subscription filter and the DB row-level (T-14-04-01).
 *
 * The hook is intentionally stateless (no isConnected tracking) — connection
 * status is not surfaced to the UI in Phase 14.
 */

import { createBrowserClient } from '@supabase/ssr'
import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type InsertCallback = () => void

/**
 * Subscribes to Supabase Realtime INSERT events on app_notifications for the
 * given contractorId.
 *
 * On each INSERT:
 * - Invalidates ['notifications', contractorId] query (feed refresh)
 * - Invalidates ['notifications-unread', contractorId] query (badge refresh)
 * - Calls onInsert callback if provided
 *
 * The onInsert callback is stored in a ref so callers need not memoize it —
 * passing an inline arrow function will not cause the subscription to tear down
 * and re-create on every render (CR-02).
 *
 * @param contractorId - The contractor's ID. Subscription is skipped if null/empty.
 * @param onInsert - Optional callback fired on each new notification insert.
 */
export function useNotificationsSubscription(
  contractorId: string | null,
  onInsert?: InsertCallback
) {
  const queryClient = useQueryClient()

  // Stable ref: callers need not memoize the callback. The ref is always current
  // because the layout-effect update runs before any effect that reads it.
  const onInsertRef = useRef(onInsert)
  useEffect(() => {
    onInsertRef.current = onInsert
  })

  useEffect(() => {
    // Guard: do not attempt subscription without a valid contractor ID
    if (!contractorId) return

    const channel = supabase
      .channel(`notifications-realtime-${contractorId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'app_notifications',
          // contractor_id filter prevents cross-tenant event leakage (T-14-04-01)
          filter: `contractor_id=eq.${contractorId}`
        },
        () => {
          // Invalidate both notification queries on new insert
          queryClient.invalidateQueries({ queryKey: ['notifications', contractorId] })
          queryClient.invalidateQueries({ queryKey: ['notifications-unread', contractorId] })
          // Read callback from ref — avoids adding onInsert to the effect dep array
          // which would cause infinite subscribe/unsubscribe loops for inline callbacks.
          onInsertRef.current?.()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [contractorId, queryClient]) // onInsert intentionally omitted — accessed via ref
}

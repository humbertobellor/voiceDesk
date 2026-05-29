'use client'

/**
 * NotificationBell — self-contained notification bell UI with live unread count.
 *
 * Renders a Bell icon with an orange numeric badge when unread notifications exist.
 * Clicking opens a Radix Popover showing the 50 most recent notifications, a
 * "Mark all read" button, and an empty state when no notifications exist.
 *
 * Supabase Realtime subscription is mounted exclusively here — do NOT duplicate
 * useNotificationsSubscription in Sidebar.tsx or BottomTabBar.tsx (T-14-04-03).
 *
 * Props:
 *   className — forwarded to the outermost wrapper div for layout positioning.
 */

import {
  Root as PopoverRoot,
  Trigger as PopoverTrigger,
  Content as PopoverContent,
} from '@radix-ui/react-popover'
import { Bell } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useNotifications, useUnreadCount, useMarkAllRead } from '@/lib/query/client'
import { useNotificationsSubscription } from '@/lib/realtime/notificationsSubscription'
import { useContractor } from '@/contexts/ContractorContext'
import { cn } from '@/lib/utils'
import type { AppNotification } from '@/types/database'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface NotificationBellProps {
  /** Optional class applied to the outermost wrapper div. */
  className?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the left-border color class for a notification row based on event_type.
 * Colors are locked per UI-SPEC.md (Phase 16 will replace with CSS tokens).
 */
function borderColorForEventType(
  eventType: AppNotification['event_type']
): string {
  switch (eventType) {
    case 'emergency':
      return '#EF4444'
    case 'lead':
      return '#F97316'
    default:
      // 'system' | 'payment_failure' → slate
      return '#64748B'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * NotificationBell component.
 *
 * Mounts the Supabase Realtime subscription for live notification updates.
 * Must be rendered exactly once in the layout (T-14-04-03).
 */
export function NotificationBell({ className }: NotificationBellProps) {
  const { contractorId } = useContractor()

  // Queries
  const { data: notifications = [] } = useNotifications()
  const { data: unreadCount = 0 } = useUnreadCount()

  // Mutations
  const markAllRead = useMarkAllRead()

  // Realtime subscription — mounted here and only here
  useNotificationsSubscription(contractorId)

  // Badge display value: cap at 99+
  const badgeText = unreadCount > 99 ? '99+' : String(unreadCount)
  const hasUnread = unreadCount > 0

  return (
    <div className={cn('relative', className)}>
      <PopoverRoot>
        {/* ── Trigger ───────────────────────────────────────────────── */}
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Notifications"
            className="relative flex items-center justify-center rounded-md p-1 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]"
          >
            {/* Bell icon */}
            <Bell
              size={20}
              color={hasUnread ? '#F97316' : '#94A3B8'}
              aria-hidden="true"
            />

            {/* Unread badge — visible only when unreadCount > 0 */}
            {hasUnread && (
              <span
                aria-label={`${unreadCount} unread notifications`}
                className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#F97316] text-white"
                style={{ fontSize: '10px', fontWeight: 600 }}
              >
                {badgeText}
              </span>
            )}
          </button>
        </PopoverTrigger>

        {/* ── Popover Content ───────────────────────────────────────── */}
        <PopoverContent
          align="end"
          sideOffset={8}
          className="z-50 w-[360px] max-h-[500px] overflow-hidden rounded-lg border border-[#334155] bg-[#1E293B] shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#334155] px-4 py-3">
            <span className="text-sm font-semibold text-[#F8FAFC]">
              Notifications
            </span>
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="cursor-pointer text-xs text-[#F97316] hover:underline disabled:opacity-50"
            >
              Mark all read
            </button>
          </div>

          {/* Feed */}
          <div className="overflow-y-auto" style={{ maxHeight: '440px' }}>
            {notifications.length === 0 ? (
              /* Empty state */
              <div className="px-6 py-12 text-center">
                <p className="text-sm text-[#94A3B8]">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="flex items-stretch border-b border-[#334155] hover:bg-[rgba(255,255,255,0.05)]"
                >
                  {/* Colored left border — 4px, event_type color */}
                  <div
                    className="w-1 flex-shrink-0"
                    style={{
                      backgroundColor: borderColorForEventType(notification.event_type),
                    }}
                    aria-hidden="true"
                  />

                  {/* Notification content */}
                  <div className="flex-1 px-3 py-2">
                    <p className="truncate text-xs font-semibold text-[#F8FAFC]">
                      {notification.title}
                    </p>
                    <p className="truncate text-xs text-[#94A3B8]">
                      {notification.body}
                    </p>
                    <p className="mt-0.5 text-[#94A3B8]" style={{ fontSize: '10px' }}>
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </PopoverContent>
      </PopoverRoot>
    </div>
  )
}

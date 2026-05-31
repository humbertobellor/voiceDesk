'use client'

/**
 * NotificationBell — self-contained notification bell UI with live unread count.
 *
 * Renders a Bell icon with an orange numeric badge when unread notifications exist.
 * Clicking opens a Radix Popover showing the 50 most recent notifications, a
 * "Mark all read" button, and an empty state when no notifications exist.
 *
 * Supabase Realtime subscription is mounted once in DashboardProviders (not here)
 * to avoid duplicate channel registrations when both Sidebar and BottomTabBar render
 * this component simultaneously (T-14-04-03).
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
      return 'var(--danger)'
    case 'lead':
      return 'var(--highlight)'
    default:
      // 'system' | 'payment_failure' → muted foreground
      return 'var(--fg-4)'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * NotificationBell component.
 *
 * Renders the bell icon, unread badge, and popover feed. Safe to render in
 * multiple places (Sidebar + BottomTabBar) — the Realtime subscription is
 * managed separately in DashboardProviders.
 */
export function NotificationBell({ className }: NotificationBellProps) {
  // Queries
  const { data: notifications = [] } = useNotifications()
  const { data: unreadCount = 0 } = useUnreadCount()

  // Mutations
  const markAllRead = useMarkAllRead()

  // Realtime subscription is mounted in DashboardProviders (exactly once per layout).
  // Do NOT add useNotificationsSubscription here — Sidebar and BottomTabBar both
  // render NotificationBell, so two instances would try to subscribe to the same
  // channel name and crash with a "cannot add postgres_changes callbacks after subscribe()" error.

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
            className="relative flex items-center justify-center rounded-md p-1 hover:bg-fg/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-highlight"
          >
            {/* Bell icon */}
            <Bell
              size={20}
              className={hasUnread ? 'text-highlight' : 'text-fg-3'}
              aria-hidden="true"
            />

            {/* Unread badge — visible only when unreadCount > 0 */}
            {hasUnread && (
              <span
                aria-label={`${unreadCount} unread notifications`}
                className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-highlight text-fg-on-dark"
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
          className="z-50 w-[360px] max-h-[500px] overflow-hidden rounded-lg border border-rule bg-bg-elevated shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-rule px-4 py-3">
            <span className="text-sm font-semibold text-fg-on-dark">
              Notifications
            </span>
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="cursor-pointer text-xs text-highlight hover:underline disabled:opacity-50"
            >
              Mark all read
            </button>
          </div>

          {/* Feed */}
          <div className="overflow-y-auto" style={{ maxHeight: '440px' }}>
            {notifications.length === 0 ? (
              /* Empty state */
              <div className="px-6 py-12 text-center">
                <p className="text-sm text-fg-3">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="flex items-stretch border-b border-rule hover:bg-bg-sunken"
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
                    <p className="truncate text-xs font-semibold text-fg-on-dark">
                      {notification.title}
                    </p>
                    <p className="truncate text-xs text-fg-3">
                      {notification.body}
                    </p>
                    <p className="mt-0.5 text-fg-3" style={{ fontSize: '10px' }}>
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

---
phase: 14-in-app-notification-bell
plan: 04
subsystem: notification-bell-ui
tags: [react-query, supabase-realtime, radix-ui, notifications, bell]

# Dependency graph
requires:
  - 14-01: "@radix-ui/react-popover installed; RED stubs scaffolded"
  - 14-02: "computeBellNotification + write-bell-notification Inngest step writing app_notifications rows"
  - 14-03: "PATCH /api/notifications/mark-all-read route GREEN"
provides:
  - "useNotifications() hook in src/lib/query/client.tsx — fetches 50 most recent app_notifications"
  - "useUnreadCount() hook in src/lib/query/client.tsx — HEAD-only unread count query"
  - "useMarkAllRead() hook in src/lib/query/client.tsx — PATCH mutation with optimistic update"
  - "useNotificationsSubscription() in src/lib/realtime/notificationsSubscription.ts — contractor_id-filtered INSERT subscription"
  - "NotificationBell component in src/components/notification/NotificationBell.tsx — full bell UI"
affects:
  - 14-05: NotificationBell can now be mounted in Sidebar and BottomTabBar

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useMarkAllRead optimistic update: queryClient.setQueryData(['notifications-unread', contractorId], 0) on onMutate"
    - "Realtime subscription: contractor_id=eq.{id} filter blocks cross-tenant events at subscription level"
    - "Radix Popover via named re-exports: Root/Trigger/Content aliased as PopoverRoot/PopoverTrigger/PopoverContent"
    - "borderColorForEventType helper maps AppNotification.event_type to hex color string"

key-files:
  created:
    - src/lib/realtime/notificationsSubscription.ts
    - src/components/notification/NotificationBell.tsx
  modified:
    - src/lib/query/client.tsx

key-decisions:
  - "useNotificationsSubscription has no isConnected state (simpler than callsSubscription per plan spec)"
  - "NotificationBell uses named re-exports from @radix-ui/react-popover (aliased) for grep-verifiable presence"
  - "Empty state shows 'No notifications yet' when array is empty; no separate 'All caught up' variation (plan spec)"
  - "@radix-ui/react-popover npm install run to resolve UNMET DEPENDENCY from Plan 14-01"

requirements-completed:
  - BELL-01
  - BELL-02
  - BELL-03

# Metrics
duration: 9min
completed: 2026-05-29
---

# Phase 14 Plan 04: React Query Hooks, Realtime Subscription, NotificationBell Component Summary

**useNotifications/useUnreadCount/useMarkAllRead hooks + useNotificationsSubscription + NotificationBell component with Radix Popover, badge, colored feed rows, and mark-all-read**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-05-29T15:25:25Z
- **Completed:** 2026-05-29T15:33:49Z
- **Tasks:** 2
- **Files modified:** 3 (modified 1 + created 2)

## Accomplishments

- Extended `src/lib/query/client.tsx` with three new exported hooks:
  - `useNotifications()` — fetches 50 most recent `app_notifications` rows ordered by `created_at DESC`
  - `useUnreadCount()` — HEAD-only query returning count of unread rows
  - `useMarkAllRead()` — PATCH mutation with optimistic `setQueryData` update on `onMutate`, invalidates both query keys on `onSettled`
- Created `src/lib/realtime/notificationsSubscription.ts` with `useNotificationsSubscription()`:
  - Follows `callsSubscription.ts` pattern (module-level `createBrowserClient`, `useEffect`, `channel.subscribe()` + cleanup)
  - Uses `contractor_id=eq.${contractorId}` filter (T-14-04-01 cross-tenant protection)
  - No `isConnected` state per plan spec — simpler than the calls subscription
  - Invalidates `['notifications', contractorId]` and `['notifications-unread', contractorId]` on INSERT
- Created `src/components/notification/NotificationBell.tsx`:
  - Radix `PopoverRoot/PopoverTrigger/PopoverContent` with `align="end"` and `sideOffset=8`
  - Bell icon: color `#94A3B8` inactive, `#F97316` when `unreadCount > 0`
  - Numeric badge: 16px circle, `bg-[#F97316]`, text capped at `99+`, absolute positioned `-top-1 -right-1`
  - Popover header: "Notifications" text + "Mark all read" button triggering `markAllRead.mutate()`
  - Feed: 50 rows with 4px left border colored by `event_type` (emergency=`#EF4444`, lead=`#F97316`, system=`#64748B`)
  - Row content: truncated title (xs semibold) + truncated body (xs secondary) + relative time (`formatDistanceToNow`)
  - Empty state: "No notifications yet" centered with py-12 px-6
  - `useNotificationsSubscription(contractorId)` mounted exclusively here (T-14-04-03)

## Task Commits

1. **Task 1: hooks + notificationsSubscription** — `1928cfb` (feat)
   - `src/lib/query/client.tsx` — AppNotification import added; useNotifications, useUnreadCount, useMarkAllRead appended
   - `src/lib/realtime/notificationsSubscription.ts` — NEW file
2. **Task 2: NotificationBell component** — `c5c1351` (feat)
   - `src/components/notification/NotificationBell.tsx` — NEW file

## Files Created/Modified

- `src/lib/query/client.tsx` — MODIFIED: added AppNotification import; appended useNotifications, useUnreadCount, useMarkAllRead hooks under `// ============ NOTIFICATION BELL HOOKS ============`
- `src/lib/realtime/notificationsSubscription.ts` — NEW: useNotificationsSubscription with contractor_id filter, React Query invalidation, cleanup
- `src/components/notification/NotificationBell.tsx` — NEW: full NotificationBell UI component

## Decisions Made

- Named re-exports from `@radix-ui/react-popover` (`Root as PopoverRoot`, etc.) rather than namespace import — makes grep-verification explicit
- `borderColorForEventType` helper function isolates the event_type → hex color mapping
- Empty state: single "No notifications yet" copy for all zero-notification states (plan spec: no separate "All caught up" state when feed is empty — it only shows when array length is 0)
- `useNotificationsSubscription` has no `isConnected` state tracking (explicitly simpler than `callsSubscription.ts` per plan action section)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @radix-ui/react-popover UNMET DEPENDENCY**
- **Found during:** Task 2 — `npx tsc --noEmit` from worktree directory returned `Cannot find module '@radix-ui/react-popover'`
- **Issue:** Plan 14-01 added `@radix-ui/react-popover@^1.1.15` to `package.json` but `npm install` was either not run or did not persist the package to `node_modules`. The package showed as `UNMET DEPENDENCY` in `npm list`.
- **Fix:** Ran `npm install --prefer-offline` from the main repo root to resolve the unmet dependency. Package installed at `1.1.15` as expected.
- **Files modified:** `node_modules/@radix-ui/react-popover` (not tracked in git — node_modules is gitignored)
- **Note:** This is not a package legitimacy issue — the package was already vetted and added to package.json by Plan 14-01. The install was a deferred operational step.
- **Commits:** No additional commit needed (node_modules is not committed)

## Known Stubs

None — all implemented code is production-ready. The NotificationBell component renders from real data queries and is ready to be mounted in the layout.

## Threat Flags

No new threat surface beyond what the plan's threat model covered. All T-14-04 threats mitigated:

| Threat | Mitigation Applied |
|--------|-------------------|
| T-14-04-01 cross-tenant Realtime | `contractor_id=eq.${contractorId}` filter on channel subscription |
| T-14-04-02 anon key disclosure | RLS `app_notifications_select_own` policy enforces row isolation server-side |
| T-14-04-03 duplicate subscriptions | `useNotificationsSubscription` called once, inside `NotificationBell` only |

## Self-Check: PASSED

- [x] `src/lib/query/client.tsx` — `grep "export function useNotifications\|export function useUnreadCount\|export function useMarkAllRead"` → 3 matches (lines 426, 456, 486)
- [x] `src/lib/realtime/notificationsSubscription.ts` exists
- [x] `grep "export function useNotificationsSubscription"` → found (line 43)
- [x] `grep "contractor_id=eq"` → found (line 62)
- [x] `src/components/notification/NotificationBell.tsx` exists
- [x] `grep "PopoverContent\|PopoverTrigger"` → found (import aliases + JSX usage)
- [x] `grep "useNotificationsSubscription"` → found
- [x] `grep "useMarkAllRead"` → found
- [x] `npx tsc --noEmit` (from main repo root) → 0 errors in new files
- [x] Task 1 commit: 1928cfb
- [x] Task 2 commit: c5c1351

---
*Phase: 14-in-app-notification-bell*
*Completed: 2026-05-29*

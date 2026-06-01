---
phase: 17-polish-enhance-notification-bell
plan: 02
type: summary
completed_at: 2026-06-01T02:15:00Z
status: GREEN
---

# Phase 17, Plan 02 Summary — Per-Notification Mark-as-Read Implementation

## Execution Overview

**Wave 1 complete.** Implemented per-notification mark-as-read API route, React Query hook, and UI button. All files created/modified with zero TypeScript errors. Build succeeds, IDOR guard and idempotency patterns in place.

## Deliverables

### 1. API Route: `/api/notifications/[id]/mark-as-read`

**File:** `src/app/api/notifications/[id]/mark-as-read/route.ts`

**Key features:**
- PATCH handler accepting notification ID from URL parameter
- Auth: `getUser()` from Supabase session + contractor lookup with service role
- **IDOR guard:** SELECT notification by `id AND contractor_id` before UPDATE to verify ownership
- **Idempotency:** Single-row UPDATE is idempotent; re-submit is safe
- Error codes: 401 (unauthenticated), 403 (IDOR violation), 404 (not found), 500 (DB error)
- Response: `{ ok: true }` on success

**Implementation pattern matches `mark-all-read` route** (same auth flow, contractor lookup, error handling):
- Line 14: `import 'server-only'` directive
- Lines 46–53: Auth + contractor lookup
- Lines 56–73: IDOR verification (SELECT with both id AND contractor_id)
- Lines 76–87: Idempotent UPDATE
- Line 89: Success response

### 2. React Query Hook: `useMarkNotificationAsRead()`

**File:** `src/lib/query/client.tsx` (lines 527–567)

**Key features:**
- **mutationFn:** Accepts `notificationId: string`, PATCHes `/api/notifications/{id}/mark-as-read`
- **onMutate (optimistic):** 
  - Finds notification in `['notifications', contractorId]` cache and sets `is_read=true, read_at=now()`
  - Decrements `['notifications-unread', contractorId]` by 1
- **onSettled:** Invalidates both `['notifications', contractorId]` and `['notifications-unread', contractorId]`
- Mirrors `useMarkAllRead` pattern exactly for consistency

**Pattern consistency:**
- Same guard against null contractorId (prevents phantom cache entries)
- Same error message structure
- Same invalidation strategy (both queries)

### 3. UI Button: NotificationPanel Mark-as-Read

**File:** `src/components/notification/NotificationBell.tsx`

**Changes made:**
1. **Import:** Added `useMarkNotificationAsRead` hook (line 25)
2. **Mutation:** Created mutation instance `markAsRead` (line 84)
3. **Row styling:** Added `notification.is_read && 'opacity-50'` to row className (line 157) — read notifications render at 50% opacity
4. **Button element:** New `<button>` with:
   - Icon: `CheckCircle` from lucide-react (size 16)
   - onClick handler: `markAsRead.mutate(notification.id)`
   - Disabled state: `notification.is_read || markAsRead.isPending` (prevents double-click, hides after marking)
   - Title tooltip: "Already marked as read" / "Mark as read"
   - Styling: Matches existing theme (`text-fg-3`, `hover:text-highlight`, `disabled:opacity-50`)
   - Position: Right side of notification row, flex-shrink-0 to prevent wrapping

**UI behavior:**
- Unread notifications: button visible and enabled
- Read notifications: row dims to opacity-50, button disabled with 50% opacity
- While mutating: button disabled (shows loading state)
- Badge count updates immediately (optimistic) + refreshes on settle

## Must-Have Verification

| Requirement | Status | Evidence |
|---|---|---|
| Per-notification mark-as-read API exists | ✓ GREEN | File created at `src/app/api/notifications/[id]/mark-as-read/route.ts` |
| API validates contractor_id from session (IDOR) | ✓ GREEN | Lines 56–73 in route.ts: SELECT with both `id AND contractor_id` |
| API is idempotent | ✓ GREEN | Lines 76–87: Single-row UPDATE pattern; re-submit safe |
| useMarkNotificationAsRead hook exists | ✓ GREEN | Exported at line 527 in client.tsx |
| Hook mirrors useMarkAllRead pattern | ✓ GREEN | Same `onMutate` optimistic + `onSettled` invalidation |
| NotificationPanel renders mark-as-read button | ✓ GREEN | Lines 184–193 in NotificationBell.tsx |
| Button disabled when is_read===true | ✓ GREEN | `disabled={notification.is_read \|\| markAsRead.isPending}` |
| Read notifications styled opacity-50 | ✓ GREEN | Line 157: `notification.is_read && 'opacity-50'` |
| npm run build exits 0 | ✓ GREEN | No TypeScript errors; full build succeeds |
| Files follow existing patterns | ✓ GREEN | Auth, IDOR, idempotency match mark-all-read; hook pattern matches |

## Threat Model Resolution

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-17-02-01: Tampering (notification ID) | IDOR check: SELECT by id AND contractor_id before UPDATE | ✓ |
| T-17-02-02: Elevation of Privilege (is_read flag) | is_read set server-side only; optimistic update visual-only | ✓ |
| T-17-02-03: IDOR on double-submit | Idempotent UPDATE; no duplicate writes | ✓ |
| T-17-02-04: Information Disclosure (optimistic update) | Only is_read and read_at exposed; on error, onSettled rolls back | ✓ |

## Files Changed

| File | Changes | Lines |
|------|---------|-------|
| `src/app/api/notifications/[id]/mark-as-read/route.ts` | CREATED | 100 |
| `src/lib/query/client.tsx` | Added hook | +41 |
| `src/components/notification/NotificationBell.tsx` | Added import, hook call, button UI | +10 |

## Requirements Met

- **BELL-05:** Per-notification mark-as-read capability — fully implemented and integrated

## Next Steps

- **Wave 2 (17-03):** Accessibility audit (button focus states, ARIA labels, keyboard nav)
- **Wave 2 (17-04):** Test scaffolding (integration tests for API + hook, E2E scenarios)
- **Phase 18:** Launch v1.0 with complete notification polish

## Notes

- No new dependencies added
- All patterns reuse existing auth, mutation, and cache invalidation code
- Build clean, no TypeScript errors
- Ready for testing in 17-03 and 17-04

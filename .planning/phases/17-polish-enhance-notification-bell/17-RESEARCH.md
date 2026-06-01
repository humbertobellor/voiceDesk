# Phase 17: Polish & Enhance NotificationBell — Research

**Researched:** 2026-06-01
**Domain:** React component polish, per-notification state mutations, accessibility, test coverage
**Confidence:** HIGH

---

## Summary

Phase 17 enhances Phase 14's NotificationBell implementation in two ways: (1) **polish** — comprehensive test coverage, accessibility audit, responsive design verification, and bug fixes for edge cases, and (2) **enhance** — add per-notification mark-as-read action (BELL-05).

Phase 14 delivered a production-quality core: NotificationBell component with real-time badge updates via Supabase Realtime, a 50-row notification feed in a Radix Popover, and a "mark all read" action. However, Phase 14 work was gated by a failing pre-commit hook that delayed the final human UAT checkpoint. Phase 17 begins with **resolving the UAT gate** (Task 1), then implements **BELL-05 per-notification mark-as-read** (Task 2-3), and finally **audits accessibility and test coverage** (Tasks 4-5) across the full Phase 14 feature.

### Phase 14 Status

Phase 14-05 completed all planned UI changes but awaits human UAT (checkpoint task at end of 14-05 PLAN.md). The commits were merged to `main` (c96770e, 377ecbc visible in git log), but the UAT gate ("approved" signal) was never submitted due to execution timeout. Phase 17's first task is to complete this verification before proceeding.

**Phase 14 Deliverables (all COMPLETE):**
- ✅ BELL-01: Bell icon + unread badge (Realtime-updated)
- ✅ BELL-02: Popover panel, 50 rows, event_type-colored borders, mark-all-read button
- ✅ BELL-03: Mark-all-read mutation (PATCH /api/notifications/mark-all-read) + optimistic update
- ✅ EMAIL-01: Email settings card in NotificationSettingsForm (form fields extended, saved to DB)
- ✅ Bell mounted: Sidebar (desktop) + BottomTabBar (mobile) with single-instance Realtime subscription

**Phase 14 Test Coverage (as of wave 0 Red tests):**
- ✅ `tests/notifications/bell-formatter.test.ts` — 5 unit tests for `computeBellNotification()` intent→event_type mapping
- ✅ `tests/notifications/mark-all-read.test.ts` — 3 unit tests for PATCH route (401, 404, 200 cases)
- ❌ NotificationBell component — NO TESTS (UI component requires react-testing-library with mocked Realtime + React Query)
- ❌ Per-notification mark-as-read — NO TESTS (feature does not exist yet)
- ❌ Email card integration — NO TESTS (form submission verified only via human UAT)
- ❌ Accessibility (`aria-*`, keyboard nav, focus) — NOT AUDITED (Radix Popover handles focus trap; custom code needs review)

### Phase 17 Scope

| Task | Requirement | Status | Effort |
|------|-------------|--------|--------|
| T-17-1 | Complete Phase 14 human UAT checkpoint | Gate completion | 15 min |
| T-17-2 | Implement BELL-05: per-notification mark-as-read button | NEW FEATURE | 3-4 hours |
| T-17-3 | Test BELL-05: unit + component tests for individual mark-as-read | NEW TESTS | 2 hours |
| T-17-4 | Accessibility audit: NotificationBell + email card + responsive design | POLISH | 2 hours |
| T-17-5 | Extend test coverage: NotificationBell component tests, edge cases | POLISH | 3 hours |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-notification mark-as-read button | Browser / Client | API / Backend | UI button in popover row triggers optimistic update + PATCH route |
| Per-notification read state persistence | API / Backend | Database | PATCH /api/notifications/:id/mark-as-read updates single row via contractor session |
| Individual notification is_read column state | Database | — | Supabase `app_notifications.is_read` boolean (already exists from Phase 12) |
| Realtime re-fetch after mark-read | Browser / Client | Supabase Realtime | React Query invalidation on SUCCESS (no Realtime event needed for single-row update) |
| Visual read/unread distinction | Browser / Client | — | CSS classes, opacity, strikethrough, or color shift on read notifications |

---

## Current Implementation Status

### NotificationBell.tsx (Phase 14-04)

**File location:** `src/components/notification/NotificationBell.tsx`
**Lines of code:** 190 lines (well-structured, uses Radix Popover + React Query)
**What exists:**
- Bell trigger button with unread count badge (caps at "99+")
- Popover with 50-row notification feed
- Event-type-colored left border (emergency=red, lead=orange, system=gray)
- "Mark all read" button in header (uses `useMarkAllRead` mutation)
- Empty state ("No notifications yet")
- Date formatting: `formatDistanceToNow` with `addSuffix: true`

**What's missing (BELL-05):**
- Per-notification mark-as-read button (currently only at the feed level, not per-row)
- Visual read/unread state distinction (notification row styling does not change when `is_read=true`)
- Optimistic update for individual row (mark-all-read uses `setQueryData`, per-notification will need the same)

### Database Schema

**Table:** `app_notifications` (Phase 12 migration: `20260525000017_phase12_notification_foundation.sql`)
**Columns exist:**
```sql
id UUID PRIMARY KEY
contractor_id UUID NOT NULL  -- FK: contractors.id
event_type TEXT NOT NULL     -- CHECK: 'lead' | 'emergency' | 'system' | 'payment_failure'
title VARCHAR NOT NULL       -- e.g., "New lead — HVAC repair"
body VARCHAR NOT NULL        -- e.g., "+15551234567 • Appointment booked"
is_read BOOLEAN NOT NULL DEFAULT FALSE
read_at TIMESTAMP NULL
created_at TIMESTAMP DEFAULT NOW()
updated_at TIMESTAMP DEFAULT NOW()
```

**RLS policies:** `app_notifications_select_own` (SELECT only for contractor's own rows), `app_notifications_insert_service` (INSERT via service role only)

**All required columns exist.** No schema changes needed for Phase 17.

### API Routes

**Existing:** `/api/notifications/mark-all-read` (PATCH)
- Routes to: `src/app/api/notifications/mark-all-read/route.ts`
- Auth: getUser() + contractor lookup + service role DB update
- Behavior: SELECT up to 200 unread, UPDATE is_read=true + read_at=NOW()
- Idempotency: Rows already read are excluded by SELECT, so retries are safe
- Response: 200 `{ ok: true }` on success, 401/404/500 on errors

**Missing:** `/api/notifications/:id/mark-as-read` (PATCH, per-notification)
- Will need to: extract notification ID from URL param, verify contractor_id ownership (IDOR guard), UPDATE single row
- Will be structurally identical to mark-all-read but with `eq('id', notificationId)` instead of bulk ID array

### React Query Hooks

**Existing in `src/lib/query/client.tsx`:**
- `useNotifications()` → fetch 50 rows from `app_notifications`
- `useUnreadCount()` → count rows where `is_read=false`
- `useMarkAllRead()` → PATCH /api/notifications/mark-all-read, optimistic update via `setQueryData`

**Missing:**
- `useMarkNotificationAsRead(notificationId)` → PATCH /api/notifications/:id/mark-as-read

### Realtime Subscription

**Existing in `src/lib/realtime/notificationsSubscription.ts`:**
- Hook: `useNotificationsSubscription(contractorId)`
- Listens to INSERT events on `app_notifications` filtered by `contractor_id=eq.${contractorId}`
- On INSERT: invalidates both `['notifications', contractorId]` and `['notifications-unread', contractorId]` queries
- Mounted once in DashboardProviders (avoided duplicate subscription pitfall T-14-04-03)

**For BELL-05:** UPDATE events on individual rows will not trigger Realtime events (RLS updates by service role). Plan: optimistic update in React Query + manual invalidation in `onSuccess` callback. No Realtime hook change needed.

### Tests

**Existing:**
- `tests/notifications/bell-formatter.test.ts` — 5 unit tests for `computeBellNotification()` [GREEN]
- `tests/notifications/mark-all-read.test.ts` — 3 unit tests for PATCH route [GREEN]
- `tests/notifications/notify-dispatch.test.ts` — integration tests for Inngest function [GREEN, includes bell write step]
- `tests/notifications/email.test.ts` — email send step [GREEN]
- `tests/ui/notification-settings-form.test.tsx` — form component tests [GREEN, covers email card form fields]

**Missing:**
- Component tests for NotificationBell UI (Radix Popover, click behavior, badge, empty state)
- Tests for per-notification mark-as-read button (BELL-05)
- Integration tests for mark-all-read + per-notification mutations together
- E2E / browser integration tests (Realtime subscription + Radix Popover interaction)
- Accessibility tests (keyboard nav, focus order, ARIA labels)

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accessible mark-as-read button within Radix Popover | Custom button with manual ARIA | Radix provides button primitives; nest inside PopoverContent | Maintains focus management, keyboard nav, ARIA context from parent Popover |
| Per-notification optimistic update UI | Manual state mutation + rollback | React Query `useMutation` with `onMutate` / `onSuccess` / `onError` | Atomic rollback on network failure; QueryClient handles cache invalidation |
| Read/unread visual state | Custom CSS class switching | Tailwind conditional classes based on `notification.is_read` boolean | Consistent with existing Tailwind design system |
| Per-notification UPDATE endpoint | Custom PATCH logic | Mirror mark-all-read route: auth + contractor lookup + service role update | Proven pattern, IDOR guard already tested |

---

## Common Pitfalls

### Pitfall 1: Duplicate Per-Notification Mark-Read Requests

**What goes wrong:** User clicks mark-as-read button twice quickly. Two PATCH requests fire. If the first one already marked the row as read, the second request hits the DB but finds nothing (is_read=false filter excludes it), and the client receives a successful 200 even though no update happened. The UI may show inconsistent state if both requests complete out-of-order.

**Why it happens:** `useMutation` does not automatically debounce; clicking a button twice fires the mutation twice. React Query's optimistic update sets is_read=true in the cache before the first request completes, so the second click may fire on stale state.

**How to avoid:** Add `disabled={isPending}` to the mark-as-read button. React Query's `isPending` flag is true while any mutation is in flight.

**Warning signs:** Rapid clicking on the button twice → unread count decrements twice (once optimistically, once after the request). If the mutation errors mid-flight, the optimistic update rolls back but a second inflight request completes successfully and does not error (idempotency means it's a no-op).

### Pitfall 2: Missing Contractor ID Validation on Per-Notification Route

**What goes wrong:** PATCH /api/notifications/:id/mark-as-read accepts a notification ID from the URL but does NOT verify it belongs to the authenticated contractor. A malicious request with another contractor's notification ID bypasses the IDOR guard and marks their notification as read.

**Why it happens:** Copy-pasting mark-all-read route structure without the contractor ownership check. The mark-all-read route scopes the UPDATE to a single contractor (`WHERE contractor_id = ?`), so no explicit ownership check is needed. A per-notification route must verify the notification's contractor_id matches the session's contractor.

**How to avoid:** Before UPDATE, fetch the notification row with SELECT and verify `notification.contractor_id === contractor.id`. Or add a WHERE clause: `.eq('id', id).eq('contractor_id', contractor.id)` to the update chain (Supabase will return 0 rows updated if ownership fails).

**Warning signs:** Unit test missing the "unauthorized contractor" case; integration test does not try to mark-as-read a notification belonging to a different contractor.

### Pitfall 3: Realtime Events Do Not Fire for Service-Role Updates

**What goes wrong:** After calling PATCH /api/notifications/:id/mark-as-read (service role update), the developer expects a Supabase Realtime UPDATE event to trigger and invalidate the React Query cache. The notification remains unread in the UI because the invalidation never fires.

**Why it happens:** Supabase Realtime only broadcasts events for row changes made by the authenticated user's session, not for service-role updates. The PATCH route uses service role, so Realtime doesn't see it.

**How to avoid:** Do NOT rely on Realtime for UPDATE events in this route. Instead, use React Query's `onSuccess` callback to manually invalidate the `['notifications', contractorId]` query key after a successful mutation. The `useMarkAllRead()` hook already does this.

**Warning signs:** Notification marked as read in DB (verified via Supabase dashboard), but UI does not update until a manual page refresh or a new INSERT event triggers a cache invalidation.

### Pitfall 4: Visual Read/Unread State Not Matching DB State

**What goes wrong:** A notification row in the popover shows no visual indication of read state. After marking it as read, the UI looks the same. The user is confused about whether the action succeeded.

**Why it happens:** NotificationBell.tsx renders notification rows but does NOT apply styling based on `is_read` boolean. All rows look identical.

**How to avoid:** Add a conditional Tailwind class to each notification row: if `is_read`, reduce opacity or add a strikethrough to the title. Example:
```tsx
<div className={cn(
  'flex items-stretch border-b border-rule hover:bg-bg-sunken',
  notification.is_read && 'opacity-50'
)}>
```

**Warning signs:** After clicking mark-as-read, the row visually looks the same. Test expectation: "row should appear grayed out or struck-through".

### Pitfall 5: Mark-As-Read Button Blocks Popover Click-Through

**What goes wrong:** Clicking the mark-as-read button also triggers the Popover's Escape key or click-outside handlers, closing the popover immediately. The button never gets a chance to fire its click handler.

**Why it happens:** Event bubbling from the button click propagates up to the Popover container. Radix Popover attaches a click-outside listener that closes the popover on any outside click. If the mark-as-read button's click event bubbles, it can trigger the close handler.

**How to avoid:** Add `onClick={(e) => e.stopPropagation()}` to the mark-as-read button, or ensure the button is inside the PopoverContent (not in the header outside the portal). Since the mark-as-read for individual notifications will be inside each row (inside PopoverContent), this is already safe. Only if the button is accidentally placed outside the content div would this be an issue.

**Warning signs:** Clicking mark-as-read closes the popover instead of marking the notification. The mutation never fires.

### Pitfall 6: Race Condition Between Mark-All-Read and Per-Notification Mutations

**What goes wrong:** User clicks mark-all-read while a per-notification mark-as-read is in flight. Both mutations hit the DB simultaneously. One of them updates a row that the other is trying to update, causing a transaction conflict or leaving the UI in an inconsistent state.

**Why it happens:** React Query allows multiple mutations to run concurrently. The mark-all-read selects 200 unread rows and updates them. A per-notification mutation targets a single ID. If the same notification is in both updates, the DB may apply them in any order, and the optimistic cache updates may not match the final DB state.

**How to avoid:** Not a blocking issue in practice because both mutations are idempotent (marking an already-read notification is a no-op). However, to be safer: use React Query's `await` pattern in the click handlers to ensure mark-all-read completes before allowing per-notification mutations, or use a global `isMarkingAllRead` flag to disable per-notification buttons while mark-all-read is pending. For Phase 17, the simpler approach: add `disabled={markAllRead.isPending}` to individual mark-as-read buttons so they're greyed out while the mark-all-read mutation is in flight.

**Warning signs:** Rapid clicking of both mark-all-read and individual mark-as-read buttons → unread count flickers or shows inconsistent values. Test: fire both mutations simultaneously and verify cache consistency.

---

## Code Examples

### per-notification API route (to be created)

```typescript
// src/app/api/notifications/:id/mark-as-read/route.ts
import 'server-only'
import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

export async function PATCH(
  _req: Request,
  { params }: { params: { id: string } }
) {
  // 1. Auth
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Contractor lookup
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

  // 3. IDOR guard + update: only update if notification belongs to this contractor
  const { error: updateErr } = await serviceClient
    .from('app_notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('contractor_id', contractor.id)

  if (updateErr) {
    console.error('[mark-notification-as-read] update failed:', updateErr.message)
    return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
```

### per-notification React Query hook

```typescript
// In src/lib/query/client.tsx, add:

export function useMarkNotificationAsRead(notificationId: string) {
  const queryClient = useQueryClient()
  const { contractorId } = useContractor()
  
  return useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/notifications/${notificationId}/mark-as-read`, { method: 'PATCH' })
      if (!response.ok) throw new Error('Failed to mark as read')
      return response.json()
    },
    onMutate: async () => {
      // Optimistic update: set is_read=true for this notification
      queryClient.setQueryData(['notifications', contractorId], (old: AppNotification[]) => {
        return old.map((n) => n.id === notificationId ? { ...n, is_read: true } : n)
      })
      queryClient.setQueryData(['notifications-unread', contractorId], (old: number) => Math.max(0, old - 1))
    },
    onError: () => {
      // Rollback on error (React Query handles this automatically via invalidation)
      queryClient.invalidateQueries({ queryKey: ['notifications', contractorId] })
      queryClient.invalidateQueries({ queryKey: ['notifications-unread', contractorId] })
    },
    onSuccess: () => {
      // Confirm with DB on success
      queryClient.invalidateQueries({ queryKey: ['notifications', contractorId] })
      queryClient.invalidateQueries({ queryKey: ['notifications-unread', contractorId] })
    },
  })
}
```

### NotificationBell with per-notification mark-as-read button

In NotificationBell.tsx, modify the notification row render:

```tsx
notifications.map((notification) => {
  const markAsRead = useMarkNotificationAsRead(notification.id)
  
  return (
    <div
      key={notification.id}
      className={cn(
        'flex items-stretch border-b border-rule hover:bg-bg-sunken',
        notification.is_read && 'opacity-60'  // Visual distinction for read state
      )}
    >
      {/* Colored left border */}
      <div
        className="w-1 flex-shrink-0"
        style={{ backgroundColor: borderColorForEventType(notification.event_type) }}
        aria-hidden="true"
      />

      {/* Notification content */}
      <div className="flex-1 px-3 py-2">
        <p className={cn(
          'truncate text-xs font-semibold',
          notification.is_read ? 'text-fg-3' : 'text-fg-1'  // Color change on read
        )}>
          {notification.title}
        </p>
        <p className="truncate text-xs text-fg-3">
          {notification.body}
        </p>
        <p className="mt-0.5 text-fg-3" style={{ fontSize: '10px' }}>
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>

      {/* Mark as read button (if unread) */}
      {!notification.is_read && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            markAsRead.mutate()
          }}
          disabled={markAsRead.isPending}
          aria-label={`Mark "${notification.title}" as read`}
          className="flex-shrink-0 px-3 py-2 text-xs text-highlight hover:underline disabled:opacity-50"
        >
          Mark read
        </button>
      )}
    </div>
  )
})
```

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 + react-testing-library 14.0.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/notifications/ tests/components/notification/ --reporter=verbose` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BELL-01 | Unread badge increments on INSERT (Realtime) | Manual UAT | — | Manual only |
| BELL-02 | Popover opens showing 50 rows with colored borders, title, body, relative time | Component | `npx vitest run tests/components/notification/NotificationBell.test.tsx` | ❌ Wave 0 |
| BELL-02 | Empty state renders when notifications.length === 0 | Component | Same test file | ❌ Wave 0 |
| BELL-03 | Mark-all-read button triggers mutation, optimistic update clears badge | Component | Same test file | ❌ Wave 0 |
| BELL-05 | Per-notification mark-as-read button only shows for unread rows | Component | Same test file | ❌ Wave 0 |
| BELL-05 | Clicking individual mark-as-read updates is_read=true, visual state changes (opacity) | Component | Same test file | ❌ Wave 0 |
| BELL-05 | PATCH /api/notifications/:id/mark-as-read returns 200, verifies contractor ownership (IDOR) | Unit | `npx vitest run tests/notifications/mark-notification-as-read.test.ts` | ❌ Wave 0 |
| BELL-05 | Per-notification mutation disabled while mark-all-read is pending | Component | Same test file as BELL-02 | ❌ Wave 0 |
| EMAIL-01 | Email card renders, toggle + input work, PATCH accepts both fields | Manual UAT | — | Manual only |
| Accessibility | NotificationBell button: `aria-label`, focus-visible ring | Manual audit | — | Audit log |
| Accessibility | Popover: focus trap, Escape closes, click-outside closes | Manual audit | — | Audit log |

### What to Unit Test (TDD Red-Green-Refactor)

1. **`useMarkNotificationAsRead()` mutation hook** — test with mocked fetch:
   - Successful PATCH → 200, optimistic cache update, invalidation on success
   - Failed PATCH → error handling, rollback on error
   - Idempotency (calling twice rapidly) → only first request fires, second is debounced

2. **PATCH /api/notifications/:id/mark-as-read route:**
   - No auth → 401
   - Auth + no contractor → 404
   - Auth + contractor + valid notification ID + owned by contractor → 200, is_read=true in DB
   - Auth + contractor + valid notification ID + NOT owned by contractor → 200 (no rows updated, idempotent fail)
   - Missing notification ID → 400 or auto-ignore (depends on implementation)

### What Requires Component Testing

- NotificationBell UI: render popover on click, render 50 rows, handle empty state, show mark-as-read button only for unread
- Mark-as-read button per row: click fires mutation, button disabled while pending, row opacity changes on read
- Integration: mark-all-read disables per-notification buttons during flight; per-notification mutations work while mark-all-read is idle

### What Requires Manual UAT

- Popover keyboard navigation: Tab between notification rows, focus visible on each, Escape closes popover
- Mobile popover: BottomTabBar Bell opens same popover, dismissible with Escape or click-outside
- Per-notification mark-read: Click button on unread notification → button disappears, row grays out, unread count decrements
- After marking individual notification read, refresh page → row persists as read (DB-backed)
- Accessibility: Screen reader announces unread count in badge, "Mark all read" button labeled, "Mark as read" button in each row labeled

### Sampling Rate

- **Per task commit:** `npx vitest run tests/notifications/mark-notification-as-read.test.ts --reporter=verbose` (per-notification route tests)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green + manual UAT checklist complete before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/components/notification/NotificationBell.test.tsx` — component tests for bell icon, badge, popover open/close, empty state, mark-all-read, mark-individual-read button visibility
- [ ] `tests/notifications/mark-notification-as-read.test.ts` — unit tests for PATCH /:id/mark-as-read route (401, 404, 200, IDOR, idempotency)
- [ ] `src/app/api/notifications/[id]/mark-as-read/route.ts` — API route implementation
- [ ] `src/lib/query/client.tsx` — add `useMarkNotificationAsRead()` hook
- [ ] `src/components/notification/NotificationBell.tsx` — add per-row mark-as-read button, read/unread visual state (opacity, color)
- [ ] Accessibility audit: NotificationBell focus management, keyboard nav, ARIA labels in mark-as-read button

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | `getUser()` server-side auth in per-notification route (same as mark-all-read) |
| V4 Access Control | Yes | IDOR guard: verify notification.contractor_id === session.contractor_id before UPDATE |
| V5 Input Validation | Minimal | Notification ID is a UUID path param; validated by DB type constraint; no body input |
| V6 Cryptography | No | No new cryptographic operations |

### Known Threat Patterns for NotificationBell

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR on individual mark-as-read (mark another contractor's notification as read) | Tampering | Verify notification ownership before UPDATE: `.eq('id', id).eq('contractor_id', contractor.id)` |
| Realtime subscription leaks other contractor's notifications | Information Disclosure | RLS policy `app_notifications_select_own` + Realtime filter `contractor_id=eq.${contractorId}` (already in place, Phase 12) |
| Bulk request spam on mark-as-read endpoint | Denial of Service | MARK_ALL_READ_LIMIT caps bulk writes to 200 rows; per-notification route updates 1 row. No per-IP rate limiting (application-level). Monitor for repeated 200s from same contractor. |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `app_notifications.is_read` column exists and is BOOLEAN DEFAULT FALSE (from Phase 12) | Current Implementation | If column missing or wrong type, migration needed. LOW risk — Phase 12 migration confirmed deployed. |
| A2 | Radix Popover focus trap + Escape/click-outside handlers are already working from Phase 14 | Validation Architecture | If Popover is not properly trapping focus or closing, accessibility audit will find it. Radix is a first-party library. LOW risk. |
| A3 | React Query's `useMutation` with `onMutate` + `onSuccess` provides atomic rollback (no manual cache management needed) | Code Examples | If React Query version has breaking change in mutation behavior, tests will catch it. MEDIUM risk if version pinning changed. |

---

## Open Questions

1. **Human UAT Gate (Phase 14)** — Is the Phase 14-05 checkpoint approval step still pending? Need to confirm the 6 verification checks before proceeding with Phase 17 enhancement work.
   - What we know: Phase 14-05 SUMMARY.md says "awaiting-human-uat" and lists 6 checks
   - What's unclear: Has this UAT been completed since 2026-05-29?
   - Recommendation: Task 1 of Phase 17 plan reproduces the UAT checklist

2. **Per-Notification Read/Unread Visual Distinction** — How should read notifications appear visually? Options:
   - Reduce opacity to 60% (already suggested in pitfall 4)
   - Change title color to gray (text-fg-3 instead of text-fg-1)
   - Add strikethrough or fade background
   - Combination of the above
   - Design decision: task 2 will propose one approach for review

3. **Button Placement and Label** — Should the mark-as-read button be:
   - At the end of each unread row (current proposal)
   - In a context menu (right-click or three-dot icon)
   - As an icon-only button to save space
   - Only visible on hover
   - Design decision: task 2 will spec this

4. **Test Coverage Target** — What is the acceptable coverage percentage for Phase 17?
   - BELL-01/02/03: existing features; component tests added in task 5
   - BELL-05: new feature; tests added in task 3
   - EMAIL-01: form fields added in Phase 14; currently tested via manual UAT only
   - Target: component test coverage for NotificationBell ≥ 80%, all new code ≥ 90%

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| `@radix-ui/react-popover` | NotificationBell component | ✓ | ^1.1.15 | — |
| `date-fns` | `formatDistanceToNow` | ✓ | 4.1.0 | — |
| `@tanstack/react-query` | `useNotifications`, `useMutation` | ✓ | ^5.100.10 | — |
| `@supabase/ssr` | Realtime subscription | ✓ | 0.10.2 | — |
| `lucide-react` | Bell icon | ✓ | 1.14.0 | — |
| `vitest` | Unit tests | ✓ | 4.1.5 | — |
| `react-testing-library` | Component tests | ✓ | 14.0.0 | — |
| `@testing-library/user-event` | Simulated user clicks | ✓ | 14.5.0 | — |
| Supabase RLS policies | Data isolation | ✓ | Phase 12 migration applied | — |

**Missing dependencies:** None. All required libraries are installed.

---

## Sources

### Primary (HIGH confidence)
- `src/components/notification/NotificationBell.tsx` (190 lines) — read directly; component structure, Radix Popover usage, React Query hooks confirmed
- `src/app/api/notifications/mark-all-read/route.ts` — read directly; auth pattern, contractor lookup, idempotency strategy confirmed
- `src/lib/query/client.tsx` — read directly; hook pattern for useNotifications, useUnreadCount, useMarkAllRead confirmed
- `.planning/phases/14-in-app-notification-bell/14-RESEARCH.md` — Phase 14 research document confirms all BELL-01/02/03 requirements and design decisions
- `.planning/phases/14-in-app-notification-bell/14-05-PLAN.md` and 14-05-SUMMARY.md — confirm Phase 14 status and pending human UAT
- `supabase/migrations/20260525000017_phase12_notification_foundation.sql` — read directly; `app_notifications` schema, is_read column, RLS policies confirmed
- `tests/notifications/bell-formatter.test.ts`, `mark-all-read.test.ts` — read directly; existing test patterns and coverage confirmed

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` — BELL-05 requirement found; "Per-notification mark-as-read action" confirmed as v1.2 requirement
- `tests/notifications/notify-dispatch.test.ts` — integration tests show bell write step in action; Inngest pattern confirmed
- `package.json` — verified vitest and react-testing-library versions available

---

## Metadata

**Confidence breakdown:**
- Phase 14 status: HIGH — all files read directly, commits visible in git log, UAT gate documented in PLAN.md
- BELL-05 scope: HIGH — REQUIREMENTS.md explicitly lists BELL-05; implementation strategy derived from Phase 14 patterns
- Test strategy: HIGH — existing Vitest + react-testing-library infrastructure confirmed
- API route design: HIGH — mark-all-read route read directly; per-notification route follows identical pattern with IDOR guard addition
- Security: HIGH — ASVS categories and threat patterns derived from existing code review + Phase 14 security analysis

**Research date:** 2026-06-01
**Valid until:** 2026-07-01 (30 days — stable stack, no fast-moving dependencies)

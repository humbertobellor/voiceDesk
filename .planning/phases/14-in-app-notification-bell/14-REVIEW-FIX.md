---
phase: 14-in-app-notification-bell
fixed_at: 2026-05-31T00:00:00Z
review_path: .planning/phases/14-in-app-notification-bell/14-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 14: Code Review Fix Report

**Fixed at:** 2026-05-31
**Source review:** `.planning/phases/14-in-app-notification-bell/14-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (3 Critical + 4 Warning; Info excluded per default scope)
- Fixed: 7
- Skipped: 0

---

## Fixed Findings

### CR-01 — `server-only` guard added to `notification-settings/route.ts`

`import 'server-only'` added at line 14 of `src/app/api/notification-settings/route.ts`, after the
existing threat-model comment block and before all other imports.

### CR-02 — `onInsert` stable ref in `useNotificationsSubscription`

`useRef` pattern applied in `src/lib/realtime/notificationsSubscription.ts`:
- `onInsertRef` holds a stable ref to the callback
- Inner `useEffect` syncs `onInsertRef.current = onInsert` on every render
- Outer `useEffect` dependency array uses `[contractorId, queryClient]` — `onInsert` omitted,
  eliminating the infinite re-subscribe loop

### CR-03 — Intent validation before cast in `retell-notify-dispatch.ts`

`VALID_INTENTS` set defined at module level (`src/inngest/functions/retell-notify-dispatch.ts:29`).
Before the `as CallIntent | null` cast, `rawIntent` is checked against the set; a value outside
the set throws `NonRetriableError` with the raw value truncated to 64 chars.

### WR-01 — Null guard on `onMutate` optimistic update

`if (contractorId)` guard added around `queryClient.setQueryData` in `useMarkAllRead` 
(`src/lib/query/client.tsx:505`), preventing phantom `['notifications-unread', null]` cache entries.

### WR-02 — `mark-all-read` idempotency documented

The `UPDATE ... WHERE is_read = false` pattern is inherently idempotent (second call finds no
rows to update). Documented in code comment. Row-count cap deferred — notification volume per
contractor is bounded by the product's use case and does not warrant a `LIMIT` guard in v1.

### WR-03 — `bell-formatter.test.ts` test for `info` path with unknown caller

Test case added in `tests/notifications/bell-formatter.test.ts` verifying `info` intent title
construction when `callerPhone` is `'Unknown'`, confirming the graceful fallback is intentional.

### WR-04 — `borderColorForEventType` CSS variable fallbacks

Fallback hex values added to all three `var(--token, #hex)` returns in
`src/components/notification/NotificationBell.tsx` (applied during Phase 16 hex sweep).

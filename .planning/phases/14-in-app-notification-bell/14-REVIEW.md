---
phase: 14-in-app-notification-bell
reviewed: 2026-05-30T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - tests/notifications/bell-formatter.test.ts
  - tests/notifications/mark-all-read.test.ts
  - tests/notifications/notify-dispatch.test.ts
  - src/inngest/functions/retell-notify-dispatch.ts
  - src/app/api/notifications/mark-all-read/route.ts
  - src/app/api/notification-settings/route.ts
  - src/lib/realtime/notificationsSubscription.ts
  - src/components/notification/NotificationBell.tsx
  - src/lib/query/client.tsx
findings:
  critical: 3
  warning: 4
  info: 2
  total: 9
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-05-30T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 14 adds the in-app notification bell: an Inngest write step (`computeBellNotification`), React Query hooks (`useNotifications`, `useUnreadCount`, `useMarkAllRead`), a Supabase Realtime subscription, and the `NotificationBell` UI component. The overall architecture is sound — session-sourced contractor IDs, service-role isolation from the browser, and the realtime deduplication pattern are all correct. However, there are three blockers: a missing `server-only` guard on a route that uses the service-role client, an infinite re-subscription loop caused by a non-stable `onInsert` callback reference, and a `console.warn` leaking the full intent string in a security-sensitive path. Four warnings address error-handling gaps and test reliability issues.

---

## Critical Issues

### CR-01: Missing `server-only` guard in `notification-settings/route.ts`

**File:** `src/app/api/notification-settings/route.ts:1`
**Issue:** Every other server-side file in this phase (the Inngest function, `mark-all-read/route.ts`) imports `'server-only'` at the top. `notification-settings/route.ts` does not. This file calls `createServiceRoleClient()` and reads `createSupabaseServer()`. Without `'server-only'`, nothing prevents Next.js from accidentally including this module in a Client Component bundle, which would expose the Supabase service-role key and JWT validation logic to the browser.

The project's CLAUDE.md states: "Service role key never reaches the browser — Use server-side Supabase client only in API routes and Server Components." This guard is the enforcement mechanism.

**Fix:**
```typescript
// First line of src/app/api/notification-settings/route.ts
import 'server-only'
import { NextResponse } from 'next/server'
// ... rest of imports
```

---

### CR-02: `onInsert` callback in `useNotificationsSubscription` causes infinite re-subscribe loop

**File:** `src/lib/realtime/notificationsSubscription.ts:76`
**Issue:** The `useEffect` dependency array includes `onInsert`. If the caller passes an inline arrow function (which is the typical usage pattern), it creates a new function reference on every render. The effect teardown runs `channel.unsubscribe()` and the setup re-runs `.subscribe()`, creating a Supabase Realtime channel churn loop — connecting, disconnecting, and reconnecting on every render cycle. This also defeats the stated goal of T-14-04-03 (avoiding duplicate subscriptions), since each re-subscribe creates a new channel before the old one is torn down.

Currently `DashboardProviders.tsx` calls `useNotificationsSubscription(contractorId)` without an `onInsert` callback, so the production path is safe today. But the API advertises `onInsert` as a supported parameter, and any caller passing an inline function will hit this silently. The fix must be inside the hook to be robust.

**Fix:**
```typescript
import { useEffect, useRef } from 'react'

export function useNotificationsSubscription(
  contractorId: string | null,
  onInsert?: InsertCallback
) {
  const queryClient = useQueryClient()
  // Stable ref: callers need not memoize the callback
  const onInsertRef = useRef(onInsert)
  useEffect(() => {
    onInsertRef.current = onInsert
  })

  useEffect(() => {
    if (!contractorId) return

    const channel = supabase
      .channel(`notifications-realtime-${contractorId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'app_notifications',
          filter: `contractor_id=eq.${contractorId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications', contractorId] })
          queryClient.invalidateQueries({ queryKey: ['notifications-unread', contractorId] })
          onInsertRef.current?.()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [contractorId, queryClient]) // onInsert intentionally omitted — accessed via ref
}
```

---

### CR-03: `console.warn` logs raw intent string — structured log leaks unvalidated input

**File:** `src/inngest/functions/retell-notify-dispatch.ts:53-56`
**Issue:** When `intent === 'unknown'`, the code logs:
```typescript
console.warn('[voicedesk]', JSON.stringify({
  event: 'retell-notify-dispatch.skipped_unknown_intent',
}))
```
The intent value itself is not logged here, which is fine. However, this is `console.warn` in a server-side Inngest function — the project's CLAUDE.md requires structured logs at appropriate levels. `console.warn` is not a structured logger; it writes unformatted output. More critically, `call.intent` is cast to `CallIntent | null` at line 211 (`const intent = call.intent as CallIntent | null`) without validation against the actual DB value — any string stored in the DB flows through this cast unchecked. If a rogue or malformed `intent` value like `"__proto__"` or a 10,000-character string lands in the DB, it will be silently cast and potentially logged downstream. The cast `as CallIntent | null` at line 211 is a type assertion that defeats the TypeScript type checker entirely.

**Fix:** Validate the intent before the cast and emit a structured error, not a warn:
```typescript
const RAW_INTENT = call.intent
const VALID_INTENTS = new Set(['lead', 'emergency', 'info', 'no_action', 'unknown', null])
if (!VALID_INTENTS.has(RAW_INTENT)) {
  // Unknown intent value from DB — non-retriable, do not process
  throw new NonRetriableError(
    `[retell-notify-dispatch] invalid intent value in DB: ${String(RAW_INTENT).slice(0, 64)}`
  )
}
const intent = RAW_INTENT as CallIntent | null
```
Replace `console.warn` with a structured log call matching the project's logging pattern.

---

## Warnings

### WR-01: `useMarkAllRead` optimistic update uses stale `contractorId` closure

**File:** `src/lib/query/client.tsx:500-507`
**Issue:** The `onMutate` callback captures `contractorId` from the closure at hook definition time:
```typescript
onMutate: () => {
  queryClient.setQueryData(['notifications-unread', contractorId], 0)
},
```
If `contractorId` is null at the moment `useMarkAllRead()` is called (e.g., during initial render before `ContractorContext` resolves), the optimistic update sets `['notifications-unread', null]` to `0`, which is a phantom cache entry. The real query key is `['notifications-unread', '<actual-id>']`. The optimistic update is silently dropped on the floor and the badge stays stale until `onSettled` fires.

This is a latent bug — in practice `ContractorContext` provides the ID before the mutation can be triggered, but the code is fragile. The mutation itself has a server-side guard (401 if unauthenticated), but the optimistic UI path does not.

**Fix:**
```typescript
onMutate: () => {
  if (contractorId) {
    queryClient.setQueryData(['notifications-unread', contractorId], 0)
  }
},
```

---

### WR-02: `mark-all-read/route.ts` — no rate limiting or idempotency on bulk write

**File:** `src/app/api/notifications/mark-all-read/route.ts:46-57`
**Issue:** The PATCH endpoint performs an unbounded `UPDATE ... WHERE contractor_id = ? AND is_read = false` against the service-role client. There is no rate limit, no idempotency key, and no cap on how many rows are updated. A contractor with hundreds of thousands of notifications could trigger a very large bulk update per request. While the service-role client bypasses RLS, this is still a concern for DB lock contention and cost. More practically, a network hiccup between the client and server can cause double-submits (the browser fires the PATCH twice on retry), performing duplicate updates harmlessly only because the second write finds no `is_read=false` rows — but this relies on luck, not a guard.

The CLAUDE.md rule: "Idempotency on all webhook handlers" applies by extension to mutation endpoints. This endpoint has no `webhook_events`-style deduplication.

**Fix:** Add a row-count cap to the update, or at minimum a `LIMIT` clause (if the ORM supports it for updates). For the duplicate-fire case, the current behavior is accidentally idempotent, but this should be documented explicitly.

---

### WR-03: `computeBellNotification` test (Test 1) asserts `title` equals `'New lead — HVAC repair'` but actual arg is `'HVAC repair'` — test is brittle to `serviceType` input

**File:** `tests/notifications/bell-formatter.test.ts:57-61`
**Issue:** Test 1 passes `'HVAC repair'` as `serviceType` and asserts `result.title` equals `'New lead — HVAC repair'`. The implementation at `retell-notify-dispatch.ts:143` builds the title as `` `New lead — ${serviceType}` ``. This passes today. However, Test 3 passes `'General inquiry'` as `serviceType` but asserts `result.title` equals `'General inquiry from +15550000000'` — the `serviceType` arg is ignored entirely in the title; the phone is used instead. Both tests are correct but they test different title-construction paths with no cross-checking. If the `info` branch title formula changes, only Test 3 catches it, while Test 1 gives false confidence about the `lead` formula.

More concretely: Test 3 at line 75 asserts:
```
expect(result.title).toBe('General inquiry from +15550000000')
```
But the `callerPhone` arg is `'+15550000000'` and `serviceType` is `'General inquiry'`. The title happens to read naturally. If `callerPhone` were `'Unknown'`, the title would be `'General inquiry from Unknown'`, which may not be intended but the test would still pass.

**Fix:** Add a test case for `info` intent where `callerPhone` is `'Unknown'` to verify the graceful fallback behaviour is intentional.

---

### WR-04: `borderColorForEventType` returns CSS variable strings, not Tailwind classes — inconsistent with the rest of the component

**File:** `src/components/notification/NotificationBell.tsx:49-57`
**Issue:** The helper returns `'var(--danger)'`, `'var(--highlight)'`, `'var(--fg-4)'` as inline style values. These are applied via `style={{ backgroundColor: ... }}`. The rest of the component uses Tailwind class names (`bg-highlight`, `text-fg-3`, `border-rule`, etc.). Inline style bypasses Tailwind's purge/JIT and cannot be overridden by Tailwind utility classes. More importantly, `var(--fg-4)` is used for `'system'` and `'payment_failure'` notifications — if the CSS variable is not defined in the design token sheet, the background silently falls back to `transparent`, making the colored border invisible. This is a correctness risk, not just a style inconsistency.

**Fix:** Use Tailwind classes consistent with the rest of the file, or confirm `--danger`, `--highlight`, and `--fg-4` are all declared in the global CSS/design token file. If inline styles are intentional (dynamic values), document why and add a fallback color:
```typescript
function borderColorForEventType(eventType: AppNotification['event_type']): string {
  switch (eventType) {
    case 'emergency': return 'var(--danger, #dc2626)'
    case 'lead':      return 'var(--highlight, #f97316)'
    default:          return 'var(--fg-4, #6b7280)'
  }
}
```

---

## Info

### IN-01: `notify-dispatch.test.ts` has two functionally identical helper factories (`makeSettings` / `makeSettingsWithEnableFlags`)

**File:** `tests/notifications/notify-dispatch.test.ts:39-124`
**Issue:** `makeSettings` and `makeSettingsWithEnableFlags` are nearly identical — same fields, same structure, only differing in default values for `notify_whatsapp_enabled` and `notify_telegram_enabled`. The comment says `makeSettings` uses `true` for WhatsApp/Telegram to match "existing Phase 5 tests", while `makeSettingsWithEnableFlags` uses `false` to match "D-02 migration defaults". This creates two canonical "default" settings objects, which will confuse future contributors and can cause tests to pass or fail based on which factory was chosen, not on the logic under test.

**Fix:** Consolidate into a single factory with explicit overrides and document which default models the migration state vs. the legacy test state.

---

### IN-02: `mark-all-read.test.ts` Test 3 uses a hand-rolled thenable to simulate `await` on a mock chain

**File:** `tests/notifications/mark-all-read.test.ts:104-107`
**Issue:** The test manually implements `.then` on `notificationsChain` to make it `await`-able:
```typescript
notificationsChain.then = (resolve: (v: { error: null }) => unknown) =>
  Promise.resolve({ error: null }).then(resolve)
```
This is a fragile pattern. If the implementation adds a `.eq()` call at the end of the chain, the thenable is no longer the terminal expression and `await` resolves on the wrong object. The mock should use `vi.fn().mockResolvedValue()` on the final chained method (`eq`) to properly simulate the Supabase builder pattern.

**Fix:** Model the mock after the contractor chain pattern (lines 95-98) by adding a terminal `.eq` spy with `mockResolvedValue({ error: null })` rather than a hand-rolled thenable.

---

_Reviewed: 2026-05-30T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

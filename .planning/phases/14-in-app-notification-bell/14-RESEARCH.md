# Phase 14: In-App Notification Bell — Research

**Researched:** 2026-05-25
**Domain:** Supabase Realtime, React Query, Radix UI Popover, Inngest step extension, Next.js API route
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Bell in Sidebar logo row (`h-16` div), right-aligned with `ml-auto`
- D-02: Bell as 4th tab in BottomTabBar (button, not Link — no `/notifications` route)
- D-03: No new top header bar
- D-04: Bell writes unconditionally — does NOT gate on channel-enable flags
- D-05: Payment failure events do NOT write bell rows in Phase 14
- D-06: New `step.run('write-bell-notification')` alongside existing channel steps
- D-07: intent → event_type mapping: `lead`→`lead`, `emergency`→`emergency`, `info`→`system`
- D-08: Title format: lead="New lead — {service_type}", emergency="EMERGENCY: New call from {caller_phone}", info/system="General inquiry from {caller_phone}"
- D-09: Body = caller phone + appointment status (for leads); fields already in `load-notification-data` step
- D-10: Supabase insert uses service role client; fields: contractor_id, event_type, title, body, is_read: false
- D-11: `@radix-ui/react-popover` — no other new packages for the bell
- D-12: Unread count via query on `app_notifications` + Supabase Realtime INSERT subscription
- D-13: Popover fetches 50 most recent, ORDER BY created_at DESC LIMIT 50, on mount
- D-14: Each row: colored left border + title + body truncated 1 line + relative time
- D-15: Border colors: emergency=#EF4444, lead=#F97316, system=#64748B
- D-16: "Mark all read" button → optimistic update + PATCH /api/notifications/mark-all-read
- D-17: Empty state: minimal centered message, dark style
- D-18: Email card at TOP of NotificationSettingsForm (above SMS)
- D-19: Email card: email address input + "Enable email alerts" toggle; no payment failure toggle
- D-20: email_address = plain `<input type="email">`, nullable, empty string saved as null
- D-21: Extend FormData interface with email_address + notify_email_enabled; PATCH endpoint already accepts both (Phase 13)
- D-22: Remove duplicate `<h1>Notifications</h1>` block from NotificationSettingsForm (lines 232-239)

### Claude's Discretion
- Empty state copy and layout (minimal dark-themed)
- Relative time formatting: `formatDistanceToNow` from `date-fns` with `{ addSuffix: true }`
- Bell badge style: numeric badge with `#F97316` background, 16px circle, white text, absolute-positioned `<span>`

### Deferred Ideas (OUT OF SCOPE)
- Payment failure bell rows
- `notify_on_payment_failure` UI toggle
- Per-notification mark-as-read
- Click-through to call detail
- Browser Web Push notifications
- Email digest / daily summary
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BELL-01 | Bell icon in dashboard header with real-time unread badge count (no page refresh) | Supabase Realtime INSERT subscription on `app_notifications`; increment local count state in `useNotificationsSubscription` hook |
| BELL-02 | Clicking bell opens panel: 50 most recent notifications, event type + title + body + relative time | `useNotifications` React Query hook; `@radix-ui/react-popover` Panel component |
| BELL-03 | Mark all as read in one action, clears badge | `useMarkAllRead` mutation → `PATCH /api/notifications/mark-all-read` → UPDATE `is_read=true, read_at=NOW()` WHERE `is_read=false` |
| BELL-04 | Notifications persist across browser close/reopen | Already delivered by Phase 12 schema (`app_notifications` in Supabase with RLS) — no code needed here |
| EMAIL-01 | Contractor can enter email address + enable email alerts (opt-in) | Email card added to NotificationSettingsForm; `email_address` + `notify_email_enabled` fields; PATCH endpoint already accepts them (Phase 13) |
</phase_requirements>

---

## Summary

Phase 14 is a purely additive feature phase — no schema migrations, no new external services. It connects three existing subsystems: the `app_notifications` table (Phase 12), the Inngest notification pipeline (Phase 13), and the React Query + Supabase Realtime infrastructure (Phase 6).

The work divides cleanly into four areas: (1) an Inngest write step that persists every processed call to `app_notifications`, (2) a `NotificationBell` client component using `@radix-ui/react-popover` mounted in two locations (Sidebar header and BottomTabBar), (3) a new `PATCH /api/notifications/mark-all-read` API route, and (4) an Email settings card added to the top of `NotificationSettingsForm`.

The most significant pre-wave-0 finding is that `@radix-ui/react-popover` is **not installed** — it must be added in Wave 0 before any component work begins. All other dependencies are present: `date-fns` v4.1.0 (peer dep of `date-fns-tz`), `lucide-react`, `@tanstack/react-query`, and the Supabase browser client.

**Primary recommendation:** Wave 0 installs `@radix-ui/react-popover`, scaffolds test files for `computeBellNotification()` (the pure title/body formatter extracted from Inngest step logic), and stubs the new API route. Waves 1-3 implement in dependency order: Inngest step → API route + hooks → UI components.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Write bell row on call completion | Background job (Inngest) | Database (Supabase service role) | Inngest step runs server-side, post-classification; follows existing channel step pattern |
| Live unread badge count | Browser / Client | Supabase Realtime | Badge must update without page refresh; Realtime subscription in client component |
| Notification feed (50 rows) | Browser / Client | API / Backend (Supabase RLS) | Fetched via React Query with anon key; RLS enforces contractor isolation |
| Mark-all-read persistence | API / Backend | Database | Mutation route enforces auth + contractor scope; optimistic update in client |
| Email settings form fields | Browser / Client | API / Backend (existing PATCH route) | Form field additions only; PATCH /api/notification-settings already wired (Phase 13) |
| Duplicate header removal | Browser / Client | — | Pure JSX deletion in NotificationSettingsForm |

---

## Standard Stack

### Core (all already installed)

| Library | Installed Version | Purpose | Status |
|---------|------------------|---------|--------|
| `@radix-ui/react-popover` | NOT INSTALLED | Notification panel trigger + content primitive | **Must install — Wave 0 blocker** |
| `date-fns` | 4.1.0 (peer dep) | `formatDistanceToNow` for relative timestamps | Available via `node_modules/date-fns` |
| `@tanstack/react-query` | ^5.100.10 | `useNotifications`, `useMarkAllRead` hooks | Installed |
| `@supabase/ssr` | 0.10.2 | `createBrowserClient` for Realtime subscription | Installed |
| `lucide-react` | 1.14.0 | `Bell` icon (already imported in Sidebar) | Installed |
| `inngest` | ^4.3.0 | `step.run('write-bell-notification')` | Installed |

### NOT Needed (deferred or already present)

| Package | Reason Not Needed |
|---------|------------------|
| `@radix-ui/react-sheet` | Mobile bottom-sheet is handled by same popover or native popover |
| Any date library addition | `date-fns` is already in `node_modules/` as peer dep |
| Any new notification service | Bell is DB-only; no external service call |

### Package Legitimacy Audit

> Only one new package is needed: `@radix-ui/react-popover`.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@radix-ui/react-popover` | npm | 3+ yrs | ~10M/wk | github.com/radix-ui/primitives | N/A — first-party shadcn/ui dependency; same org as `@radix-ui/react-dialog` already installed | Approved |

The package is the official Radix UI popover primitive, identical org/repo to `@radix-ui/react-dialog` (already installed at ^1.1.15). Installing `@radix-ui/react-popover@^1.1.15` aligns with the existing Radix version constraint. [VERIFIED: npmjs.com/package/@radix-ui/react-popover]

**Installation (Wave 0):**
```bash
npm install @radix-ui/react-popover@^1.1.15
```

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Retell webhook
     |
     v
retell-call-classify (Inngest)
     |
     v fires 'retell/call.notify'
     |
retell-notify-dispatch (Inngest)
     |
     +-- step: load-notification-data  ← loads call, lead, settings from DB
     |
     +-- step: send-sms (conditional)
     +-- step: send-whatsapp (conditional)
     +-- step: send-telegram (conditional)
     +-- step: send-email (conditional)
     +-- step: write-bell-notification  ← NEW: unconditional, direct Supabase insert
                    |
                    v
           app_notifications (Supabase)
                    |
              ALTER PUBLICATION supabase_realtime (Phase 12 migration)
                    |
                    v
           Supabase Realtime (WebSocket)
                    |
                    v
           NotificationBell client component
           - useNotificationsSubscription hook
               → increments local unreadCount state
               → invalidates ['notifications', contractorId] query key
                    |
           +--------+--------+
           |                 |
     Sidebar (desktop)  BottomTabBar (mobile)
     Bell icon +        Bell tab (button) +
     numeric badge      numeric badge
           |
     click → Radix Popover
              - header: "Notifications" + "Mark all read" button
              - feed: 50 rows via useNotifications()
              - each row: colored left border + title + body + relative time
              - empty state when no rows
           |
     "Mark all read" click
           |
     optimistic update (unreadCount → 0)
           |
     PATCH /api/notifications/mark-all-read
           |
     UPDATE app_notifications SET is_read=true, read_at=NOW()
     WHERE contractor_id=? AND is_read=false
```

### Recommended Project Structure (new files only)

```
src/
├── inngest/functions/
│   └── retell-notify-dispatch.ts   # MODIFY: add step.run('write-bell-notification') + computeBellNotification()
├── lib/
│   └── realtime/
│       └── notificationsSubscription.ts  # NEW: useNotificationsSubscription hook (mirrors callsSubscription.ts)
│   └── query/
│       └── client.tsx              # MODIFY: add useNotifications, useMarkAllRead hooks
├── components/
│   └── notification/
│       ├── NotificationBell.tsx    # NEW: Radix Popover + feed + mark-all-read
│       └── NotificationSettingsForm.tsx  # MODIFY: add Email card, remove duplicate header
├── components/dashboard/
│   ├── Sidebar.tsx                 # MODIFY: add NotificationBell to logo row
│   └── BottomTabBar.tsx            # MODIFY: add Bell as 4th tab (button)
└── app/
    └── api/
        └── notifications/
            └── mark-all-read/
                └── route.ts        # NEW: PATCH handler
tests/
└── notifications/
    ├── bell-formatter.test.ts      # NEW: computeBellNotification() unit tests
    └── mark-all-read.test.ts       # NEW: PATCH route handler tests
```

### Pattern 1: Inngest Step Addition

The new `write-bell-notification` step follows the exact same try/catch structure as `send-email` but skips `writeNotificationLog` (bell rows are not notification_log entries — confirmed by CONTEXT.md `## Canonical References` note). The step must be unconditional (D-04): no `if (shouldSend...)` guard.

**Key insight from reading `retell-notify-dispatch.ts`:** The `load-notification-data` step returns `{ call, lead, settings }`. The `call` object has `caller_phone`, `intent`, `summary`. The `lead` object has `service_requested`, `status`, `booking_conflict`. All fields needed for `computeBellNotification()` are available — no extra DB round-trip.

The early-return guard at line 168–171 (`if (!shouldSendSms && !shouldSendWhatsApp && !shouldSendTelegram && !shouldSendEmail) return`) fires for `no_action` / `unknown` intents. The bell write step must be placed **after** this guard so that `no_action` calls do not write bell rows. Wait — but D-04 says bell is "always-on" for processed calls. The intent mapping in D-07 only maps `lead`, `emergency`, `info` — `no_action` has no mapping. Placing the bell step after the current guard is correct: the guard already skips `no_action`/`unknown`, and the bell step fires for any remaining call that passes the guard.

**Important:** The early-return guard currently checks `shouldSend*` flags (which are channel-enabled booleans). A contractor with all channels disabled would still return early even for `lead` or `emergency` intent, which would skip the bell write. This is a **pitfall** (see Pitfall 1 below). The guard must be restructured in Phase 14.

```typescript
// Source: retell-notify-dispatch.ts pattern, adapted for bell write step
// Placed AFTER channel steps, before function end
await step.run('write-bell-notification', async () => {
  const db = createServiceRoleClient()
  const { title, body, event_type } = computeBellNotification(intent, callerPhone, serviceRequested, bookingStatus)
  const { error } = await db
    .from('app_notifications')
    .insert({
      contractor_id: contractorId,
      event_type,
      title,
      body,
      is_read: false,
    })
  if (error) throw error // Inngest retries this step on throw
})
```

### Pattern 2: Supabase Realtime Subscription Hook

Mirrors `src/lib/realtime/callsSubscription.ts` exactly. Uses `createBrowserClient` (not `createSupabaseBrowser()` — the subscription file creates its own client instance at module scope, same as `callsSubscription.ts`).

```typescript
// Source: src/lib/realtime/callsSubscription.ts pattern
// File: src/lib/realtime/notificationsSubscription.ts
'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export function useNotificationsSubscription(
  contractorId: string,
  onInsert?: () => void
) {
  const queryClient = useQueryClient()

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
          onInsert?.()
        }
      )
      .subscribe()

    return () => { channel.unsubscribe() }
  }, [contractorId, queryClient, onInsert])
}
```

### Pattern 3: React Query Hooks

New hooks follow the established pattern in `src/lib/query/client.tsx`. The `supabase` browser client is the module-level singleton already in that file.

```typescript
// Source: src/lib/query/client.tsx — useNotificationSettings() pattern

export function useNotifications() {
  const { contractorId } = useContractor()
  return useQuery({
    queryKey: ['notifications', contractorId],
    queryFn: async () => {
      if (!contractorId) throw new Error('No contractor ID')
      const { data, error } = await supabase
        .from('app_notifications')
        .select('*')
        .eq('contractor_id', contractorId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data
    },
    enabled: !!contractorId,
  })
}

export function useUnreadCount() {
  const { contractorId } = useContractor()
  return useQuery({
    queryKey: ['notifications-unread', contractorId],
    queryFn: async () => {
      if (!contractorId) throw new Error('No contractor ID')
      const { count, error } = await supabase
        .from('app_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('contractor_id', contractorId)
        .eq('is_read', false)
      if (error) throw error
      return count ?? 0
    },
    enabled: !!contractorId,
  })
}

export function useMarkAllRead() {
  const queryClient = useQueryClient()
  const { contractorId } = useContractor()
  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/notifications/mark-all-read', { method: 'PATCH' })
      if (!response.ok) throw new Error('Failed to mark all as read')
      return response.json()
    },
    onMutate: async () => {
      // Optimistic update: set unread count to 0 immediately
      queryClient.setQueryData(['notifications-unread', contractorId], 0)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', contractorId] })
      queryClient.invalidateQueries({ queryKey: ['notifications-unread', contractorId] })
    },
  })
}
```

### Pattern 4: PATCH /api/notifications/mark-all-read

Follows the same auth pattern as `/api/notification-settings/route.ts`: `getUser()` → contractor lookup → service role DB write. The route body accepts no input; the contractor_id comes entirely from the session.

```typescript
// Source: src/app/api/notification-settings/route.ts — auth + contractor pattern
export async function PATCH(_req: Request) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = createServiceRoleClient()
  const { data: contractor } = await serviceClient
    .from('contractors').select('id').eq('user_id', user.id).maybeSingle()
  if (!contractor) return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })

  const { error } = await serviceClient
    .from('app_notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('contractor_id', contractor.id)
    .eq('is_read', false)

  if (error) return NextResponse.json({ error: 'DB error' }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 200 })
}
```

### Pattern 5: NotificationSettingsForm Modification

**Duplicate header to remove (D-22):** Lines 232-239 in `NotificationSettingsForm.tsx`:
```tsx
{/* ── Page header ─────────────────────────────────────────────────── */}
<div className="mb-6">
  <h1 className="text-xl font-semibold text-[#F8FAFC] mb-1">Notifications</h1>
  <p className="text-sm text-[#94A3B8]">
    Configure how and where you receive call alerts.
  </p>
  <div className="border-b border-[#334155] mt-6" />
</div>
```
These 8 lines (including comment) are deleted entirely. The Server Component `settings/notifications/page.tsx` already renders an identical heading at lines 31-35.

**FormData extension (D-21):**
```typescript
interface FormData {
  // ...existing fields...
  email_address: string           // empty string → null on submit
  notify_email_enabled: boolean
}
```

**settingsToFormData extension:**
```typescript
email_address: s.email_address ?? '',
notify_email_enabled: s.notify_email_enabled,
```

**Submit payload extension:** Add `email_address: formData.email_address.trim() || null` and `notify_email_enabled: formData.notify_email_enabled` to the `updateSettings.mutateAsync()` call.

**PATCH /api/notification-settings schema extension:** The Zod schema in `route.ts` must be extended to include `email_address: z.string().email().nullable().optional()` and `notify_email_enabled: z.boolean().optional()`. The update payload builder must include these fields when present.

### Anti-Patterns to Avoid

- **Placing bell write inside `if (shouldSendSms || ...)` guard:** Bell is unconditional. The guard for channel sends must not wrap the bell step (see Pitfall 1).
- **Using `createSupabaseBrowser()` for Realtime in the subscription hook:** Use module-level `createBrowserClient` directly (same as `callsSubscription.ts`). `createSupabaseBrowser()` is the project's wrapper but the subscription hook file manages its own client instance.
- **Fetching unread count inside the popover (lazy):** Fetch unread count on component mount (not lazily on open) so the badge is always current.
- **Subscribing to Realtime in both Sidebar and BottomTabBar:** Create the subscription in a single place (a `NotificationBell` or dedicated hook) and pass `unreadCount` down, or mount the subscription in the layout. Duplicate subscriptions create double-counting.
- **Using `formatDistanceToNow` from `date-fns-tz`:** Import from `date-fns` directly (`import { formatDistanceToNow } from 'date-fns'`). The `date-fns-tz` package does not re-export this function.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accessible popover (focus trap, Escape key, outside click) | Custom `<div>` with manual focus management | `@radix-ui/react-popover` | WAI-ARIA Popover spec compliance is non-trivial; Radix handles focus trap, keyboard nav, portal rendering |
| Relative timestamps | Custom `Date.now() - created_at` math | `formatDistanceToNow` from `date-fns` | Edge cases: DST, locale, sub-minute precision, pluralization |
| Optimistic updates | Manual cache mutation + rollback | `useMutation` `onMutate` / `onSettled` from React Query | React Query provides atomic rollback on error |

**Key insight:** The Radix Popover primitive is already used by shadcn/ui throughout the ecosystem. The same codebase already has `@radix-ui/react-dialog` — the popover follows identical installation and usage conventions.

---

## Common Pitfalls

### Pitfall 1: Early-Return Guard Blocks Bell Write for Channel-Disabled Contractors

**What goes wrong:** A contractor who disables all channels (SMS off, WhatsApp off, Telegram off, email off) triggers the early-return at line 168-171 of `retell-notify-dispatch.ts` before the bell step runs, so no bell row is ever written for them.

**Why it happens:** The existing guard `if (!shouldSendSms && !shouldSendWhatsApp && !shouldSendTelegram && !shouldSendEmail) return` was correct before Phase 14 (no bell step). Now it must account for the bell, which is always-on.

**How to fix:** The guard logic must be split: keep the `no_action`/`unknown` intent check (which `computeChannels` already returns all-false for), but don't exit early just because all channel flags are off. The bell step should always run for `lead`, `emergency`, or `info` intents regardless of channel flags.

**Recommended refactor:**
```typescript
// Only return early for no_action / unknown intents
// (computeChannels returns all-false for these; channel flags may all be off for valid intents)
const hasValidIntent = intent && intent !== 'no_action' && intent !== 'unknown'
if (!hasValidIntent && !shouldSendSms && !shouldSendWhatsApp && !shouldSendTelegram && !shouldSendEmail) {
  return
}
```
Or more cleanly: check intent directly before the guard and use a separate `shouldWriteBell` flag.

**Warning signs:** Unit test with `intent='lead'` + all channel flags disabled returns without calling the bell insert.

### Pitfall 2: @radix-ui/react-popover Not Installed

**What goes wrong:** `import { Popover, PopoverTrigger, PopoverContent } from '@radix-ui/react-popover'` fails at build time with "Cannot find module".

**Why it happens:** `@radix-ui/react-popover` is in `STATE.md` as a locked decision but was never added to `package.json`. The installed Radix packages are `react-dialog`, `react-label`, `react-slot` — popover is absent. Confirmed by inspecting `package.json`.

**How to avoid:** First task in Wave 0: `npm install @radix-ui/react-popover@^1.1.15`.

**Warning signs:** TypeScript error on import; `node_modules/@radix-ui/react-popover` directory absent.

### Pitfall 3: Supabase Realtime Duplicate Subscriptions

**What goes wrong:** If `NotificationBell` is mounted in both Sidebar and BottomTabBar, two `supabase.channel()` subscriptions fire for every INSERT, causing the unread count to increment twice per new notification.

**Why it happens:** Both Sidebar and BottomTabBar render independently in the dashboard layout. If each mounts its own `NotificationBell` component with its own `useNotificationsSubscription`, both react to the same INSERT.

**How to avoid:** Mount `NotificationBell` (and its subscription) in exactly one place. The recommended approach: mount a single `NotificationBell` component in the dashboard layout (`src/app/(dashboard)/layout.tsx`) that renders the Sidebar bell icon on desktop and the BottomTabBar bell tab on mobile via responsive classes, OR pass `unreadCount` as a prop from a single parent hook.

### Pitfall 4: `date-fns` Import Path

**What goes wrong:** `import { formatDistanceToNow } from 'date-fns-tz'` → runtime error, function not exported from that package.

**Why it happens:** The project has `date-fns-tz` in `package.json`. Developers assume all date utilities come from there. `date-fns-tz` only provides timezone-aware functions; `formatDistanceToNow` is in the core `date-fns` package.

**How to avoid:** Import from `'date-fns'` directly. The package is installed at v4.1.0 as a peer dependency of `date-fns-tz` and is available in `node_modules/`.

```typescript
import { formatDistanceToNow } from 'date-fns'  // correct
// NOT: import { formatDistanceToNow } from 'date-fns-tz'  // wrong
```

### Pitfall 5: PATCH /api/notification-settings Missing Email Fields

**What goes wrong:** After adding `email_address` and `notify_email_enabled` to the form, saving succeeds (200) but the values are silently ignored because the Zod schema in `route.ts` doesn't include them.

**Why it happens:** `updateNotificationSettingsSchema` in `route.ts` currently has 8 fields (SMS, WhatsApp, Telegram toggles + phone numbers). It must be extended to include the two email fields.

**How to avoid:** Update the Zod schema and the `updatePayload` builder in the same commit as the form changes.

### Pitfall 6: Bell Step Throws on `no_action` Intent Due to Missing event_type Mapping

**What goes wrong:** `computeBellNotification` receives intent `'no_action'` or `null` and tries to map it to an `event_type`, resulting in `undefined` being inserted into the CHECK-constrained column, causing a DB error and Inngest retry loop.

**Why it happens:** The bell step runs after the early-return guard, but `intent` could theoretically be `null` if `call.intent` was null in the DB.

**How to avoid:** `computeBellNotification` must handle null/`no_action`/`unknown` gracefully — either throw an explicit early return or map them to `'system'`. Add a unit test for this case.

---

## Code Examples

### computeBellNotification — Pure Formatter (TDD target)

```typescript
// Source: derived from CONTEXT.md D-07, D-08, D-09
// File: exported from retell-notify-dispatch.ts (alongside computeChannels)

type BellEventType = 'lead' | 'emergency' | 'system'

interface BellNotification {
  event_type: BellEventType
  title: string
  body: string
}

export function computeBellNotification(
  intent: CallIntent | null,
  callerPhone: string,
  serviceType: string,
  appointmentStatus: string
): BellNotification {
  if (intent === 'emergency') {
    return {
      event_type: 'emergency',
      title: `EMERGENCY: New call from ${callerPhone}`,
      body: `${callerPhone} • ${serviceType}`,
    }
  }
  if (intent === 'lead') {
    return {
      event_type: 'lead',
      title: `New lead — ${serviceType}`,
      body: `${callerPhone} • ${appointmentStatus}`,
    }
  }
  // info, system, null → 'system'
  return {
    event_type: 'system',
    title: `General inquiry from ${callerPhone}`,
    body: `${callerPhone} • ${serviceType}`,
  }
}
```

### Sidebar Logo Row Modification

```tsx
{/* Logo area — MODIFIED in Phase 14: add NotificationBell with ml-auto */}
<div className="h-16 flex items-center gap-2 px-6 border-b border-[#334155]">
  <Mic size={20} className="text-[#F97316]" />
  <span className="text-xl font-semibold text-[#F8FAFC]">VoiceDesk</span>
  <NotificationBell className="ml-auto" />
</div>
```

### BottomTabBar Bell Tab

The Bell tab must be a `<button>` (not `<Link>`) because there is no `/notifications` route — it opens a popover/sheet. The tab renders a `Bell` icon and uses the same active-state color logic as existing tabs.

```tsx
// New 4th entry — button, not Link
// Added to the render loop alongside the 3 existing Link tabs
<button
  type="button"
  onClick={() => setBellOpen(true)}
  className={cn(
    'flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px]',
    bellOpen ? 'text-[#F97316]' : 'text-[#94A3B8]'
  )}
>
  <Bell size={20} />
  <span className="text-xs">Notifications</span>
</button>
```

---

## Runtime State Inventory

> Phase 14 is not a rename/refactor/migration phase. This section is omitted.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| `@radix-ui/react-popover` | NotificationBell component | ✗ NOT INSTALLED | — | None — must install in Wave 0 |
| `date-fns` | `formatDistanceToNow` in feed rows | ✓ | 4.1.0 (peer dep) | — |
| `@tanstack/react-query` | useNotifications, useMarkAllRead hooks | ✓ | ^5.100.10 | — |
| `@supabase/ssr` | Realtime subscription | ✓ | 0.10.2 | — |
| `lucide-react` | Bell icon | ✓ | 1.14.0 | — |
| `inngest` | write-bell-notification step | ✓ | ^4.3.0 | — |
| Supabase Realtime publication | Live badge updates | ✓ | Phase 12 migration applied | — |
| `vitest` | Unit tests | ✓ | 4.1.5 | — |

**Missing dependencies with no fallback:**
- `@radix-ui/react-popover` — blocks all bell UI work. Install in Wave 0: `npm install @radix-ui/react-popover@^1.1.15`

**Missing dependencies with fallback:**
- None

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/notifications/bell-formatter.test.ts tests/notifications/mark-all-read.test.ts --reporter=verbose` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BELL-01 | `computeBellNotification()` maps intent to correct event_type + title format | Unit | `npx vitest run tests/notifications/bell-formatter.test.ts` | ❌ Wave 0 |
| BELL-01 | Realtime badge increment on INSERT | Manual UAT | — | Manual only |
| BELL-02 | Popover opens, 50 rows render | Manual UAT | — | Manual only |
| BELL-03 | `PATCH /api/notifications/mark-all-read` returns 200, sets is_read=true | Unit/Integration | `npx vitest run tests/notifications/mark-all-read.test.ts` | ❌ Wave 0 |
| BELL-03 | Optimistic unread count update | Manual UAT | — | Manual only |
| BELL-04 | Notifications persist after browser close | Manual UAT | — | Phase 12 schema; verify via Supabase dashboard |
| EMAIL-01 | Email card renders at top of form | Manual UAT | — | Manual only |
| EMAIL-01 | PATCH /api/notification-settings accepts email_address + notify_email_enabled | Integration | Extend `tests/phase-10-notification-settings.spec.ts` | ❌ Wave 0 gap |

### What to Unit Test (TDD Red-Green-Refactor)

1. **`computeBellNotification()`** — pure function, clear I/O contract. Tests cover:
   - `intent='lead'` → `{ event_type: 'lead', title: 'New lead — HVAC repair', body: '...' }`
   - `intent='emergency'` → `{ event_type: 'emergency', title: 'EMERGENCY: ...', body: '...' }`
   - `intent='info'` → `{ event_type: 'system', title: 'General inquiry from ...', body: '...' }`
   - `intent=null` → `{ event_type: 'system', ... }` (no throw)
   - `intent='no_action'` → `{ event_type: 'system', ... }` (no throw, but caller should skip insert)

2. **`PATCH /api/notifications/mark-all-read`** — pure request/response contract:
   - Unauthorized (no session) → 401
   - No contractor → 404
   - DB update succeeds → 200 `{ ok: true }`
   - Follows the mock pattern in `tests/api/` using `createServiceRoleClient` mock

### What Requires Integration Testing

- `write-bell-notification` Inngest step: verified by extending `tests/notifications/notify-dispatch.test.ts` — mock the Supabase `insert` call and verify it's called with correct payload for each intent.
- `PATCH /api/notification-settings` with email fields: extend `tests/phase-10-notification-settings.spec.ts` to verify the new Zod fields are accepted and written.

### What Requires Manual UAT

- Supabase Realtime badge increment without page refresh (requires live Supabase connection)
- Popover opens and renders feed rows with correct left-border colors
- "Mark all read" clears badge optimistically and persists after page reload
- Email card appears above SMS card in settings form
- Duplicate `<h1>Notifications</h1>` is gone (visual check)
- BottomTabBar Bell tab visible on mobile viewport (< 640px)

### Sampling Rate

- **Per task commit:** `npx vitest run tests/notifications/bell-formatter.test.ts --reporter=verbose`
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green + manual UAT checklist complete before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/notifications/bell-formatter.test.ts` — unit tests for `computeBellNotification()` covering all 5 intent cases
- [ ] `tests/notifications/mark-all-read.test.ts` — unit tests for PATCH route handler (401, 404, 200 cases)
- [ ] `npm install @radix-ui/react-popover@^1.1.15` — required before any component file is written

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Polling for unread count | Supabase Realtime WebSocket subscription | Already established in Phase 6 (`callsSubscription.ts`); replicate for `app_notifications` |
| Manual popover with `useState` + click-outside handler | `@radix-ui/react-popover` | Handles focus trap, keyboard nav, portal; WAI-ARIA compliant |
| Eager full re-fetch on badge update | React Query `invalidateQueries` + `setQueryData` for optimistic count | Established in Phase 6 |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `date-fns` v4.1.0 in `node_modules/` (peer dep of `date-fns-tz`) exports `formatDistanceToNow` at the same API as v3 | Standard Stack | If v4 has breaking API change, import path needs update — low risk, v4 API is stable for this function |
| A2 | `@radix-ui/react-popover@^1.1.15` is compatible with existing `@radix-ui/react-dialog@^1.1.15` and React 19 | Package Legitimacy | Could trigger peer dep conflict — very low risk; same Radix version family |
| A3 | The Supabase `app_notifications` table is in the `supabase_realtime` publication (Phase 12 migration applied) | Architecture | If migration was not applied to production, Realtime events silently fail — verify with `SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime'` |

---

## Open Questions (RESOLVED)

1. **Early-return guard restructuring scope** — RESOLVED: Place the bell step before the existing channel-dispatch guard with its own intent check (`intent && intent !== 'no_action' && intent !== 'unknown'`). This is the narrower change: the channel guard is left in place, and the bell step runs independently for valid intents. Plan 14-02 implements this; Plan 14-01 Task 3 adds RED stubs to notify-dispatch.test.ts that verify the guard behaviour automatically.

2. **BottomTabBar Bell — shared popover state** — RESOLVED: NotificationBell is mounted in Sidebar for desktop viewports and in BottomTabBar for mobile viewports (where Sidebar is responsive-hidden below md breakpoint), one instance per viewport. Task 1 of Plan 14-05 reads Sidebar's responsive classes at edit-time to determine which component gets the BottomTabBar mount. No shared lifted state is needed — each viewport has exactly one NotificationBell instance with its own subscription. This decision is locked in must_haves.truths of Plan 14-05.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | `getUser()` server-side auth check in mark-all-read route (same pattern as notification-settings route) |
| V4 Access Control | Yes | contractor_id from session only, never from request body; RLS enforces isolation on `app_notifications` |
| V5 Input Validation | Minimal | PATCH route accepts no body; Zod schema extension for email field uses `z.string().email().nullable()` |
| V6 Cryptography | No | No new secrets or tokens |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR on mark-all-read (clear another contractor's notifications) | Tampering | contractor_id always from session (same pattern as notification-settings route, line 68-78) |
| Realtime subscription leaks cross-tenant data | Information Disclosure | Supabase RLS `app_notifications_select_own` policy + filter `contractor_id=eq.${contractorId}` in channel |
| Bell write with arbitrary event_type bypassing CHECK constraint | Tampering | `computeBellNotification()` only returns `'lead'`, `'emergency'`, `'system'` — all valid CHECK values; INSERT uses service role but event_type is hard-coded by function |

---

## Sources

### Primary (HIGH confidence)
- `src/inngest/functions/retell-notify-dispatch.ts` — read directly; step structure, `computeChannels`, load-notification-data output shape confirmed
- `src/lib/realtime/callsSubscription.ts` — read directly; Realtime subscription pattern confirmed
- `src/lib/query/client.tsx` — read directly; React Query hook pattern confirmed
- `src/app/api/notification-settings/route.ts` — read directly; PATCH auth + Zod pattern confirmed
- `src/components/dashboard/Sidebar.tsx` — read directly; logo row structure (line 48-51) confirmed
- `src/components/dashboard/BottomTabBar.tsx` — read directly; 3-tab `tabs` array structure confirmed
- `src/components/notification/NotificationSettingsForm.tsx` — read directly; duplicate header (lines 232-239), `cardClass`, `inputClass`, `FormData`, `useUpdateNotificationSettings` confirmed
- `supabase/migrations/20260525000017_phase12_notification_foundation.sql` — read directly; `app_notifications` schema, RLS, CHECK constraint values, Realtime publication confirmed
- `package.json` — read directly; `@radix-ui/react-popover` absent; `date-fns` present at v4.1.0; `@tanstack/react-query` present
- `vitest.config.ts` — read directly; test framework and file patterns confirmed

### Secondary (MEDIUM confidence)
- `src/app/(dashboard)/layout.tsx` — confirmed Sidebar + BottomTabBar mount points and DashboardProviders wrapper
- `src/app/(dashboard)/settings/notifications/page.tsx` — confirmed canonical `<h1>Notifications</h1>` at lines 31-35, validating D-22

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified by direct `package.json` inspection; `@radix-ui/react-popover` absence confirmed
- Architecture patterns: HIGH — derived directly from reading existing source files
- Pitfalls: HIGH — Pitfall 1 (early-return guard) confirmed by code reading; Pitfall 2 (`@radix-ui/react-popover` not installed) confirmed by `package.json`; others derived from patterns
- Test strategy: HIGH — existing Vitest config and test structure confirmed by `ls tests/`

**Research date:** 2026-05-25
**Valid until:** 2026-06-24 (30 days — stable stack, no fast-moving dependencies)

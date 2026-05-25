# Phase 14: In-App Notification Bell - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the full notification bell feature: (1) an Inngest `step.run('write-bell-notification')` inside `retell-notify-dispatch` that writes every completed call to `app_notifications`, (2) a `NotificationBell` client component using `@radix-ui/react-popover` mounted in the Sidebar header and BottomTabBar, with Supabase Realtime for live unread count, and (3) a `PATCH /api/notification-settings` extension + form update to add email address + enable toggle at the top of the Notification Settings form. No schema migrations — Phase 12 built the full `app_notifications` schema and Phase 13 added the email columns.

Also includes a cosmetic bug fix: remove the duplicate `<h1>Notifications</h1>` header block from `NotificationSettingsForm` (the Server Component `settings/notifications/page.tsx` already renders the canonical heading).

</domain>

<decisions>
## Implementation Decisions

### Bell Placement

- **D-01:** Desktop: bell icon lives in the Sidebar `logo row` (the 64px `h-16` div containing the Mic icon + "VoiceDesk" wordmark). Bell is right-aligned in that row alongside the existing content.
- **D-02:** Mobile: add a Bell tab to `BottomTabBar` alongside Calls, Leads, Settings. Tapping the Bell tab opens the notification popover. `BottomTabBar` currently has 3 tabs; the bell becomes a 4th.
- **D-03:** No new top header bar added to the dashboard layout. The Sidebar header is the only placement.

### Inngest Write Step

- **D-04:** Every call processed by `retell-notify-dispatch` writes a bell row — `lead`, `emergency`, and `info` (general inquiry) intent calls all write to `app_notifications`. The write is always-on: it does NOT gate on any channel-enable flags (SMS/email/WhatsApp). Bell is unconditional.
- **D-05:** Payment failure events do NOT write bell rows in Phase 14. Only call events.
- **D-06:** The write is a new `step.run('write-bell-notification')` inside `retellNotifyDispatch`, alongside the existing `send-sms`, `send-whatsapp`, `send-telegram`, `send-email` steps. Independent Inngest retry, independent of other channel steps.
- **D-07:** event_type mapping from call intent: `'lead'` → `event_type: 'lead'`, `'emergency'` → `event_type: 'emergency'`, `'info'` / general inquiry → `event_type: 'system'` (Phase 12 catch-all — no `'info'` value in the CHECK constraint).
- **D-08:** Notification title format:
  - lead: `"New lead — [service_type]"` (e.g. "New lead — HVAC repair")
  - emergency: `"EMERGENCY: New call from [caller_phone]"`
  - info/system: `"General inquiry from [caller_phone]"`
- **D-09:** Notification body: caller phone + appointment status (for leads), or brief description. All fields are already loaded in the `load-notification-data` Inngest step — no extra DB round-trip.
- **D-10:** The Supabase insert uses `supabase` server client (service role) — same client already used in other Inngest steps. Insert into `app_notifications` with `contractor_id`, `event_type`, `title`, `body`, `is_read: false`.

### Bell UI & Realtime

- **D-11:** `@radix-ui/react-popover` — locked from STATE.md. No other new packages for the bell.
- **D-12:** Unread count: query `app_notifications` filtered by `contractor_id` + `is_read = false`. Subscribe to Supabase Realtime INSERT events on `app_notifications` to increment count live.
- **D-13:** The popover feed fetches the 50 most recent notifications: `ORDER BY created_at DESC LIMIT 50`. Fetched via React Query on mount, not lazy.
- **D-14:** Each row shows: colored left border (event_type) + title (line 1) + body truncated to 1 line with ellipsis (`truncate` class) + relative time ("3 minutes ago").
- **D-15:** Color-coded left border by event_type: `emergency` → red (`#EF4444`), `lead` → orange (`#F97316`), `system` / general inquiry → slate (`#64748B`).
- **D-16:** "Mark all read" button inside the popover header. On click: optimistic update of unread count to 0, then `PATCH /api/notifications/mark-all-read` which runs `UPDATE app_notifications SET is_read = true, read_at = NOW() WHERE contractor_id = ? AND is_read = false`. Persists across browser sessions — the cleared state comes from DB on next mount.
- **D-17:** Empty state: Claude picks a minimal empty state consistent with the app's dark style. Expected: a simple centered message — no heavy illustration.

### Email Settings Integration

- **D-18:** Add an **Email section card** at the TOP of `NotificationSettingsForm` — first card, above SMS. Card structure mirrors existing SMS/WhatsApp/Telegram cards (same `cardClass` CSS, icon + label + enable checkbox in header, email address text input below).
- **D-19:** Email section controls: email address text input + "Enable email alerts" toggle (checkbox). No payment failure toggle — keep the form simple. The Phase 13 `notify_on_payment_failure` column exists in the DB but is not exposed in the UI yet.
- **D-20:** `email_address` is a plain `<input type="email">` — no phone normalization. No validation beyond browser's native email format check. Nullable — empty string saved as `null` to the DB.
- **D-21:** Extend `FormData` interface in `NotificationSettingsForm` with `email_address: string` and `notify_email_enabled: boolean`. Extend `useUpdateNotificationSettings` mutation payload accordingly. The `PATCH /api/notification-settings` endpoint already accepts these fields (Phase 13 wired them) — only the form needs to be updated.

### Duplicate Header Fix

- **D-22:** Remove the page header block from `NotificationSettingsForm` (lines that render `<h1>Notifications</h1>` + subtitle + `border-b`). The Server Component `settings/notifications/page.tsx` is the canonical heading owner — the form is a form, not a page. Fix is a simple deletion with no behavioral change.

### Claude's Discretion

- Empty state UI: minimal dark-themed message consistent with existing app style. Claude picks the exact copy and layout.
- Relative time formatting: use `date-fns` (already installed) `formatDistanceToNow` — no new dependency.
- Bell badge: orange dot or numeric badge when `unreadCount > 0`; hidden when 0. Claude picks the exact badge style (numeric vs dot).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database Schema (Phase 12 — no migrations needed)
- `.planning/phases/12-notification-foundation/12-CONTEXT.md` — `app_notifications` full schema (D-01 through D-05), RLS pattern, Realtime publication setup
- `supabase/migrations/` — scan for the Phase 12 migration that creates `app_notifications` and adds email columns to `notification_settings`

### Inngest Function to Modify
- `src/inngest/functions/retell-notify-dispatch.ts` — add `step.run('write-bell-notification')` alongside existing channel steps; `load-notification-data` step already has all fields needed for title/body

### Existing UI Components to Modify
- `src/components/dashboard/Sidebar.tsx` — add bell icon to the `h-16` logo row (D-01)
- `src/components/dashboard/BottomTabBar.tsx` — add Bell as 4th tab (D-02)
- `src/components/notification/NotificationSettingsForm.tsx` — add Email card (D-18/D-19/D-20/D-21), remove duplicate header (D-22)
- `src/app/(dashboard)/settings/notifications/page.tsx` — already has the canonical `<h1>Notifications</h1>`; no changes needed (confirms D-22)

### Existing Query/Hook Patterns
- `src/lib/query/client.tsx` — React Query hooks; extend with `useNotifications` (fetch 50 rows) and `useUnreadCount` + `useMarkAllRead` mutation
- `src/app/(dashboard)/layout.tsx` — `DashboardProviders` wraps all dashboard pages; `NotificationBell` client component can live here or be mounted directly in `Sidebar`

### State and Locked Decisions
- `.planning/STATE.md` §"Key Decisions Locked (v1.1)" — `@radix-ui/react-popover` locked, `app_notifications` RLS subquery pattern, Tailwind v4 `@theme {}` requirements
- `.planning/ROADMAP.md` §Phase 14 — 5 success criteria (authoritative acceptance checklist)
- `.planning/REQUIREMENTS.md` — BELL-01, BELL-02, BELL-03, BELL-04, EMAIL-01

### Existing Notification Patterns (for Inngest step)
- `src/lib/notifications/log.ts` — pending-before-send pattern (D-06 Inngest step does NOT use this for bell writes — direct Supabase insert is correct since bell writes are not `notification_log` entries)
- Phase 13 `step.run('send-email')` in `retell-notify-dispatch.ts` — structural template for the new `step.run('write-bell-notification')` step

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@radix-ui/react-popover` — already locked; check `package.json` to confirm it's installed (Phase 12 locked the decision but may not have installed it)
- `formatDistanceToNow` from `date-fns` — already installed, use for relative timestamps in feed rows
- `Bell` from `lucide-react` — already imported in `Sidebar.tsx` (used in settings sub-nav); reuse the same import for the bell icon in the logo row
- `useContractor()` from `ContractorContext` — available in all client components inside `DashboardProviders`; provides `contractorId` for Supabase Realtime filtering
- `createSupabaseBrowser()` — browser client for Realtime subscriptions; established pattern in `Sidebar.tsx`

### Established Patterns
- Supabase Realtime subscription pattern: Phase 6 set up `useEffect(() => { const channel = supabase.channel(...).on('postgres_changes', ...) })` — replicate for `app_notifications` INSERT events
- React Query invalidation on Realtime event: Phase 6 pattern calls `queryClient.invalidateQueries(...)` inside the Realtime callback — replicate for unread count
- Hardcoded colors: current codebase uses `#F97316` (orange), `#EF4444` (red), `#64748B` (slate), `#0F172A` (dark bg), `#334155` (border) — match these for bell badge and feed row borders until Phase 16 design sweep
- `cardClass` in `NotificationSettingsForm`: `'bg-[#1E293B] border border-[#334155] rounded-xl p-6 max-w-[480px] mb-4'` — reuse for Email card

### Integration Points
- `retell-notify-dispatch.ts`: new `step.run('write-bell-notification')` slots in after `send-email` step (or alongside — order doesn't matter, steps are independent)
- `Sidebar.tsx` logo row: `<div className="h-16 flex items-center gap-2 px-6 border-b border-[#334155]">` — add bell icon right-aligned with `ml-auto`
- `BottomTabBar.tsx` `tabs` array: add `{ href: '/notifications', icon: Bell, label: 'Notifications' }` — or make it a button that opens popover rather than a Link (since bell is a popover, not a page)
- `PATCH /api/notification-settings`: existing endpoint already accepts `notify_email_enabled` and `email_address` (Phase 13 wired) — form only needs new fields in its `FormData` type and submit payload

</code_context>

<specifics>
## Specific Ideas

- Bell in sidebar logo row: right-aligned with `ml-auto` — `[mic] VoiceDesk  [Bell 🔔]`
- Badge style: Claude decides — likely a small orange dot or numeric pill when `unreadCount > 0`
- BottomTabBar bell: may need to be a `<button>` that triggers a sheet/popover rather than a `<Link>` (no `/notifications` route exists — it's a popover)
- Relative time: `formatDistanceToNow(new Date(created_at), { addSuffix: true })` → "3 minutes ago"
- Feed row color-coded left border matches the exact hex colors used elsewhere in the app: `#EF4444` red, `#F97316` orange, `#64748B` slate
- Email input in form: `<input type="email">` with same `inputClass` CSS as SMS/WhatsApp phone inputs

</specifics>

<deferred>
## Deferred Ideas

- Payment failure bell rows — not in Phase 14; only call events write bell rows
- `notify_on_payment_failure` UI toggle — DB column exists (Phase 13) but UI deferred; keep form simple for now
- Per-notification mark-as-read — BELL-03 only requires mark-all-read; per-row `read_at` update is future
- Notification click-through to call detail — popover rows show info but don't link anywhere in Phase 14
- Push notifications (browser Web Push API) — explicitly future requirement
- Email digest / daily summary — explicitly future

</deferred>

---

*Phase: 14-In-App Notification Bell*
*Context gathered: 2026-05-25*

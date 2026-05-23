# Phase 10: Notification Settings Form — Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a full notification settings form at `settings/notifications`. The page currently renders only `<EmptyState>`. This phase replaces it with a complete notification configuration UI covering:

1. **SMS number** — write field (`sms_number`)
2. **WhatsApp number** — write field (`whatsapp_number`)
3. **Telegram** — connection status + unlink action
4. **Per-channel enable/disable toggles** — new DB columns (`notify_sms_enabled`, `notify_whatsapp_enabled`, `notify_telegram_enabled`)
5. **Event toggles** — `notify_on_lead`, `notify_on_emergency`, `notify_on_general_inquiry`
6. **Dispatch function update** — `retell-notify-dispatch.ts` checks new enable flags

A new Supabase migration is required to add the three channel-enable columns.

</domain>

<decisions>
## Implementation Decisions

### D-01: Form scope — full channel management
All notification settings live on one page: phone number inputs, per-channel enable toggles, event-type toggles, and Telegram link status. No partial scope.

### D-02: Channel enable/disable model — explicit toggles
Add three boolean columns to `notification_settings`:
- `notify_sms_enabled BOOLEAN NOT NULL DEFAULT TRUE`
- `notify_whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE`
- `notify_telegram_enabled BOOLEAN NOT NULL DEFAULT FALSE`

Migration default for existing rows: SMS=TRUE (opt-out model), WhatsApp=FALSE, Telegram=FALSE. New contractor rows use the same defaults.

### D-03: Phone number fields — two separate inputs
`sms_number` and `whatsapp_number` are independent fields. No "use same for WhatsApp" checkbox. Contractors can configure different numbers per channel.

### D-04: Phone input UX — normalize to E.164 on save
- Accept US numbers in any common format (`3055551234`, `(305) 555-1234`, `305-555-1234`)
- Validate and normalize to E.164 (`+13055551234`) using `libphonenumber-js` on save
- US-only for v1 — no country picker
- Placeholder text: `+1 (305) 555-1234`
- Show inline validation error if the number is invalid

### D-05: Save behavior — single Save button
All fields (phone numbers + toggles) saved together on Submit. No auto-save on blur. Matches the pattern established by `BusinessInfoForm`, `BusinessHoursForm`, `KeywordsForm`.

### D-06: Telegram section — status + unlink action
Show connection status ("Connected" / "Not connected"). When connected, show an "Unlink" button that calls a new endpoint (`POST /api/notification-settings/telegram/unlink`) setting `telegram_chat_id = NULL`. Show the Telegram setup instructions / deep-link when not connected.

### D-07: Dispatch function update — enable flags only
`computeChannels()` in `retell-notify-dispatch.ts` adds three additional checks:
- `settings?.notify_sms_enabled === true` (alongside existing `sms_number != null`)
- `settings?.notify_whatsapp_enabled === true` (alongside existing `whatsapp_number != null`)
- `settings?.notify_telegram_enabled === true` (alongside existing `telegram_chat_id != null`)

No other behavior changes to the dispatch function in this phase.

### D-08: WhatsApp Content SIDs — defer
The `HXplaceholder_new_lead` and `HXplaceholder_emergency` placeholder SIDs in `whatsapp.ts` are NOT touched in this phase. Real SIDs go in Vercel env when WABA is approved.

### D-09: API pattern — REST route + React Query (Claude's discretion)
Follow the established project pattern: `PATCH /api/notification-settings` route for saving phone numbers + toggles. `useUpdateNotificationSettings` hook added to `src/lib/query/client.tsx`. Server Component fetches current settings; passes them as props to the client form.

### Claude's Discretion
- API route path: `PATCH /api/notification-settings` (consistent with existing route naming)
- Form component name: `NotificationSettingsForm`
- Toggle UI: standard checkbox or toggle switch — match existing `notify_on_*` UI convention when one exists
- Error handling: inline field errors for phone validation; toast or inline banner for save errors

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing notification settings
- `src/app/(dashboard)/settings/notifications/page.tsx` — current EmptyState implementation to replace
- `src/inngest/functions/retell-notify-dispatch.ts` — `computeChannels()` function that must be updated; existing `sms_number`/`whatsapp_number` null checks are the gate today
- `src/lib/notifications/whatsapp.ts` — WhatsApp dispatch (placeholder SIDs — do NOT touch)
- `src/types/database.ts` — `NotificationSettings` interface (must be extended with 3 new enable columns)

### Settings page patterns (analogues)
- `src/app/(dashboard)/settings/calendar/page.tsx` — Server Component + client form pattern
- `src/app/(dashboard)/settings/phone/page.tsx` — two-state settings page pattern
- `src/app/(dashboard)/settings/agent/page.tsx` + `src/components/agent/BusinessInfoForm.tsx` — single Save button form pattern

### React Query hooks
- `src/lib/query/client.tsx` — all mutations live here; `useUpdateLeadStatus` and `useSyncRetellAgent` are closest analogs

### Migration
- `supabase/migrations/` — existing migrations for schema and RLS convention; new migration adds 3 boolean columns with NOT NULL defaults and RLS must be updated
- `src/app/api/onboarding/create-account/route.ts` — line ~112: creates empty `notification_settings` row; verify new columns get defaults from the migration

### Phone number handling
- `libphonenumber-js` is installed as a production dependency — use `parsePhoneNumber` with `'US'` default region for E.164 normalization

### Telegram unlink
- `src/app/api/webhooks/telegram/route.ts` — how `telegram_chat_id` is written (upsert pattern); unlink route should set it to NULL
- `src/app/(dashboard)/dashboard/page.tsx` — Telegram deep-link pattern (`voiceDeskTelBot`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `EmptyState` component — currently used in notifications page; will be removed or shown only in Telegram "not connected" state
- `useQuery`/`useMutation`/`useQueryClient` from `@tanstack/react-query` — already set up in `src/lib/query/client.tsx`
- `createSupabaseServer()` — server-side Supabase client for the Server Component fetch
- `createBrowserClient()` — browser Supabase client already initialized in `client.tsx` for React Query hooks
- `libphonenumber-js` — installed but unused in any form; first usage will be here

### Established Patterns
- Server Component → client form: calendar and phone settings pages use this pattern (Server Component does auth + DB read, passes data as props to `'use client'` component)
- React Query mutations: `useMutation` with `onSuccess: () => queryClient.invalidateQueries(...)` for cache invalidation after save
- Single Save button: all agent config forms use a `handleSubmit` with a loading state and a single submit button
- RLS: every `notification_settings` operation enforces `contractor_id = (SELECT auth.uid() ...)` — new columns inherit existing RLS policies (no new policies needed for the migration)

### Integration Points
- `settings/notifications/page.tsx` → replace the current EmptyState export with a Server Component that fetches `notification_settings` and passes them to `NotificationSettingsForm`
- `PATCH /api/notification-settings` → new route; updates `sms_number`, `whatsapp_number`, `notify_sms_enabled`, `notify_whatsapp_enabled`, `notify_telegram_enabled`, `notify_on_lead`, `notify_on_emergency`, `notify_on_general_inquiry`
- `POST /api/notification-settings/telegram/unlink` → sets `telegram_chat_id = NULL` for the authenticated contractor
- `retell-notify-dispatch.ts` → `computeChannels()` and the `Pick<NotificationSettings, ...>` type signature must include the 3 new enable columns

</code_context>

<specifics>
## Specific Requirements

1. Placeholder text for phone fields: `+1 (305) 555-1234`
2. Phone validation: `libphonenumber-js` with `'US'` default region → E.164 on save
3. Channel defaults in migration: SMS=TRUE, WhatsApp=FALSE, Telegram=FALSE
4. Unlink Telegram: `POST /api/notification-settings/telegram/unlink` → `telegram_chat_id = NULL`
5. Save all settings together: single Submit button, no field-level auto-save
6. WhatsApp Content SIDs: do NOT change `HXplaceholder_*` values

</specifics>

<deferred>
## Deferred Ideas

- **Email notifications** — new capability requiring email provider (Resend/SendGrid), new DB column, new dispatch channel. Future phase.
- **WhatsApp Content SID wiring** — replace `HXplaceholder_*` with real env vars when WABA is approved. Not needed for the UI to work.
- **Country picker for phone input** — US-only for v1. Add when international contractors are onboarded.
- **Payment alert consistency** — `stripe-payment-failure.ts` sends alerts to `contractor.phone_number` instead of `notification_settings.sms_number`. Audit tech debt item; deferred to Phase 11 or standalone fix.

</deferred>

---

*Phase: 10-notification-settings-form-sms-number-whatsapp-number-write-*
*Context gathered: 2026-05-23*

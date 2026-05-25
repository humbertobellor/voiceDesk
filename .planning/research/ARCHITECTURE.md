# Architecture Research — v1.1 Notifications & UI Brand

**Milestone:** v1.1 Notifications & UI Brand
**Researched:** 2026-05-24
**Confidence:** HIGH — all findings grounded in the existing codebase, no speculation

---

## Schema Changes

### 1. `notification_settings` — additive columns only (no new table)

Three new columns on the existing `notification_settings` table:

```sql
ALTER TABLE notification_settings
  ADD COLUMN IF NOT EXISTS notify_email_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_address              TEXT    NULL,
  ADD COLUMN IF NOT EXISTS notify_on_payment_failure  BOOLEAN NOT NULL DEFAULT TRUE;
```

- `notify_email_enabled` — opt-in model, consistent with `notify_whatsapp_enabled` and
  `notify_telegram_enabled` defaults.
- `email_address` — nullable; existing contractors have no email set yet. The contractor's
  Supabase Auth email is available as a UI fallback suggestion, but must be stored
  explicitly rather than implied.
- `notify_on_payment_failure` — Stripe payment failure alerts are currently SMS/WA-only
  via `payment-alert.ts`. Email needs this gate.
- RLS: existing policies in `20260504000002_rls_policies.sql` cover all four operations on
  `notification_settings` by `contractor_id`. New columns are automatically covered — no
  new policy needed.
- Type changes required: add three fields to `NotificationSettings` in
  `src/types/database.ts` and to the `computeChannels` function signature in
  `retell-notify-dispatch.ts`.
- `NotificationChannel` union in `src/types/database.ts` must add `'email'`.

### 2. `app_notifications` — new table

In-app notification bell requires persistent unread notifications. This is distinct from
`notification_log` (which is an outbound delivery audit log, not an in-app feed).

```sql
CREATE TABLE app_notifications (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id  UUID        NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  call_id        UUID        NULL REFERENCES calls(id) ON DELETE SET NULL,
  lead_id        UUID        NULL REFERENCES leads(id) ON DELETE SET NULL,
  event_type     TEXT        NOT NULL,
  -- 'new_lead' | 'emergency' | 'booking_confirmed' | 'payment_failed'
  title          TEXT        NOT NULL,
  body           TEXT        NOT NULL,
  is_read        BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contractor reads own notifications
CREATE POLICY "contractor select own notifications"
  ON app_notifications FOR SELECT
  USING (contractor_id = (SELECT id FROM contractors WHERE user_id = auth.uid()));

-- INSERT only via service role (Inngest writes rows; no user-direct inserts)
CREATE POLICY "service role insert"
  ON app_notifications FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Contractor marks own as read
CREATE POLICY "contractor update own notifications"
  ON app_notifications FOR UPDATE
  USING (contractor_id = (SELECT id FROM contractors WHERE user_id = auth.uid()));

-- No user DELETE — notifications are immutable from user perspective

-- Enable Realtime (same pattern as calls table)
ALTER PUBLICATION supabase_realtime ADD TABLE app_notifications;
```

Retention: no auto-purge in v1.1. A future migration adds cleanup for rows older than
90 days if needed.

### 3. Telegram auto-activation — no schema change

The `setWebhook` call uses the platform-level `TELEGRAM_BOT_TOKEN` and `APP_URL` env
vars. There is no per-contractor bot token and no new column needed.

---

## Data Flow Changes

### Feature 1: Email notifications via Resend

**Trigger path (unchanged):** Retell webhook → `retell-call-classify` → fires
`retell/call.notify` → `retell-notify-dispatch`.

**Changes inside `retell-notify-dispatch`:**

1. `load-notification-data` step: extend `notification_settings` SELECT to include
   `notify_email_enabled` and `email_address`.
2. `computeChannels`: add `shouldSendEmail` boolean gated on
   `settings.email_address != null && settings.notify_email_enabled === true && (intent
   matches per-event prefs)`.
3. New `step.run('send-email', ...)` block following the identical write-before-send
   pattern of existing channels: `writeNotificationLog(channel: 'email')` → `sendEmail()`
   → `updateNotificationLog`. One Inngest step = one channel = independent retry.

**Payment failure emails:** `stripe-payment-failure.ts` → `sendPaymentFailureAlert()`
(`payment-alert.ts`). The alert helper grows an email branch. Gated by
`notify_on_payment_failure && notify_email_enabled`. The `load-contractor` step must
SELECT `notify_email_enabled`, `email_address`, `notify_on_payment_failure` from
`notification_settings`.

**New library file:** `src/lib/notifications/email.ts` — Resend SDK wrapper with
`sendEmail()` function. Same shape as `sms.ts` and `telegram.ts`: `server-only` import,
singleton client, params interface, result interface.

**New env var:** `RESEND_API_KEY` (server-only, no `NEXT_PUBLIC_` prefix). Add to
`.env.example`.

### Feature 2: In-app notification bell

**Write path (Inngest → DB):**
`retell-notify-dispatch` grows a new `step.run('write-app-notification', ...)` that
INSERTs a row into `app_notifications` via the service-role client. This step fires only
when intent is `lead` or `emergency` (skips `no_action` and `info` unless
`notify_on_general_inquiry` is true — same gate as notification dispatch). No per-channel
toggle: in-app notifications are always-on for v1.1.

**Read path (dashboard → browser):**
- `useAppNotifications()` React Query hook — queries `app_notifications` via the browser
  Supabase client (anon key, RLS enforces row isolation), ordered by `created_at DESC`,
  limited to 50 most recent. Query key: `['app-notifications', contractorId]`.
- `useUnreadCount()` React Query hook — `SELECT count(*) WHERE is_read = false`.
  `staleTime: 0` so count stays current after marking read.
- `useAppNotificationsSubscription()` realtime hook in
  `src/lib/realtime/appNotificationsSubscription.ts` — follows exact pattern of
  `callsSubscription.ts`: `postgres_changes` INSERT on `app_notifications` filtered by
  `contractor_id=eq.{id}`. On INSERT: invalidates `['app-notifications']` and
  `['app-notifications', 'unread-count']` in React Query cache.

**Mark-read path:**
`PATCH /api/app-notifications/read-all` — sets `is_read = true` for all unread rows
belonging to the authenticated contractor (contractor_id from session, service role for
write). A per-notification mark-read is not needed in v1.1; read-all is sufficient for
the bell UX.

**UI location:** `Sidebar.tsx` — Bell icon is already imported (line 6 of existing file).
Add `<NotificationBell />` as a client component in the header area or above the user
section. Bell renders a red badge with unread count; clicking opens a dropdown/drawer
rendering the notification feed. This is a new `src/components/notification/NotificationBell.tsx`
component.

### Feature 3: Telegram auto-activation

**Current state:** `.env.example` instructs the operator to manually POST to the Telegram
Bot API (`setWebhook`) after deploy.

**Target state:** A button in the Notifications settings page calls a server action that
does this automatically.

**Architecture:** Single platform-level `TELEGRAM_BOT_TOKEN` (one bot for all
contractors). The `setWebhook` call is a one-time platform setup, not per-contractor.

**Server action:** `src/app/actions/telegram.ts` — `activateTelegramWebhook()`:
```
1. Reads TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, APP_URL from process.env (server-side)
2. POSTs to https://api.telegram.org/bot{TOKEN}/setWebhook
   body: { url: APP_URL + '/api/webhooks/telegram', secret_token: TELEGRAM_WEBHOOK_SECRET }
3. Returns { ok: true, webhookUrl } or { ok: false, error: description }
```

**Detecting current webhook state:** Before showing the "Activate" button, call
`getWebhookInfo` (`GET https://api.telegram.org/bot{TOKEN}/getWebhookInfo`) from the
server action or page server component to determine if already registered. Show status
in the UI: "Webhook registered at {url}" vs "Not registered".

**UI surface:** A new "Telegram Webhook" card in `NotificationSettingsForm` — visible only
when `TELEGRAM_BOT_TOKEN` is set (server-side env check passed as prop from the Server
Component page). Error messages surface the Telegram API `description` field (e.g. "bad
token", "URL unreachable").

**No DB schema change.** Webhook registration is platform-level state, not per-contractor.

**Where `TELEGRAM_WEBHOOK_SECRET` comes from:** Already present in `.env.example` and
already used by the webhook handler for inbound validation. No new env var needed.

### Feature 4: Wolknitive Design System token sweep

No DB changes. Pure frontend.

**Token extraction approach:**
1. Extract CSS custom property definitions from ZIP handoff file.
2. Define all tokens under `:root { }` in `src/app/globals.css`.
3. Extend `tailwind.config.ts` to reference CSS vars:
   ```ts
   colors: { brand: 'rgb(var(--color-brand) / <alpha-value>)', ... }
   ```
   This allows `bg-brand` Tailwind classes while values live in CSS vars — compatible with
   future dark/light mode via `:root` overrides.
4. Do not hardcode hex values in `tailwind.config.ts`.

**Current hardcoded color density (from source review):**
- `Sidebar.tsx` — `bg-[#0F172A]`, `border-[#334155]`, `text-[#F8FAFC]`, `text-[#94A3B8]`,
  `text-[#F97316]` throughout.
- `NotificationSettingsForm.tsx` — densest: `bg-[#1E293B]`, `bg-[#0F172A]`, `#F97316`,
  `#EF4444`, `#16A34A`, `#334155`, `#93C5FD`.
- `settings/notifications/page.tsx` — hardcoded colors in heading and divider.
- All dashboard pages use the same palette.

**Sweep order:** Sidebar first (shell — all pages inherit it), then
NotificationSettingsForm, then dashboard pages, then settings pages. Sweep by component
file, not by color, to avoid partial sweeps that leave inconsistent references.

---

## New vs Modified Components

### New files

| File | Type | Purpose |
|------|------|---------|
| `src/lib/notifications/email.ts` | Library | Resend SDK wrapper, `sendEmail()` |
| `src/lib/realtime/appNotificationsSubscription.ts` | Hook | Supabase Realtime for `app_notifications` INSERT |
| `src/app/actions/telegram.ts` | Server Action | `activateTelegramWebhook()` — calls Telegram setWebhook/getWebhookInfo |
| `src/app/api/app-notifications/read-all/route.ts` | API Route | PATCH — marks all unread `app_notifications` as read |
| `src/components/notification/NotificationBell.tsx` | Client Component | Bell icon + unread badge + dropdown notification feed |
| `supabase/migrations/YYYYMMDD_v11_app_notifications.sql` | Migration | `app_notifications` table + RLS + Realtime publication |
| `supabase/migrations/YYYYMMDD_v11_email_settings.sql` | Migration | Add email columns to `notification_settings` |

### Modified files

| File | Change |
|------|--------|
| `src/inngest/functions/retell-notify-dispatch.ts` | Add `shouldSendEmail` to `computeChannels`; add `send-email` step; add `write-app-notification` step |
| `src/lib/notifications/log.ts` | Extend `NotificationChannel` union with `'email'` |
| `src/lib/notifications/payment-alert.ts` | Add email branch alongside SMS/WA |
| `src/inngest/functions/stripe-payment-failure.ts` | Load and pass `notify_email_enabled`, `email_address`, `notify_on_payment_failure` to payment alert helper |
| `src/types/database.ts` | Add `'email'` to `NotificationChannel`; add `notify_email_enabled`, `email_address`, `notify_on_payment_failure` to `NotificationSettings`; add `AppNotification` interface |
| `src/lib/query/client.tsx` | Add `useAppNotifications()`, `useUnreadCount()`, `useMarkAllRead()` hooks |
| `src/components/dashboard/Sidebar.tsx` | Embed `<NotificationBell />`; replace hardcoded colors with design tokens |
| `src/components/notification/NotificationSettingsForm.tsx` | Add email field + `notify_email_enabled` toggle; add Telegram webhook activation card; apply design tokens |
| `src/app/(dashboard)/settings/notifications/page.tsx` | Pass Telegram webhook status as server-fetched prop; apply design tokens |
| `src/app/api/notification-settings/route.ts` | Extend Zod schema and update payload for `notify_email_enabled`, `email_address` |
| `src/app/globals.css` | Add `:root { }` Wolknitive token block |
| `tailwind.config.ts` | Extend theme colors/typography/radius with CSS var references |
| `.env.example` | Add `RESEND_API_KEY` |

---

## Suggested Build Order

### Phase A — Foundation (DB + Types + Email lib)

**Why first:** All other features depend on schema. Email library is isolated with no UI
dependencies. Unblocks all parallel work downstream.

1. Migration: `app_notifications` table + RLS + Realtime publication
2. Migration: `notification_settings` — add `notify_email_enabled`, `email_address`,
   `notify_on_payment_failure`
3. `src/types/database.ts` — update `NotificationChannel`, `NotificationSettings`,
   add `AppNotification` interface
4. `src/lib/notifications/email.ts` — Resend SDK wrapper
   (TDD: unit test `sendEmail()` with mocked Resend client before touching Inngest)
5. `.env.example` — add `RESEND_API_KEY`

**Gate:** Migrations applied, TypeScript compiles, email lib unit tests green.

### Phase B — Email notifications (Inngest integration)

**Why second:** Builds directly on Phase A types and library. No UI. Fully testable in
Inngest dev server. Does not require the bell UI.

1. Extend `computeChannels` in `retell-notify-dispatch.ts` with `shouldSendEmail`
   (update existing pure-function unit tests in same file)
2. Add `step.run('send-email', ...)` block
3. Extend `payment-alert.ts` + `stripe-payment-failure.ts` for email
4. Extend `/api/notification-settings` Zod schema for new fields

**Gate:** `computeChannels` unit tests green; email step visible in Inngest dev UI.

### Phase C — In-app notification bell

**Why third:** Requires Phase A schema. Independent of Phase B at the UI level. The
Inngest write step can be added immediately alongside Phase B work.

1. Add `step.run('write-app-notification', ...)` to `retell-notify-dispatch`
2. `useAppNotifications()`, `useUnreadCount()`, `useMarkAllRead()` hooks in
   `src/lib/query/client.tsx`
3. `src/lib/realtime/appNotificationsSubscription.ts`
4. `src/app/api/app-notifications/read-all/route.ts`
5. `src/components/notification/NotificationBell.tsx`
6. Wire `<NotificationBell />` into `Sidebar.tsx`
7. `NotificationSettingsForm.tsx` — add email field + toggle (consumes Phase A columns)

**Gate:** Bell shows live unread count in Inngest dev; marking all read clears badge.

### Phase D — Telegram auto-activation

**Why fourth:** Self-contained. No schema changes. No dependency on Phases B or C.
Can be moved earlier if the operational priority is higher (e.g. real contractors waiting
to connect Telegram without manual `setWebhook` steps).

1. `src/app/actions/telegram.ts` — `activateTelegramWebhook()` + `getTelegramWebhookInfo()`
2. Telegram webhook status card in `NotificationSettingsForm` — current status display +
   "Activate" button
3. Error surface for Telegram API failures in the card

**Gate:** `setWebhook` call succeeds in staging; `/start` deep-link test still works.

### Phase E — Design system sweep

**Why last:** No functional dependencies. No risk to data flows built in A–D. Doing it
last means the sweep covers the new `NotificationBell` and Telegram activation card from
Phases C and D. A partial sweep before those components exist would require a second pass.

1. Extract Wolknitive tokens from ZIP — enumerate all color, typography, spacing, radius
   values
2. Define `:root { }` CSS custom properties in `src/app/globals.css`
3. Extend `tailwind.config.ts` with semantic class names backed by CSS vars
4. Sweep components (highest hardcoded-color density first):
   - `Sidebar.tsx`
   - `NotificationSettingsForm.tsx` + `NotificationBell.tsx`
   - Dashboard pages: `calls/`, `leads/`, `dashboard/`
   - Settings pages: `agent/`, `calendar/`, `phone/`, `account/`, `go-live/`
5. Visual check after each group; no `[#XXXXXX]` arbitrary values should remain outside
   `globals.css`

---

## Integration Points Summary

| New Feature | Integration Point | Risk |
|-------------|------------------|------|
| Email notifications | `computeChannels()` pure function — independently unit-testable | LOW |
| Email notifications | `notification_log.channel` enum — additive DB + TS type change | LOW |
| In-app bell | New `step.run` in `retell-notify-dispatch` | LOW — Inngest steps memoized independently |
| In-app bell | Supabase Realtime on new table | MEDIUM — requires explicit `ALTER PUBLICATION` |
| Telegram activation | Telegram Bot API `setWebhook` | MEDIUM — external API, env var dependency |
| Design tokens | Arbitrary Tailwind values → semantic classes | LOW — visual only, no logic change |

---

## Constraints and Decisions

**Resend over other providers:** Fits the Node/TS stack; simple transactional API; the
`sendEmail()` abstraction isolates the SDK so switching providers is a one-file change.

**In-app notifications are append-only (no user delete):** Consistent with `notification_log`
audit philosophy. Contractors mark read, not delete. Simplifies RLS.

**No per-contractor email templates in v1.1:** Email body is server-side HTML built in
`email.ts`. No template editor. Matches the Telegram plain-text approach already in place.

**Telegram auto-activation is platform-scoped:** The architecture uses one platform bot
(`TELEGRAM_BOT_TOKEN`), not per-contractor bots. `setWebhook` is a one-time platform
operation, not per-user. The server action reads env vars, not contractor DB rows.

**Design tokens live in CSS vars:** Compatible with Tailwind v4's CSS custom property
model. The sweep converts hardcoded hex values to CSS vars without requiring a Tailwind
version migration.

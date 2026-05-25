# Features Research — v1.1 Notifications & UI Brand

**Milestone:** v1.1 Notifications & UI Brand
**Researched:** 2026-05-24
**Confidence:** HIGH — scope is well-bounded; all features are established SaaS patterns

---

## Email Notifications

**Table stakes:**
- Contractor receives an email on every new lead (caller phone, service type, appointment status)
- Contractor receives an email on every emergency call (EMERGENCY prefix, callback number)
- Contractor receives an email on payment failure (deactivation warning, billing portal link)
- Opt-in model: disabled by default, contractor enables in Notification Settings
- Email address field in settings (may differ from login email)
- Emails arrive within 60 seconds of call end (Inngest dispatch guarantee)

**Differentiators:**
- Per-event toggles: contractor can receive email for emergencies only, not routine leads
- Branded email template using Wolknitive design system (not a plain-text email)
- Call summary included in body (AI summary from `call_analysis.call_summary`)

**Anti-features:**
- Email digest / daily summary — adds complexity, no demand signal yet
- Unsubscribe link in transactional emails — legally only required for marketing; transactional alerts are exempt. Adding one creates UX confusion ("am I unsubscribed from my emergency alerts?")
- Per-lead reply-to threading — support ticket complexity, not needed for v1.1
- Attachment of call recording — security risk, no demand signal

**Key behaviors:**
- Email is an additional parallel channel; it does NOT replace SMS/WA/Telegram
- Send failure does not block other channels (Promise.allSettled pattern)
- `notification_log` records email send status as `channel: 'email'`
- Payment failure email fires from `stripe-payment-failure` Inngest function, not `retell-notify-dispatch`

**Edge cases:**
- `email_address` is null → skip email channel silently (do not error)
- Resend rate limit → Inngest retry handles it; log as `'failed'` after max retries
- Resend domain not verified → hard error at deploy-time config check, not silently swallowed

---

## In-App Notification Bell

**Table stakes:**
- Bell icon in dashboard header with unread badge count (red dot or number)
- Clicking bell opens a dropdown/panel listing recent notifications (most recent first)
- Notification items show: event type icon, title, body excerpt, time ago
- "Mark all as read" action clears the badge
- Bell updates in real-time via Supabase Realtime (no page refresh)
- Notifications persist in DB — contractor sees history after browser close/reopen

**Differentiators:**
- Notification items link to relevant page (lead → /leads, call → /calls with call highlighted)
- Event type icons differentiate leads from emergencies at a glance

**Anti-features:**
- Per-notification delete — append-only log philosophy matches `notification_log`
- Browser push notifications (Web Push API) — requires HTTPS + service worker + permission UX; high complexity, low additional value when contractor is already in the dashboard
- Notification center as a full page — the bell panel is sufficient for v1.1
- Pagination of notification history — last 50 rows is sufficient; infinite scroll adds complexity

**Key behaviors:**
- In-app notifications fire for `lead` and `emergency` events always-on (no per-event toggle in v1.1)
- `info` and `no_action` calls do NOT create in-app notifications
- Unread count visible on Sidebar even when on non-dashboard pages
- Empty state: "No notifications yet" when feed is empty

**Edge cases:**
- Multiple browser tabs open → Realtime fires on all; React Query cache invalidation handles deduplication
- Contractor not logged in when call arrives → notification row still written by Inngest (service role); appears when contractor next logs in

---

## Telegram Auto-Activation

**Table stakes:**
- A button in Notification Settings that activates the platform Telegram webhook
- Shows current webhook status: "Active — registered at [url]" vs "Not registered"
- Error messages if activation fails (token missing, Telegram API error)
- One-time operation: button is disabled/hidden when already registered

**Differentiators:**
- Status check on page load via `getWebhookInfo` — contractor doesn't need to ask support "did it work?"
- Clear error surface: Telegram API returns `description` on failure; show it verbatim

**Anti-features:**
- Per-contractor Telegram bots — v1.0 architecture uses one platform bot; this is a platform-level operation, not a per-user feature
- Webhook deregistration UI — not needed; once activated, the platform bot should stay registered
- Bot token input field for contractors — contradicts platform bot architecture; contractors link their Telegram account via `/start` deep-link, not by providing their own bot

**Key behaviors:**
- `activateTelegramWebhook()` server action reads `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `APP_URL` from env — no DB read needed
- Calls Telegram's `setWebhook` endpoint; on success, shows registered URL in UI
- Calls `getWebhookInfo` to check current state before showing "Activate" button
- Visible only when `TELEGRAM_BOT_TOKEN` is set (server component env check as prop)

**Edge cases:**
- Webhook already registered at same URL → Telegram returns `ok: true` (idempotent) — treat as success
- `APP_URL` env var missing → server action returns config error; show setup instructions
- Token is valid but URL is unreachable → Telegram returns error `description`

---

## Wolknitive Design System Application

**Table stakes:**
- All hardcoded hex color values removed from component files
- Brand color tokens defined in CSS custom properties in `globals.css`
- Typography tokens (font family, sizes, weights) applied consistently
- Spacing and border-radius tokens applied via Tailwind semantic class names
- Visual consistency across all dashboard pages (sidebar, header, cards, tables, forms, modals)
- Auth pages (login, signup) updated to brand palette
- No regression in functionality — design sweep is visual-only

**Differentiators:**
- New components added in v1.1 (NotificationBell, Telegram activation card) match brand from day one — no second sweep needed
- Semantic class names (`bg-surface`, `text-muted`, `border-subtle`) make future theme changes a one-line CSS edit

**Anti-features:**
- Dark mode toggle — Wolknitive handoff may define a dark palette; implementing a toggle is a separate feature with state management complexity. Apply dark palette as the fixed theme for v1.1 (the current UI is dark-themed)
- Landing page / marketing site — out of scope for v1.1; design system is applied to the app UI only
- Animation tokens / motion system — v1.1 sweep is static; transitions are not in scope

**Key behaviors:**
- Token extraction from ZIP: read CSS/design tokens file from handoff; enumerate `--color-*`, `--font-*`, `--radius-*`, `--spacing-*` values
- Apply to `globals.css` under `:root { }` block (and `@theme { }` for Tailwind v4 semantic classes)
- Sweep order: Sidebar.tsx → NotificationBell.tsx → NotificationSettingsForm.tsx → dashboard pages → settings pages → auth pages
- `npm run build` must exit 0 after sweep; no broken Tailwind class references

**Edge cases:**
- Wolknitive ZIP uses Figma token format (JSON) vs CSS file — need to extract from the file format present in the handoff
- A token referenced in a component has no equivalent in Wolknitive — use closest design token; flag in PR description
- Auth pages use different layout than dashboard — may need separate token application pass

---

## Notification Preferences Per Event

**Table stakes:**
- Contractor can independently toggle which events notify per channel (lead, emergency, after-hours, payment failure)
- Existing booleans: `notify_on_new_lead`, `notify_on_emergency`, `notify_on_general_inquiry` already exist in `notification_settings`
- Email channel uses same per-event gates as SMS/WA/Telegram
- Changes saved via `PATCH /api/notification-settings`

**Key behaviors:**
- Email channel respects existing `notify_on_new_lead`, `notify_on_emergency` booleans (same gates as other channels)
- New `notify_on_payment_failure` boolean added for email (Stripe failure alerts)
- `computeChannels()` function extended — all channel conditions centralized in one function

**Anti-features:**
- Per-event frequency limits ("only notify once every X minutes") — complexity without demand signal
- "Quiet hours" schedule for notifications — v1.2 feature

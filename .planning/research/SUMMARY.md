# Research Summary — v1.1 Notifications & UI Brand

**Synthesized:** 2026-05-24
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md

---

## Stack Additions

**4 new npm packages:**

| Package | Version | Purpose |
|---------|---------|---------|
| `resend` | `^6.12.3` | Transactional email delivery |
| `@react-email/components` | `^1.0.12` | React components for email templates |
| `@react-email/render` | `^2.0.8` | Server-side HTML rendering for Resend |
| `@radix-ui/react-popover` | `^1.1.15` | Notification bell dropdown panel |

**No other new packages.** grammy `setWebhook` is already in the installed grammy v1.x SDK. Wolknitive Design System is a CSS token sweep, not an npm package.

**New env vars:** `RESEND_API_KEY`, `RESEND_FROM_ADDRESS` (both server-only).

**2 new Supabase migrations:**
- `app_notifications` table (notification bell persistence + Realtime)
- `notification_settings` additive columns: `notify_email_enabled`, `email_address`, `notify_on_payment_failure`

---

## Feature Table Stakes

### Email Notifications
- Contractor receives email for new lead, emergency, payment failure
- Opt-in; disabled by default
- Fires from Inngest alongside SMS/WA/Telegram (same `Promise.allSettled` pattern)
- `notification_log` tracks `channel: 'email'` delivery status

### In-App Notification Bell
- Bell icon in dashboard header with unread badge
- Dropdown feed, mark all read, Supabase Realtime live updates
- Persistent in `app_notifications` table
- Fires for `lead` and `emergency` events; always-on in v1.1

### Telegram Auto-Activation
- Platform-level: one shared bot token, one `setWebhook` call
- Settings page shows current webhook status (`getWebhookInfo`)
- Server action registers webhook with `secret_token` validation
- No per-contractor bot token; no DB schema change

### Design System Sweep
- Wolknitive Design System from ZIP handoff applied as CSS custom properties
- Tokens in `globals.css` under `@theme {}` + `:root {}`
- Sweep all components: Sidebar → NotificationBell → NotificationSettingsForm → dashboard pages → settings pages → auth pages
- No hardcoded `[#XXXXXX]` arbitrary Tailwind values should remain

---

## Architecture Summary

**Build order (5 phases):**

| Phase | Focus | Gate |
|-------|-------|------|
| A | DB migrations + TypeScript types + email lib | Schema live, tsc clean, email unit tests green |
| B | Email in Inngest dispatch + payment alerts + API schema | `computeChannels` tests green; email visible in Inngest dev UI |
| C | Notification bell (Inngest write + React Query + Realtime + UI) | Bell shows live count; mark-all-read clears badge |
| D | Telegram auto-activation (server action + settings UI) | `setWebhook` succeeds; status card shows registered URL |
| E | Design system sweep (token extract + globals.css + component sweep) | `npm run build` clean; 15/15 regression tests green |

**Key integration points:**
- Email slots into `retell-notify-dispatch` as a new `step.run('send-email', ...)` block
- `app_notifications` written by a new `step.run('write-app-notification', ...)` in the same Inngest function
- `computeChannels()` pure function extended with `shouldSendEmail` — independently unit-testable
- Telegram server action reads env vars only; no DB interaction

---

## Watch Out For

1. **`ALTER PUBLICATION supabase_realtime ADD TABLE app_notifications`** must be in the migration — silent failure if omitted (bell never updates in real-time)
2. **Resend domain verification** is an operational prerequisite — document in `.env.example` and verify before deploy
3. **RLS cross-tenant pattern** on `app_notifications`: use `(SELECT id FROM contractors WHERE user_id = auth.uid())` — not `auth.uid()` directly
4. **`shouldSendEmail` must gate on `email_address != null`** — not just `notify_email_enabled`
5. **grammy v2 is now `latest` on npm** — never `npm install grammy` without `@^1.x`
6. **Tailwind v4 `@theme {}` vs `:root {}`** — define tokens in both for utility class generation AND CSS var access
7. **Zod schema must be extended** in `/api/notification-settings` for new email fields — not just the DB

---

## Open Architecture Decision

**Telegram: platform bot vs contractor-owned bot** — The v1.0 architecture used a single platform `TELEGRAM_BOT_TOKEN`. The user confirmed "auto-register on token save" in scoping. The architecture research confirms this is a platform-level one-time `setWebhook` call (not per-contractor). The UI surfaces the activation as an admin action in settings, not a per-contractor configuration. This is confirmed: **platform bot, one `setWebhook` call.**

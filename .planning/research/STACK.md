# Stack Research — v1.1 Notifications & UI Brand

**Project:** VoiceDesk (existing Next.js 16 / React 19 / Tailwind v4 / Supabase / Inngest app)
**Researched:** 2026-05-24
**Scope:** Additions and changes only — v1.0 stack is validated and excluded from re-research.

---

## New Dependencies

| Package | Version | Purpose | Why not X? |
|---------|---------|---------|-----------|
| `resend` | `^6.12.3` | Email delivery (call/lead/emergency alerts to contractors) | Resend is the modern transactional email API with a native React integration; SendGrid / Postmark work but require more boilerplate and have no `react:` prop on their send API |
| `@react-email/components` | `^1.0.12` | React components for email templates (Html, Body, Text, Section, Button, Hr, etc.) | Gives fully typed React-based email templates; writing raw HTML strings manually is fragile and untestable. DO NOT use the `tailwindv4` dist-tag — it is a pre-release canary (1.0.0-tailwindv4.6); use `latest` |
| `@react-email/render` | `^2.0.8` | Renders a React email component tree to an HTML string server-side | Required to produce the `html:` string passed to `resend.emails.send()`. Ships separately from the component kit so the preview server (`react-email` package) is not required in production |
| `@radix-ui/react-popover` | `^1.1.15` | Accessible popover for the notification bell dropdown | Project already uses Radix Dialog, Label, Slot. Popover is the right primitive for an anchored, dismissable panel. Using `react-dropdown-menu` would be overkill (keyboard-navigated menu semantics are wrong for a notification feed) |

**No other new npm packages are needed.** All other capabilities (Supabase Realtime, React Query, grammy, Inngest, Tailwind v4 CSS custom properties) already exist in the project.

---

## Integration Notes

### Feature 1: Email Notifications via Resend

**How it connects:**

- A new `send-email` step is added inside the existing Inngest function `retell-notify-dispatch.ts`, parallel to `send-sms`, `send-whatsapp`, `send-telegram`. Each step is independently memoized by Inngest.
- `@react-email/render` is called server-side inside the Inngest step to produce an HTML string. The string is passed to `resend.emails.send({ html: ... })`. No React preview server needed in production — only `@react-email/render` and `@react-email/components`.
- The `from:` address must be a verified Resend domain. For v1.1, `noreply@voicedesk.ai` (or `alerts@voicedesk.ai`) must be added as a verified sender in the Resend dashboard before deploy.
- Resend `react:` prop (passes a React element directly) is an alternative to pre-rendering with `@react-email/render`. Both work; pre-rendering is preferred here because the Inngest step is already server-side and avoids potential SSR/edge incompatibilities.
- `notification_settings` needs a new column `notify_email_enabled BOOLEAN DEFAULT FALSE` and optionally `email_address TEXT` (contractors may want alerts at a different address than their login email). Migration required.
- Resend API key goes in `RESEND_API_KEY` env var. Server-only — never exposed to the browser.
- Confidence: HIGH — verified via Context7 (resend `/websites/resend` library ID, 2551 snippets).

**Resend `html:` vs `react:` prop:**

Resend supports both:
```typescript
// Option A — pre-render (recommended for Inngest steps)
const html = await render(CallAlertEmail({ callerName, summary }))
await resend.emails.send({ html, ... })

// Option B — pass React element directly
await resend.emails.send({ react: CallAlertEmail({ callerName, summary }), ... })
```

Both approaches are confirmed in Resend's official docs. Use Option A in Inngest steps for explicit control over rendering errors.

---

### Feature 2: In-App Notification Bell

**How it connects:**

- Requires a new `contractor_notifications` Supabase table (new migration). Columns: `id`, `contractor_id`, `type` (enum: `call` | `lead` | `emergency`), `title`, `body`, `read_at` (nullable), `call_id` (nullable FK), `created_at`.
- The bell component lives in the dashboard layout header. The existing `DashboardLayout` in `src/app/(dashboard)/layout.tsx` passes `contractorId` down via `DashboardProviders` — the bell can read it from context.
- Unread count: use a React Query query (`queryKey: ['notifications', 'unread', contractorId]`) polling or invalidated by Supabase Realtime. The existing `callsSubscription.ts` pattern (Supabase `postgres_changes` + `queryClient.invalidateQueries`) should be replicated for `contractor_notifications`.
- The popover panel lists recent notifications with mark-as-read. `@radix-ui/react-popover` — the only new package — wraps the panel.
- Writing notification rows: the Inngest dispatch function writes a row to `contractor_notifications` inside a new `step.run('write-in-app-notification', ...)` step after classification. This is the canonical write path — no separate API route needed.
- RLS: `contractor_notifications` needs SELECT/INSERT/UPDATE/DELETE policies scoped to `contractor_id` matching `auth.uid()` contractor lookup, same pattern as all other tables.
- No new npm packages beyond `@radix-ui/react-popover`.

---

### Feature 3: Telegram Bot Auto-Activation (setWebhook on save)

**How it connects:**

- `grammy` (already installed at `^1.42.0`, latest stable is `1.43.0`) exposes `bot.api.setWebhook(url, options)` natively. No additional package needed.
- The confirmed signature from the installed grammy types: `setWebhook(url: string, other?: Other<R, "setWebhook", "url">, signal?: AbortSignal): Promise<true>`
- When a contractor saves their bot token in settings (new flow for self-serve bots), a server action calls:
  ```typescript
  const bot = new Bot(contractorBotToken)
  await bot.api.setWebhook(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/telegram`,
    { secret_token: process.env.TELEGRAM_WEBHOOK_SECRET }
  )
  ```
- This call uses the **contractor's bot token**, not the platform `TELEGRAM_BOT_TOKEN`. If the current architecture uses a single platform bot for all contractors (the v1.0 pattern in `telegram.ts` — `process.env.TELEGRAM_BOT_TOKEN`), the auto-activation flow must be confirmed against the product requirement: is this about contractors connecting their own custom bot (needs token input field) or about auto-registering the platform bot's webhook (one-time operational step)?
  - If platform bot: `setWebhook` only needs to run once at deploy time (or via an admin script), not in the UI. No UI changes needed.
  - If contractor-owned bot: a new `telegram_bot_token` column in `notification_settings` is required, and the server action runs per contractor.
- The existing `src/app/api/webhooks/telegram/route.ts` already uses `webhookCallback` from grammy with `secret_token` validation — the auto-activation just needs to register the webhook URL pointing to this existing handler.
- grammy v1.42.0 → v1.43.0 is a non-breaking minor bump. Upgrading is safe but not required.

---

### Feature 4: Wolknitive Design System Application

**How it connects:**

- Wolknitive is not an npm package — it is not published on the npm registry. This is a brand token + component style sweep applied to the existing codebase using Tailwind v4 CSS custom properties.
- The project already uses Tailwind v4 (`@import 'tailwindcss'` in `globals.css`) with CSS custom property tokens (`--color-background`, `--color-surface`, `--color-accent`, etc.). The design system application is a **CSS token replacement + component update pass**, not a new package.
- Implementation path: update tokens in `globals.css` → update component files that hardcode hex values → ensure all components reference `var(--color-*)` tokens rather than inline Tailwind color classes.
- Tailwind v4 supports `@theme` inline CSS custom properties (`@theme { --color-brand: oklch(...); }`). Brand tokens should be defined in `globals.css` under `@theme` so they become Tailwind utility classes (`text-brand`, `bg-surface`, etc.) — cleaner than `var()` in every classname.
- No new npm packages. Lucide React (already at `1.14.0`, latest `1.16.0`) has the `Bell` icon already imported in Sidebar.tsx — confirmed in codebase.

---

## Do NOT Add

| Package | Reason |
|---------|--------|
| `react-email` (the preview server package, `^6.3.2`) | This is the dev server for email previewing. Not needed in production code. Only `@react-email/components` and `@react-email/render` are needed. |
| `@react-email/tailwind` | Email clients strip `<style>` blocks; this component inlines Tailwind utilities into email HTML. For 3–4 simple transactional templates (call alert, lead alert, emergency alert), write inline styles directly — less complexity, no build-time dependency, and Tailwind v4 class names in emails would be a mismatch with how email clients work. |
| `nodemailer` / `@sendgrid/mail` / `postmark` | Resend covers all email sending. Adding a second email SDK creates confusion about which sends what. |
| `@radix-ui/react-dropdown-menu` | Semantically incorrect for a notification feed (dropdown menu implies navigable menu items with keyboard selection). Use Popover. |
| `socket.io` / `pusher-js` | Supabase Realtime already handles WebSocket push for all live-update features in this app. A second WebSocket layer would be redundant. |
| `@upstash/redis` / `ioredis` | No rate limiting or caching requirement introduced by these 4 features. |
| `swr` | React Query is already in the project. Do not add a second data-fetching library. |
| `grammy` v2.x | The `latest` tag on npm now resolves to grammy 2.0.7 — this is a breaking major version. The project uses v1.x. Stay on `^1.43.0` (or the current `^1.42.0`). grammy 2.x changes the module structure. |

---

## Environment Variables to Add

```bash
# Email (Resend)
RESEND_API_KEY=                  # server-only; never exposed to browser
RESEND_FROM_ADDRESS=             # e.g. alerts@voicedesk.ai (must be a verified Resend domain)
```

No other new env vars are required. Telegram webhook secret (`TELEGRAM_WEBHOOK_SECRET`) already exists. The design system sweep is pure CSS/component changes.

---

## Migration Requirements

| Feature | Migration Needed | Change |
|---------|-----------------|--------|
| Email notifications | YES | Add `notify_email_enabled BOOLEAN DEFAULT FALSE` and `notification_email TEXT` columns to `notification_settings` |
| In-app notification bell | YES | New `contractor_notifications` table with RLS |
| Telegram auto-activation | MAYBE | Depends on platform-bot vs contractor-bot architecture decision (see Feature 3 notes) |
| Wolknitive design system | NO | CSS/component-only changes |

---

## Confidence Assessment

| Area | Confidence | Source |
|------|------------|--------|
| `resend` version and `html:` / `react:` API | HIGH | Context7 verified (`/websites/resend`, 2551 snippets); npm registry |
| `@react-email/components` + `@react-email/render` versions | HIGH | npm registry direct query |
| React 19 compatibility for react-email packages | HIGH | Verified peer deps: `react: '^18.0 \|\| ^19.0 \|\| ^19.0.0-rc'` |
| `@radix-ui/react-popover` for notification bell | HIGH | Already in project's Radix transitive deps; npm registry |
| grammy `setWebhook` signature | HIGH | Verified in installed `node_modules/grammy/out/core/api.d.ts` |
| grammy v2 breaking change warning | HIGH | npm dist-tags confirmed v2.0.7 is now `latest` |
| Wolknitive is not an npm package | HIGH | npm registry returns no results for `@wolknitive/design-system` or `wolknitive` |
| Tailwind v4 `@theme` token approach | MEDIUM | Tailwind v4 docs pattern; project already uses v4 CSS import style |

# Pitfalls Research — v1.1 Notifications & UI Brand

**Milestone:** v1.1 Notifications & UI Brand
**Researched:** 2026-05-24
**Confidence:** HIGH — grounded in existing codebase patterns and known failure modes

---

## Email: Resend domain not verified before deploy

**Risk:** HIGH
**What happens:** `resend.emails.send()` returns a 403 error with "Domain is not verified" or similar. No emails are sent. Error surfaces in Inngest retry logs but is invisible to the contractor.
**Prevention:** Add `RESEND_FROM_ADDRESS` to `.env.example` with a comment: "Must be a verified domain in the Resend dashboard — verify before deploy." Add a startup check or Inngest `onFailure` that logs `RESEND_DOMAIN_UNVERIFIED` clearly. Verify `voicedesk.ai` (or the sending domain) in the Resend dashboard before pushing to production.
**Phase to address:** Phase A (Foundation) — add env var and document verification requirement before email lib implementation.

---

## Email: Sending to `null` email_address silently crashes

**Risk:** MEDIUM
**What happens:** `sendEmail({ to: null })` passes TypeScript if the field is typed as `string | null` and the caller doesn't check. Resend throws a runtime error; Inngest retries the step and the error appears non-deterministic.
**Prevention:** `computeChannels()` must gate `shouldSendEmail` on `settings.email_address != null` (not just `notify_email_enabled`). Add a unit test: `computeChannels` with `email_address: null` and `notify_email_enabled: true` → `shouldSendEmail: false`.
**Phase to address:** Phase B (Email notifications Inngest integration).

---

## Resend: Using `react:` prop in Inngest edge environment

**Risk:** MEDIUM
**What happens:** If Inngest functions run in a Vercel edge runtime, passing a React element via `react:` prop to `resend.emails.send()` may fail because RSC/edge doesn't support all React render APIs.
**Prevention:** Always pre-render with `@react-email/render`: `const html = await render(EmailComponent(props))` then pass `html:` string to Resend. This avoids RSC compatibility issues entirely. Confirmed approach in STACK.md.
**Phase to address:** Phase B — use `render()` pattern from day one.

---

## In-App Bell: Missing `ALTER PUBLICATION` for Realtime

**Risk:** HIGH
**What happens:** `app_notifications` table is created with RLS but `ALTER PUBLICATION supabase_realtime ADD TABLE app_notifications` is omitted from the migration. Supabase Realtime never fires `postgres_changes` events for this table. The bell never updates without a page refresh. This is a silent failure — no console error, no exception.
**Prevention:** Include `ALTER PUBLICATION supabase_realtime ADD TABLE app_notifications;` in the migration SQL, same line as the `calls` table was added in migration 1. Add a manual verify step after `supabase db push`: confirm table appears in `supabase_realtime` publication via `SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime'`.
**Phase to address:** Phase A (Foundation) migration.

---

## In-App Bell: Cross-tenant RLS leak on `app_notifications`

**Risk:** HIGH
**What happens:** If the SELECT policy on `app_notifications` uses `contractor_id = auth.uid()` (matching against the UUID of the authenticated user) instead of looking up the contractor row by `user_id`, the wrong contractor's notifications are returned — or no rows at all.
**Prevention:** Follow the established pattern from all other tables: `USING (contractor_id = (SELECT id FROM contractors WHERE user_id = auth.uid()))`. The `contractors` table maps `user_id` (auth UID) → `id` (contractor UUID). The `app_notifications.contractor_id` FK references `contractors.id`, not `auth.uid()` directly.
**Phase to address:** Phase A (Foundation) migration — include in migration review checklist.

---

## In-App Bell: N+1 Realtime subscription

**Risk:** MEDIUM
**What happens:** `<NotificationBell>` registers a Supabase Realtime subscription inside a `useEffect`. If the component unmounts and remounts (route navigation, StrictMode double-invoke), duplicate subscriptions accumulate. Each subscription fires a separate React Query invalidation. Can cause query waterfall and stale cache states.
**Prevention:** Follow `callsSubscription.ts` pattern exactly: use a single named channel string (e.g. `'app-notifications-${contractorId}'`), clean up in `useEffect` return function with `supabase.removeChannel(channel)`. Test with React StrictMode enabled.
**Phase to address:** Phase C (In-app notification bell) component implementation.

---

## Telegram Activation: `APP_URL` env var missing in Inngest/server context

**Risk:** MEDIUM
**What happens:** `activateTelegramWebhook()` server action reads `process.env.APP_URL` (or `NEXT_PUBLIC_APP_URL`) to build the webhook URL. If the env var is absent, the webhook URL passed to Telegram is `undefined/api/webhooks/telegram`. Telegram accepts the call but the URL is invalid; bot updates are never delivered. No error thrown by the server action.
**Prevention:** Validate `process.env.APP_URL` at the top of `activateTelegramWebhook()` — if missing, return `{ ok: false, error: 'APP_URL env var not configured' }`. Surface this error in the settings UI. Document `APP_URL` in `.env.example` (it may already exist as `NEXT_PUBLIC_APP_URL`).
**Phase to address:** Phase D (Telegram auto-activation) server action.

---

## Telegram Activation: `setWebhook` succeeds but the handler URL is wrong

**Risk:** MEDIUM
**What happens:** The webhook is registered successfully but `APP_URL` points to a preview/staging URL. Production traffic is then routed to the wrong environment. Bot updates get delivered to the staging server.
**Prevention:** Display the registered webhook URL in the settings UI after activation. Contractor or admin can verify it matches the production URL. The `getWebhookInfo` call on page load fetches and shows the current URL.
**Phase to address:** Phase D — include webhook URL display in the status card.

---

## Design System: Tailwind v4 `@theme` vs `:root` conflict

**Risk:** MEDIUM
**What happens:** Tailwind v4 uses `@theme` in CSS to define utility class extensions. If Wolknitive tokens are defined under `:root {}` only (not `@theme {}`), they are available as CSS vars (`var(--color-brand)`) but NOT as Tailwind utility classes (`bg-brand`). Developers then mix `bg-[--color-brand]` with `bg-brand` and the intent is inconsistent.
**Prevention:** Define all brand tokens in BOTH `@theme {}` (for Tailwind utility class generation) AND `:root {}` (for raw CSS var access where Tailwind classes can't be used, like inline styles). Pattern from ARCHITECTURE.md: `@theme { --color-brand: oklch(...); }` generates `bg-brand`, `text-brand`, etc.
**Phase to address:** Phase E (Design system) — establish token definition pattern before sweeping any components.

---

## Design System: Breaking Tailwind arbitrary value references in tests/screenshots

**Risk:** LOW
**What happens:** After sweeping hardcoded `[#0F172A]` values to `bg-surface`, any E2E tests or screenshot comparisons that target elements by color will break.
**Prevention:** The existing regression test suite (`regression-v1-smoke.spec.ts`) does not assert on colors — it uses `getByRole` and text selectors. No test changes needed. However, after the sweep, run the 15-test regression suite to catch any layout regressions.
**Phase to address:** Phase E — run `regression-v1-smoke.spec.ts` after sweep to verify no functional regressions.

---

## grammy v2 accidental upgrade during `npm install`

**Risk:** HIGH
**What happens:** `grammy@latest` now resolves to v2.0.7 (breaking major). If any phase runs `npm install grammy` without a pinned version, or if `package.json` has `"grammy": "^1.42.0"` and someone runs `npm update grammy`, nothing breaks immediately — but v2 has different module structure and the existing `grammy` imports in `telegram.ts` and `route.ts` will throw at runtime.
**Prevention:** Never run `npm install grammy` without `@1.x`. Current `package.json` should have `"grammy": "^1.42.0"`. Do not `npm update grammy`. If upgrading grammy, do it as a dedicated task with changelog review.
**Phase to address:** All phases — add to project `.npmrc`: `package-lock=true` is already enforced by the existing `package-lock.json`. No changes needed beyond awareness.

---

## Email/Notification Settings: Zod schema not extended for new fields

**Risk:** MEDIUM
**What happens:** `PATCH /api/notification-settings` validates the request body with a Zod schema. If `notify_email_enabled` and `email_address` are not added to the schema, they are silently stripped from the validated payload. The DB update is a no-op for the new fields. No error, no feedback to the user.
**Prevention:** Extend the Zod schema in `src/app/api/notification-settings/route.ts` as part of Phase B, before the UI is built. Add tests that send the new fields and assert they are persisted.
**Phase to address:** Phase B (Email notifications Inngest integration).

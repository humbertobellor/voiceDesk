---
phase: 15-telegram-activation
reviewed: 2026-05-30T12:00:00Z
depth: deep
files_reviewed: 6
files_reviewed_list:
  - src/app/(dashboard)/settings/notifications/actions.ts
  - src/app/(dashboard)/settings/notifications/page.tsx
  - src/components/notification/NotificationSettingsForm.tsx
  - src/lib/notifications/telegram.ts
  - tests/actions/telegram-webhook.test.ts
  - tests/components/notification/NotificationSettingsForm.webhook.test.tsx
findings:
  critical: 4
  warning: 5
  info: 3
  total: 12
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-05-30T12:00:00Z
**Depth:** deep
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Six files reviewed for the Telegram webhook activation feature (TEL-01 / TEL-02): a
server action, a server-component page, a client-form component, the grammY singleton
library module, and two test files. Cross-module call chains were traced for the full
path: `page.tsx → getBot()`, `actions.ts → getBot()`, `route.ts → new Bot()`, and the
component's `handleActivateTelegramWebhook → activateTelegramWebhook`.

Four blockers were found:

1. **Two separate Bot instances exist at runtime** — `src/app/api/webhooks/telegram/route.ts`
   creates its own `new Bot(botToken ?? 'placeholder')` at module load, while
   `src/lib/notifications/telegram.ts` maintains a singleton via `getBot()`. These are
   different objects. The webhook route never calls `getBot()`. This means the singleton
   cached in `telegram.ts` is used only for outbound sends (`sendTelegram`) and the
   activation action (`activateTelegramWebhook`), while the webhook handler uses a
   completely independent Bot instance. This duplication is not a runtime crash but is a
   correctness hazard: the two instances cannot share state, and a future attempt to
   register middleware or commands on the "shared" singleton will silently have no effect on
   the webhook bot.

2. **`getBot()` singleton caches the token implicitly but never detects token rotation.**
   After a `TELEGRAM_BOT_TOKEN` change the old Bot instance continues to be returned.

3. **`TELEGRAM_WEBHOOK_URL` is only checked for an `https://` prefix** — no host/path
   validation. Any HTTPS URL including internal metadata endpoints passes.

4. **`setTimeout` return value is discarded** — `setFeedback(null)` can fire on an
   unmounted component.

Five warnings cover: the platform webhook URL being disclosed to all tenant contractors,
a `setWebhook`/`getWebhookInfo` race returning an error even after successful registration,
missing client-side email validation (`noValidate` suppresses browser validation), the
hardcoded bot username `voiceDeskTelBot`, and a missing `notify_telegram_enabled` reset
when the unlink mutation succeeds but the query cache hasn't refreshed yet.

---

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Two independent `Bot` instances — `route.ts` never uses the `getBot()` singleton

**File:** `src/app/api/webhooks/telegram/route.ts:18` and `src/lib/notifications/telegram.ts:17-22`

**Issue:** The webhook handler (`route.ts`) creates its own Bot instance at module load:

```typescript
const bot = new Bot(botToken ?? 'placeholder')   // route.ts line 18
```

The `getBot()` singleton in `telegram.ts` creates a separate instance on first call. These
are two different Bot objects that both use `TELEGRAM_BOT_TOKEN` but are never coordinated.

Concrete consequences:
- Commands registered via `bot.command('start', ...)` in `route.ts` are registered only on
  the route-local instance. Any code that calls `getBot().command(...)` (now or in the
  future) registers on the singleton — which is never given an update to process. The split
  is currently benign only because no code calls `getBot()` for command registration, but the
  design is fragile and contradicts the documented intent ("Consistent with the webhook
  handler's module-level `const bot = new Bot(...)` pattern" — `telegram.ts` comment).
- The `'placeholder'` fallback in `route.ts` creates a Bot instance with a known-invalid
  token. grammY will not fail at construction time; it will fail at the first API call. The
  guard at line 93-96 prevents processing, but the `bot` object with the placeholder token
  is still passed to `webhookCallback` on line 98. If the guard logic is ever refactored
  incorrectly, a Bot instance with `'placeholder'` as its token will attempt real API calls.

**Fix:** Make `route.ts` import and use `getBot()` from `telegram.ts` instead of
maintaining its own instance. Remove the `'placeholder'` fallback — if the token is missing,
`getBot()` already throws with an informative message:

```typescript
// route.ts — replace the module-level bot creation with:
import { getBot } from '@/lib/notifications/telegram'

export async function POST(req: Request) {
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[webhook/telegram] TELEGRAM_WEBHOOK_SECRET is not set')
    return new Response('Service Unavailable', { status: 503 })
  }

  let bot: Bot
  try {
    bot = getBot()
  } catch {
    console.error('[webhook/telegram] TELEGRAM_BOT_TOKEN is not set')
    return new Response('Service Unavailable', { status: 503 })
  }

  const handleUpdate = webhookCallback(bot, 'std/http', undefined, undefined, webhookSecret)
  // ...
}
```

Note: grammY `webhookCallback` expects a Bot that already has command handlers registered.
The `/start` handler must be registered on the singleton before `webhookCallback` is called.
The canonical way is to register commands in the `telegram.ts` module during `getBot()` initialization.

---

### CR-02: `getBot()` singleton does not detect token rotation — silently returns stale Bot

**File:** `src/lib/notifications/telegram.ts:17-22`

**Issue:** `_bot` is set once and never invalidated. If `TELEGRAM_BOT_TOKEN` changes
(secret rotation in Vercel env vars followed by a redeploy, or env var injection during
testing), the cached instance was built with the old token and all subsequent API calls
will receive 401 errors from Telegram. The new token value is read on every `getBot()` call
but is never compared against the token used to build `_bot`.

**Fix:** Track the token used to build the cached instance:

```typescript
let _bot: Bot | null = null
let _cachedToken: string | null = null

export function getBot(): Bot {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('[getBot] TELEGRAM_BOT_TOKEN is not set')
  if (!_bot || _cachedToken !== token) {
    _bot = new Bot(token)
    _cachedToken = token
  }
  return _bot
}
```

---

### CR-03: `TELEGRAM_WEBHOOK_URL` validated only by `https://` prefix — SSRF via env var misconfiguration

**File:** `src/app/(dashboard)/settings/notifications/actions.ts:59-60`

**Issue:** The only check before registering the URL with the Telegram Bot API is:

```typescript
if (!webhookUrl.startsWith('https://'))
  return { ok: false, error: 'Webhook URL must be HTTPS.' }
```

Any HTTPS URL passes: `https://169.254.169.254/` (AWS metadata), `https://attacker.example/`,
`https://internal-service/`. If an attacker can write `TELEGRAM_WEBHOOK_URL` via a CI/CD
misconfiguration, compromised secrets manager, or misconfigured Vercel project settings,
they can redirect all Telegram bot updates — including message text, user IDs, and the
verified `X-Telegram-Bot-Api-Secret-Token` header — to an attacker-controlled endpoint.

**Fix:** Restrict to the expected application host. Move the expected host to an env var
or compile-time constant:

```typescript
const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL
if (!webhookUrl) return { ok: false, error: 'Telegram webhook URL not configured.' }

let parsed: URL
try {
  parsed = new URL(webhookUrl)
} catch {
  return { ok: false, error: 'Telegram webhook URL is not a valid URL.' }
}
if (parsed.protocol !== 'https:') {
  return { ok: false, error: 'Webhook URL must be HTTPS.' }
}

const ALLOWED_WEBHOOK_HOST = process.env.NEXT_PUBLIC_VERCEL_URL
  ?? process.env.VERCEL_URL
  ?? 'voicedesk.vercel.app'

if (parsed.hostname !== ALLOWED_WEBHOOK_HOST) {
  return { ok: false, error: 'Webhook URL host does not match expected application host.' }
}
```

---

### CR-04: `setTimeout` return value discarded — `setFeedback(null)` fires on unmounted component

**File:** `src/components/notification/NotificationSettingsForm.tsx:211`

**Issue:** After a successful form save, a 3-second auto-dismiss timer is created but never
stored or cancelled:

```typescript
setTimeout(() => setFeedback(null), 3000)
```

If the user navigates away before the timer fires, React calls the component's cleanup but
cannot cancel this timer because the ID was never captured. The callback fires on an
unmounted component. In React 18 this is a no-op in production but triggers a console
warning in development and strict mode. If this component ever wraps a context or portal
with actual teardown side-effects, the silent state update can mask those errors.

**Fix:** Store the timer ID in a ref and cancel it on unmount:

```typescript
const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

// In handleSubmit, replace the raw setTimeout call:
if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
feedbackTimerRef.current = setTimeout(() => setFeedback(null), 3000)

// Add cleanup effect (alongside existing effects):
useEffect(() => {
  return () => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
  }
}, [])
```

---

## Warnings

### WR-01: Platform webhook URL exposed to every authenticated contractor

**File:** `src/app/(dashboard)/settings/notifications/page.tsx:29-37`

**Issue:** `getBot().api.getWebhookInfo()` is called on every page load for every contractor
who visits the notifications settings page. The response — including the registered webhook
URL — is serialized into `initialWebhookInfo` and passed as a prop to the client component,
where it is rendered in the DOM. The URL is also returned to the client after every
"Activate Telegram Webhook" button click via `actions.ts`.

The Telegram Bot API returns the webhook URL as registered by `setWebhook`. This is the
platform's internal ingress URL. While it must be publicly reachable by Telegram, broadcasting
it in every contractor's settings page HTML unnecessarily increases the attack surface and
violates least-privilege disclosure.

Additionally, this call makes page load time dependent on Telegram API latency. A 1-second
Telegram API timeout will add 1 second to every contractor's settings page load.

**Fix:** If the webhook card is intended for platform operators only, gate the
`getWebhookInfo()` call and the entire webhook card behind an admin flag. If it must be
visible to all contractors for operational transparency, at minimum strip the URL from the
returned object before rendering it in the component.

---

### WR-02: `setWebhook` success followed by `getWebhookInfo` failure returns `ok: false` — misleading error

**File:** `src/app/(dashboard)/settings/notifications/actions.ts:67-74`

**Issue:** Both calls share the same `try/catch`. If `setWebhook` succeeds but
`getWebhookInfo` throws (transient error), the catch block returns `{ ok: false, error:
'Failed to activate webhook. Please try again.' }`. The webhook **was** registered
successfully, but the user is told it failed. On retry, `setWebhook` is called again
(idempotent for the same URL, so no harm) but the misleading error creates confusion and
unnecessary retries.

Also, Telegram's eventual consistency means `getWebhookInfo` immediately after `setWebhook`
may return the previous webhook URL rather than the just-registered one.

**Fix:** Treat `getWebhookInfo` as best-effort. Return success after `setWebhook` resolves,
fall back to the known URL if `getWebhookInfo` fails:

```typescript
await getBot().api.setWebhook(webhookUrl, { secret_token: webhookSecret })

let webhookInfo: Record<string, unknown> = { url: webhookUrl }
try {
  webhookInfo = (await getBot().api.getWebhookInfo()) as unknown as Record<string, unknown>
} catch {
  // Non-fatal: registration succeeded; echo back the URL we just registered
}
return { ok: true, webhookInfo }
```

---

### WR-03: Email address submitted without client-side validation — `noValidate` suppresses browser enforcement

**File:** `src/components/notification/NotificationSettingsForm.tsx:206`

**Issue:** The form has `noValidate` set (line 275), which disables all browser-native
validation including the `type="email"` attribute on the email input. Phone numbers are
validated and normalized via `normalizePhone()` before submission; email is submitted as-is:

```typescript
email_address: formData.email_address.trim() || null,
```

A contractor can save `@`, `foo@`, `not-an-email`, or a string with embedded spaces.
The server-side API route at `/api/notification-settings` does validate with
`z.string().email()`, so the invalid value will be rejected — but the form treats the
rejection as a generic save error rather than an inline field error, degrading UX.

**Fix:** Add client-side email validation in `handleSubmit` before calling `setIsSaving`:

```typescript
const emailValue = formData.email_address.trim()
if (emailValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
  setFeedback({ type: 'error', message: 'Enter a valid email address.' })
  return
}
```

---

### WR-04: Hardcoded bot username `voiceDeskTelBot` cannot vary across environments

**File:** `src/components/notification/NotificationSettingsForm.tsx:469`

**Issue:** The Telegram deep link is hardcoded:

```tsx
href={`https://t.me/voiceDeskTelBot?start=${contractorId ?? ''}`}
```

The bot username in this link and the bot registered via `TELEGRAM_BOT_TOKEN` are
independent values. If the token is rotated to a different bot (staging bot, bot rename,
disaster recovery), the link still points to the old username. A contractor clicking the
link connects to the wrong bot, sends `/start`, and gets no reply — the webhook handler
is not attached to that bot.

**Fix:** Drive the username from an environment variable:

```typescript
// In .env.local:
// NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=voiceDeskTelBot

href={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'voiceDeskTelBot'}?start=${contractorId ?? ''}`}
```

---

### WR-05: `page.tsx` renders nothing when `notification_settings` row does not exist — silent blank page

**File:** `src/app/(dashboard)/settings/notifications/page.tsx:53-58`

**Issue:** The settings data fetch uses `.maybeSingle()` which returns `null` when no row
exists. The page conditionally renders the form:

```tsx
{settings && (
  <NotificationSettingsForm ... />
)}
```

When `settings` is `null` (first-time contractor who has not had a `notification_settings`
row created yet, or a row that was deleted), the page renders only the heading section with
no form, no error message, and no call to action. The contractor sees a blank area with no
explanation. This is a silent failure mode — no redirect, no error, no "setup required"
prompt.

**Fix:** Add an explicit empty-state fallback:

```tsx
{settings ? (
  <NotificationSettingsForm
    initialSettings={settings}
    initialWebhookInfo={initialWebhookInfo}
  />
) : (
  <p className="text-sm text-[#94A3B8]">
    Notification settings are not yet configured. Please contact support.
  </p>
)}
```

Alternatively, create the `notification_settings` row during contractor onboarding so it
always exists by the time this page is reached.

---

## Info

### IN-01: `contractorId ?? ''` produces a silently broken Telegram deep link

**File:** `src/components/notification/NotificationSettingsForm.tsx:469`

**Issue:** When `useContractor()` returns `contractorId: null` (context not yet resolved),
the deep link becomes `https://t.me/voiceDeskTelBot?start=` with an empty payload. The
webhook handler correctly rejects the empty payload with an error reply to the user. The
contractor is shown a confusing bot error rather than a UI-level loading or disabled state.

**Fix:** Disable the link when `contractorId` is null:

```tsx
{contractorId ? (
  <a href={`https://t.me/voiceDeskTelBot?start=${contractorId}`} ...>
    Open @voiceDeskTelBot (opens in new tab)
  </a>
) : (
  <span className="text-[#64748B] text-sm">Loading account…</span>
)}
```

---

### IN-02: `@ts-expect-error` directives in test file are now stale and will cause compilation failure

**File:** `tests/components/notification/NotificationSettingsForm.webhook.test.tsx:89,98,107,121,137,161,181`

**Issue:** Every render call is annotated:

```typescript
// @ts-expect-error — initialWebhookInfo prop does not exist yet (RED state)
```

The component under review already accepts `initialWebhookInfo` as a typed prop. TypeScript's
`--strict` mode (which this project uses per CLAUDE.md) produces `TS2578: Unused
'@ts-expect-error' directive` for each of these, causing the test file to fail compilation.
This means `tsc` will fail, and the test suite will not run — breaking the CI gate silently
if the type check is separate from the test run.

**Fix:** Remove all seven `@ts-expect-error` comments from this test file. The prop is now
correctly typed and no suppression is needed.

---

### IN-03: Double `as unknown as Record<string, unknown>` cast repeated in two files with no shared type

**File:** `src/app/(dashboard)/settings/notifications/page.tsx:31`, `src/app/(dashboard)/settings/notifications/actions.ts:70`

**Issue:** Both the page and the action cast the grammY `WebhookInfo` return value:

```typescript
as unknown as Record<string, unknown>
```

This erases all structural type information grammY provides and forces downstream code to
re-establish it with manual type guards (`typeof webhookInfo.url === 'string'`). The cast
is duplicated across two independent files. The intermediate `as unknown` form — rather than
a direct `as Record<string, unknown>` — signals that TypeScript itself would reject the
direct cast, which is a red flag for correctness.

**Fix:** Define a typed DTO in a server-side types file and use it at both sites:

```typescript
// src/types/telegram.ts (server-only)
import type { WebhookInfo } from 'grammy/types'
export type TelegramWebhookStatus = Pick<WebhookInfo, 'url' | 'pending_update_count' | 'has_custom_certificate'>
```

Pass `TelegramWebhookStatus | null` as the prop type instead of `Record<string, unknown> | null`.
This eliminates the runtime type guard in the component and makes the `url` access
statically safe.

---

_Reviewed: 2026-05-30T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

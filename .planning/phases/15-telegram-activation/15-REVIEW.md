---
phase: 15-telegram-activation
reviewed: 2026-05-30T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/app/(dashboard)/settings/notifications/actions.ts
  - src/app/(dashboard)/settings/notifications/page.tsx
  - src/components/notification/NotificationSettingsForm.tsx
  - src/lib/notifications/telegram.ts
  - tests/actions/telegram-webhook.test.ts
  - tests/components/notification/NotificationSettingsForm.webhook.test.tsx
findings:
  critical: 3
  warning: 4
  info: 3
  total: 10
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-05-30T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Six files reviewed covering the Telegram webhook activation feature: a server action,
a server-component page, a client-form component, a grammY singleton module, and two
test files (unit + component). The authentication and authorization guard in the server
action is sound. The test coverage for the discriminated-union error paths is solid.

Three blockers were found: (1) a stale-token bug in the `getBot()` singleton that silently
serves a Bot instance built with an outdated token after a token rotation; (2) an open
redirect / SSRF vector via the unvalidated `TELEGRAM_WEBHOOK_URL` env var that accepts
any `https://` URL without restricting it to the expected host; (3) a missing `await` on
`setTimeout` cleanup that can call `setFeedback(null)` on an unmounted component.
Four warnings cover: missing email validation, a timing gap between `setWebhook` and
`getWebhookInfo` producing inconsistent state, a hardcoded bot username, and the `page.tsx`
calling `getWebhookInfo()` without authorization (any authenticated contractor can see the
platform-level webhook URL). Three info items are noted.

---

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: `getBot()` singleton silently reuses a Bot built with the original token after token rotation

**File:** `src/lib/notifications/telegram.ts:17-22`

**Issue:** The module-level `_bot` variable is set once on first call and is never cleared.
If `TELEGRAM_BOT_TOKEN` changes at runtime (secret rotation, environment variable update
without a cold start), subsequent calls still return the Bot instance that was built with
the old token. The new token value is read on every call (`const token = process.env.TELEGRAM_BOT_TOKEN`)
but is never compared to the token that `_bot` was created with. API calls on the stale
Bot will receive 401 errors from Telegram, and those errors will surface as runtime failures
in `sendTelegram()` and `activateTelegramWebhook()` without any indication that the root
cause is a token mismatch.

**Fix:** Cache the token alongside the instance and rebuild when they diverge:

```typescript
let _bot: Bot | null = null
let _botToken: string | null = null

export function getBot(): Bot {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('[getBot] TELEGRAM_BOT_TOKEN is not set')
  if (!_bot || _botToken !== token) {
    _bot = new Bot(token)
    _botToken = token
  }
  return _bot
}
```

---

### CR-02: `TELEGRAM_WEBHOOK_URL` accepted after only an `https://` prefix check — no host validation

**File:** `src/app/(dashboard)/settings/notifications/actions.ts:59-60`

**Issue:** The only validation applied to `TELEGRAM_WEBHOOK_URL` before it is registered
with the Telegram Bot API is a `startsWith('https://')` check. A misconfigured or
maliciously overridden environment variable pointing to an arbitrary HTTPS host (e.g.,
an internal metadata service URL, a third-party domain, or an attacker-controlled server)
will pass this check and be registered as the bot webhook. Telegram would then forward
every bot update — including the `secret_token`-bearing `X-Telegram-Bot-Api-Secret-Token`
header and full message payloads — to the attacker-controlled endpoint.

Although an attacker must already be able to write the `TELEGRAM_WEBHOOK_URL` env var for
this to be exploitable, environment variable injection through CI/CD misconfigurations or
secrets-manager mistakes is a realistic threat vector in SaaS deployments.

**Fix:** Assert that the webhook URL matches the expected application host. The strictest
form uses a compile-time constant; a practical server-side form checks the host portion:

```typescript
const EXPECTED_WEBHOOK_HOST = 'voicedesk.vercel.app'   // move to a shared constant

const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL
if (!webhookUrl) return { ok: false, error: 'Telegram webhook URL not configured.' }

let parsedUrl: URL
try {
  parsedUrl = new URL(webhookUrl)
} catch {
  return { ok: false, error: 'Telegram webhook URL is not a valid URL.' }
}

if (parsedUrl.protocol !== 'https:') {
  return { ok: false, error: 'Webhook URL must be HTTPS.' }
}

if (parsedUrl.hostname !== EXPECTED_WEBHOOK_HOST) {
  return { ok: false, error: 'Webhook URL host does not match expected application host.' }
}
```

---

### CR-03: `setTimeout` leak — `setFeedback(null)` may fire after component unmount

**File:** `src/components/notification/NotificationSettingsForm.tsx:211`

**Issue:** After a successful save, `setTimeout(() => setFeedback(null), 3000)` is scheduled
but its return value (the timer ID) is never stored and therefore never cancelled. If the
user navigates away from the page within 3 seconds of a successful save, the callback fires
on the now-unmounted component. In React 18 strict mode this logs a warning; in production
builds it is a silent state-update-after-unmount bug that can mask errors or, depending on
framework version, interfere with concurrent rendering.

**Fix:** Store the timer ID in a ref and cancel it in an effect cleanup:

```typescript
const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

// Inside handleSubmit, replace:
//   setTimeout(() => setFeedback(null), 3000)
// with:
if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
feedbackTimerRef.current = setTimeout(() => setFeedback(null), 3000)

// Add a cleanup effect:
useEffect(() => {
  return () => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
  }
}, [])
```

---

## Warnings

### WR-01: `page.tsx` calls `getWebhookInfo()` for every authenticated contractor — exposes platform webhook URL to all users

**File:** `src/app/(dashboard)/settings/notifications/page.tsx:30-37`

**Issue:** The `getBot().api.getWebhookInfo()` call is made for every contractor who visits
the notifications settings page. The Telegram webhook is a **platform-level** resource, not
a per-contractor resource. Any authenticated contractor can see the registered webhook URL
(`initialWebhookInfo.url`) in the rendered HTML. For a multi-tenant SaaS, the platform's
internal webhook endpoint URL should not be disclosed to tenants. The URL itself is not a
secret (it must be publicly reachable by Telegram), but the unnecessary disclosure
violates the principle of least privilege and increases the attack surface for enumeration.

Additionally, this call makes page load latency dependent on Telegram API availability; a
slow or failing Telegram API will delay the settings page for every user.

**Fix:** Restrict the webhook card and its data to a designated platform administrator role,
or remove `initialWebhookInfo` from the page props entirely and only expose the webhook
activation button without showing the current URL to end users. If the URL display is
intended for debugging, gate it behind an admin-only flag:

```typescript
// Only fetch webhook info when the user has admin privileges
const isAdmin = /* check user.role or contractor.is_admin */
let initialWebhookInfo: Record<string, unknown> | null = null
if (isAdmin) {
  try {
    initialWebhookInfo = (await getBot().api.getWebhookInfo()) as unknown as Record<string, unknown>
  } catch (err) { /* ... */ }
}
```

---

### WR-02: Race condition between `setWebhook` and `getWebhookInfo` — stale status on partial failure

**File:** `src/app/(dashboard)/settings/notifications/actions.ts:67-69`

**Issue:** `setWebhook` and `getWebhookInfo` are called sequentially in two separate API
round-trips inside the same `try` block:

```typescript
await getBot().api.setWebhook(webhookUrl, { secret_token: webhookSecret })
const webhookInfo = await getBot().api.getWebhookInfo()
```

If `setWebhook` succeeds but `getWebhookInfo` fails (transient network error, Telegram API
flap), the `catch` block returns `{ ok: false, error: 'Failed to activate webhook. Please
try again.' }`. The user sees an error message even though the webhook **was** successfully
registered. On retry, the user clicks the button again, `setWebhook` is called a second time
(idempotent for the same URL, so harmless), but the user experience is misleading.

Conversely, if `setWebhook` succeeds and is followed by the `getWebhookInfo` call that
returns the *previous* (old) webhook state due to an eventual-consistency lag in Telegram's
infrastructure, the returned `webhookInfo` might not yet reflect the just-registered URL,
causing the UI to continue showing "Not registered" even after a successful activation.

**Fix:** Treat the two calls as independently fallible. Return success after `setWebhook`
completes, and use a best-effort `getWebhookInfo` for display:

```typescript
await getBot().api.setWebhook(webhookUrl, { secret_token: webhookSecret })

let webhookInfo: Record<string, unknown> = { url: webhookUrl }
try {
  webhookInfo = (await getBot().api.getWebhookInfo()) as unknown as Record<string, unknown>
} catch {
  // Non-fatal: setWebhook succeeded; show the URL we just registered as fallback
}
return { ok: true, webhookInfo }
```

---

### WR-03: Email address is submitted without validation — invalid values silently saved

**File:** `src/components/notification/NotificationSettingsForm.tsx:206`

**Issue:** Phone numbers are validated via `normalizePhone()` before submission, but
`email_address` is submitted as-is after a `.trim()` call with no format validation:

```typescript
email_address: formData.email_address.trim() || null,
```

The `<input type="email">` attribute provides browser-level UI hints but offers no
programmatic enforcement (the form has `noValidate` set, which explicitly suppresses
browser validation). A contractor can save a syntactically invalid email address (e.g.,
`not-an-email`, `@`, `foo@`). If the API route at `/api/notification-settings` also lacks
email validation (not in scope of this review), the invalid value would be persisted and
could cause notification delivery failures silently.

**Fix:** Validate the email address before submission using a simple regex or the standard
`input.validity.valid` API:

```typescript
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// In handleSubmit, before setIsSaving:
const emailValue = formData.email_address.trim()
if (emailValue && !EMAIL_RE.test(emailValue)) {
  setFeedback({ type: 'error', message: 'Enter a valid email address.' })
  return
}
```

---

### WR-04: Hardcoded bot username `voiceDeskTelBot` in the component deep link

**File:** `src/components/notification/NotificationSettingsForm.tsx:469`

**Issue:** The Telegram deep-link URL is constructed with a hardcoded bot username:

```tsx
href={`https://t.me/voiceDeskTelBot?start=${contractorId ?? ''}`}
```

If the bot is renamed, deprecated, or if a staging/development bot with a different
username must be used, this string must be tracked down across the codebase and updated
manually. More critically, the bot username in the link and the bot registered via
`TELEGRAM_BOT_TOKEN` can silently diverge — users click a link to one bot while the
platform registers a webhook for a different bot.

**Fix:** Add a `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` environment variable and use it here,
with a fallback that makes the mismatch visible:

```typescript
const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'voiceDeskTelBot'
// ...
href={`https://t.me/${botUsername}?start=${contractorId ?? ''}`}
```

This also enables different bot usernames across staging and production environments.

---

## Info

### IN-01: `contractorId ?? ''` produces a silently broken deep link when `contractorId` is null

**File:** `src/components/notification/NotificationSettingsForm.tsx:469`

**Issue:** When `useContractor()` returns `contractorId: null` (loading or error state),
the deep link becomes `https://t.me/voiceDeskTelBot?start=` with an empty `start` payload.
The webhook handler in `route.ts` correctly rejects this (`if (!contractorId)` check), so
no data is corrupted, but the user is shown a broken error message from the bot ("Invalid
link") rather than a meaningful UI-level message explaining that their account is not ready.

**Fix:** Disable the link when `contractorId` is null:

```tsx
{contractorId ? (
  <a href={`https://t.me/voiceDeskTelBot?start=${contractorId}`} ...>
    Open @voiceDeskTelBot (opens in new tab)
  </a>
) : (
  <span className="text-[#64748B] text-sm">Loading your account…</span>
)}
```

---

### IN-02: `@ts-expect-error` on prop that now exists — tests will fail once `@ts-expect-error` becomes stale

**File:** `tests/components/notification/NotificationSettingsForm.webhook.test.tsx:89,98,107,121,137,161,181`

**Issue:** Every render call in the test file is annotated with:
```typescript
// @ts-expect-error — initialWebhookInfo prop does not exist yet (RED state)
```
The component under review **already accepts** `initialWebhookInfo` as a typed prop. Once
TypeScript checks this file, the `@ts-expect-error` directives will become "unused suppression"
errors (tsc `--strict` flag causes `TS2578: Unused '@ts-expect-error' directive`), and the
test file will fail to compile. This defeats the RED-test intent.

**Fix:** Remove all `@ts-expect-error` comments from the component test file now that the
prop exists in the component:

```typescript
// BEFORE (incorrect after prop was added):
// @ts-expect-error — initialWebhookInfo prop does not exist yet (RED state)
render(<NotificationSettingsForm initialSettings={initialSettings} initialWebhookInfo={null} />)

// AFTER:
render(<NotificationSettingsForm initialSettings={initialSettings} initialWebhookInfo={null} />)
```

---

### IN-03: `as unknown as Record<string, unknown>` double cast applied in two places with no shared type

**File:** `src/app/(dashboard)/settings/notifications/page.tsx:31`, `src/app/(dashboard)/settings/notifications/actions.ts:70`

**Issue:** Both the page and the action cast the grammY `WebhookInfo` type via
`as unknown as Record<string, unknown>`. This pattern erases the type information that grammY
provides (e.g., `url: string`, `pending_update_count: number`) and forces downstream code
to use untyped property access, requiring a secondary type-guard in the component (`typeof
webhookInfo.url === 'string'`). The casting is repeated in two independent files, and the
intermediate `as unknown` widens the type fully before narrowing, bypassing TypeScript's
assignability check.

**Fix:** Import `WebhookInfo` from grammY in a shared server-only module or create a typed
DTO, and pass it across the component boundary using the actual type:

```typescript
// shared type (server-side only file, or in types/telegram.ts):
import type { WebhookInfo } from 'grammy/types'
export type TelegramWebhookInfo = Pick<WebhookInfo, 'url' | 'pending_update_count' | 'has_custom_certificate'>
```

At minimum, remove the intermediate `as unknown` — the direct cast `as Record<string, unknown>`
would at least preserve any compile-time relationship. The double-cast form `as unknown as X`
is a code smell that signals a type-safety gap.

---

_Reviewed: 2026-05-30T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

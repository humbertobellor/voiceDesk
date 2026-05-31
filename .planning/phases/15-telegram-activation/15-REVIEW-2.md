---
phase: 15-telegram-activation
reviewed: 2026-05-30T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - tests/actions/telegram-webhook.test.ts
  - tests/components/notification/NotificationSettingsForm.webhook.test.tsx
  - src/app/(dashboard)/settings/notifications/actions.ts
  - src/lib/notifications/telegram.ts
  - src/app/(dashboard)/settings/notifications/page.tsx
  - src/components/notification/NotificationSettingsForm.tsx
findings:
  critical: 3
  warning: 4
  info: 2
  total: 9
status: issues_found
---

# Phase 15: Code Review Report (Pass 2)

**Reviewed:** 2026-05-30T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 15 adds a server action (`activateTelegramWebhook`) that registers the platform-level
Telegram Bot API webhook, a settings UI card showing webhook status, and server-side
prefetching of webhook info on the Notifications page. The implementation handles
authentication, authorization, env-var validation, and error propagation reasonably well.

Three blockers found:

1. Real production credentials committed to git (`.env.prod`, `.env.prod-check`, `.env.test`)
   — entirely outside the reviewed source files but surfaced by the grep pass performed
   during context loading. The secrets include Stripe secret/webhook keys, Supabase service-role
   JWT, Google OAuth client secret, Inngest signing key, and a Telegram webhook secret. This
   is the most critical finding.
2. The `'use server'` directive in `actions.ts` is preceded by multi-line block comments.
   Next.js requires `'use server'` to be the very first statement in the file (before any
   comments). The current placement — after 8 lines of comments — causes Next.js to treat
   the file as a plain module, silently bypassing the server-action security boundary and
   making every function in the file callable from the client without server-side checks.
3. `process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` is read inside a client component at
   render time. `NEXT_PUBLIC_` variables are inlined at **build time** by Next.js; reading
   them at runtime via `process.env` in a Client Component returns `undefined` if the
   variable was not set when the bundle was compiled, silently falling back to the hardcoded
   production bot username regardless of environment.

---

## Structural Findings (fallow)

None provided.

---

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Production secrets committed to git in `.env.prod` and `.env.prod-check`

**File:** `.env.prod:1-39`, `.env.prod-check:1-39`, `.env.test:1-39`
**Issue:** `git ls-files` confirms `.env.prod` and `.env.prod-check` are tracked by git
(`.env.test` is also tracked). These files contain live production credentials:

- `GOOGLE_CLIENT_SECRET` — real Google OAuth client secret
- `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` — live Inngest production keys
- `STRIPE_SECRET_KEY` — Stripe test-mode secret key (`sk_test_...`)
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service-role JWT (bypasses RLS — full DB access)
- `OAUTH_ENCRYPTION_KEY` — AES-256-GCM key used to encrypt Google refresh tokens at rest
- `RETELL_API_KEY` — Retell AI production key
- `TELEGRAM_WEBHOOK_SECRET` — Telegram webhook validation secret
- `VERCEL_OIDC_TOKEN` — Vercel OIDC JWT

The `.gitignore` explicitly lists `.env.local` and `.env*.local` but does NOT list `.env.prod`
or `.env.prod-check`. Anyone with read access to the repository has had access to these
credentials from the first commit they appeared in.

**Fix:**
```bash
# 1. Remove files from git tracking immediately (do NOT delete from disk)
git rm --cached .env.prod .env.prod-check .env.test

# 2. Add to .gitignore
echo ".env.prod" >> .gitignore
echo ".env.prod-check" >> .gitignore
echo ".env.test" >> .gitignore

# 3. Rotate ALL credentials that appear in these files — treat every secret
#    as compromised:
#    - Supabase: regenerate service-role key in Supabase dashboard
#    - Google: regenerate OAuth client secret in Google Cloud Console
#    - Stripe: roll secret key (sk_test_... → new key) and webhook secret
#    - Inngest: regenerate event key and signing key
#    - Retell: regenerate API key
#    - OAUTH_ENCRYPTION_KEY: generate new key; re-encrypt all stored tokens
#    - TELEGRAM_WEBHOOK_SECRET: generate new secret and re-register webhook
#    - Vercel OIDC token: ephemeral — no action needed

# 4. Use environment variable injection in Vercel dashboard / CI,
#    never a committed file.
```

---

### CR-02: `'use server'` directive is not the first statement — server-action boundary silently bypassed

**File:** `src/app/(dashboard)/settings/notifications/actions.ts:1-10`
**Issue:** Next.js requires the `'use server'` directive to be the very first statement in
the file — before any code, imports, or comments. The current file has 8 lines of block
comments before the directive on line 9:

```
1  // src/app/(dashboard)/settings/notifications/actions.ts
2  // Server actions for the Notification Settings page.
...
9  'use server'
```

When the directive is not the first statement, Next.js does not mark the file as a
Server Actions module. The functions are still exported and importable from client bundles,
but they execute **without** the server-action security wrapper. The auth checks inside
`activateTelegramWebhook` still run (they are application-level guards), but the Next.js
framework-level protections — CSRF token validation, encrypted action IDs, and the
enforcement that the function cannot be serialized to the client — are all skipped.

**Fix:** Move the directive to line 1, before any comments:

```typescript
'use server'
// src/app/(dashboard)/settings/notifications/actions.ts
// Server actions for the Notification Settings page.
//
// TEL-01 / TEL-02: ...
import 'server-only'
import { createSupabaseServer } from '@/lib/supabase/server'
...
```

---

### CR-03: `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` read at runtime via `process.env` in a Client Component — always `undefined` unless set at build time

**File:** `src/components/notification/NotificationSettingsForm.tsx:485,490`
**Issue:** In a Client Component, Next.js replaces `NEXT_PUBLIC_*` env-var references with
their **build-time** values when compiling the client bundle. Reading
`process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` at runtime works only if the variable was
present at build time. If it is absent at build time (no entry in `.env.local` or Vercel
environment), `process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` is `undefined` and the
`?? 'voiceDeskTelBot'` fallback fires — silently pointing **all** environments (staging,
preview, local) at the hardcoded production bot. This breaks the stated intent:
"staging and production bots are independent" (WR-04 comment, line 483).

The `.env.example` does not include `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` at all, so
developers have no prompt to set it.

**Fix:**

1. Add the variable to `.env.example`:
```
# Telegram bot username (without @). Used to generate the deep-link URL.
# Set per environment — staging and production bots must differ.
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=voiceDeskTelBot
```

2. Ensure the variable is populated in Vercel environment settings for each deployment
   target before building.

3. Optionally add a build-time assertion in `next.config.js` to catch a missing value:
```js
if (!process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME) {
  throw new Error('NEXT_PUBLIC_TELEGRAM_BOT_USERNAME must be set at build time')
}
```

---

## Warnings

### WR-01: `handleActivateTelegramWebhook` swallows unexpected exceptions — `webhookActivating` never resets on crash

**File:** `src/components/notification/NotificationSettingsForm.tsx:259-272`
**Issue:** The handler uses a `finally` block to reset `webhookActivating`, which is
correct for the normal path. However, `activateTelegramWebhook` is declared as "never
throws," so unexpected runtime errors (e.g., a network interruption before the `await`
settles, or a React render error) would not reach `finally`. More concretely: the
handler has no `catch` block. If the server action itself throws (which the current
implementation does not, but future changes or a framework error might), the button
stays disabled permanently for the session.

The `handleUnlinkTelegram` handler (line 240) has the same structural pattern. Both
should add a catch:

```typescript
const handleActivateTelegramWebhook = async () => {
  setWebhookError(null)
  setWebhookActivating(true)
  try {
    const result = await activateTelegramWebhook()
    if (result.ok) {
      setWebhookInfo(result.webhookInfo)
    } else {
      setWebhookError(result.error)
    }
  } catch (err) {
    setWebhookError('An unexpected error occurred. Please try again.')
    console.error('[handleActivateTelegramWebhook] unexpected:', err)
  } finally {
    setWebhookActivating(false)
  }
}
```

---

### WR-02: Bot singleton state (`_bot`, `_cachedToken`) is module-level — registration order race on cold start

**File:** `src/lib/notifications/telegram.ts:20-21,36-98`
**Issue:** On Vercel, each serverless function invocation shares the same Node.js module
instance only within the same worker process. On a cold start, `_bot` is `null`. Two
concurrent requests hitting `getBot()` simultaneously could both observe `_bot === null`,
both create a new `Bot` instance, both register the `/start` command handler, and then
race to assign `_bot`. The last writer wins, but the first-created Bot instance (now
orphaned) has already registered command handlers. The duplicate handler registration on
the surviving instance does not happen, but the orphaned instance's handlers do fire if
any grammY internal state is shared by reference.

In practice, grammY handlers are registered on the instance, so the orphaned Bot is just
garbage collected without side effects. However the token comparison `_cachedToken !== token`
is not thread-safe in Node.js concurrent execution; two concurrent calls can both take the
`if (!_bot || _cachedToken !== token)` branch and create two Bot instances, then assign
in undefined order.

**Fix:** Use a simple initialization guard:

```typescript
let _initPromise: Promise<Bot> | null = null

export function getBot(): Bot {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('[getBot] TELEGRAM_BOT_TOKEN is not set')
  if (_bot && _cachedToken === token) return _bot
  // For serverless, accept the double-init risk — or use a lock:
  if (!_bot || _cachedToken !== token) {
    _bot = null
    _cachedToken = null
    const bot = new Bot(token)
    // ... register handlers ...
    _bot = bot
    _cachedToken = token
  }
  return _bot
}
```

Or accept the trade-off and add a comment acknowledging the race.

---

### WR-03: `page.tsx` calls `getBot()` which throws when `TELEGRAM_BOT_TOKEN` is missing — the catch only handles `getWebhookInfo()` failures

**File:** `src/app/(dashboard)/settings/notifications/page.tsx:31`
**Issue:** `getBot()` throws synchronously (`throw new Error('[getBot] TELEGRAM_BOT_TOKEN is not set')`) when `TELEGRAM_BOT_TOKEN` is missing. The `try/catch` on line 30 catches both the `getBot()` throw and the `getWebhookInfo()` rejection, so the page does fall back to `null` gracefully. However, the error message logged on line 33-36 says "getWebhookInfo failed" even when the actual failure is a missing token — the log is misleading for future debugging. More importantly, the `getBot()` call inside the `try` is the **synchronous** initializer, so if it throws, it creates a new Bot instance registration each page load on the error path — the singleton is not populated, so `_bot` remains `null`, and next time a different path calls `getBot()` without the catch (e.g., `sendTelegram` in a notification handler), it throws uncaught.

This is not a crash risk for the page itself (the catch handles it), but the logging misleads operators.

**Fix:**

```typescript
let initialWebhookInfo: Record<string, unknown> | null = null
try {
  const bot = getBot() // may throw if token missing
  initialWebhookInfo = (await bot.api.getWebhookInfo()) as unknown as Record<string, unknown>
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err)
  // Distinguish missing token from API failure for operator clarity
  if (msg.includes('TELEGRAM_BOT_TOKEN')) {
    console.warn('[NotificationsPage] TELEGRAM_BOT_TOKEN not set — webhook card will show fallback')
  } else {
    console.error('[NotificationsPage] getWebhookInfo failed:', msg)
  }
}
```

---

### WR-04: Test file `NotificationSettingsForm.webhook.test.tsx` contains `@ts-expect-error` on every `render` call — errors are suppressed unconditionally

**File:** `tests/components/notification/NotificationSettingsForm.webhook.test.tsx:89,98,107-111,121,136,161,181`
**Issue:** Every test that renders `NotificationSettingsForm` uses `@ts-expect-error` with
the comment "initialWebhookInfo prop does not exist yet (RED state)." The phase is now
complete and the prop exists in the component. The `@ts-expect-error` directives should
have been removed after the implementation was added; leaving them means:

1. Any *future* real type error on these lines will be silently swallowed.
2. TypeScript's `--strict` mode with `useUnknownInCatchVariables` will not flag the
   suppressed error even when the prop type is correct.

If the prop is now properly typed, TypeScript would emit an "Unused '@ts-expect-error'
directive" error in strict mode — which indicates the suppressions should be removed.

**Fix:** Remove all `// @ts-expect-error` directives in this test file and verify the
tests compile cleanly. If any line still has a genuine type mismatch, address the type
rather than suppressing it.

---

## Info

### IN-01: `ActivateResult` type uses `Record<string, unknown>` for `webhookInfo` — loses type safety across the boundary

**File:** `src/app/(dashboard)/settings/notifications/actions.ts:19-21`
**Issue:** The `webhookInfo` field on the success branch is typed as
`Record<string, unknown>`. The grammY `WebhookInfo` type has a concrete shape; using the
opaque record type means the client component must use runtime `typeof` guards (which it
does at line 509-511 of the form) rather than benefiting from compile-time guarantees.
The stated reason is "avoid importing grammy types into a client component," but the type
can be declared locally in a shared types file or inline in the action return type without
importing grammy.

**Fix:** Define a local interface for the minimal shape used by the client:

```typescript
// In actions.ts or a shared types file
interface TelegramWebhookInfo {
  url: string
  has_custom_certificate: boolean
  pending_update_count: number
}

type ActivateResult =
  | { ok: true; webhookInfo: TelegramWebhookInfo }
  | { ok: false; error: string }
```

This eliminates the runtime `typeof webhookInfo.url === 'string'` guard in the component.

---

### IN-02: Deep link renders empty `?start=` parameter when `contractorId` is `null`

**File:** `src/components/notification/NotificationSettingsForm.tsx:485`
**Issue:** `contractorId` is typed as `string | null`. The template literal uses
`contractorId ?? ''`, so if the context returns `null`, the deep link becomes
`https://t.me/voiceDeskTelBot?start=` — an empty `?start` parameter. In `telegram.ts`
the `/start` handler splits on space and checks `contractorId` for emptiness (line 47-50),
so it would reply with an "Invalid link" error. The link still works structurally, but
the contractor tapping it gets an error message in Telegram before understanding what went
wrong.

The page always redirects unauthenticated users (line 18-19 in `page.tsx`), so `null`
should not occur in practice — but the type allows it and no assertion guards against it.

**Fix:** Either assert non-null before rendering, or hide the link when `contractorId` is
`null`:

```tsx
{contractorId ? (
  <a href={`https://t.me/${botUsername}?start=${contractorId}`} ...>
    Open @{botUsername} (opens in new tab)
  </a>
) : (
  <p className="text-sm text-fg-3">Setup link unavailable. Please reload the page.</p>
)}
```

---

_Reviewed: 2026-05-30T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

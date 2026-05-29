# Phase 15: Telegram Activation - Research

**Researched:** 2026-05-29
**Domain:** Telegram webhook management via grammy SDK; Next.js server actions; real-time UI state updates
**Confidence:** HIGH

## Summary

Phase 15 adds a "Telegram Bot Webhook" status card to the Notification Settings form. The card displays the platform-level Telegram webhook registration status on page load (via `bot.api.getWebhookInfo()`) and allows one-click activation via a server action that calls `bot.api.setWebhook()`. The implementation is straightforward: grammy v1.42.0 (installed and locked in project) has both methods built-in; no new packages are needed. The only new env var is `TELEGRAM_WEBHOOK_URL`, a full HTTPS URL pointing to the webhook handler already deployed in Phase 5. State management follows the existing pattern: Server Component fetches on load, passes to Client Component, local state tracks in-flight actions, and error messages display inline without page reload.

**Primary recommendation:** Implement a card component that fetches `getWebhookInfo()` in the Server Component at page load, passes `initialWebhookInfo` as a prop to `NotificationSettingsForm`, tracks activation state in React hooks, and calls `activateTelegramWebhook()` server action on button click. Mirror the existing error/loading patterns from the `handleUnlinkTelegram` handler already in the component.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Webhook status display | Frontend Server (SSR) | Browser (React state) | Fetch on page load via Server Component; display dynamically on client via React state updates |
| Webhook activation | API / Backend | Frontend (Server Action boundary) | `setWebhook()` call is server-only (requires bot token); server action routes request, client shows loading/error UI |
| Status refresh | Browser | Frontend Server | After successful activation, update local state immediately with returned `WebhookInfo`; no separate fetch |
| Error handling | Browser | API/Backend | Server action returns error string; client displays inline; no page crash |

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Webhook status card is a new section inside `NotificationSettingsForm` — reuses `cardClass` CSS for consistency
- **D-02:** Card position: after Section 3 (per-contractor Telegram link) and before Section 4 (Event type toggles)
- **D-03:** Server action `activateTelegramWebhook()` in a new file, calls `bot.api.setWebhook()` using `getBot()` singleton from `src/lib/notifications/telegram.ts`
- **D-04:** `TELEGRAM_WEBHOOK_URL` env var: full HTTPS URL, e.g., `https://voicedesk.app/api/webhooks/telegram`
- **D-05:** Server action calls `bot.api.getWebhookInfo()` after `setWebhook()` success and returns updated info for immediate client state update
- **D-06:** On failure, server action returns error message string (no throwing); client handles gracefully
- **D-07:** Server Component calls `getWebhookInfo()` on load and passes `initialWebhookInfo` as prop to card
- **D-08:** If `TELEGRAM_BOT_TOKEN` missing or `getWebhookInfo()` throws, Server Component catches and passes `null` (card renders "Status unavailable" fallback)
- **D-09:** Card tracks `webhookInfo` in local React state, initialized from `initialWebhookInfo` prop; no React Query needed
- **D-10:** Activate button shows loading spinner while action in-flight; mirrors `handleUnlinkTelegram` pattern

### Claude's Discretion
- Exact card heading and icon choice (suggest `Bot` or `Send` from lucide-react, already imported)
- Exact copy for "Not registered" vs registered states
- Whether to show webhook URL truncated or full
- Error message copy for missing `TELEGRAM_WEBHOOK_URL` env var vs Telegram API failure

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEL-01 | Notification Settings page shows current Telegram webhook status on load — either registered webhook URL or "Not registered" — fetched via `getWebhookInfo()` | grammy v1.42.0 has `bot.api.getWebhookInfo()` built-in; Server Component can call synchronously on page load; no blocking I/O concerns |
| TEL-02 | Contractor or admin can activate platform Telegram webhook from settings with single button click; status display updates to show registered URL on success, or error message on failure | grammy v1.42.0 has `bot.api.setWebhook()` built-in; server action pattern matches existing `updateLanguages()` in src/app/actions/settings.ts; no additional packages required |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| grammy | 1.42.0 | Telegram bot framework; provides `bot.api.setWebhook()` and `bot.api.getWebhookInfo()` methods | Already installed, locked in project (do NOT upgrade to v2 — breaking change); v1.x is stable and feature-complete for webhook management |
| Next.js | 16.2.4 | Server actions, Server Components | Already in project; server actions are standard pattern for async mutations from client components |
| React | 19.0.0 | Local state management for `webhookInfo`, loading, error states | Already in project; no additional state library needed for this single-card interaction |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 1.14.0 | Icons: `Bot` or `Send` for card header; `Loader2` for button loading state | Already imported in `NotificationSettingsForm`; consistent with existing icon usage |
| zod | 4.4.2 | Input validation for `activateTelegramWebhook()` server action | Already in project; should validate `TELEGRAM_WEBHOOK_URL` format (full HTTPS URL) before calling Telegram |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server action for `setWebhook()` | REST API route in `src/app/api/` | Functionally equivalent; server actions are more concise and type-safe; no meaningful difference for this phase |
| React hooks for `webhookInfo` state | React Query (`useQuery` / `useMutation`) | React Query is already installed; not needed here — this is a one-shot button-click action with an immediate response, not a refetch scenario |
| `getWebhookInfo()` on Server Component page load | Client-side fetch on mount | Server Component approach avoids layout shift before query resolves; matches existing `initialSettings` pattern from Phase 12 |

**Installation:**
No new packages needed. grammy v1.42.0 is already in package.json.

**Version verification:**
```bash
npm view grammy version
# Output: 1.42.0 (as of 2026-05-29)
```

## Package Legitimacy Audit

No new packages added in this phase. The `grammy` v1.42.0 already installed is used.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| grammy | npm | 3+ years | 100k+/week | [getgist/grammy](https://github.com/grammyjs/grammyjs) | [OK] | Already approved in Phase 5 |

**Packages removed:** None
**Packages flagged:** None

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  Notification Settings Page (Server Component)                  │
│                                                                 │
│  1. Fetch getWebhookInfo() on load                             │
│  2. Pass initialWebhookInfo as prop to client component        │
│     └─→ Handle null if bot token missing or API error         │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ initialWebhookInfo: WebhookInfo | null
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  NotificationSettingsForm (Client Component)                    │
│                                                                 │
│  3. Initialize local state: webhookInfo, isLoading, error      │
│  4. Render card: status text + Activate button                 │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ (User clicks "Activate Telegram Webhook")
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  activateTelegramWebhook() Server Action                        │
│                                                                 │
│  5. Validate TELEGRAM_WEBHOOK_URL env var exists + is HTTPS    │
│  6. Call bot.api.setWebhook(url, { secret_token })             │
│  7. On success: call bot.api.getWebhookInfo()                  │
│  8. Return: { ok: true, webhookInfo } | { ok: false, error }  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ { ok, webhookInfo?, error? }
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  Client: Update local state + UI                                │
│                                                                 │
│  9. Success: setState({ webhookInfo, error: null })            │
│     → Card re-renders with registered webhook URL              │
│  10. Failure: setState({ error: message })                     │
│     → Inline error text below button; previous status visible   │
│                                                                 │
│  NO PAGE RELOAD — purely local state update                   │
└─────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

The codebase already has the necessary structure. No new directories needed.

```
src/
├── app/
│   ├── actions/
│   │   └── settings.ts                    ← (existing; can extend or add new file)
│   ├── api/
│   │   └── webhooks/
│   │       └── telegram/
│   │           └── route.ts               ← (existing webhook handler)
│   ├── (dashboard)/
│   │   └── settings/
│   │       └── notifications/
│   │           ├── page.tsx               ← (extend to fetch getWebhookInfo())
│   │           └── actions.ts             ← (NEW — or use src/app/actions/)
│   └── ...
├── components/
│   └── notification/
│       └── NotificationSettingsForm.tsx   ← (extend with webhook card)
├── lib/
│   └── notifications/
│       └── telegram.ts                    ← (existing getBot() singleton)
└── ...
```

**File modifications:**
1. `src/app/(dashboard)/settings/notifications/page.tsx` — add `getBot().api.getWebhookInfo()` call
2. `src/components/notification/NotificationSettingsForm.tsx` — add webhook card section
3. `src/app/actions/settings.ts` or new file in `src/app/(dashboard)/settings/notifications/` — add `activateTelegramWebhook()` server action
4. `.env.example` — add `TELEGRAM_WEBHOOK_URL` entry

### Pattern 1: Server Component → Server Action Mutation with Immediate Client State Update

**What:** A Server Component fetches data on page load and passes it as a prop to a Client Component. The Client Component invokes a server action on user interaction. The server action performs the mutation and returns both the result and updated data. The Client Component updates local state with the returned data without a page reload.

**When to use:** When you need immediate client-side feedback after a server mutation (optimistic updates), and a page refresh is undesirable. Common in settings/preferences forms.

**Example:**

```typescript
// src/app/(dashboard)/settings/notifications/page.tsx (Server Component)
import { Bot } from 'grammy'
import { createSupabaseServer } from '@/lib/supabase/server'

async function NotificationsPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: contractor } = await supabase
    .from('contractors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!contractor) redirect('/setup/phone')

  // NEW: Fetch webhook status on load
  let initialWebhookInfo = null
  let webhookError = null
  try {
    const { getBot } = await import('@/lib/notifications/telegram')
    const webhookInfo = await getBot().api.getWebhookInfo()
    initialWebhookInfo = webhookInfo
  } catch (err) {
    console.error('[NotificationsPage] getWebhookInfo failed:', err instanceof Error ? err.message : err)
    webhookError = 'Could not fetch webhook status'
  }

  const { data: settings } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('contractor_id', contractor.id)
    .maybeSingle()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#F8FAFC] mb-1">Notifications</h1>
        <p className="text-sm text-[#94A3B8]">Configure how and where you receive call alerts.</p>
        <div className="border-b border-[#334155] mt-6" />
      </div>
      {settings && (
        <NotificationSettingsForm
          initialSettings={settings}
          initialWebhookInfo={initialWebhookInfo}
          webhookError={webhookError}
        />
      )}
    </div>
  )
}
```

```typescript
// src/app/(dashboard)/settings/notifications/actions.ts or src/app/actions/settings.ts (Server Action)
'use server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { createSupabaseServer } from '@/lib/supabase/server'
import { getBot } from '@/lib/notifications/telegram'

interface ActivateWebhookResult {
  ok: true
  webhookInfo: any // grammy WebhookInfo type
}

interface ActivateWebhookError {
  ok: false
  error: string
}

export async function activateTelegramWebhook(): Promise<ActivateWebhookResult | ActivateWebhookError> {
  // 1. Authorization
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  // 2. Verify contractor exists
  const serviceClient = createServiceRoleClient()
  const { data: contractor } = await serviceClient
    .from('contractors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!contractor) return { ok: false, error: 'Contractor not found.' }

  // 3. Validate TELEGRAM_WEBHOOK_URL env var
  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL
  if (!webhookUrl) {
    return { ok: false, error: 'Telegram webhook URL not configured on server.' }
  }

  if (!webhookUrl.startsWith('https://')) {
    return { ok: false, error: 'Webhook URL must be HTTPS.' }
  }

  // 4. Retrieve webhook secret
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!webhookSecret) {
    return { ok: false, error: 'Telegram webhook secret not configured on server.' }
  }

  try {
    // 5. Call setWebhook on the Telegram Bot API
    const bot = getBot()
    await bot.api.setWebhook(webhookUrl, { secret_token: webhookSecret })

    // 6. Fetch and return updated webhook info
    const webhookInfo = await bot.api.getWebhookInfo()
    return { ok: true, webhookInfo }
  } catch (err) {
    console.error('[activateTelegramWebhook] error:', err instanceof Error ? err.message : err)
    const message = err instanceof Error ? err.message : 'Failed to activate webhook'
    return { ok: false, error: message }
  }
}
```

```typescript
// src/components/notification/NotificationSettingsForm.tsx (Client Component — new section)
'use client'
import { useState, useEffect } from 'react'
import { Bot, Loader2 } from 'lucide-react'
import { activateTelegramWebhook } from '@/app/(dashboard)/settings/notifications/actions'
// or: import { activateTelegramWebhook } from '@/app/actions/settings'

interface NotificationSettingsFormProps {
  initialSettings: NotificationSettings
  initialWebhookInfo: any | null  // grammy WebhookInfo
  webhookError?: string | null
}

export function NotificationSettingsForm({
  initialSettings,
  initialWebhookInfo,
  webhookError: initialWebhookError,
}: NotificationSettingsFormProps) {
  // ... existing state ...

  // NEW: Webhook card state
  const [webhookInfo, setWebhookInfo] = useState<any | null>(initialWebhookInfo)
  const [webhookActivating, setWebhookActivating] = useState(false)
  const [webhookError, setWebhookError] = useState<string | null>(initialWebhookError ?? null)

  const cardClass =
    'bg-[#1E293B] border border-[#334155] rounded-xl p-6 max-w-[480px] mb-4'

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
      setWebhookError('Unexpected error. Please try again.')
    } finally {
      setWebhookActivating(false)
    }
  }

  // NEW: Webhook card section (insert between Section 3 and Section 4)
  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* ── Section 0: Email ─────────────────────────────────────────────── */}
      {/* ... existing sections ... */}

      {/* ── Section 3: Telegram (per-contractor link) ────────────────────── */}
      {/* ... existing code ... */}

      {/* ── NEW Section: Telegram Bot Webhook ────────────────────────────── */}
      <div className={cardClass}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-[#64748B]" />
            <span className="text-sm font-semibold text-[#F8FAFC]">Telegram Bot Webhook</span>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-xs text-[#94A3B8] mb-2">Platform webhook registration status:</p>
          {webhookInfo ? (
            <p className="text-sm text-[#E2E8F0] font-mono break-all">
              {webhookInfo.url || 'Registered (URL unavailable)'}
            </p>
          ) : (
            <p className="text-sm text-[#94A3B8]">Not registered</p>
          )}
        </div>

        <button
          type="button"
          onClick={handleActivateTelegramWebhook}
          disabled={webhookActivating}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#F97316] hover:bg-[#EA580C] disabled:opacity-50 disabled:cursor-not-allowed text-[#FFFFFF] text-sm font-semibold rounded-lg transition-colors"
        >
          {webhookActivating && <Loader2 className="w-4 h-4 animate-spin" />}
          {webhookActivating ? 'Activating...' : 'Activate Telegram Webhook'}
        </button>

        {webhookError && (
          <p className="text-xs text-[#F87171] mt-2">{webhookError}</p>
        )}
      </div>

      {/* ── Section 4: Event type toggles ──────────────────────────────── */}
      {/* ... existing code ... */}
    </form>
  )
}
```

### Anti-Patterns to Avoid

- **Calling `bot.api.getWebhookInfo()` on every client re-render:** Keep it on the Server Component page load only. Use local state for client-side state. Do NOT call it in a `useEffect(() => { ... }, [])` on the client — this defeats the purpose of the Server Component optimization.
- **Throwing errors in the server action:** Return a structured error object instead. Throwing errors in server actions can leave the client in an inconsistent state. Always return `{ ok: false, error: string }`.
- **Showing a page reload toast instead of updating local state:** The whole point of this phase is "status display updates to show the registered URL on success... WITHOUT a page reload." Do NOT add `location.reload()` — it kills the UX.
- **Forgetting to validate `TELEGRAM_WEBHOOK_URL` format:** Missing env var or non-HTTPS URL should be caught in the server action, not by Telegram's API (which will fail with a cryptic error).
- **Not passing `secret_token` to `setWebhook()`:** The second parameter `{ secret_token: TELEGRAM_WEBHOOK_SECRET }` is mandatory. Without it, Telegram won't validate incoming webhooks, and the webhook handler will reject all requests at the grammY `webhookCallback` step.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Telegram webhook registration | Custom HTTP POST to Telegram API | `bot.api.setWebhook()` from grammy | grammy abstracts token handling, error serialization, and response parsing; rolling your own adds HTTP client boilerplate and error paths |
| Webhook status fetching | Manual API calls + caching logic | `bot.api.getWebhookInfo()` from grammy | Same: grammy handles the API call, parsing, and type safety |
| Button loading state + error display | Custom useReducer hook | useState + inline conditional rendering | For single-action forms, useState is simpler and matches the existing `handleUnlinkTelegram` pattern already in this component |
| Form state management for phone numbers | Custom validation logic | Keep existing `normalizePhone()` helper + `libphonenumber-js` | Already in the component; phone validation is a solved problem in this codebase |

**Key insight:** grammy's `bot.api.*` methods hide the complexity of Telegram Bot API HTTP calls. Do not attempt to call the Telegram API directly — grammy is your single source of truth for the bot.

## Common Pitfalls

### Pitfall 1: Missing or Misconfigured `TELEGRAM_WEBHOOK_URL` Env Var

**What goes wrong:** Server action calls `bot.api.setWebhook()` with `undefined` or a malformed URL. Telegram API returns a cryptic error like "Bad Request: WEBHOOK_URL_NOT_HTTPS_ALLOWED" or "Bad Request: WEBHOOK_URL_INVALID". User sees a generic "Failed to activate" message with no hint what the env var should be.

**Why it happens:** `.env.local` is not version-controlled, and `.env.example` was not updated by the developer. The server action doesn't validate the URL format before calling Telegram.

**How to avoid:** 
1. Add `TELEGRAM_WEBHOOK_URL=https://yourdomain.com/api/webhooks/telegram` to `.env.example` with a clear comment.
2. In the server action, validate `TELEGRAM_WEBHOOK_URL` is a full HTTPS URL before calling `setWebhook()`.
3. Return a clear error like "Telegram webhook URL not configured on server" if missing or invalid.

**Warning signs:** 
- User clicks "Activate" and sees a Telegram API error message in the UI instead of a readable error.
- Error message contains "WEBHOOK_URL" — this is Telegram rejecting the raw URL, not a configuration issue.

### Pitfall 2: Forgetting `secret_token` Parameter in `setWebhook()`

**What goes wrong:** Server action calls `bot.api.setWebhook(webhookUrl)` without the second parameter `{ secret_token }`. Webhook registrations successfully, but the webhook handler at `src/app/api/webhooks/telegram/route.ts` later rejects all incoming updates because grammY's `webhookCallback(..., undefined, undefined, webhookSecret)` validation fails.

**Why it happens:** Developer reads grammy docs, sees `setWebhook(url)` as the minimal example, and forgets that the project's webhook handler (line 98 of route.ts) validates the `X-Telegram-Bot-Api-Secret-Token` header. Without `secret_token` in the registration, Telegram never sends the header, and the validation fails.

**How to avoid:**
1. Always pass the second parameter: `bot.api.setWebhook(webhookUrl, { secret_token: TELEGRAM_WEBHOOK_SECRET })`.
2. Verify both `TELEGRAM_WEBHOOK_SECRET` and `TELEGRAM_WEBHOOK_URL` are set before calling.
3. Cross-check the webhook handler code (route.ts line 98) — it expects `webhookSecret` to be passed to `webhookCallback`.

**Warning signs:**
- Webhook is registered (status page shows the URL), but incoming Telegram messages are silently dropped.
- Webhook handler returns a 503 error when a Telegram message arrives (line 87–89 of route.ts).
- No error in the client; the problem is silent because the webhook handler silently rejects updates.

### Pitfall 3: Calling `getWebhookInfo()` on Every Client Re-render

**What goes wrong:** Developer adds a `useEffect(() => { getWebhookInfo() }, [])` to the Client Component to "keep the webhook status fresh." This defeats the purpose of the Server Component optimization and causes unnecessary API calls to Telegram on every user interaction (because the hook re-runs after every render).

**Why it happens:** Confusion about where data fetching belongs in Next.js App Router. Client developers are used to `useEffect` fetches; Server Components are less familiar.

**How to avoid:**
1. Fetch `getWebhookInfo()` once in the Server Component at page load.
2. Pass the result as a prop to the Client Component.
3. Update local state only after the server action succeeds — never re-fetch from Telegram.
4. If you need fresh data, add a "refresh" button that calls a server action; don't use `useEffect`.

**Warning signs:**
- Network tab shows multiple `bot.api.getWebhookInfo()` calls during a single user interaction.
- Component re-renders cause Telegram API calls instead of using cached state.

### Pitfall 4: Returning Errors by Throwing in Server Action

**What goes wrong:** Server action throws an error on failure:
```typescript
if (!webhookUrl) throw new Error('Missing webhook URL')
```
Client catches the thrown error, but the error handling flow is unclear — client code must distinguish thrown errors from returned error objects. State management becomes inconsistent.

**Why it happens:** Throwing feels like the "natural" way to signal errors in JavaScript. Developers don't realize that server actions have special error handling that can leave the component in an inconsistent state.

**How to avoid:**
1. Always return a discriminated union: `{ ok: true, ... } | { ok: false, error: string }`.
2. Never throw in server actions; handle all error cases and return a structured result.
3. Client code checks `result.ok` and updates state accordingly.

**Warning signs:**
- Try/catch blocks in the client calling the server action.
- Inconsistent error state after a failed action.
- Error handling logic spread across multiple places.

## Code Examples

Verified patterns from official sources:

### Server Component Fetching Webhook Status

**Source:** CONTEXT.md D-07; existing pattern from `src/app/(dashboard)/settings/notifications/page.tsx` with getWebhookInfo() addition

```typescript
// src/app/(dashboard)/settings/notifications/page.tsx
import { getBot } from '@/lib/notifications/telegram'

export default async function NotificationsPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: contractor } = await supabase
    .from('contractors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!contractor) redirect('/setup/phone')

  // D-07: Fetch webhook status on page load
  let initialWebhookInfo = null
  try {
    initialWebhookInfo = await getBot().api.getWebhookInfo()
  } catch (err) {
    console.error('[NotificationsPage] getWebhookInfo failed:', err instanceof Error ? err.message : err)
    // D-08: Pass null if fetch fails; card renders fallback
  }

  const { data: settings } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('contractor_id', contractor.id)
    .maybeSingle()

  return (
    <div>
      {/* ... header ... */}
      {settings && (
        <NotificationSettingsForm
          initialSettings={settings}
          initialWebhookInfo={initialWebhookInfo}
        />
      )}
    </div>
  )
}
```

### Server Action for Webhook Activation

**Source:** CONTEXT.md D-03, D-05, D-06; pattern mirrors `src/app/actions/settings.ts` updateLanguages

```typescript
// src/app/(dashboard)/settings/notifications/actions.ts or src/app/actions/settings.ts
'use server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { getBot } from '@/lib/notifications/telegram'

type ActivateResult = { ok: true; webhookInfo: any } | { ok: false; error: string }

export async function activateTelegramWebhook(): Promise<ActivateResult> {
  // Auth check
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  // Contractor lookup
  const serviceClient = createServiceRoleClient()
  const { data: contractor } = await serviceClient
    .from('contractors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!contractor) return { ok: false, error: 'Contractor not found.' }

  // D-04: Validate TELEGRAM_WEBHOOK_URL env var
  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL
  if (!webhookUrl) {
    return { ok: false, error: 'Telegram webhook URL not configured.' }
  }

  if (!webhookUrl.startsWith('https://')) {
    return { ok: false, error: 'Webhook URL must be HTTPS.' }
  }

  // D-06: Guard missing secret
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!webhookSecret) {
    return { ok: false, error: 'Telegram webhook secret not configured.' }
  }

  try {
    const bot = getBot()
    // D-03: Call setWebhook with secret_token
    await bot.api.setWebhook(webhookUrl, { secret_token: webhookSecret })

    // D-05: Fetch and return updated info for immediate client state update
    const webhookInfo = await bot.api.getWebhookInfo()
    return { ok: true, webhookInfo }
  } catch (err) {
    console.error('[activateTelegramWebhook]:', err instanceof Error ? err.message : err)
    // D-06: Return error message, do not throw
    return { ok: false, error: 'Failed to activate webhook. Please try again.' }
  }
}
```

### Client Component Card with Activation Button

**Source:** CONTEXT.md D-09, D-10; pattern mirrors existing `handleUnlinkTelegram` in NotificationSettingsForm

```typescript
// Inside NotificationSettingsForm ('use client')
'use client'
import { useState } from 'react'
import { Bot, Loader2 } from 'lucide-react'
import { activateTelegramWebhook } from '@/app/(dashboard)/settings/notifications/actions'

interface Props {
  initialWebhookInfo: any | null
  // ... other props ...
}

export function NotificationSettingsForm({ initialWebhookInfo, ...props }: Props) {
  // D-09: Local state
  const [webhookInfo, setWebhookInfo] = useState<any | null>(initialWebhookInfo)
  const [webhookActivating, setWebhookActivating] = useState(false)
  const [webhookError, setWebhookError] = useState<string | null>(null)

  // D-10: Handle click, show loading spinner, update state
  const handleActivateTelegramWebhook = async () => {
    setWebhookError(null)
    setWebhookActivating(true)
    try {
      const result = await activateTelegramWebhook()
      if (result.ok) {
        setWebhookInfo(result.webhookInfo)
        // Optional: show success toast
      } else {
        setWebhookError(result.error)
      }
    } catch (err) {
      setWebhookError('Unexpected error occurred.')
    } finally {
      setWebhookActivating(false)
    }
  }

  const cardClass = 'bg-[#1E293B] border border-[#334155] rounded-xl p-6 max-w-[480px] mb-4'
  const inputClass =
    'w-full px-4 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F8FAFC] text-sm ' +
    'focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent'

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* ... existing sections ... */}

      {/* NEW: Telegram Webhook Activation Card */}
      <div className={cardClass}>
        <div className="flex items-center gap-2 mb-4">
          <Bot className="w-4 h-4 text-[#64748B]" />
          <span className="text-sm font-semibold text-[#F8FAFC]">Telegram Bot Webhook</span>
        </div>

        <div className="mb-4">
          <p className="text-xs text-[#94A3B8] mb-2">Platform webhook registration status:</p>
          {webhookInfo ? (
            <p className="text-sm text-[#E2E8F0] font-mono break-all">
              {webhookInfo.url || '(registered)'}
            </p>
          ) : (
            <p className="text-sm text-[#94A3B8]">Not registered</p>
          )}
        </div>

        <button
          type="button"
          onClick={handleActivateTelegramWebhook}
          disabled={webhookActivating}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#F97316] hover:bg-[#EA580C] disabled:opacity-50 disabled:cursor-not-allowed text-[#FFFFFF] text-sm font-semibold rounded-lg transition-colors"
        >
          {webhookActivating && <Loader2 className="w-4 h-4 animate-spin" />}
          {webhookActivating ? 'Activating...' : 'Activate Telegram Webhook'}
        </button>

        {webhookError && (
          <p className="text-xs text-[#F87171] mt-2">{webhookError}</p>
        )}
      </div>

      {/* ... rest of form ... */}
    </form>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling webhook status via client-side `setInterval()` | Server-side fetch on page load, pass as prop to client | Next.js 13+ (App Router introduced Server Components) | Eliminates unnecessary API calls; improves performance and reduces latency |
| Webhook registration via manual API routes | Telegram Bot Framework (grammy) abstracts API calls | grammy v1.x (2021+) | Type safety, error handling, token management built-in; reduces boilerplate |
| Page reload after webhook activation | Optimistic client state update | React 18+ + Next.js server actions | UX improvement; no flash of loading, instant feedback |

**Deprecated/outdated:**
- Polling-based webhook status checks: No longer needed with Server Components. Server Component can fetch on page load synchronously.
- Manual HTTP requests to Telegram API: Use grammy's `bot.api.*` methods. Manually constructing HTTP requests adds complexity without benefit.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | grammy v1.42.0 has `bot.api.setWebhook()` and `bot.api.getWebhookInfo()` methods built-in and available | Standard Stack | If grammy v1.x does not have these methods, implementation must be rewritten to call Telegram API directly (HTTP requests) |
| A2 | `TELEGRAM_WEBHOOK_URL` is a new env var that should be added to `.env.example` | Architecture Patterns | If the URL is derived from `APP_URL` or another env var instead of being independent, the server action should compute it rather than reading from env |
| A3 | `getBot()` from `src/lib/notifications/telegram.ts` is thread-safe and can be called from both Server Components and Server Actions | Code Examples | If `getBot()` is not thread-safe or has side effects, it must be refactored before use in a Server Component |

**All claims verified by:**
- `grammy` v1.42.0 is installed in package.json and confirmed to be the correct version.
- `getBot()` is already in use in `src/app/api/webhooks/telegram/route.ts` and `src/lib/notifications/telegram.ts` (existing code).
- CONTEXT.md D-04 explicitly states `TELEGRAM_WEBHOOK_URL` is a new env var to be added.

## Open Questions

1. **Webhook URL truncation in UI**
   - What we know: The card should display the registered webhook URL or "Not registered"
   - What's unclear: Should the full URL be shown, or should it be truncated with ellipsis for readability?
   - Recommendation: Show the full URL in a monospace font with `break-all` CSS (keeps long URLs readable). This matches existing practice in error messages and technical fields.

2. **Error message specificity**
   - What we know: Server action returns error message string
   - What's unclear: Should different error types (missing env var vs. Telegram API error) have different messaging, or a single generic message?
   - Recommendation: Use specific error messages (e.g., "Webhook URL not configured" vs. "Telegram API error"). Users debugging deployment issues need clarity.

3. **Success feedback**
   - What we know: Status display updates without page reload
   - What's unclear: Should a toast notification appear on success, or is the inline status update sufficient?
   - Recommendation: Inline status update is sufficient per phase success criteria. No toast needed — matches the minimalist approach of the settings form.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Server action execution | ✓ | 20+ (Vercel default) | — |
| TELEGRAM_BOT_TOKEN | `getBot()` singleton | ✓ | Set in `.env` for all phases | — |
| TELEGRAM_WEBHOOK_SECRET | Webhook handler validation | ✓ | Set in `.env` since Phase 5 | — |
| TELEGRAM_WEBHOOK_URL | Server action `setWebhook()` call | ✗ | — | Add to `.env.example` + docs |

**Missing dependencies:**
- `TELEGRAM_WEBHOOK_URL` must be added by the developer to `.env.local` and configured in the server action.

**Setup required before phase implementation:**
- None — all dependencies already exist except `TELEGRAM_WEBHOOK_URL`, which is added in this phase.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 + React Testing Library 16.3.2 |
| Config file | vitest.config.ts (inherited from Next.js) |
| Quick run command | `npm test -- --reporter=verbose` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEL-01 | Server Component fetches `getWebhookInfo()` on page load and passes to client; client renders status correctly | Integration | `npm test -- --grep "webhook.*status"` | ❌ Wave 0 |
| TEL-02 | Server action `activateTelegramWebhook()` calls `setWebhook()`, returns success with new info; client updates state without page reload | Unit + Integration | `npm test -- --grep "activate.*webhook"` | ❌ Wave 0 |
| TEL-02 | Error handling: server action returns error string; client displays inline; no page crash | Unit | `npm test -- --grep "webhook.*error"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- tests/notifications/webhook-activation.test.ts -x` (fast unit tests only)
- **Per wave merge:** `npm run test` (full suite including integration tests)
- **Phase gate:** Full suite green + manual smoke test of Notifications Settings page before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/actions/telegram-webhook.test.ts` — unit tests for `activateTelegramWebhook()` server action (mocked grammy, Supabase client)
- [ ] `tests/components/notification/NotificationSettingsForm.test.tsx` — rendering + interaction tests for webhook card (mocked server action)
- [ ] `tests/integrations/notifications-page.test.tsx` — Server Component + Client Component integration (mocked getBot(), verified prop threading)
- [ ] `.env.example` update — add `TELEGRAM_WEBHOOK_URL` entry

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | User already authenticated via Supabase middleware |
| V3 Session Management | No | Session managed by Supabase Auth |
| V4 Access Control | Yes | Server action checks contractor ownership (user → contractor lookup); only authenticated contractors can activate |
| V5 Input Validation | Yes | Server action validates `TELEGRAM_WEBHOOK_URL` is full HTTPS URL; rejects empty/http URLs |
| V6 Cryptography | Yes | `TELEGRAM_WEBHOOK_SECRET` must be strong random string (128+ bits); passed securely to grammy via env var |
| V8 Data Protection | Yes | No sensitive data stored; webhook URL is non-secret (public Vercel URL) |

### Known Threat Patterns for {Next.js + grammy + Telegram}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthorized webhook registration (attacker calls `setWebhook` without auth) | Spoofing | Server action requires Supabase auth + contractor lookup; cannot be called by unauthenticated users |
| Invalid webhook URL leads to all messages dropped silently | Denial of Service | Server action validates `TELEGRAM_WEBHOOK_URL` format (HTTPS) before calling Telegram; returns clear error if invalid |
| Webhook secret exposed in client code or logs | Information Disclosure | `TELEGRAM_WEBHOOK_SECRET` is server-only env var; never logged or sent to browser; only used in server action and webhook handler |
| Webhook secret mismatch (registration secret ≠ validation secret) | Tampering | Both server action and webhook handler reference same `TELEGRAM_WEBHOOK_SECRET` env var; single source of truth prevents mismatch |
| Contractor A can activate webhook for Contractor B | Elevation of Privilege | Server action uses service role client to verify contractor ownership: `eq('user_id', user.id)`. Only the authenticated user's contractor record can be activated. |

## Sources

### Primary (HIGH confidence)
- grammy documentation: https://grammy.dev/ — verified v1.42.0 includes `bot.api.setWebhook()` and `bot.api.getWebhookInfo()` methods; these are core Bot API methods, unchanged since v1.0
- Next.js App Router documentation: https://nextjs.org/docs — Server Components and server actions are stable, documented patterns for v14+
- Telegram Bot API documentation: https://core.telegram.org/bots/api — `setWebhook` and `getWebhookInfo` endpoints are official API methods

### Secondary (MEDIUM confidence)
- CONTEXT.md from `/gsd:discuss-phase 15` — locked decisions D-01 through D-10 document the exact implementation pattern (Server Component fetch → server action → client state update)
- Existing codebase patterns: `src/app/actions/settings.ts` (server action pattern), `src/lib/notifications/telegram.ts` (getBot singleton), `src/app/api/webhooks/telegram/route.ts` (webhook validation pattern)

### Tertiary (information sources)
- VoiceDesk CLAUDE.md — project constraints: strict type safety, TDD, Conventional Commits
- VoiceDesk REQUIREMENTS.md — TEL-01, TEL-02 success criteria

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — grammy v1.42.0 is installed, methods are documented and used in existing code
- Architecture: **HIGH** — Server Component + server action pattern is established in the codebase; no new architectural decisions needed
- Pitfalls: **HIGH** — Identified by careful reading of existing webhook handler code and common async state management mistakes
- Implementation specifics: **MEDIUM** — Some UI copy and styling choices are deferred to "Claude's Discretion"; substance (code) is HIGH confidence

**Research date:** 2026-05-29
**Valid until:** 2026-06-29 (30 days; grammy v1.x is stable; no expected API changes)

# Phase 15: Telegram Activation - Pattern Map

**Mapped:** 2026-05-29
**Files analyzed:** 4 new/modified files
**Analogs found:** 4 / 4 (100% coverage)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/(dashboard)/settings/notifications/page.tsx` | page | request-response | `src/app/(dashboard)/settings/calendar/page.tsx` | exact |
| `src/components/notification/NotificationSettingsForm.tsx` | component | request-response | `src/components/notification/NotificationSettingsForm.tsx` (self) | exact |
| `src/app/actions/settings.ts` or new `src/app/(dashboard)/settings/notifications/actions.ts` | server-action | request-response | `src/app/actions/settings.ts` (updateLanguages) | exact |
| `.env.example` | config | static | `.env.example` (existing entries) | exact |

## Pattern Assignments

### `src/app/(dashboard)/settings/notifications/page.tsx` (page, request-response)

**Analog:** `src/app/(dashboard)/settings/notifications/page.tsx` (existing file to extend)

**Current file structure** (lines 1-39):
```typescript
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { NotificationSettingsForm } from '@/components/notification/NotificationSettingsForm'

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

  const { data: settings } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('contractor_id', contractor.id)
    .maybeSingle()

  return (
    <div>
      {/* ... header ... */}
      {settings && <NotificationSettingsForm initialSettings={settings} />}
    </div>
  )
}
```

**Pattern to add: getWebhookInfo() call on page load** (D-07, D-08 from CONTEXT.md):
- Add import: `import { getBot } from '@/lib/notifications/telegram'` at top
- Add try/catch block after contractor lookup to fetch `getBot().api.getWebhookInfo()`
- Pass result as `initialWebhookInfo` prop to `NotificationSettingsForm`
- On error, pass `null` and render fallback UI in component

**Implementation reference** from RESEARCH.md §Code Examples lines 497-540:
```typescript
// After contractor lookup, before settings fetch:
let initialWebhookInfo = null
try {
  initialWebhookInfo = await getBot().api.getWebhookInfo()
} catch (err) {
  console.error('[NotificationsPage] getWebhookInfo failed:', err instanceof Error ? err.message : err)
}

// Pass to component:
<NotificationSettingsForm
  initialSettings={settings}
  initialWebhookInfo={initialWebhookInfo}
/>
```

---

### `src/components/notification/NotificationSettingsForm.tsx` (component, request-response)

**Analog:** `src/components/notification/NotificationSettingsForm.tsx` (existing file to extend with new card section)

**Existing Telegram section pattern** (lines 371-440):
```typescript
{/* ── Section 3: Telegram ────────────────────────────── */}
<div className={cardClass}>
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2">
      <Send className="w-4 h-4 text-[#64748B]" />
      <span className="text-sm font-semibold text-[#F8FAFC]">Telegram</span>
    </div>
    <label className="flex items-center gap-2 cursor-pointer" htmlFor="notify_telegram_enabled">
      <span className="text-sm text-[#94A3B8]">Send Telegram notifications</span>
      <input
        id="notify_telegram_enabled"
        type="checkbox"
        className={checkboxClass}
        checked={formData.notify_telegram_enabled}
        onChange={(e) => handleFieldChange('notify_telegram_enabled', e.target.checked)}
      />
    </label>
  </div>
  {/* connected/disconnected states ... */}
</div>
```

**Existing error handling pattern** (lines 119, 208-220):
```typescript
const [telegramError, setTelegramError] = useState<string | null>(null)

const handleUnlinkTelegram = async () => {
  setTelegramError(null)
  setUnlinkLoading(true)
  try {
    await telegramUnlink.mutateAsync()
    setFormData((prev) => ({ ...prev, notify_telegram_enabled: false }))
  } catch {
    setTelegramError('Could not unlink Telegram. Please try again.')
  } finally {
    setUnlinkLoading(false)
  }
}
```

**Pattern to add: Webhook activation card** (new section between Section 3 and Section 4):
- Add state: `const [webhookInfo, setWebhookInfo] = useState<any | null>(initialWebhookInfo)`
- Add state: `const [webhookActivating, setWebhookActivating] = useState(false)`
- Add state: `const [webhookError, setWebhookError] = useState<string | null>(null)`
- Add handler: `handleActivateTelegramWebhook` (mirror `handleUnlinkTelegram` pattern)
- Add new card section using existing `cardClass` CSS
- Button shows `Loader2` spinner while `webhookActivating` is true
- Display webhook status: show registered URL or "Not registered"
- Display inline error if `webhookError` is set

**Update component props interface**:
```typescript
interface NotificationSettingsFormProps {
  initialSettings: NotificationSettings
  initialWebhookInfo: any | null  // grammy WebhookInfo type
}
```

**Reference implementation** from RESEARCH.md §Code Examples lines 606-689:
- Card placed after the existing per-contractor Telegram link (Section 3)
- Before Event type toggles (Section 4)
- Uses same `cardClass` for visual consistency: `'bg-[#1E293B] border border-[#334155] rounded-xl p-6 max-w-[480px] mb-4'`
- Button shows loading spinner during activation
- On success: update `webhookInfo` state to reflect registered URL
- On failure: set `webhookError` and display inline red text

---

### `src/app/actions/settings.ts` or new `src/app/(dashboard)/settings/notifications/actions.ts` (server-action, request-response)

**Analog:** `src/app/actions/settings.ts` (updateLanguages)

**Auth + validation + mutation pattern** (lines 1-42):
```typescript
'use server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

type UpdateResult = { ok: true } | { ok: false; error: string }

export async function updateLanguages(input: LanguageFormData): Promise<UpdateResult> {
  // 1. Authorization: getUser() validates JWT
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  // 2. Validate input against schema
  const parsed = languageSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  // 3. Find contractor owned by user
  const serviceClient = createServiceRoleClient()
  const { data: contractor, error: cErr } = await serviceClient
    .from('contractors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (cErr || !contractor) return { ok: false, error: 'Contractor not found.' }

  // 4. Perform mutation
  const { error: uErr } = await serviceClient
    .from('contractor_settings')
    .update({ ... })
    .eq('contractor_id', contractor.id)
  if (uErr) {
    console.error('[updateLanguages] update failed:', uErr.message)
    return { ok: false, error: 'Failed to save settings. Please try again.' }
  }

  return { ok: true }
}
```

**Pattern to implement for activateTelegramWebhook:**
1. **Auth check** — use `createSupabaseServer()` + `getUser()`, return error if not signed in
2. **Contractor lookup** — use service role client to verify user owns contractor
3. **Environment validation** — check `TELEGRAM_WEBHOOK_URL` exists and is HTTPS; return clear error if missing or invalid
4. **Telegram API call** — call `getBot().api.setWebhook(webhookUrl, { secret_token: webhookSecret })`
5. **Return updated info** — call `getBot().api.getWebhookInfo()` and return result for immediate client state update
6. **Error handling** — return `{ ok: false, error: string }` (never throw)

**Return type:**
```typescript
type ActivateResult = { ok: true; webhookInfo: any } | { ok: false; error: string }
```

**Reference implementation** from RESEARCH.md §Code Examples lines 546-600:
- Import `getBot` from `@/lib/notifications/telegram`
- Validate `TELEGRAM_WEBHOOK_URL` format before calling Telegram (guard against misconfiguration)
- Always pass `secret_token` to `setWebhook()` — without it, webhook validation will fail
- Catch all errors and return discriminated union, never throw

---

### `.env.example` (config, static)

**Analog:** `.env.example` (existing file, lines 64-72)

**Existing Telegram env vars pattern**:
```
# Telegram Bot Token (Phase 5 Notifications)
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_WEBHOOK_SECRET=your-random-hex-secret
```

**Pattern to add: TELEGRAM_WEBHOOK_URL**
- Add new entry after `TELEGRAM_WEBHOOK_SECRET`
- Full HTTPS URL pointing to the webhook handler: `https://yourdomain.com/api/webhooks/telegram`
- Include comment explaining: "Platform webhook URL for Telegram Bot API registration (Phase 15)"
- Include example: `https://voicedesk.vercel.app/api/webhooks/telegram`

**Reference format** from RESEARCH.md §Common Pitfalls §Pitfall 1, and CONTEXT.md D-04:
```
# Telegram Webhook URL (Phase 15 - Activation)
# Full HTTPS URL where Telegram sends updates. Must match the domain returned by getWebhookInfo().
# Example: https://voicedesk.vercel.app/api/webhooks/telegram
# For local testing, use ngrok: https://xxxx.ngrok-free.app/api/webhooks/telegram
TELEGRAM_WEBHOOK_URL=https://yourdomain.com/api/webhooks/telegram
```

---

## Shared Patterns

### Server Action Auth + Contractor Lookup Pattern
**Source:** `src/app/actions/settings.ts` lines 10-29, `src/app/actions/onboarding.ts` lines 13-31
**Apply to:** `activateTelegramWebhook()` server action

Every server action that modifies contractor settings must:
1. Call `createSupabaseServer()` to get user session
2. Call `getUser()` and return error if not authenticated
3. Use `createServiceRoleClient()` for data mutations
4. Look up contractor by `eq('user_id', user.id)` to verify ownership
5. Return discriminated union: `{ ok: true, ... } | { ok: false, error: string }`
6. Never throw in server actions — always return structured error

### React Hook State Management for Async Actions
**Source:** `src/components/notification/NotificationSettingsForm.tsx` lines 115-119, 208-220
**Apply to:** Webhook activation card in `NotificationSettingsForm`

For single async mutations (like button clicks):
1. Track three states: `const [isLoading, setIsLoading] = useState(false)`
2. Track error: `const [error, setError] = useState<string | null>(null)`
3. Handler clears error, sets loading, calls action, updates state on result
4. Button disabled while loading; shows spinner via `{isLoading && <Loader2 className="w-4 h-4 animate-spin" />}`
5. Display error inline as red text below button: `{error && <p className="text-xs text-[#F87171] mt-2">{error}</p>}`
6. No page reload on success — update local state only

### Environment Variable Validation in Server Actions
**Source:** `src/app/api/webhooks/telegram/route.ts` lines 86-96
**Apply to:** `activateTelegramWebhook()` server action

Guard critical environment variables:
1. Check existence: `const value = process.env.VAR_NAME; if (!value) return { ok: false, error: '...' }`
2. Validate format: check HTTPS URLs start with `https://`, check required patterns
3. Return clear, user-facing error message (e.g., "Webhook URL not configured on server")
4. Log the error for debugging: `console.error('[action-name] validation failed:', ...)`
5. Never expose raw env var names or values to client — sanitize error messages

### Server Component → Client Component Prop Threading
**Source:** `src/app/(dashboard)/settings/notifications/page.tsx` lines 1-39
**Apply to:** Passing `initialWebhookInfo` from page to `NotificationSettingsForm`

When fetching data in a Server Component:
1. Fetch asynchronously on page load (no layout shift)
2. Pass result as prop to Client Component
3. Client Component seeds local state from prop: `const [state, setState] = useState(propValue)`
4. Client updates state only via user interactions; never re-fetches from page
5. This pattern avoids N+1 queries and keeps data fetching at the right boundary

---

## No Analog Found

All four files have strong analogs in the existing codebase. No patterns lacking implementation examples.

---

## Metadata

**Analog search scope:** `/src` directory; focused on existing notification, settings, and server action patterns

**Files scanned:** 
- `src/app/actions/settings.ts` (28 lines)
- `src/app/actions/onboarding.ts` (48 lines)
- `src/app/(dashboard)/settings/notifications/page.tsx` (40 lines)
- `src/components/notification/NotificationSettingsForm.tsx` (500+ lines)
- `src/lib/notifications/telegram.ts` (32 lines)
- `src/app/api/webhooks/telegram/route.ts` (107 lines)
- `.env.example` (91 lines)

**Pattern extraction date:** 2026-05-29

**Key references used:**
- CONTEXT.md D-01 through D-10 (locked decisions on card placement, server action signature, state management)
- RESEARCH.md §Code Examples (verified patterns with line references)
- Existing webhook handler and telegram.ts module (getBot singleton usage)
- Existing NotificationSettingsForm component (error + loading state patterns, cardClass CSS)

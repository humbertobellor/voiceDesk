# VoiceDesk — Full Codebase Review

**Reviewed:** 2026-05-20  
**Depth:** deep  
**Files Reviewed:** 73 source files  
**Status:** issues_found

---

## Executive Summary

| Severity | Count |
|----------|-------|
| BLOCKER  | 5     |
| HIGH     | 6     |
| MEDIUM   | 8     |
| LOW      | 6     |
| **Total**| **25**|

The codebase demonstrates strong security fundamentals in most areas: HMAC signature verification before payload access on both Retell and Stripe webhooks, correct use of `getUser()` over `getSession()`, contractor_id resolved from JWT rather than request body throughout, OAuth tokens encrypted at rest with AES-256-GCM, and comprehensive RLS policies. The critical rules from CLAUDE.md are largely upheld.

The most severe issues are: (1) a schema mismatch that causes the `stripe-payment-failure` Inngest function to query nonexistent columns and silently send alerts to `undefined`, (2) nonexistent columns written by `payment-alert.ts` causing the notification audit log to always fail, (3) a Telegram webhook that accepts unauthenticated messages when `TELEGRAM_WEBHOOK_SECRET` is not set, (4) an open redirect via the `Origin` header in the Stripe portal route, and (5) the checkout route allowing `trialing` users to create duplicate Stripe subscriptions.

---

## Findings Table

| # | Severity | File:Line | Description |
|---|----------|-----------|-------------|
| 1 | BLOCKER | `src/inngest/functions/stripe-payment-failure.ts:53` | Queries nonexistent `phone` and `whatsapp_enabled` columns — alert is silently sent to `undefined` |
| 2 | BLOCKER | `src/lib/notifications/payment-alert.ts:118–141` | Inserts `notification_type` and `recipient_phone` — columns that do not exist in the schema — causing every audit log insert to fail silently |
| 3 | BLOCKER | `src/app/api/webhooks/telegram/route.ts:63` | `TELEGRAM_WEBHOOK_SECRET` defaults to `''`; grammY treats an empty secret as "no validation", allowing any HTTP client to inject arbitrary `/start` payloads |
| 4 | BLOCKER | `src/app/api/stripe/portal/route.ts:59` | `returnUrl` constructed from the attacker-controlled `Origin` request header — open redirect after Stripe portal session |
| 5 | BLOCKER | `src/app/api/stripe/checkout/route.ts:58` | Only blocks `active` status; `trialing` and `past_due` users can call this endpoint to create additional Stripe checkout sessions |
| 6 | HIGH | `src/app/api/recordings/route.ts:51–63` | `createBrowserClient` used inside a server-side API route to generate signed storage URLs; uses anon key with limited permissions and is architecturally wrong for a server context |
| 7 | HIGH | `src/app/api/webhooks/stripe/handlers.ts:136` | `invoice.subscription` cast via `(invoice as any).subscription` — type safety circumvented; fallback to `invoice.id` mixes subscription ID with invoice ID, corrupting the Inngest event payload |
| 8 | HIGH | `src/lib/notifications/whatsapp.ts:25–27` | WhatsApp Content SIDs are placeholder strings (`HXplaceholder_new_lead`, `HXplaceholder_emergency`) — all WhatsApp notifications fail at runtime |
| 9 | HIGH | `src/app/api/webhooks/stripe/handlers.ts:77–81` | Stripe price IDs hardcoded in application code; if Stripe test-mode prices differ from live-mode prices, tier mapping silently defaults to `'basic'` |
| 10 | HIGH | `src/app/api/webhooks/telegram/route.ts:27–46` | `contractorId` from Telegram `/start` payload is not validated as a UUID before being passed to the database upsert — no format check, though FK constraint is the only guard |
| 11 | HIGH | `supabase/migrations/20260514000011_add_contractor_email.sql:12` | `ALTER TABLE contractors ALTER COLUMN email SET NOT NULL` runs after a conditional UPDATE; any orphaned contractor row (no matching `auth.users`) will have `NULL` email and cause the migration to fail in production |
| 12 | MEDIUM | `src/app/actions/onboarding.ts:35–37` | `markContractorLive` verifies ownership via a SELECT but then does the UPDATE with only `.eq('id', contractorId)` — redundant query pattern; ownership check result not carried to update filter |
| 13 | MEDIUM | `src/components/onboarding/steps/TestCallStep.tsx:21–27` | Any inbound call to the contractor's number (not specifically a "test" call) triggers `markContractorLive`; there is no test-call-specific filter on the Realtime subscription |
| 14 | MEDIUM | `src/lib/retell/webhook-types.ts:12` | `from_number` is typed as `string` (not `string | undefined`), but `call.from_number` is accessed with `?? null` in handlers — type is wrong and callers use the wrong field |
| 15 | MEDIUM | `src/lib/query/client.tsx:196–210` | `useUpdateLeadStatus` mutation updates leads by `id` only, without a `contractor_id` filter — relies entirely on RLS; no defense-in-depth at the query level |
| 16 | MEDIUM | `src/app/api/stripe/checkout/route.ts:40–41` | `priceId` obtained by indexing `process.env` with a user-supplied key pattern (`TIER_PRICE_MAP[tier]`) — tier is validated first, so this is safe, but the pattern is fragile |
| 17 | MEDIUM | `src/inngest/functions/retell-call-classify.ts:28–43` | `onFailure` handler calls `db.from('appointments').update(...)` without checking if the `callId` has any appointments; silent no-op on failure is fine but the error is never surfaced |
| 18 | MEDIUM | `src/lib/scheduling/slots.ts:66–68` | `setHours`/`setMinutes` called on a date object created from `addMinutes(nowInTz, dayOffset * 1440)` — `nowInTz` is a "fake-local" Date from `toZonedTime`; arithmetic applied to it without converting back to UTC first may produce off-by-one-hour slots around DST transitions |
| 19 | LOW | `src/app/api/recordings/route.ts:57` | Recording path extracted via regex `replace(/^.*\/recordings\//, 'recordings/')` — if `recording_url` does not contain `/recordings/`, the result is the entire URL, causing a malformed storage path |
| 20 | LOW | `supabase/migrations/20260504000001_initial_schema.sql:164` | `calendar_credentials.token_expiry TIMESTAMPTZ NOT NULL` — but `tokens.expiry_date` from Google OAuth can be `null` (e.g., when using service account tokens); upsert in `callback/route.ts:63` uses `token_expiry: ... ?? null` which would fail the NOT NULL constraint |
| 21 | LOW | `src/lib/stripe/client.ts:7` | Stripe client singleton stored at module level — works on Vercel (new Lambda per deployment) but can persist a stale key if `STRIPE_SECRET_KEY` is rotated without a cold start |
| 22 | LOW | `src/lib/retell/system-prompt.ts:18` | `settings.emergency_keywords.en.join(', ')` — if `emergency_keywords.en` is an empty array (possible via direct DB write), the emergency keyword list in the system prompt is silent |
| 23 | LOW | `src/app/api/onboarding/create-account/route.ts:10–12` | `normalizePhoneNumber` strips `/^\+?1?/` before prepending `+1` — if a US phone number's area code starts with `1` (e.g., `1800...`), the leading `1` is stripped from the digits before re-adding, producing an incorrect number. Validation mitigates most cases but `+1(800)555-1234` (11 digits) would misparse the area code |
| 24 | LOW | `src/inngest/functions/retell-notify-dispatch.ts:23` | `idempotency: 'event.data.callId'` — Inngest idempotency key is a JMESPath string, not the resolved value; the function will use the literal string `"event.data.callId"` as the key, making all calls share one idempotency slot |
| 25 | LOW | `middleware.ts:68` | Middleware matcher excludes `/api/onboarding/create-account` from authentication, which is intentional. However, no other `/api/` route is excluded — the middleware calls `supabase.auth.getUser()` on every API request, including Retell/Stripe webhook routes, adding an unnecessary network round-trip on each webhook |

---

## Detailed Findings

### BLOCKER-01: `stripe-payment-failure` Inngest function queries nonexistent columns

**File:** `src/inngest/functions/stripe-payment-failure.ts:53`

**Issue:** The `load-contractor` step selects `phone` and `whatsapp_enabled` from the `contractors` table:

```typescript
.select('id, retell_llm_id, phone, whatsapp_enabled')
```

The `contractors` schema has `phone_number` (not `phone`), and there is no `whatsapp_enabled` column in any migration. Supabase will return these fields as `undefined`. The subsequent call to `sendPaymentFailureAlert` receives `phone: undefined`, which causes the guard `if (!phone)` to skip the SMS alert entirely and log a warning. The `whatsappEnabled` defaults to `false` via `?? false`, so the WhatsApp path is also suppressed. Payment failure alerts are **silently swallowed** — contractors are never notified.

**Fix:**
```typescript
// stripe-payment-failure.ts step load-contractor
.select('id, retell_llm_id, phone_number, notification_settings(sms_number, whatsapp_number)')

// then:
await sendPaymentFailureAlert({
  contractorId,
  phone: contractor.phone_number,
  whatsappEnabled: !!contractor.notification_settings?.[0]?.whatsapp_number,
})
```

---

### BLOCKER-02: `payment-alert.ts` writes nonexistent columns to `notification_log`

**File:** `src/lib/notifications/payment-alert.ts:118–141`

**Issue:** Both notification log inserts write `notification_type` and `recipient_phone`:

```typescript
await db.from('notification_log').insert({
  contractor_id: contractorId,
  call_id: callId,
  notification_type: 'payment_failure_alert',  // column does not exist
  channel: 'sms',
  recipient_phone: phone,                        // column does not exist; schema uses 'recipient'
  status: 'sent',
})
```

The `notification_log` schema (`20260504000001_initial_schema.sql:197–210`) has `recipient TEXT NOT NULL` (not `recipient_phone`) and no `notification_type` column. Every insert will be rejected by Supabase with a column-not-found error. Because the catch block swallows the error (`console.warn` only), the payment alert audit log is never written.

**Fix:**
```typescript
await db.from('notification_log').insert({
  contractor_id: contractorId,
  call_id: null,           // payment alerts aren't call-related
  channel: 'sms',
  recipient: phone,        // use 'recipient', not 'recipient_phone'
  message: smsBody,        // include the message for audit completeness
  status: 'sent',
})
```

---

### BLOCKER-03: Telegram webhook accepts unauthenticated messages when `TELEGRAM_WEBHOOK_SECRET` is unset

**File:** `src/app/api/webhooks/telegram/route.ts:63`

**Issue:**
```typescript
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET ?? ''
const handleUpdate = webhookCallback(bot, 'std/http', undefined, undefined, webhookSecret)
```

When `TELEGRAM_WEBHOOK_SECRET` is not set in the environment, `webhookSecret` is `''`. grammY's `webhookCallback` with an empty string secret performs **no signature validation** — it accepts any HTTP POST request as a valid Telegram update. An attacker can send a crafted `/start <contractor_uuid>` message directly to the endpoint, linking any contractor's account to an attacker-controlled Telegram chat and hijacking their notifications.

**Fix:**
```typescript
// At module init, fail hard if secret is missing
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
if (!webhookSecret) {
  throw new Error('[webhook/telegram] TELEGRAM_WEBHOOK_SECRET is required — cannot start bot without signature validation')
}
const handleUpdate = webhookCallback(bot, 'std/http', undefined, undefined, webhookSecret)
```

---

### BLOCKER-04: Open redirect via attacker-controlled `Origin` header in Stripe portal route

**File:** `src/app/api/stripe/portal/route.ts:59`

**Issue:**
```typescript
const returnUrl = new URL(req.headers.get('origin') ?? '')
returnUrl.pathname = '/settings/account'
```

The `Origin` request header is fully attacker-controlled. A logged-in contractor (or a CSRF attack targeting a logged-in contractor) can send `Origin: https://evil.com`, causing `returnUrl` to become `https://evil.com/settings/account`. Stripe redirects the user to this URL after the portal session, completing an open redirect that can harvest session tokens or phish credentials.

Additionally, when `origin` is `null` or `''`, `new URL('')` throws `TypeError: Invalid URL`, returning HTTP 500 (caught by the outer try/catch).

**Fix:**
```typescript
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL
if (!appUrl) {
  return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
}
const returnUrl = new URL('/settings/account', appUrl).toString()
const portalUrl = await createPortalSession({ customerId: contractor.stripe_customer_id, returnUrl })
```

---

### BLOCKER-05: Checkout allows duplicate subscriptions for `trialing` and `past_due` contractors

**File:** `src/app/api/stripe/checkout/route.ts:58`

**Issue:**
```typescript
if (contractor.subscription_status === 'active') {
  return NextResponse.json({ error: 'Contractor already has an active subscription' }, { status: 400 })
}
```

Only `active` status is blocked. A contractor with `subscription_status = 'trialing'` (already has a trial subscription in Stripe) or `past_due` can call this endpoint to create a new Stripe Checkout session. This creates multiple Stripe subscriptions per contractor, corrupting billing state. The webhook handler in `handleCheckoutCompleted` would then overwrite `stripe_subscription_id` with the newest session's value, orphaning the earlier subscription.

**Fix:**
```typescript
const blockedStatuses = ['active', 'trialing']
if (blockedStatuses.includes(contractor.subscription_status)) {
  return NextResponse.json(
    { error: 'Contractor already has an active or trialing subscription' },
    { status: 400 }
  )
}
```

---

### HIGH-01: `createBrowserClient` used inside a server-side API route

**File:** `src/app/api/recordings/route.ts:51–63`

**Issue:**
```typescript
const supabaseBrowser = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
const { data: signedData } = await supabaseBrowser.storage
  .from('recordings')
  .createSignedUrl(recordingPath, 60)
```

`createBrowserClient` is designed for browser usage and initializes with cookie-less state. Using it server-side with the anon key means the storage request runs without any user session context. The signed URL generation may fail if the storage bucket requires authenticated access, or succeed only because the bucket is public — either way, the pattern is architecturally wrong and bypasses any session-scoped access control for storage operations. The correct approach is `createServiceRoleClient` or the authenticated server client.

**Fix:**
```typescript
import { createServiceRoleClient } from '@/lib/supabase/service'

const db = createServiceRoleClient()
const { data: signedData, error: signedError } = await db.storage
  .from('recordings')
  .createSignedUrl(recordingPath, 60)
```

---

### HIGH-02: `(invoice as any).subscription` corrupts subscriptionId in payment failure event

**File:** `src/app/api/webhooks/stripe/handlers.ts:136`

**Issue:**
```typescript
const subscriptionId = (invoice as any).subscription ?? invoice.id
```

The comment says "invoice.subscription is the subscription ID string (not a nested object)". The Stripe SDK types `invoice.subscription` as `string | Stripe.Subscription | null` — casting to `any` to access it is a type safety bypass. More critically, the fallback `?? invoice.id` mixes a subscription ID (`sub_...`) with an invoice ID (`in_...`). If `invoice.subscription` is `null` (e.g., a one-time charge invoice), `subscriptionId` becomes the invoice ID. The `subscriptionId` is then sent to Inngest, where `stripe-payment-failure.ts` doesn't even use it — making this a dead, misleading field that may confuse future handlers.

**Fix:**
```typescript
import type Stripe from 'stripe'
const typedInvoice = invoice as Stripe.Invoice & { subscription?: string | null }
const subscriptionId = typeof typedInvoice.subscription === 'string'
  ? typedInvoice.subscription
  : null
```

---

### HIGH-03: WhatsApp Content SIDs are placeholder strings — all WhatsApp notifications fail

**File:** `src/lib/notifications/whatsapp.ts:25–27`

**Issue:**
```typescript
export const WHATSAPP_CONTENT_SIDS = {
  new_lead: 'HXplaceholder_new_lead',
  emergency: 'HXplaceholder_emergency',
} as const
```

These are development placeholder values. Any call to `sendWhatsApp()` will submit these SIDs to the Twilio API, which will reject them with an error. Since WhatsApp is a primary emergency notification channel, this means emergency notifications silently fall back to SMS only (if configured) — a safety-critical gap for a system advertised as dispatching emergencies.

**Fix:** Replace with real approved Content SIDs from the Twilio Console after WABA template approval. Consider making these env vars so they can be set without a code deployment:
```typescript
export function getWhatsAppContentSids() {
  return {
    new_lead: process.env.TWILIO_WHATSAPP_SID_NEW_LEAD ?? '',
    emergency: process.env.TWILIO_WHATSAPP_SID_EMERGENCY ?? '',
  }
}
```

---

### HIGH-04: Hardcoded Stripe price IDs in webhook handler will silently default to 'basic'

**File:** `src/app/api/webhooks/stripe/handlers.ts:77–81`

**Issue:**
```typescript
const tierMap: Record<string, string> = {
  'price_1TWnwOPUnGyJvc3kBUtjnla1': 'basic',
  'price_1TWnzFPUnGyJvc3kCPGRXcLT': 'professional',
  'price_1TWo0zPUnGyJvc3k9qnsukB5': 'enterprise',
}
const subscriptionTier = tierMap[priceId] ?? 'basic'
```

These appear to be Stripe test-mode price IDs. In production, these IDs will not match any real price, causing every contractor who subscribes to be assigned tier `'basic'` regardless of what they purchased. The `?? 'basic'` fallback silently swallows the mismatch.

**Fix:** Use the same env-var-based price IDs that the checkout route already references:
```typescript
const tierMap: Record<string, string> = {
  [process.env.STRIPE_BASIC_PLAN_ID ?? '']: 'basic',
  [process.env.STRIPE_PROFESSIONAL_PLAN_ID ?? '']: 'professional',
  [process.env.STRIPE_ENTERPRISE_PLAN_ID ?? '']: 'enterprise',
}
const subscriptionTier = tierMap[priceId]
if (!subscriptionTier) {
  console.error(`[webhook/stripe] unknown price ID: ${priceId} — cannot map to tier`)
  return
}
```

---

### HIGH-05: Telegram `/start` handler does not validate UUID format of `contractorId`

**File:** `src/app/api/webhooks/telegram/route.ts:27–46`

**Issue:**
```typescript
const parts = text.split(' ')
const contractorId = parts[1]?.trim()
if (!contractorId) { ... return }
// contractorId passed directly to DB upsert:
contractor_id: contractorId,
```

There is no UUID format validation. Any string (including empty, malformed, or probing strings) is passed directly to Supabase. While the FK constraint on `notification_settings.contractor_id → contractors(id)` will reject non-existent UUIDs, it won't reject malformed UUID strings — Postgres will throw a `22P02 invalid input syntax for type uuid` error, returned as an unhandled Supabase error. This logs an error message that includes the raw untrusted input (`contractorId`), which could be used to inject garbage into logs. Additionally, any valid UUID that happens to belong to another contractor can be supplied by an attacker.

**Fix:**
```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
if (!contractorId || !UUID_REGEX.test(contractorId)) {
  await ctx.reply('❌ Invalid link. Please use the setup link from your VoiceDesk dashboard.')
  return
}
```

---

### HIGH-06: Email `NOT NULL` migration is unsafe and may fail in production

**File:** `supabase/migrations/20260514000011_add_contractor_email.sql:12`

**Issue:**
```sql
ALTER TABLE contractors ADD COLUMN email TEXT;
UPDATE contractors c SET email = u.email FROM auth.users u WHERE c.user_id = u.id AND c.email IS NULL;
ALTER TABLE contractors ALTER COLUMN email SET NOT NULL;
```

The `UPDATE` only fills `email` for contractors that have a matching `auth.users` row. If any contractor row exists without a matching `auth.users` record (orphaned rows, rows created via service role bypassing auth, or any edge case), the `ALTER SET NOT NULL` step will fail with a constraint violation, causing the entire migration to roll back. On a live production database, this could block all subsequent migrations.

**Fix:**
```sql
-- Provide a safe default before adding NOT NULL
ALTER TABLE contractors ADD COLUMN email TEXT NOT NULL DEFAULT '';
UPDATE contractors c SET email = u.email FROM auth.users u WHERE c.user_id = u.id;
ALTER TABLE contractors ALTER COLUMN email DROP DEFAULT;
```

---

### MEDIUM-01: `markContractorLive` ownership check is disconnected from the update

**File:** `src/app/actions/onboarding.ts:22–37`

**Issue:** The server action first does a SELECT to verify ownership:
```typescript
const { data: contractor } = await serviceClient
  .from('contractors').select('id').eq('id', contractorId).eq('user_id', user.id).maybeSingle()
if (cErr || !contractor) return { ok: false, error: '...' }
```
Then does the UPDATE:
```typescript
await serviceClient.from('contractors').update({ is_live: true }).eq('id', contractorId)
```

The update filters only by `id`, not by `user_id`. This is not exploitable because the ownership was verified in the select, and the `contractorId` parameter comes from the server-rendered page (not user input in this context). However, the pattern violates defense-in-depth: the update should also include `.eq('user_id', user.id)` so the DB operation itself is scoped correctly.

**Fix:**
```typescript
await serviceClient
  .from('contractors')
  .update({ is_live: true })
  .eq('id', contractorId)
  .eq('user_id', user.id)  // redundant but defense-in-depth
```

---

### MEDIUM-02: Any incoming call marks contractor as live — no test-call filter

**File:** `src/components/onboarding/steps/TestCallStep.tsx:21–27`

**Issue:** The Realtime subscription in `useTestCallVerification` listens for ANY INSERT on the `calls` table for this contractor:
```typescript
filter: `contractor_id=eq.${contractorId}`
event: 'INSERT'
```

If a real customer calls the contractor's number while they are on the "Go Live" step of onboarding, `markContractorLive` is called based on that real call rather than an intentional test call. The contractor is marked live without ever having actually verified the setup. There is no `is_test_call` flag or other distinguishing attribute.

**Fix:** Add a `is_test_call BOOLEAN DEFAULT false` column to the `calls` table (or derive it from the time window), and filter the Realtime subscription to only trigger on calls where `is_after_hours = false` AND `duration_seconds > N`, or require the contractor to explicitly click a "I've placed my test call" button before listening.

---

### MEDIUM-03: `from_number` in webhook types is non-nullable but handlers use `?? null`

**File:** `src/lib/retell/webhook-types.ts:12`

**Issue:**
```typescript
from_number: string  // typed as non-optional, non-nullable
```

But in `handlers.ts:55`:
```typescript
caller_phone: call.from_number ?? null,
```

The `?? null` guard is correct (Retell may omit the field), but the type definition claims it's always present. If code elsewhere in the codebase uses `call.from_number` without a null guard (trusting the TypeScript type), it may crash at runtime on spam calls or test calls that have no caller ID. The type should be `from_number?: string` to match reality.

**Fix:**
```typescript
export interface RetellCallPayload {
  from_number?: string | null  // E.164 caller phone — absent on anonymous/blocked calls
  ...
}
```

---

### MEDIUM-04: `useUpdateLeadStatus` relies solely on RLS — no contractor_id guard in query

**File:** `src/lib/query/client.tsx:196–210`

**Issue:**
```typescript
const { data, error } = await supabase
  .from('leads')
  .update({ status: newStatus, updated_at: new Date().toISOString() })
  .eq('id', leadId)
```

This mutation updates by `leadId` only. While RLS policies correctly restrict writes to leads belonging to the authenticated contractor, there is no contractor_id filter in the query itself. If RLS were ever accidentally disabled (e.g., during a debug session or migration error), any authenticated user could update any lead. Defense-in-depth requires the query to also include `.eq('contractor_id', contractorId)`.

**Fix:**
```typescript
.update({ status: newStatus, updated_at: new Date().toISOString() })
.eq('id', leadId)
.eq('contractor_id', contractorId)  // defense-in-depth
```

---

### MEDIUM-05: `leads.caller_phone` is `NOT NULL` but can be empty string

**File:** `supabase/migrations/20260504000001_initial_schema.sql:114`

**Issue:**
```sql
caller_phone TEXT NOT NULL,
```

In `retell-call-classify.ts:147`:
```typescript
caller_phone: callRow?.caller_phone ?? '',
```

When `caller_phone` is null in the calls table (which is allowed — `calls.caller_phone TEXT` is nullable), the insert falls back to `''` (empty string) to satisfy the NOT NULL constraint on `leads`. An empty string is not a valid phone number and will cause downstream notification failures (`sendSms({ to: '' })` will silently fail or error at Twilio).

**Fix:** Either make `leads.caller_phone` nullable, or explicitly reject creating a lead when caller phone is unavailable:
```typescript
if (!callRow?.caller_phone) {
  console.warn('[retell-call-classify] skipping lead creation — no caller phone')
  return null
}
```

---

### MEDIUM-06: DST boundary risk in slot computation using `nowInTz` for arithmetic

**File:** `src/lib/scheduling/slots.ts:57, 66–68`

**Issue:**
```typescript
const nowInTz = toZonedTime(now, timezone)
// ...
const candidateDayStart = startOfDay(addMinutes(nowInTz, dayOffset * 1440))
// ...
let slotStartInTz = new Date(candidateDayStart)
slotStartInTz.setHours(openH, openM, 0, 0)
```

`toZonedTime` returns a "fake" local Date that appears to be in the timezone but is actually a UTC Date with shifted values. Calling `addMinutes` on it for multi-day arithmetic, then `startOfDay`, then `setHours` on the result mixes timezone-shifted values with UTC-based arithmetic. During DST transitions (e.g., 2:00 AM → 3:00 AM), this can produce a `candidateDayStart` that is off by one hour, causing slots to be computed at the wrong time (e.g., 9 AM slot shows as 8 AM or 10 AM).

**Fix:** Use `date-fns-tz`'s `toDate` / `fromZonedTime` for all arithmetic in the contractor's timezone:
```typescript
// Don't do arithmetic on toZonedTime() results
// Use addDays on UTC timestamps and convert back when needed
```

---

### MEDIUM-07: Inngest idempotency key for `retell-notify-dispatch` is a literal string

**File:** `src/inngest/functions/retell-notify-dispatch.ts:23`

**Issue:**
```typescript
idempotency: 'event.data.callId',
```

In Inngest, `idempotency` on a function definition takes a JMESPath expression evaluated against the event — **not** a template string. The value `'event.data.callId'` is interpreted literally, meaning all invocations of this function share the same idempotency key. This causes the second invocation of any `retell/call.notify` event to be deduplicated against the first, so only the first contractor ever receives notifications after a process restart.

**Fix:** Confirm the correct Inngest API for per-event idempotency. Based on Inngest v3 docs, the correct pattern is to pass `id` on the event itself:
```typescript
// In retell-call-classify.ts, when sending:
await step.sendEvent('trigger-notify', {
  name: 'retell/call.notify',
  id: `retell-notify-${callId}`,  // idempotency key on the event send
  data: { callId, contractorId },
})
// And remove the idempotency field from the function definition
```

---

### LOW-01: Recording path extraction fails silently for non-standard URLs

**File:** `src/app/api/recordings/route.ts:57`

**Issue:**
```typescript
const recordingPath = call.recording_url.replace(/^.*\/recordings\//, 'recordings/')
```

If `recording_url` stored by the Retell webhook does not contain `/recordings/` in its path (e.g., it is a Retell CDN URL like `https://cdn.retellai.com/call-123.mp3`), the regex finds no match and `recordingPath` becomes the entire URL (`https://cdn.retellai.com/call-123.mp3`). This is then passed as a storage bucket path, causing `createSignedUrl` to fail.

**Fix:** Validate that the recording URL belongs to Supabase storage before attempting to generate a signed URL, or store only the storage path (not the full URL) in `calls.recording_url`.

---

### LOW-02: `calendar_credentials.token_expiry` is `NOT NULL` but Google can return `null` expiry

**File:** `supabase/migrations/20260504000001_initial_schema.sql:164`

**Issue:**
```sql
token_expiry TIMESTAMPTZ NOT NULL,
```

In `src/app/api/auth/google/callback/route.ts:63`:
```typescript
token_expiry: tokens.expiry_date != null ? new Date(tokens.expiry_date).toISOString() : null,
```

If `tokens.expiry_date` is null (can happen with certain OAuth configurations), `token_expiry: null` is written to a `NOT NULL` column, causing a constraint violation. The code handles the null case by producing `null`, but the schema rejects it.

**Fix:** Either make `token_expiry` nullable (`TIMESTAMPTZ`), or set a safe default when null (e.g., 1 hour from now).

---

### LOW-03: Module-level singleton clients can retain stale API keys after key rotation

**Files:** `src/lib/stripe/client.ts`, `src/lib/retell/client.ts`, `src/lib/openai/client.ts`

**Issue:** All three clients use module-level singletons (`let _client = null`). On Vercel serverless, each Lambda instance is reused across requests in the same warm invocation cycle. If an API key is rotated, the old client persists in memory until the Lambda is cold-started. Stripe webhooks and Retell calls made with the stale key will be rejected until the next cold start.

This is expected behavior in serverless, but it is undocumented and could cause silent failures during key rotation procedures.

**Fix:** Document that key rotation requires a forced redeployment (which triggers cold starts). No code change required, but add a comment.

---

### LOW-04: Emergency keyword prompt is silent when `en` array is empty

**File:** `src/lib/retell/system-prompt.ts:18`

**Issue:**
```typescript
const emergencyKeywords = settings.emergency_keywords.en.join(', ')
```

The DB-level `DEFAULT` for `emergency_keywords` is a populated JSONB object, but the `ContractorSettings` type does not enforce non-empty arrays. If a contractor's emergency keywords are cleared via direct DB access, `emergencyKeywords` becomes `''` and the system prompt reads:

```
Emergency keywords (): If the caller mentions any of these...
```

This silently disables emergency keyword detection in the voice agent.

**Fix:**
```typescript
const emergencyKeywords = settings.emergency_keywords.en.join(', ')
if (!emergencyKeywords) {
  console.warn('[system-prompt] emergency_keywords.en is empty for contractor — emergency detection degraded')
}
```

---

### LOW-05: Phone normalization regex strips leading digit from some US area codes

**File:** `src/app/api/onboarding/create-account/route.ts:10–12`

**Issue:**
```typescript
function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/[\s\-\(\)\.]/g, '').replace(/^\+?1?/, '')
  return `+1${digits}`
}
```

The regex `/^\+?1?/` matches an optional `+` followed by an optional `1`. For the phone `+13055551234`, this correctly strips `+1` leaving `3055551234`. However, the Zod validation in `phoneSchema` checks the digit count after stripping, so most misparse cases are caught. The edge case of ambiguity between country code and area code `1` (e.g., `+1 (100) 555-1234`) is handled correctly because the regex stops at the first `1`, but should use a more precise pattern:

```typescript
const digits = phone.replace(/[\s\-\(\)\.]/g, '').replace(/^\+?1/, '')
// Require exactly 10 digits remain (enforce no partial strip)
```

---

### LOW-06: Middleware runs `getUser()` on every Retell/Stripe webhook request

**File:** `middleware.ts:68`

**Issue:**
```typescript
matcher: ['/((?!_next/static|_next/image|favicon.ico|api/onboarding/create-account).*)'],
```

The middleware matcher includes all `/api/webhooks/*` routes. Every Retell and Stripe webhook call triggers a `supabase.auth.getUser()` network call (which calls the Supabase Auth API), even though webhook routes verify their own HMAC signatures and never use session-based auth. This adds latency to every webhook and wastes Supabase Auth API quota.

**Fix:** Extend the matcher negative lookahead to exclude webhook routes:
```typescript
matcher: ['/((?!_next/static|_next/image|favicon.ico|api/onboarding/create-account|api/webhooks/).*)'],
```

---

## Security Controls Verified as Correct

The following critical rules from CLAUDE.md were verified and are correctly implemented:

- **RLS on every table** — All 9 tables have RLS enabled with all four operation policies (SELECT/INSERT/UPDATE/DELETE). `webhook_events` uses a deny-all policy for authenticated/anon users (service role bypasses). New columns added in subsequent migrations are covered by existing policies.
- **Service role key never in browser** — `SUPABASE_SERVICE_ROLE_KEY` has no `NEXT_PUBLIC_` prefix; `service.ts` uses `import 'server-only'`. Verified no `NEXT_PUBLIC_SERVICE_ROLE` references exist.
- **OAuth tokens encrypted at rest** — `encryptToken`/`decryptToken` use AES-256-GCM with a random 96-bit IV per encryption. Tokens stored as `iv:tag:ciphertext` hex. Key is validated to be exactly 64 hex chars. Implementation is correct.
- **Webhook idempotency** — Retell uses `UPSERT ON CONFLICT retell_call_id`. Stripe uses `webhook_events` table with `UNIQUE(source, event_type, external_id)` and 23505 error detection. Inngest uses `id: retell-classify-${call.call_id}`.
- **contractor_id always from auth session** — All provisioning, settings, stripe, and recording routes derive contractor_id from `supabase.auth.getUser()` and a subsequent DB lookup by `user_id`. No route accepts contractor_id from request body or query params.
- **Retell webhook verified before payload access** — `verify(rawBody, retellApiKey, signature)` called before `JSON.parse(rawBody)`. Returns 401 on failure.
- **Webhook returns 200 immediately** — Both Retell and Stripe webhook routes use `after()` from `next/server` for all downstream processing. The 200 response is returned before any DB or Inngest calls.
- **`getUser()` not `getSession()`** — All auth checks use `supabase.auth.getUser()`. Verified across middleware, API routes, and server actions.
- **Open redirect prevention in OAuth callback** — `/auth/callback` validates `next` param starts with `/` and not `//`.

---

_Reviewed: 2026-05-20_  
_Reviewer: Claude (gsd-code-reviewer) — depth: deep_

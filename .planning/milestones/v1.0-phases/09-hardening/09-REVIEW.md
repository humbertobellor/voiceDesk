---
phase: 09-hardening
reviewed: 2026-05-23T00:00:00Z
depth: deep
files_reviewed: 10
files_reviewed_list:
  - src/app/(dashboard)/dashboard/page.tsx
  - src/app/(dashboard)/settings/phone/page.tsx
  - src/app/api/webhooks/retell/route.ts
  - src/app/api/webhooks/telegram/route.ts
  - src/inngest/functions/retell-agent-sync.ts
  - src/inngest/functions/retell-call-classify.ts
  - src/inngest/functions/retell-notify-dispatch.ts
  - src/inngest/functions/stripe-payment-failure.ts
  - src/lib/notifications/telegram.ts
  - tests/ui/phone-settings.test.tsx
findings:
  critical: 4
  warning: 5
  info: 3
  total: 12
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-05-23T00:00:00Z
**Depth:** deep
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Ten files reviewed spanning the Phase 9 hardening scope: dashboard Telegram banner, phone provisioning two-state form, Retell and Telegram webhook handlers, four Inngest background functions, the Telegram notification sender, and the phone-settings test stub.

Critical issues: three security/correctness bugs in the HMAC diagnostic logger, the Telegram webhook handler's module-level throw, and the stripe-payment-failure agent-deactivation step; plus one type-safety gap in the provisioning form's success path that causes a silent UI failure. Five warnings cover missing contractor-existence verification, orphaned notification log rows, confusing 422 error mapping, `unknown` intent silently suppressed, and a semantically incorrect status value. Three info items cover the test stub, a dead query field, and a misleading deep link when no contractor record exists.

---

## Critical Issues

### CR-01: HMAC Diagnostic Log Leaks Partial Hash Prefixes on Every Auth Failure

**File:** `src/app/api/webhooks/retell/route.ts:48-50`
**Issue:** On every failed Retell webhook verification, the logger emits 16 hex characters (64 bits) of the expected HMAC digest, the variant-A computed digest, and the variant-B computed digest together. An attacker who can drive repeated probe requests — using their own body content — sees how close each attempt's HMAC is to the computed value for a known body+timestamp. With access to the logs (Vercel log drain, Datadog, etc., which are frequently over-shared in SaaS teams), this progressively narrows the keyspace. Additionally, `full_signature` is always logged verbatim, exposing the timestamp that was used by the legitimate sender, which is less sensitive but still unnecessary noise.

The HMAC key itself (`RETELL_WEBHOOK_KEY`) is not logged — that would be a P0. The prefix leak is a P1 because it meaningfully assists an offline dictionary attack when the attacker can also control the plaintext body.

**Fix:**
```typescript
// Remove prefix diagnostics entirely from the failure log.
// Keep only opaque timing and reason fields.
const { valid: isValid, diagnostics } = verifyRetellHmac(rawBody, retellWebhookKey, signature)
if (!isValid) {
  console.error('[voicedesk]', JSON.stringify({
    event: 'webhook.retell.signature_failed',
    // Safe fields only:
    reason: diagnostics['reason'],        // 'bad_sig_format' | 'expired' | 'hmac_mismatch'
    time_diff_ms: diagnostics['time_diff_ms'],
    body_length: rawBody.length,
    content_encoding: req.headers.get('content-encoding'),
  }))
  return new Response('Unauthorized', { status: 401 })
}
// Remove diag['expected_prefix'], diag['varA_body_ts_prefix'], diag['varB_ts_body_prefix']
// from verifyRetellHmac entirely.
```

---

### CR-02: Telegram Route Module-Level `throw` Crashes the Next.js Process on Missing Env Var

**File:** `src/app/api/webhooks/telegram/route.ts:71-75`
**Issue:** The module executes `throw new Error(...)` at the top level if `TELEGRAM_WEBHOOK_SECRET` is missing. In Next.js App Router, route modules are evaluated during cold start. An uncaught module-level throw propagates up through the framework's module loader, crashing the Node.js worker process (or at minimum rendering the entire route permanently unavailable with a 500 for all requests, including unrelated routes in the same worker). This also fails silently during `next build` static analysis because it is not flagged as a build error.

The intent (fail fast on missing secret) is correct. The mechanism must move into the request handler, matching the defensive pattern already used for `TELEGRAM_BOT_TOKEN` lines 79-83.

**Fix:**
```typescript
// Replace the module-level throw with a request-time guard:

// BEFORE (module level — unsafe):
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
if (!webhookSecret) {
  throw new Error('[webhook/telegram] TELEGRAM_WEBHOOK_SECRET is required...')
}
const handleUpdate = webhookCallback(bot, 'std/http', undefined, undefined, webhookSecret)

// AFTER (request time — safe):
export async function POST(req: Request) {
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[webhook/telegram] TELEGRAM_WEBHOOK_SECRET is not set — rejecting update')
    return new Response('Service Unavailable', { status: 503 })
  }

  if (!botToken) {
    console.error('[webhook/telegram] cannot process update — TELEGRAM_BOT_TOKEN not set')
    return new Response('Service Unavailable', { status: 503 })
  }

  const handleUpdate = webhookCallback(bot, 'std/http', undefined, undefined, webhookSecret)
  try {
    return await handleUpdate(req)
  } catch (err) {
    console.error('[webhook/telegram] handleUpdate error:', err instanceof Error ? err.message : err)
    return new Response('OK', { status: 200 })
  }
}
```

---

### CR-03: `stripe-payment-failure` Uses `agent_sync_status = 'failed'` to Represent Deactivation — Creates False Retry Loop

**File:** `src/inngest/functions/stripe-payment-failure.ts:87`
**Issue:** Step 3 (`mark-agent-inactive`) sets `agent_sync_status = 'failed'` to signal that the agent is deactivated due to non-payment. The `retell-agent-sync` function's `onFailure` handler also sets `agent_sync_status = 'failed'` when a Retell LLM sync exhausts all retries. These two cases are now indistinguishable in the database and in any monitoring query.

More concretely: if `retell-agent-sync` later runs for any reason (e.g., triggered by a new call classification), it sets `agent_sync_status = 'synced'` on success (step `set-synced-status`), which silently clears the payment-deactivation marker. The Retell agent is still active on Retell's side — there is no actual API call in the deactivation step — so the only enforcement is this DB flag. Overwriting it with `'synced'` re-enables the contractor's service without payment.

**Fix:**
```typescript
// Option A: Add a dedicated status value (requires schema migration):
// agent_sync_status: 'synced' | 'failed' | 'pending' | 'deactivated' | null
await db.from('contractors')
  .update({ agent_sync_status: 'deactivated' })
  .eq('id', contractorId)

// Option B (no migration): Guard retell-agent-sync against overwriting deactivated status:
// In retell-agent-sync.ts step 'set-synced-status', add:
const { data: current } = await db
  .from('contractors')
  .select('agent_sync_status, subscription_status')
  .eq('id', contractorId)
  .maybeSingle()
if (current?.subscription_status === 'past_due' || current?.subscription_status === 'canceled') {
  // Do not overwrite deactivation — skip status update
  return
}
await db.from('contractors').update({ agent_sync_status: 'synced' }).eq('id', contractorId)
```

---

### CR-04: `handleProvision` Sets State to `undefined` on Missing `twilio_number` in API Response

**File:** `src/app/(dashboard)/settings/phone/page.tsx:73`
**Issue:** On a successful provisioning response (`res.ok`), the code calls `setTwilioNumber(data.twilio_number)` without a null/undefined guard. The API contract is reliable today (the provisioning route always includes `twilio_number`), but the type of `data` is `any` (the result of `res.json()`) and there is no runtime validation. If `data.twilio_number` is `undefined` — e.g., due to an API change, a proxy mangling the response, or a content-type mismatch — `setTwilioNumber(undefined)` is called. React state for `twilioNumber` becomes `undefined`, which is falsy. The component re-renders showing the provisioning form again rather than the number display. The user does not see an error, has no way to know provisioning succeeded, and may attempt to provision again, potentially hitting the 409 already-provisioned path.

**Fix:**
```typescript
if (res.ok) {
  const data = await res.json()
  if (!data?.twilio_number) {
    setProvisionError('Provisioning succeeded but number was not returned. Refresh the page.')
    return
  }
  setTwilioNumber(data.twilio_number)
  router.refresh()
  return
}
```

---

## Warnings

### WR-01: Telegram `/start` Handler Does Not Verify Contractor Exists Before Upsert

**File:** `src/app/api/webhooks/telegram/route.ts:43-58`
**Issue:** After UUID format validation, the handler calls `db.upsert(notification_settings)` directly with the caller-supplied `contractorId`. The FK constraint on `notification_settings.contractor_id` will reject a nonexistent UUID at the database level, so data integrity is preserved. However, the handler's response to the user — `'❌ Connection failed. Please try the link again or contact support.'` — is identical for a nonexistent contractor and a legitimate DB error. There is no distinction in logs either (same error path). This means legitimate DB outages are indistinguishable from probe attempts, hindering incident diagnosis. Additionally, the service role client is used for the upsert — any authenticated Telegram user can fire this endpoint with a well-formed UUID by crafting a direct POST (Telegram's `secret_token` header validates the source, but the UUID payload itself is not origin-checked beyond format).

A pre-flight existence check using the service role client is the minimal fix.

**Fix:**
```typescript
// After UUID validation, before upsert:
const db = createServiceRoleClient()
const { data: contractor } = await db
  .from('contractors')
  .select('id')
  .eq('id', contractorId)
  .maybeSingle()

if (!contractor) {
  await ctx.reply('❌ Invalid link. Please use the setup link from your VoiceDesk dashboard.')
  return
}
// Proceed with upsert using same `db` instance
```

---

### WR-02: `writeNotificationLog` Throw Outside `try/catch` Creates Orphaned `pending` Log Rows on Retry

**File:** `src/inngest/functions/retell-notify-dispatch.ts:171,200,226,260`
**Issue:** `writeNotificationLog()` is called outside the `try/catch` block in each channel step. If the insert fails (e.g., transient DB error), the step throws and Inngest schedules a retry. On the next retry, a new `writeNotificationLog()` call creates a second `pending` row. The first `pending` row from the failed attempt is never updated to `'failed'` because the `updateNotificationLog(logId, { status: 'failed' })` call in the catch block never executed. Over 5 retries, a single notification attempt can accumulate up to 5 orphaned `pending` rows in `notification_log`. Monitoring dashboards counting `pending` rows will report inflated numbers.

**Fix:**
```typescript
// Wrap writeNotificationLog inside the try/catch:
await step.run('send-sms', async () => {
  let logId: string | null = null
  try {
    logId = await writeNotificationLog({ contractorId, callId, channel: 'sms', recipient: settings!.sms_number!, message: smsBody })
    await sendSms({ to: settings!.sms_number!, body: smsBody, contractorId, callId })
    await updateNotificationLog(logId, { status: 'sent', sentAt: new Date().toISOString() })
  } catch (err: unknown) {
    if (logId) {
      await updateNotificationLog(logId, { status: 'failed', error: err instanceof Error ? err.message : String(err) })
    }
    throw err
  }
})
```

---

### WR-03: 422 Status Conflates Two Distinct Errors in the Phone Provisioning UI

**File:** `src/app/(dashboard)/settings/phone/page.tsx:81-82`
**Issue:** The provisioning API returns HTTP 422 for two different conditions: (a) area code has no available numbers (`'No numbers available in area code X. Try: 786, 954, or 561.'`) and (b) contractor settings not configured (`'Contractor settings not configured. Please complete onboarding.'`). The phone settings page treats any 422 response identically: `'Area code unavailable. Try: 786, 954, or 561.'` This means a contractor who hasn't completed onboarding sees a misleading "area code unavailable" message rather than "complete onboarding first."

**Fix:**
```typescript
// Use the error message from the API response body instead of hardcoding:
} else if (res.status === 422) {
  setProvisionError(json.error ?? 'Area code unavailable. Try: 786, 954, or 561.')
}
```
The provisioning API already returns a descriptive `error` field in the 422 body.

---

### WR-04: `'unknown'` Intent Silently Suppresses All Notifications

**File:** `src/inngest/functions/retell-notify-dispatch.ts:42-43`
**Issue:** `CallIntent` includes `'unknown'` as a valid value (`src/types/database.ts:9`). The `computeChannels()` function returns all-false for any intent that is not `'emergency'`, `'lead'`, or `'info'`. The early-return guard at line 42 only explicitly handles `null` and `'no_action'`. An `'unknown'`-intent call silently falls through all channel conditions and no notification is sent. While the LLM classifier (`classify-intent.ts`) only emits four values and never produces `'unknown'`, any legacy DB row with `intent = 'unknown'` (or a future LLM schema change) would be silently dropped. The function provides no log or trace when all channels are skipped for a non-`no_action` reason.

**Fix:**
```typescript
if (!intent || intent === 'no_action' || intent === 'unknown') {
  if (intent === 'unknown') {
    console.warn('[voicedesk]', JSON.stringify({
      event: 'retell-notify-dispatch.skipped_unknown_intent',
      call_id: callId,
      contractor_id: contractorId,
    }))
  }
  return { shouldSendSms: false, shouldSendWhatsApp: false, shouldSendTelegram: false }
}
```

---

### WR-05: `stripe-payment-failure` Selects `retell_llm_id` from DB but Never Uses It

**File:** `src/inngest/functions/stripe-payment-failure.ts:55`
**Issue:** The `load-contractor` step selects `'id, retell_llm_id, phone_number, notification_settings(whatsapp_number)'`. The `retell_llm_id` field is fetched but never referenced anywhere in the function. This is a dead query field. In isolation it is minor, but in an Inngest step, the entire `contractor` return value is serialized and stored in Inngest's step state — every retry re-reads it from that memoized state. Adding unnecessary fields to step return values increases serialized payload size and obscures the function's actual dependencies.

**Fix:**
```typescript
.select('id, phone_number, notification_settings(whatsapp_number)')
```

---

## Info

### IN-01: Test File Is Three Stub Throws — Test Suite is Permanently Red

**File:** `tests/ui/phone-settings.test.tsx:4-15`
**Issue:** All three test cases call `throw new Error('not yet implemented')`. Running `vitest` will report 3 failures. Per the project's TDD convention (CLAUDE.md: "Tests first, always. Red → green → refactor"), these tests should either be implemented or marked with `it.todo()` to express pending intent without failing the suite.

**Fix:**
```typescript
it.todo('renders provisioning form when twilio_number is null')
it.todo('calls POST /api/provisioning/create with area_code when Provision My Number is clicked')
it.todo('shows area code unavailable error on 422 response')
```

---

### IN-02: Telegram Deep Link Banner Shown When `contractorId` is `null`

**File:** `src/app/(dashboard)/dashboard/page.tsx:72-88`
**Issue:** The Telegram setup banner is rendered whenever `telegramLinked === false`. `telegramLinked` is only set to `true` inside the `if (contractor)` block (line 34), meaning it remains `false` when the user has no contractor record at all. In this case, `contractorId` is also `null`, and the deep link renders as `https://t.me/voiceDeskTelBot?start=` (empty payload). The user who clicks this link gets a "Invalid link" error from the bot, with no guidance on why. The banner should be conditioned on `contractorId !== null`.

**Fix:**
```typescript
{!telegramLinked && contractorId && (
  <div role="status" ...>
    ...
  </div>
)}
```

---

### IN-03: `sendTelegram` Creates a New `Bot` Instance Per Call

**File:** `src/lib/notifications/telegram.ts:22`
**Issue:** `new Bot(botToken)` is called inside `sendTelegram()` on every invocation. While grammY's `Bot` class is lightweight for API-only usage (no polling, no handlers), instantiating and discarding it on every notification send creates unnecessary object churn. The bot token is constant. A module-level singleton would be cleaner and consistent with the webhook handler's module-level `const bot = new Bot(...)` pattern.

**Fix:**
```typescript
// Module level:
let _bot: Bot | null = null
function getBot(): Bot {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('[sendTelegram] TELEGRAM_BOT_TOKEN is not set')
  if (!_bot) _bot = new Bot(token)
  return _bot
}

export async function sendTelegram(params: SendTelegramParams): Promise<SendTelegramResult> {
  const result = await getBot().api.sendMessage(params.chatId, params.message)
  return { messageId: result.message_id }
}
```

---

_Reviewed: 2026-05-23T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

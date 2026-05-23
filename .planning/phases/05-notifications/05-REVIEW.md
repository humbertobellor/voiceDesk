---
phase: 05-notifications
reviewed: 2026-05-23T00:00:00Z
depth: deep
files_reviewed: 14
files_reviewed_list:
  - src/app/(dashboard)/dashboard/page.tsx
  - src/app/api/inngest/route.ts
  - src/app/api/webhooks/telegram/route.ts
  - src/inngest/functions/retell-call-classify.ts
  - src/inngest/functions/retell-notify-dispatch.ts
  - src/lib/notifications/log.ts
  - src/lib/notifications/sms.ts
  - src/lib/notifications/telegram.ts
  - src/lib/notifications/whatsapp.ts
  - tests/notifications/log.test.ts
  - tests/notifications/notify-dispatch.test.ts
  - tests/notifications/sms.test.ts
  - tests/notifications/telegram.test.ts
  - tests/notifications/whatsapp.test.ts
findings:
  critical: 5
  warning: 4
  info: 2
  total: 11
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-05-23T00:00:00Z
**Depth:** deep
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Phase 05 delivers multi-channel notification dispatch (SMS, WhatsApp, Telegram) via an Inngest
background job (`retell-notify-dispatch`), a Telegram webhook bot, and per-channel notification
libraries. The overall architecture is sound: credentials guarded server-side, `Promise.allSettled`
parallelism, pre-send log rows, and WhatsApp Content SIDs loaded from env vars.

Five blockers require fixes before this code ships:

1. The `dispatch-notifications` Inngest step is not idempotent — a partial channel failure causes
   Inngest to retry the entire step, re-sending already-succeeded channels (up to 5× per retry budget).
2. When both `sms_number` and `whatsapp_number` are configured and WhatsApp fails, the contractor
   receives two SMS messages: the primary and the D-09 fallback.
3. A complete WhatsApp + fallback-SMS failure produces no re-throw into `allSettled`, so no Inngest
   retry is triggered for that scenario — failure is silent.
4. `notify_on_lead` and `notify_on_emergency` are fetched from the DB but never used in dispatch
   logic; SMS fires unconditionally whenever `sms_number` is set.
5. `notify_on_general_inquiry` is missing from the `NotificationSettings` TypeScript interface,
   creating a type gap that TypeScript cannot catch.

---

## Critical Issues

### CR-01: Inngest retry re-sends all channels, not just the failed one

**File:** `src/inngest/functions/retell-notify-dispatch.ts:113`

**Issue:** The entire `dispatch-notifications` step body runs inside a single `step.run()`. When one
channel fails, `Promise.allSettled` collects the rejection, and the step throws at line 247,
triggering an Inngest retry. Inngest re-executes `step.run('dispatch-notifications', ...)` from
scratch on every retry attempt. Channels that already sent successfully (e.g., SMS succeeded, but
Telegram failed) will be re-invoked, sending duplicate notifications to the contractor. With
`retries: 5`, a persistent Telegram failure causes up to 6 SMS deliveries for a single call.

There is no idempotency guard (no check of existing `notification_log` rows before re-sending), and
no unique constraint on `(contractor_id, call_id, channel)` in `notification_log` to prevent
duplicate rows.

**Fix:** Split each channel into its own `step.run()` so Inngest memoizes each channel independently
and only retries the channel that failed. Example:

```typescript
if (shouldSendSms) {
  await step.run('send-sms', async () => {
    const logId = await writeNotificationLog({ ... })
    try {
      await sendSms({ ... })
      await updateNotificationLog(logId, { status: 'sent', ... })
    } catch (err) {
      await updateNotificationLog(logId, { status: 'failed', ... })
      throw err
    }
  })
}

if (shouldSendWhatsApp) {
  await step.run('send-whatsapp', async () => { ... })
}

if (shouldSendTelegram) {
  await step.run('send-telegram', async () => { ... })
}
```

Each `step.run` result is memoized independently. A Telegram failure retries only
`send-telegram`; `send-sms` is skipped because its result is already recorded.

---

### CR-02: Duplicate SMS when sms_number + whatsapp_number are both configured and WhatsApp fails

**File:** `src/inngest/functions/retell-notify-dispatch.ts:117-199`

**Issue:** When `shouldSendSms` and `shouldSendWhatsApp` are both true, two independent sends are
pushed into the `sends` array: the primary SMS (lines 117–143) and the WhatsApp dispatch
(lines 147–203). If WhatsApp fails, the D-09 fallback on line 175 fires `sendSms` to the same
`sms_number`. The contractor receives two identical SMS messages: the primary (which already
succeeded) and the fallback.

The D-09 fallback is only meaningful when `sms_number` is configured **and** `shouldSendSms` is
`false` (i.e., there is no primary SMS going out). The current code makes no distinction.

**Fix:** Only trigger the fallback SMS if the primary SMS channel was not already dispatched:

```typescript
// D-09: WhatsApp failure → SMS fallback ONLY when primary SMS was not dispatched
if (settings?.sms_number && !shouldSendSms) {
  // ... fallback SMS logic
}
```

---

### CR-03: Silent failure — WhatsApp failure + fallback SMS failure triggers no Inngest retry

**File:** `src/inngest/functions/retell-notify-dispatch.ts:168-201`

**Issue:** When WhatsApp fails, the outer catch block (line 169) marks the log row as failed and
attempts the fallback SMS. If the fallback SMS also fails (line 191), the inner catch updates the
fallback log row but does **not** throw. Control returns to the outer WhatsApp catch block, which
also does not throw (line 199 comment: "Original WhatsApp error is swallowed"). The WhatsApp
`Promise` resolves as `fulfilled` in `allSettled`'s eyes. As a result:

- `failures.length === 0` even though both WhatsApp and its fallback failed.
- The step does not throw.
- Inngest does not retry.
- The contractor receives no notification and no retry is triggered.
- The only observable artifact is two `notification_log` rows with `status='failed'`, which requires
  the Phase 6 portal to surface.

This silences a complete delivery failure for the WA channel.

**Fix:** If the fallback SMS also fails, re-throw so `allSettled` captures the rejection:

```typescript
} catch (fallbackErr: unknown) {
  await updateNotificationLog(fallbackLogId, {
    status: 'failed',
    error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
  })
  throw fallbackErr  // Propagate so allSettled counts this as a failure → Inngest retry
}
```

---

### CR-04: `notify_on_lead` and `notify_on_emergency` fetched but never consulted — contractor preference silently ignored

**File:** `src/inngest/functions/retell-notify-dispatch.ts:56,82`

**Issue:** The `notification_settings` query at line 56 selects `notify_on_lead` and
`notify_on_emergency`. Neither field is referenced anywhere in the dispatch logic. `shouldSendSms`
is determined solely by `settings?.sms_number != null` (line 82). A contractor who has enabled
`sms_number` but set `notify_on_lead=false` (e.g., they only want emergency alerts) will receive
SMS for every lead and info call regardless.

The `NotificationSettings` DB type (database.ts line 172–173) includes both fields with `boolean`
type, so this is not a schema gap — the preference is stored but never evaluated.

**Fix:** Apply the preference flags in `shouldSendSms` and the WhatsApp/Telegram channel conditions:

```typescript
const shouldSendSms =
  settings?.sms_number != null &&
  (
    (intent === 'emergency' && (settings.notify_on_emergency ?? true)) ||
    (intent === 'lead'      && (settings.notify_on_lead      ?? true)) ||
    (intent === 'info'      && (settings.notify_on_general_inquiry === true))
  )
```

Mirror the same conditional for `shouldSendWhatsApp` and `shouldSendTelegram`.

---

### CR-05: `NotificationSettings` TypeScript type missing `notify_on_general_inquiry`

**File:** `src/types/database.ts:166-177` / `src/inngest/functions/retell-notify-dispatch.ts:84`

**Issue:** The `NotificationSettings` interface in `src/types/database.ts` has no
`notify_on_general_inquiry` field. The column exists in the DB schema (migration
`20260508000007_webhook_core.sql`, line 22) and is selected and used at lines 56 and 84 of
`retell-notify-dispatch.ts`. Because the Supabase client is not code-generated (it's a generic
client), `settings.notify_on_general_inquiry` resolves to `any` at compile time, bypassing strict
type checking. If the column were ever renamed or dropped, TypeScript would not catch the breakage.

**Fix:** Add the field to the interface:

```typescript
export interface NotificationSettings {
  // ... existing fields ...
  notify_on_general_inquiry: boolean   // Phase 5: controls info-intent notifications
  whatsapp_opted_in_at: string | null
  created_at: string
  updated_at: string
}
```

---

## Warnings

### WR-01: Telegram deep link has no expiry — link forwarding hijacks contractor notifications

**File:** `src/app/(dashboard)/dashboard/page.tsx:79` / `src/app/api/webhooks/telegram/route.ts:46-53`

**Issue:** The Telegram deep link `https://t.me/voiceDeskTelBot?start=<contractor_id>` is
permanent and contains only the contractor's UUID (which is stable and visible in the dashboard).
There is no HMAC token, no expiry timestamp, and no one-time-use check. If a contractor shares a
screenshot of the link, forwards the URL, or if the UUID leaks, any Telegram user can upsert their
`chat_id` into the contractor's `notification_settings` row, redirecting all call alerts to
themselves. The upsert on conflict (`onConflict: 'contractor_id'`) silently overwrites, so the
original contractor stops receiving notifications without warning.

**Fix:** Generate a short-lived, single-use token (e.g., 256-bit random value stored in the DB with
a 15-minute expiry) and use that as the `?start=` payload instead of the contractor UUID. Invalidate
the token on first use.

---

### WR-02: `notify-dispatch` tests do not exercise the actual Inngest function

**File:** `tests/notifications/notify-dispatch.test.ts:1-122`

**Issue:** All five tests in this file inline-reimplement the logic they claim to test. For example:

- The `no_action` test (line 68) asserts `intent !== 'no_action' === false` — a purely local variable.
- The `info without opt-in` and `info with opt-in` tests (lines 75–93) recompute `shouldSendWhatsApp`
  locally, never importing the dispatch function.
- The D-09 fallback test (lines 97–121) calls the mock functions directly without the surrounding
  dispatch logic.

None of these tests import `retellNotifyDispatch` or exercise the actual `dispatch-notifications`
step. A regression in the real function (e.g., the intent filter being removed) would not be caught
by this test suite.

**Fix:** Import and invoke `retellNotifyDispatch` through the Inngest test helper
(`InngestTestEngine` or equivalent) to test the actual step logic, or at minimum extract the
dispatch logic into a pure function that can be unit-tested in isolation.

---

### WR-03: `TWILIO_WHATSAPP_FROM` assumed to include `whatsapp:` prefix — no startup validation

**File:** `src/lib/notifications/whatsapp.ts:38-42,69`

**Issue:** Line 69 uses `from: fromNumber` (raw env var value) while line 68 adds the `whatsapp:`
prefix only to the `to` address. A comment on line 69 states the env var is already prefixed.
However, there is no runtime assertion that `fromNumber.startsWith('whatsapp:')`. If the env var is
misconfigured (e.g., set to `+15550000000` without the prefix), Twilio will return a 400 or send
to the wrong channel, surfacing only at first send attempt rather than at startup.

**Fix:** Add a startup guard alongside the other env-var checks:

```typescript
if (!fromNumber.startsWith('whatsapp:')) {
  throw new Error(
    '[sendWhatsApp] TWILIO_WHATSAPP_FROM must start with "whatsapp:" (e.g. whatsapp:+1XXXXXXXXXX)'
  )
}
```

---

### WR-04: `call.intent` typed as `string | null` discards the `CallIntent` union — new intents silently unhandled

**File:** `src/inngest/functions/retell-notify-dispatch.ts:73`

**Issue:** Line 73 casts `call.intent` to `string | null` rather than `CallIntent | null`. The
downstream conditionals (`intent === 'lead'`, `intent === 'emergency'`, `intent === 'info'`,
`intent === 'no_action'`) are exhaustive now, but if a new intent value is added to `CallIntent`
in `database.ts` the TypeScript compiler will not flag the unhandled case. The dispatch function
will silently skip notifications for any new intent.

**Fix:** Keep the strict type and use a type guard or exhaustive-check pattern:

```typescript
const intent = call.intent as CallIntent | null
// ...
if (!intent || intent === 'no_action') return

// Exhaustive channel conditions use the narrow type, so tsc flags new intents
```

---

## Info

### IN-01: Twilio client instantiated per-call rather than cached

**File:** `src/lib/notifications/sms.ts:27` / `src/lib/notifications/whatsapp.ts:66`

**Issue:** `twilio(accountSid, authToken)` is called inside `sendSms` and `sendWhatsApp` on every
invocation. Each call parses env vars and constructs a new HTTP client. In a serverless environment
this is acceptable (cold-start cost), but it is inconsistent with how `Bot` is constructed in
`telegram.ts`. Not a correctness issue.

**Fix:** Consider hoisting the client construction to module level (with env-var guard at the top of
the module) as done in the Telegram webhook route, so construction happens once per Lambda warm
container rather than once per notification send.

---

### IN-02: `retell-call-classify.ts` fires `retell/call.notify` unconditionally for `no_action` calls

**File:** `src/inngest/functions/retell-call-classify.ts:312-316`

**Issue:** Step 9 sends `retell/call.notify` for every call regardless of `finalIntent`. For
`no_action` calls (hang-ups, wrong numbers, spam), the event fires and `retell-notify-dispatch`
must load DB data only to return early at line 78. This is a minor inefficiency and creates
unnecessary function invocations and DB queries. By design (D-03), but worth noting.

**Fix:** Add a guard before `step.sendEvent`:

```typescript
if (finalIntent !== 'no_action') {
  await step.sendEvent('trigger-notify', { name: 'retell/call.notify', id: `retell-notify-${callId}`, data: { callId, contractorId } })
}
```

---

_Reviewed: 2026-05-23T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

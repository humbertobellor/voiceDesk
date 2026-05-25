---
phase: 09-hardening
fixed_at: 2026-05-23T00:00:00Z
review_path: .planning/phases/09-hardening/09-REVIEW.md
iteration: 1
findings_in_scope: 11
fixed: 11
skipped: 0
status: all_fixed
---

# Phase 9: Code Review Fix Report

**Fixed at:** 2026-05-23
**Source review:** `.planning/phases/09-hardening/09-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 11 (CR-01 through CR-04, WR-01 through WR-05, IN-02, IN-03)
- Fixed: 11
- Skipped: 0
- Type check after all fixes: `tsc --noEmit` — zero errors

---

## Fixed Issues

### CR-01: HMAC Diagnostic Log Leaks Partial Hash Prefixes

**Files modified:** `src/app/api/webhooks/retell/route.ts`
**Commit:** `448898f`
**Applied fix:** Removed the three prefix diagnostic fields (`expected_prefix`, `varA_body_ts_prefix`, `varB_ts_body_prefix`) from `verifyRetellHmac`. Replaced the spread `...diagnostics` in the failure log with explicit safe fields only: `reason`, `time_diff_ms`, `body_length`, `content_encoding`. Also removed `full_signature` and `content_length` from the log.

---

### CR-02: Telegram Route Module-Level `throw` Crashes Next.js Process

**Files modified:** `src/app/api/webhooks/telegram/route.ts`
**Commit:** `1dfd786`
**Applied fix:** Moved the `TELEGRAM_WEBHOOK_SECRET` check and `webhookCallback(...)` instantiation from module scope into the `POST` handler body. Missing secret now returns `503` instead of throwing during cold start. The check runs before the bot-token guard with the same 503 response pattern.

---

### CR-03: `stripe-payment-failure` Status `'failed'` Overwritten by `retell-agent-sync`

**Files modified:** `src/inngest/functions/retell-agent-sync.ts`, `src/inngest/functions/stripe-payment-failure.ts`
**Commit:** `4f50486`
**Applied fix (Option B):** In the `set-synced-status` step of `retell-agent-sync`, read `subscription_status` from the contractors row before writing `agent_sync_status = 'synced'`. If `subscription_status` is `'past_due'` or `'canceled'`, the update is skipped, preserving the deactivation marker set by `stripe-payment-failure`. No schema migration required.
**Note:** This fix requires human verification — the guard logic (checking `subscription_status` before writing `agent_sync_status`) is correct per the review specification but is a semantic condition that warrants manual confirmation of the subscription state transitions in production.

---

### CR-04: `handleProvision` Sets State to `undefined` on Missing `twilio_number`

**Files modified:** `src/app/(dashboard)/settings/phone/page.tsx`
**Commit:** `90568a0`
**Applied fix:** Moved `res.json()` before the `res.ok` branch so the response body is available for both success and error paths. On success, added a null-guard: if `json.twilio_number` is falsy, `setProvisionError` is called with a recovery message and the function returns early rather than calling `setTwilioNumber(undefined)`.

---

### WR-01: Telegram `/start` Does Not Verify Contractor Exists Before Upsert

**Files modified:** `src/app/api/webhooks/telegram/route.ts`
**Commit:** `1dfd786` (same commit as CR-02)
**Applied fix:** After UUID format validation in the `/start` command handler, added a pre-flight `select('id').eq('id', contractorId).maybeSingle()` query using the same service-role client. If no contractor is found, replies with the invalid-link message and returns. The upsert proceeds only when the contractor is confirmed to exist, using the same `db` instance.

---

### WR-02: `writeNotificationLog` Outside `try/catch` Creates Orphaned `pending` Rows

**Files modified:** `src/inngest/functions/retell-notify-dispatch.ts`
**Commit:** `1c60cd5`
**Applied fix:** Moved `writeNotificationLog()` inside the `try/catch` block for the SMS, WhatsApp, and Telegram dispatch steps. Introduced `let logId: string | null = null` before each try block; `updateNotificationLog` is skipped in the catch if `logId` is null (DB insert failed). Applied the same pattern to the WhatsApp fallback SMS path. No orphaned `pending` rows accumulate across retries.

---

### WR-03: 422 Status Conflates Two Distinct Errors in Phone Provisioning UI

**Files modified:** `src/app/(dashboard)/settings/phone/page.tsx`
**Commit:** `90568a0` (same commit as CR-04)
**Applied fix:** Replaced the hardcoded `'Area code unavailable. Try: 786, 954, or 561.'` string for 422 responses with `json.error ?? 'Area code unavailable. Try: 786, 954, or 561.'`. The API's descriptive error message is now surfaced directly to the user.

---

### WR-04: `'unknown'` Intent Silently Suppresses All Notifications

**Files modified:** `src/inngest/functions/retell-notify-dispatch.ts`
**Commit:** `1c60cd5` (same commit as WR-02)
**Applied fix:** Added `intent === 'unknown'` to the `computeChannels` early-return guard. When `'unknown'` intent is detected, emits a structured `console.warn` with `event` and (where available per the function context) identifiers before returning all-false channels.

---

### WR-05: `stripe-payment-failure` Selects `retell_llm_id` but Never Uses It

**Files modified:** `src/inngest/functions/stripe-payment-failure.ts`
**Commit:** `4f50486` (same commit as CR-03)
**Applied fix:** Removed `retell_llm_id` from the `load-contractor` step's select query. The select now reads only `id, phone_number, notification_settings(whatsapp_number)`, which are the fields actually used in the function.

---

### IN-02: Telegram Deep Link Banner Shown When `contractorId` is `null`

**Files modified:** `src/app/(dashboard)/dashboard/page.tsx`
**Commit:** `61805b1`
**Applied fix:** Changed the banner condition from `{!telegramLinked && (` to `{!telegramLinked && contractorId && (`. Users without a contractor record no longer see the Telegram banner with an empty deep-link payload.

---

### IN-03: `sendTelegram` Creates a New `Bot` Instance Per Call

**Files modified:** `src/lib/notifications/telegram.ts`
**Commit:** `8b3f06a`
**Applied fix:** Introduced a module-level `let _bot: Bot | null = null` and a `getBot()` lazy accessor that validates `TELEGRAM_BOT_TOKEN` and creates the singleton on first call. `sendTelegram` now delegates to `getBot().api.sendMessage(...)`. Updated the comment to reflect the new pattern.

---

## Skipped Issues

None — all 11 in-scope findings were fixed.

---

_Fixed: 2026-05-23_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

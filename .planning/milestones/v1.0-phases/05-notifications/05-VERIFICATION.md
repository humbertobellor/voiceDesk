---
phase: 05-notifications
verified: 2026-05-09T20:00:00Z
status: human_needed
score: 10/12 must-haves verified
overrides_applied: 0
human_verification:
  - test: "End-to-end notification dispatch — trigger a classified call and confirm SMS arrives within 60 seconds"
    expected: "SMS with caller phone, issue summary, and booking status arrives on contractor's configured sms_number within 60 seconds of call end"
    why_human: "Requires live Twilio credentials, a real call event flowing through Inngest, and a phone to receive the SMS. Automated tests mock the Twilio client."
  - test: "Telegram bot linking flow — click the deep link from the dashboard and send /start to @VoiceDeskBot"
    expected: "Telegram replies '✅ VoiceDesk connected. You will receive call alerts here.' and the dashboard banner disappears on next page load"
    why_human: "Requires a registered @VoiceDeskBot (TELEGRAM_BOT_TOKEN not yet provisioned), a deployed webhook URL, and a real Telegram client."
  - test: "Dashboard Telegram banner appears for unlinked contractor, is absent for linked contractor"
    expected: "Banner with 'Link Telegram for instant call alerts' and deep link shown when telegram_chat_id IS NULL; banner absent when linked"
    why_human: "Server Component rendering requires authenticated Supabase session and live DB data — not exercisable with unit tests."
gaps:
  - truth: "Caller name is included in SMS notification (NOTIF-01 requirement)"
    status: partial
    reason: "NOTIF-01 specifies 'caller name, phone number' in the notification. The dispatch function queries only caller_phone from the calls table — caller_name is never included in the SMS body. Decision D-07 in 05-CONTEXT.md explicitly defers caller name: 'calls.caller_name is never populated by Retell webhooks — name extraction is deferred.' This is a partial implementation of NOTIF-01."
    artifacts:
      - path: "src/inngest/functions/retell-notify-dispatch.ts"
        issue: "DB query: select('caller_phone, intent, summary') — caller_name absent. SMS body uses callerPhone only."
    missing:
      - "Either add caller_name to the DB query and SMS body format, OR document this deviation from NOTIF-01 as an accepted override with explicit tracing to a later phase or decision record"
  - truth: "Telegram webhook secret_token validation is active (T-05-04-01 security control)"
    status: failed
    reason: "The route comment claims 'grammY webhookCallback validates the secret_token header set during setWebhook registration.' However, grammY's webhookCallback signature is (bot, adapter, onTimeout, timeoutMilliseconds, secretToken) — the 5th parameter secretToken is not passed in the implementation: webhookCallback(bot, 'std/http') only. Without passing the secretToken, grammY does NOT validate the X-Telegram-Bot-Api-Secret-Token header. Unauthorized POST requests to /api/webhooks/telegram are not rejected at the application layer."
    artifacts:
      - path: "src/app/api/webhooks/telegram/route.ts"
        issue: "Line 61: webhookCallback(bot, 'std/http') — secretToken parameter absent. T-05-04-01 mitigation is incomplete."
    missing:
      - "Pass TELEGRAM_WEBHOOK_SECRET env var as 5th arg to webhookCallback: webhookCallback(bot, 'std/http', undefined, undefined, process.env.TELEGRAM_WEBHOOK_SECRET)"
      - "Add TELEGRAM_WEBHOOK_SECRET to .env.example with instructions to set it during setWebhook registration"
---

# Phase 5: Notifications Verification Report

**Phase Goal:** Contractors are alerted within 60 seconds of every call end via their preferred channels — SMS always fires, WhatsApp and Telegram fire when configured — so no lead or emergency is missed. Telegram bot linking flow included.
**Verified:** 2026-05-09T20:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | twilio and grammy packages are installed and importable | VERIFIED | node -e "require('twilio'); require('grammy')" exits 0 |
| 2 | .env.example documents all five new env vars with no NEXT_PUBLIC_ prefix | VERIFIED | Lines 39, 40, 46, 50, 56 in .env.example; grep for NEXT_PUBLIC_ + TWILIO/TELEGRAM returns nothing |
| 3 | sendSms sends SMS via Twilio using TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM_NUMBER | VERIFIED | sms.ts: real twilio(accountSid, authToken).messages.create(); 4/4 unit tests GREEN |
| 4 | sendWhatsApp sends WhatsApp template via Twilio using TWILIO_WHATSAPP_FROM and Content SID constants | VERIFIED | whatsapp.ts: WHATSAPP_CONTENT_SIDS exported; contentSid + contentVariables passed; 4/4 tests GREEN |
| 5 | sendTelegram sends message via grammY Bot to given chat_id using TELEGRAM_BOT_TOKEN | VERIFIED | telegram.ts: new Bot(token).api.sendMessage(chatId, message); 2/2 tests GREEN |
| 6 | writeNotificationLog inserts pending row before send; updateNotificationLog updates after | VERIFIED | log.ts: inserts status='pending', returns UUID; update is non-fatal; 4/4 tests GREEN |
| 7 | retell-call-classify.ts fires retell/call.notify event after trigger-agent-sync | VERIFIED | Line 306 in retell-call-classify.ts: step.sendEvent('trigger-notify', { name: 'retell/call.notify', data: { callId, contractorId } }) |
| 8 | retell-notify-dispatch registered in /api/inngest/route.ts with retries:5 and onFailure | VERIFIED | inngest/route.ts: retellNotifyDispatch imported and in functions array; dispatch function has retries: 5, idempotency: 'event.data.callId', onFailure handler |
| 9 | Promise.allSettled used; WhatsApp failure triggers SMS fallback (D-08, D-09) | VERIFIED | Lines 232, 171-195 in retell-notify-dispatch.ts; 6/6 dispatch logic tests GREEN |
| 10 | Emergency SMS/Telegram body contains 'EMERGENCY' prominently (EMRG-03) | VERIFIED | Lines 100, 105: "EMERGENCY: New call from..." and "⚠️ EMERGENCY: New call from..." |
| 11 | Caller name included in SMS notification (NOTIF-01) | PARTIAL | DB query selects caller_phone but NOT caller_name. D-07 defers name extraction — body contains phone only. NOTIF-01 specifies "caller name, phone number." |
| 12 | Telegram webhook validates secret_token header (T-05-04-01) | FAILED | webhookCallback(bot, 'std/http') called without secretToken 5th parameter — grammY secret_token validation not active |

**Score:** 10/12 truths verified (11 VERIFIED + 1 PARTIAL + 1 FAILED)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/notifications/sms.ts` | Real Twilio SMS implementation | VERIFIED | Uses twilio(sid,token).messages.create(); import 'server-only'; exports sendSms, SendSmsParams, SendSmsResult |
| `src/lib/notifications/whatsapp.ts` | Real Twilio WhatsApp template implementation | VERIFIED | Exports WHATSAPP_CONTENT_SIDS const + sendWhatsApp; contentSid + contentVariables; import 'server-only' |
| `src/lib/notifications/telegram.ts` | Real grammY Telegram implementation | VERIFIED | new Bot(token).api.sendMessage(); import 'server-only'; exports sendTelegram |
| `src/lib/notifications/log.ts` | notification_log DB write helpers | VERIFIED | writeNotificationLog (insert + select id) + updateNotificationLog (non-fatal update); import 'server-only' |
| `src/inngest/functions/retell-notify-dispatch.ts` | retellNotifyDispatch Inngest function | VERIFIED | retries:5, idempotency, onFailure, D-03 filter, D-05/D-06 matrix, D-08 allSettled, D-09 fallback, D-12 logging |
| `src/inngest/functions/retell-call-classify.ts` | Step 9: fires retell/call.notify event | VERIFIED | Lines 302-310: step.sendEvent('trigger-notify', { name: 'retell/call.notify', data: { callId, contractorId } }) |
| `src/app/api/webhooks/telegram/route.ts` | Telegram bot webhook handler | VERIFIED (security gap) | Exports POST; grammY webhookCallback; upserts telegram_chat_id; replies "VoiceDesk connected". Secret_token validation not wired (see gap). |
| `src/app/(dashboard)/dashboard/page.tsx` | Telegram setup banner | VERIFIED | Shows banner when !telegramLinked; hides when linked; deep link uses contractorId (not user.id); role="status" |
| `src/app/api/inngest/route.ts` | Registered retellNotifyDispatch | VERIFIED | Line 11: import; line 19: registered in functions array alongside 3 existing functions |
| `tests/notifications/sms.test.ts` | SMS tests GREEN | VERIFIED | 4/4 tests passing |
| `tests/notifications/whatsapp.test.ts` | WhatsApp tests GREEN | VERIFIED | 4/4 tests passing |
| `tests/notifications/telegram.test.ts` | Telegram lib tests GREEN | VERIFIED | 2/2 tests passing |
| `tests/notifications/log.test.ts` | Log tests GREEN | VERIFIED | 4/4 tests passing |
| `tests/notifications/notify-dispatch.test.ts` | Dispatch logic tests GREEN | VERIFIED | 6/6 tests passing |

**Total test count: 20/20 GREEN**

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `retell-call-classify.ts` | `retell/call.notify event` | `step.sendEvent('trigger-notify', ...)` | WIRED | Line 306 confirmed |
| `retell-notify-dispatch.ts` | `sms.ts + whatsapp.ts + telegram.ts` | `Promise.allSettled([sendSms, sendWhatsApp, sendTelegram])` | WIRED | Lines 108-244 confirmed |
| `retell-notify-dispatch.ts` | `notification_log table` | `writeNotificationLog + updateNotificationLog` | WIRED | 12 call sites in the dispatch step |
| `src/app/api/webhooks/telegram/route.ts` | `notification_settings.telegram_chat_id` | `createServiceRoleClient().from('notification_settings').upsert({telegram_chat_id})` | WIRED | Lines 37-47 confirmed |
| `dashboard/page.tsx` | `notification_settings query` | `createSupabaseServer().from('notification_settings').select('telegram_chat_id')` | WIRED | Lines 37-41 confirmed |
| `src/app/api/inngest/route.ts` | `retellNotifyDispatch` | `import + functions array` | WIRED | Lines 11 and 19 confirmed |
| `src/app/api/webhooks/telegram/route.ts` | `TELEGRAM_WEBHOOK_SECRET` | `webhookCallback(bot, 'std/http', undefined, undefined, secretToken)` | NOT_WIRED | 5th arg never passed; secret_token validation inactive |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `retell-notify-dispatch.ts` | `call, lead, settings` | `createServiceRoleClient()` DB queries in step.run('load-notification-data') | Yes — DB queries for calls, leads, notification_settings | FLOWING |
| `dashboard/page.tsx` | `telegramLinked, contractorId` | `createSupabaseServer()` queries: contractors → notification_settings | Yes — reads from DB via user session | FLOWING |
| `sms.ts` | `{ sid, status }` | `twilio(sid, token).messages.create()` | Yes — live Twilio API call | FLOWING (requires env vars) |
| `telegram.ts` | `{ messageId }` | `bot.api.sendMessage(chatId, message)` | Yes — live Telegram Bot API call | FLOWING (requires env var) |
| `log.ts` | row UUID | `supabase.from('notification_log').insert().select('id').single()` | Yes — real DB insert | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 20 notification tests pass | `npx vitest run tests/notifications/` | 20/20 tests passed, 5 files | PASS |
| twilio and grammy importable | `node -e "require('twilio'); require('grammy')"` | "OK" | PASS |
| TypeScript compiles clean | `npx tsc --noEmit` | No errors | PASS |
| retellNotifyDispatch registered in Inngest route | `grep -c "retellNotifyDispatch" inngest/route.ts` | 2 (import + array) | PASS |
| EMERGENCY in dispatch SMS body | `grep "EMERGENCY:" retell-notify-dispatch.ts` | Line 100: "EMERGENCY: New call from..." | PASS |
| retell/call.notify event fired from classify | `grep "retell/call.notify" retell-call-classify.ts` | Lines 302, 307 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|------------|------------|-------------|--------|----------|
| NOTIF-01 | 05-01, 05-02, 05-03 | SMS within 60s of every call, including caller name, phone, issue, booking status | PARTIAL | SMS fires for lead/emergency/info via Inngest (within 60s window by design D-10). Body includes caller_phone, issue, booking status but NOT caller_name — D-07 explicitly defers name. NOTIF-01 requirement says "caller name, phone number." |
| NOTIF-02 | 05-01, 05-02, 05-03 | WhatsApp for every new lead and emergency via pre-approved templates; SMS fallback if WhatsApp fails | SATISFIED (pending WABA) | sendWhatsApp uses WHATSAPP_CONTENT_SIDS; D-09 WhatsApp→SMS fallback implemented in dispatch. WHATSAPP_CONTENT_SIDS contains HXplaceholder values requiring WABA approval — a deployment-time dependency, not a code gap. |
| NOTIF-03 | 05-01, 05-02, 05-03, 05-04 | Telegram notification for every lead/emergency; contractor links via bot start link | SATISFIED (pending bot registration) | sendTelegram implemented; Telegram webhook handler at /api/webhooks/telegram processes /start; dashboard banner with deep link; telegram_chat_id persisted via upsert. Requires @BotFather registration (operational, not code). |
| EMRG-03 | 05-01, 05-02, 05-03 | Emergency via all configured channels within 30s; EMERGENCY prominently in message; callback number | SATISFIED | dispatch function fires all channels via Promise.allSettled; isEmergency path produces "EMERGENCY: New call from [phone]..." body; D-10: emergency classification completes in step 1 of classify, making total latency well under 30s via standard Inngest dispatch (no separate fast-path needed). |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/notifications/whatsapp.ts` | 25-27 | `WHATSAPP_CONTENT_SIDS` has `HXplaceholder_new_lead` and `HXplaceholder_emergency` values | Warning | WhatsApp sends will fail at runtime with invalid Content SIDs until WABA templates are approved and SIDs replaced. This is an intentional deployment-time dependency (D-16), not a code defect. Not a blocker of the implementation architecture. |
| `src/app/api/webhooks/telegram/route.ts` | 61 | `webhookCallback(bot, 'std/http')` without secretToken | Blocker | T-05-04-01 security control (secret_token validation) is documented in the threat model but not wired. Any POST to /api/webhooks/telegram is processed without authentication. |

### Human Verification Required

#### 1. End-to-End SMS Dispatch

**Test:** Provision a contractor with `sms_number` in notification_settings, trigger a call classified as `lead` via the Retell webhook, wait for Inngest to process the `retell/call.notify` event.
**Expected:** SMS arrives on the contractor's phone within 60 seconds containing caller phone, issue summary, and booking status.
**Why human:** Requires live Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER), a real Inngest execution environment, and a physical phone to receive the message.

#### 2. Telegram Bot Linking Flow

**Test:** After registering @VoiceDeskBot with @BotFather and setting TELEGRAM_BOT_TOKEN + setWebhook, navigate to the dashboard as an unlinked contractor, click "Connect @VoiceDeskBot", send `/start <contractorId>` in Telegram.
**Expected:** Telegram replies "✅ VoiceDesk connected. You will receive call alerts here." and the dashboard banner is absent on next page load.
**Why human:** Requires a registered Telegram bot (operational pre-ship step), a deployed webhook URL, and a real Telegram client.

#### 3. Dashboard Telegram Banner Conditional Rendering

**Test:** Log in as a contractor without `telegram_chat_id` — verify banner is visible. Log in after completing the /start flow — verify banner is absent.
**Expected:** Banner shows when unlinked; hides when linked (D-21).
**Why human:** Server Component rendering requires authenticated Supabase session and live database state — not exercisable without a deployed app and real user sessions.

### Gaps Summary

**Gap 1: NOTIF-01 — Caller name absent from SMS body**
NOTIF-01 explicitly requires "caller name" in the notification. The dispatch function's DB query selects `caller_phone, intent, summary` from the calls table — `caller_name` is not queried. Decision D-07 in 05-CONTEXT.md acknowledges this: "calls.caller_name is never populated by Retell webhooks — name extraction is deferred." The SMS body contains the caller phone number but not the caller name. This is a partial satisfaction of NOTIF-01 — the requirement is partially met (phone, issue, booking status are present) but not fully met (name is missing).

**Gap 2: Telegram webhook secret_token validation not wired**
The Telegram webhook route comments claim grammY validates the `secret_token` header set during `setWebhook` registration (T-05-04-01 STRIDE mitigation). However, grammY's `webhookCallback` signature is `(bot, adapter, onTimeout, timeoutMilliseconds, secretToken)` — the 5th parameter is required to enable token validation. The current call `webhookCallback(bot, 'std/http')` omits it. Without this, the `/api/webhooks/telegram` endpoint accepts any POST request without authentication. An attacker who discovers the endpoint URL could send arbitrary bot updates.

**Fix required:** `webhookCallback(bot, 'std/http', undefined, undefined, process.env.TELEGRAM_WEBHOOK_SECRET ?? '')` where `TELEGRAM_WEBHOOK_SECRET` is a random secret set both in the environment and via the `setWebhook` API call's `secret_token` parameter.

---

_Verified: 2026-05-09T20:00:00Z_
_Verifier: Claude (gsd-verifier)_

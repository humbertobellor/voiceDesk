---
status: partial
phase: 05-notifications
source: [05-VERIFICATION.md]
started: 2026-05-09T20:00:00Z
updated: 2026-05-09T20:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. End-to-end SMS dispatch
expected: After a classified call with intent=lead or intent=emergency, an SMS arrives on the contractor's configured sms_number within 60 seconds of call end. SMS body format: "New call from [phone] — [service]. [booking status]." Emergency SMS body includes "EMERGENCY" prominently.
result: [pending]

### 2. Telegram bot linking flow
expected: Clicking the dashboard deep link (t.me/VoiceDeskBot?start=<contractor_id>) and sending /start in Telegram causes the bot to reply "✅ VoiceDesk connected. You will receive call alerts here." and the dashboard banner disappears on next page load.
result: [pending]
prerequisites:
  - @VoiceDeskBot registered via @BotFather (TELEGRAM_BOT_TOKEN set)
  - Webhook URL registered: POST https://api.telegram.org/bot<TOKEN>/setWebhook with url=<APP_URL>/api/webhooks/telegram and secret_token=TELEGRAM_WEBHOOK_SECRET value
  - App deployed to Vercel (webhook endpoint must be publicly reachable)

### 3. Dashboard Telegram banner conditional rendering
expected: Banner "Link Telegram for instant call alerts" with deep link shown when notification_settings.telegram_chat_id IS NULL; banner absent when IS NOT NULL (D-21)
result: [pending]

## Known Accepted Deviation

**NOTIF-01 caller name** — NOTIF-01 specifies "caller name, phone number" in the notification. Decision D-07 (05-CONTEXT.md) explicitly defers caller name: "calls.caller_name is never populated by Retell webhooks — name extraction is deferred." The dispatch function sends phone number, issue, and booking status (3 of 4 NOTIF-01 fields). This is an accepted partial implementation until a later phase addresses caller name extraction.

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

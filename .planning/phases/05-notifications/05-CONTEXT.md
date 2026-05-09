# Phase 5: Notifications - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 delivers multi-channel notification dispatch — SMS always fires (for lead/emergency/info), WhatsApp and Telegram fire when configured (for lead/emergency, plus info if opted in) — within 60 seconds of every call end, so contractors never miss a booked job or emergency.

A Telegram bot linking flow (dashboard banner → deep link → bot webhook) is included. WhatsApp uses pre-approved WABA templates. A `notification_log` row is written per send attempt.

Out of scope: portal UI to manage notification settings (Phase 6), payment-failed WhatsApp template (Phase 7), per-contractor WABA registration.

</domain>

<decisions>
## Implementation Decisions

### Notification Trigger Architecture
- **D-01:** Separate Inngest function `retell-notify-dispatch` triggered by a new `retell/call.notify` event. Classification (`retell-call-classify`) fires this event at the end of its pipeline via `step.sendEvent`. Independent retry logic — notify failures do not re-run classification.
- **D-02:** `retell/call.notify` payload is minimal: `{ callId, contractorId }` only. The notify function loads all required data (call row, leads row, notification_settings) from the DB. No stale-data risk, no payload coupling between functions.
- **D-03:** `retell/call.notify` fires after every classification, including `no_action`. Filtering by intent happens inside `retell-notify-dispatch`, not in the classify job.
- **D-04:** Idempotency key on `retell/call.notify`: `retell-notify-${callId}` — same pattern as the existing classify job.

### Notification Scope (Dispatch Matrix)
- **D-05:** SMS fires for `lead`, `emergency`, and `info` intents. Skipped for `no_action` (hang-ups, wrong numbers, spam).
- **D-06:** WhatsApp and Telegram fire for `lead` and `emergency`. They also fire for `info` only when `notification_settings.notify_on_general_inquiry = true` (default false).
- **D-07:** SMS uses `caller_phone` as the caller identifier. `calls.caller_name` is never populated by Retell webhooks — name extraction is deferred. No LLM call added to Phase 5.
- **D-08:** `Promise.allSettled` for multi-channel sends — one channel failure must not block others (locked from ROADMAP.md).
- **D-09:** WhatsApp delivery failure triggers SMS fallback within the same Inngest function invocation, within the 60-second window.
- **D-10:** No separate emergency fast-path. Emergency classification (hard keyword check) completes in step 1 of classify, making total latency well under 30 seconds via standard Inngest dispatch.

### Notification Log
- **D-11:** Each send attempt = new `notification_log` row. Failed rows stay as `status='failed'`. Inngest's built-in retry mechanism handles re-sends. Full history visible in portal.
- **D-12:** `notification_log` row is written before the actual send (status='pending'), updated to 'sent'/'failed' after the API call resolves. Avoids missing log entries if the process crashes mid-send.

### WhatsApp Templates
- **D-13:** Two templates required for Phase 5: `voicedesk_new_lead` and `voicedesk_emergency`. Payment-failed template is Phase 7.
- **D-14:** `voicedesk_new_lead` variables: `{{1}}` = caller_phone, `{{2}}` = service_requested (from leads.service_requested), `{{3}}` = booking status string ("Appointment booked for [time]" or "No appointment booked").
- **D-15:** `voicedesk_emergency` body: "⚠️ EMERGENCY: {{1}} called about {{2}}. Call back immediately." Variables: `{{1}}` = caller_phone, `{{2}}` = service_requested/issue.
- **D-16:** WhatsApp Content SIDs stored as TypeScript constants (not env vars) for v1. Can be promoted to env vars in Phase 7.
- **D-17:** `TWILIO_WHATSAPP_FROM` env var holds the shared WABA-approved sender number (e.g., `whatsapp:+1XXXXXXXXXX`). Single platform number, all contractors share it.

### Telegram Bot
- **D-18:** Single `@VoiceDeskBot` for the entire platform. One `TELEGRAM_BOT_TOKEN` env var (server-side only). Register webhook via Telegram setWebhook API on deploy.
- **D-19:** Contractor linking flow: Dashboard shows a setup banner with deep link `https://t.me/VoiceDeskBot?start=<contractor_uuid>`. Contractor clicks → opens Telegram → starts bot → Telegram POSTs to `/api/webhooks/telegram` with `message.text = "/start <contractor_uuid>"`. Bot upserts `telegram_chat_id` into `notification_settings` and replies "✅ VoiceDesk connected. You'll receive call alerts here."
- **D-20:** Re-linking always overwrites `telegram_chat_id` (upsert). Contractor can re-link from a new device freely.
- **D-21:** Dashboard banner auto-dismisses when `notification_settings.telegram_chat_id` is populated — mirrors Phase 4 calendar connect banner pattern exactly.
- **D-22:** Telegram webhook endpoint: `POST /api/webhooks/telegram`. Uses grammY webhooks (not polling — serverless incompatible).
- **D-23:** `TELEGRAM_BOT_TOKEN` must be registered with @BotFather as `@VoiceDeskBot` before Phase 5 ships. Planner should surface this as a pre-ship action item.

### Claude's Discretion
- SMS message copy: format is "New call from [phone] — [issue summary]. [Booking status]." Claude may adjust wording for clarity.
- Telegram notification message format: plain text (no template approval needed for Telegram). Claude decides exact wording matching the SMS content structure.
- Inngest retry count for `retell-notify-dispatch`: follow existing `retries: 5` pattern from `retell-call-classify`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema (notification tables already exist)
- `supabase/migrations/20260504000001_initial_schema.sql` — `notification_log` (lines 197–213) and `notification_settings` (lines 218–231) table definitions
- `supabase/migrations/20260508000007_webhook_core.sql` — `notify_on_general_inquiry` column added to `notification_settings`
- `src/types/database.ts` — `NotificationChannel` type, `NotificationSettings` interface

### Existing Inngest patterns (copy these)
- `src/inngest/functions/retell-call-classify.ts` — step.run, step.sendEvent, onFailure, retries:5 pattern to follow exactly
- `src/inngest/client.ts` — Inngest client instantiation

### Existing webhook pattern
- `src/app/api/webhooks/retell/route.ts` — webhook signature verification + after() + 200-immediately pattern. Telegram webhook should follow same structure minus Retell signature (use grammY's validateToken instead).

### Phase 4 dashboard banner (reuse pattern)
- `src/app/(dashboard)/dashboard/page.tsx` — Calendar connect banner implementation to mirror for Telegram banner

### Requirements
- `NOTIF-01`, `NOTIF-02`, `NOTIF-03`, `EMRG-03` in `.planning/REQUIREMENTS.md`

### Stack reference
- `.planning/PROJECT.md` — confirms Twilio SDK v5, grammY, Inngest in stack

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/supabase/service.ts` — `createServiceRoleClient()` — used by all Inngest functions, use same pattern
- `src/inngest/client.ts` — Inngest client, import directly
- `src/inngest/functions/retell-call-classify.ts` — `step.sendEvent` at line ~295 is the exact hook point to add `retell/call.notify` dispatch
- Phase 4 calendar connect banner component in `src/app/(dashboard)/dashboard/page.tsx` — reuse structure for Telegram banner

### Established Patterns
- All Inngest functions: `retries: 5`, `onFailure` handler sets `analysis_failed` equivalent status, `step.run()` for each logical unit
- `Promise.allSettled` is locked (ROADMAP.md note) — must be used for multi-channel dispatch
- Service role client for all DB writes in background jobs
- `after()` from `next/server` for webhook deferred processing — but Telegram webhook is synchronous (grammY handles it differently, no after() needed)

### Integration Points
- `retell-call-classify.ts` step 8b (`trigger-agent-sync`) — add `step.sendEvent('trigger-notify', { name: 'retell/call.notify', data: { callId, contractorId } })` after this step
- New Inngest function `retell-notify-dispatch.ts` needs to be registered in `src/app/api/inngest/route.ts`
- New route: `src/app/api/webhooks/telegram/route.ts` — grammY webhook handler
- Dashboard: `src/app/(dashboard)/dashboard/page.tsx` — add Telegram setup banner alongside calendar banner

</code_context>

<specifics>
## Specific Ideas

- Bot username confirmed: `@VoiceDeskBot` → deep link `https://t.me/VoiceDeskBot?start=<contractor_uuid>`
- Telegram confirmation message exact text: "✅ VoiceDesk connected. You'll receive call alerts here."
- Dashboard banner dismissal condition: `notification_settings.telegram_chat_id IS NOT NULL`
- Emergency SMS must include the word "EMERGENCY" prominently (EMRG-03 requirement)
- WhatsApp fallback trigger: if WhatsApp send throws or returns error status, immediately attempt SMS fallback to the same `sms_number` — within same Inngest step invocation

</specifics>

<deferred>
## Deferred Ideas

- **Caller name in SMS** — `calls.caller_name` is never populated. Could add LLM name extraction in classify job. Deferred — Phase 5 uses `caller_phone` only.
- **Payment-failed WhatsApp template** — Needed for Phase 7 billing. Register with WABA alongside Phase 5 templates to save approval time (action item, not code).
- **Notification settings UI** — Contractor-facing toggle for channels, number management. Phase 6 portal.
- **Per-contractor WABA** — Not needed for v1; single platform number serves all contractors.
- **WhatsApp Content SIDs as env vars** — Practical for multi-environment deploys. Promote in Phase 7.

None — discussion stayed within phase scope otherwise.

</deferred>

---

*Phase: 5-Notifications*
*Context gathered: 2026-05-09*

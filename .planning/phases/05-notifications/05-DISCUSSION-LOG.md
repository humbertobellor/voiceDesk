# Phase 5: Notifications - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 5-Notifications
**Areas discussed:** Notification trigger, Telegram bot setup, WhatsApp templates, Notification scope

---

## Notification Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Separate Inngest function | Classify fires `retell/call.notify` → new `retell-notify-dispatch` function. Independent retry logic. | ✓ |
| Steps inside classify | Add notify steps at end of `retell-call-classify`. Classify failures retry the entire job. | |

**User's choice:** Separate Inngest function

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal payload (`callId + contractorId`) | Notify function reads all data from DB. No stale-data risk. | ✓ |
| Rich payload (intent, lead data, caller details) | Saves one DB query but couples the two functions. | |

**User's choice:** Minimal payload

| Option | Description | Selected |
|--------|-------------|----------|
| Fire always, let notify function filter | `retell/call.notify` fires after every classification including `no_action`. | ✓ |
| Only fire for lead/emergency/info | Classify checks intent before `step.sendEvent`. Logic split between two functions. | |

**User's choice:** Fire always, let notify function filter

---

## Telegram Bot Setup

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard setup banner | Same pattern as Phase 4 calendar banner. Consistent UX. | ✓ |
| Onboarding wizard only | Deferred to Phase 7 — no Telegram until billing phase. | |
| Notification settings page | Requires Phase 6 Portal UI to exist first. | |

**User's choice:** Dashboard setup banner

| Option | Description | Selected |
|--------|-------------|----------|
| Overwrite on re-link | `/start` always upserts `telegram_chat_id`. Contractor can re-link freely. | ✓ |
| Reject if already linked | Reply "Already linked." — requires support to change. | |

**User's choice:** Overwrite (upsert)

| Option | Description | Selected |
|--------|-------------|----------|
| @VoiceDeskBot | Matches product name. Register with @BotFather. | ✓ |
| You decide | Let planner note it as a TODO. | |

**User's choice:** @VoiceDeskBot

| Option | Description | Selected |
|--------|-------------|----------|
| Single `TELEGRAM_BOT_TOKEN` env var | One bot, shared across all contractors. Webhook-based. | ✓ |
| Per-contractor bot tokens | Each contractor creates their own bot. Too complex for v1. | |

**User's choice:** Single `TELEGRAM_BOT_TOKEN`

| Option | Description | Selected |
|--------|-------------|----------|
| Send confirmation message | Bot replies "✅ VoiceDesk connected. You'll receive call alerts here." | ✓ |
| Silent | Bot saves chat_id but sends no reply. | |

**User's choice:** Send confirmation message

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-dismiss when telegram_chat_id set | Same as Phase 4 calendar banner behavior. | ✓ |
| Keep visible with disconnect option | Adds UI state to manage. | |

**User's choice:** Auto-dismiss

---

## WhatsApp Templates

| Option | Description | Selected |
|--------|-------------|----------|
| Two templates (new_lead + emergency) | Separate templates, cleaner WABA approval. | ✓ |
| One template with urgency variable | Fewer templates but emergency prominence may fail WABA review. | |

**User's choice:** Two templates

| Option | Description | Selected |
|--------|-------------|----------|
| Caller phone + issue + booking status | Three variables. Matches SMS success criteria. | ✓ |
| Caller phone + issue only | Simpler but drops booking status. | |

**User's choice:** Caller phone + issue + booking status for `voicedesk_new_lead`

| Option | Description | Selected |
|--------|-------------|----------|
| ⚠️ EMERGENCY header + caller phone + issue | Prominent, meets EMRG-03. Two variables. | ✓ |
| Same variables as new_lead with EMERGENCY prefix | Booking status meaningless on emergencies. | |

**User's choice:** ⚠️ EMERGENCY header for `voicedesk_emergency`

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded TypeScript constants | Simpler for v1. Requires deploy to update Content SIDs. | ✓ |
| Env vars (TWILIO_WA_NEW_LEAD_SID etc.) | Easier to update after re-approval without code changes. | |

**User's choice:** Hardcoded constants (promote to env vars in Phase 7 if needed)

| Option | Description | Selected |
|--------|-------------|----------|
| `TWILIO_WHATSAPP_FROM` env var | Shared WABA number for all contractors. | ✓ |
| Per-contractor WhatsApp number | Each contractor registers own WABA — not realistic for v1. | |

**User's choice:** `TWILIO_WHATSAPP_FROM` env var

---

## Notification Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Caller phone only in SMS | No LLM cost. `caller_name` never populated by Retell. | ✓ |
| Extract name from transcript via LLM | Richer SMS but adds latency/cost. | |

**User's choice:** Caller phone only

| Option | Description | Selected |
|--------|-------------|----------|
| Skip SMS for no_action | No_action = spam/wrong number. Don't flood contractor. | ✓ |
| SMS for every call including no_action | Matches literal "every call" in success criteria. | |

**User's choice:** Skip SMS for no_action

| Option | Description | Selected |
|--------|-------------|----------|
| SMS: lead+emergency+info | WhatsApp+Telegram: lead+emergency (+ info if notify_on_general_inquiry). | ✓ |
| All channels same: lead+emergency only | Ignores notify_on_general_inquiry column. | |

**User's choice:** Differentiated dispatch matrix

| Option | Description | Selected |
|--------|-------------|----------|
| No special emergency handling | Standard Inngest dispatch, classification is fast enough. | ✓ |
| Separate high-priority Inngest queue | More complex, Inngest doesn't natively support priority queues. | |

**User's choice:** No special handling

| Option | Description | Selected |
|--------|-------------|----------|
| Each send attempt = new notification_log row | Full history. Inngest handles retries. | ✓ |
| Update existing row on retry | Cleaner table but no attempt history. | |

**User's choice:** New row per attempt

---

## Claude's Discretion

- SMS message copy format
- Telegram notification message format (no template approval needed)
- Inngest retry count for `retell-notify-dispatch` (follow existing `retries: 5` pattern)

## Deferred Ideas

- Caller name in SMS (LLM extraction deferred)
- Payment-failed WhatsApp template (Phase 7)
- Notification settings UI (Phase 6)
- Per-contractor WABA (not needed for v1)
- WhatsApp Content SIDs as env vars (Phase 7)

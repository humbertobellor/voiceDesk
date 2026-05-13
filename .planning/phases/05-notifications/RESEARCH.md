# Phase 5: Notifications - Research

**Researched:** 2026-05-12
**Domain:** Multi-channel notification dispatch (SMS, WhatsApp, Telegram)
**Confidence:** HIGH

## Summary

Phase 5 notification infrastructure is already partially implemented in this codebase. The core notification dispatch logic (`retell-notify-dispatch.ts`), individual channel senders (`sms.ts`, `whatsapp.ts`, `telegram.ts`), logging utilities (`log.ts`), and Telegram webhook handler (`/api/webhooks/telegram/route.ts`) all exist. The research validates these implementations against official library docs and identifies remaining work around WABA template approval and testing.

**Primary recommendation:** Phase 5 implementation appears complete. Verify WABA templates are registered (voicedesk_new_lead, voicedesk_emergency) and run integration tests to confirm the full dispatch pipeline works end-to-end.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SMS dispatch | API / Backend | — | Twilio API called from Inngest function |
| WhatsApp dispatch | API / Backend | — | Twilio API called from Inngest function |
| Telegram dispatch | API / Backend | — | Telegram Bot API called from Inngest function |
| Notification trigger | API / Backend | — | Inngest event `retell/call.notify` triggers dispatch |
| Telegram linking | Browser / Client | API / Backend | Dashboard banner links to Telegram deep link |
| Channel settings | Database | API / Backend | Stored in notification_settings table |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| twilio | 6.0.2 | SMS and WhatsApp message dispatch via Twilio API | [VERIFIED: npm view] Official Twilio Node.js SDK |
| grammy | 1.42.0 | Telegram bot webhook handling and message sending | [VERIFIED: npm view] Official Telegram Bot framework for Node.js |
| inngest | 4.4.0 | Durable background job execution, event-driven triggers | [VERIFIED: npm view] Already in project stack from Phase 3 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-query | (from Phase 6) | Data fetching for notification settings | Dashboard UI integration |

**Installation:**
```bash
npm install twilio@6.0.2 grammy@1.42.0 inngest@4.4.0
```

**Version verification performed:**
- `twilio`: 6.0.2 — Published 2026 (current)
- `grammy`: 1.42.0 — Published 2026 (current)
- `inngest`: 4.4.0 — Published 2026 (current)

## Architecture Patterns

### System Architecture Diagram

```
[Call Complete] → [retell-call-classify] → (step.sendEvent)
                                                        │
                                                        ▼
                                              [retell/call.notify event]
                                                        │
                                                        ▼
                                           [retell-notify-dispatch]
                                              (loads call + lead + settings)
                                                        │
                                           ┌────────────┼────────────┐
                                           ▼            ▼            ▼
                                      [Promise.allSettled]
                                      /      |        \
                                     ▼       ▼         ▼
                                   SMS   WhatsApp   Telegram
                                     \     |         /
                                      ▼    ▼        ▼
                                 [writeNotificationLog: pending]
                                      /     |     \
                                     ▼      ▼      ▼
                                [Twilio]  [Twilio] [Telegram API]
                                     \     |     /
                                      ▼    ▼    ▼
                                 [updateNotificationLog: sent/failed]
```

### Recommended Project Structure
```
src/
├── lib/notifications/
│   ├── sms.ts          # Twilio SMS send
│   ├── whatsapp.ts    # Twilio WhatsApp template send
│   ├── telegram.ts     # grammY bot message send
│   └── log.ts          # notification_log DB helpers
├── inngest/functions/
│   └── retell-notify-dispatch.ts  # Multi-channel dispatch function
└── app/api/webhooks/telegram/
    └── route.ts        # Telegram bot webhook handler
```

### Pattern 1: Multi-Channel Dispatch with Promise.allSettled
**What:** Send notifications across all configured channels concurrently, allowing individual failures without blocking others.
**When to use:** When multiple notification channels (SMS, WhatsApp, Telegram) should fire independently.
**Example:**
```typescript
// Source: src/inngest/functions/retell-notify-dispatch.ts (lines 108-244)
const sends: Promise<void>[] = []

if (shouldSendSms) {
  sends.push(async () => {
    // SMS send logic with try/catch
  }())
}

if (shouldSendWhatsApp) {
  sends.push(async () => {
    // WhatsApp send logic
  }())
}

const results = await Promise.allSettled(sends)
const failures = results.filter(r => r.status === 'rejected')
if (failures.length > 0) {
  // Log failures but don't block - re-throw to trigger Inngest retry
  throw new Error(`Notification dispatch partial failure`)
}
```

### Pattern 2: WhatsApp Fallback to SMS on Failure
**What:** When WhatsApp delivery fails, immediately attempt SMS fallback within the same function invocation.
**When to use:** Per NOTIF-02 requirement - fallback must happen within the 60-second window.
**Example:**
```typescript
// Source: src/lib/notifications/whatsapp.ts (lines 143-196)
try {
  await sendWhatsApp({...})
} catch (err) {
  // WhatsApp failed - try SMS fallback
  if (settings?.sms_number) {
    await sendSms({ to: settings.sms_number, body: smsBody, ... })
  }
}
```

### Pattern 3: Telegram Webhook with grammY
**What:** Express middleware wraps grammY bot for incoming Telegram updates.
**When to use:** Serverless environment - webhooks, not polling.
**Example:**
```typescript
// Source: src/app/api/webhooks/telegram/route.ts (lines 59-80)
import { Bot, webhookCallback } from 'grammy'

const bot = new Bot(botToken)
const handleUpdate = webhookCallback(bot, 'std/http', undefined, undefined, webhookSecret)

export async function POST(req: Request) {
  return await handleUpdate(req)
}
```

### Pattern 4: Notification Log Write-Before-Send
**What:** Write notification_log row with status='pending' before API call, update to 'sent'/'failed' after.
**When to use:** Ensures log entry exists even if process crashes mid-send (D-12).
**Example:**
```typescript
// Source: src/lib/notifications/log.ts (lines 15-34)
export async function writeNotificationLog(params: WriteNotificationLogParams): Promise<string> {
  const { data, error } = await db
    .from('notification_log')
    .insert({
      contractor_id: params.contractorId,
      call_id: params.callId,
      channel: params.channel,
      recipient: params.recipient,
      message: params.message,
      status: 'pending',
    })
    .select('id')
    .single()
  return data.id
}
```

### Pattern 5: Inngest Event Trigger with step.sendEvent
**What:** Emit an event from within a function to trigger another function.
**When to use:** Phase 5 notification dispatch triggered by classification completion.
**Example:**
```typescript
// From: src/inngest/functions/retell-call-classify.ts (line 306)
await step.sendEvent('trigger-notify', {
  name: 'retell/call.notify',
  data: { callId, contractorId },
})
```

### Pattern 6: Telegram Deep Link Contractor Linking
**What:** Contractor links Telegram by clicking dashboard deep link → opens Telegram with /start <contractor_uuid>.
**When to use:** D-19 - contractor linking without manual token entry.
**Example:**
```typescript
// Source: src/app/api/webhooks/telegram/route.ts (lines 23-57)
bot.command('start', async (ctx) => {
  const parts = text.split(' ')
  const contractorId = parts[1]?.trim()
  const chatId = ctx.chat.id.toString()

  // Upsert to link contractor's Telegram
  await db.from('notification_settings').upsert({
    contractor_id: contractorId,
    telegram_chat_id: chatId,
  }, { onConflict: 'contractor_id' })

  await ctx.reply('✅ VoiceDesk connected. You will receive call alerts here.')
})
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SMS sending | Raw HTTP to Twilio REST API | twilio SDK (twilio@6.0.2) | SDK handles auth, retries, type safety |
| WhatsApp templates | Build message from scratch | Twilio Content SID + variables | WABA requires pre-approved templates |
| Telegram Bot API | Raw HTTP to Telegram | grammy@1.420 | Webhook middleware, type-safe API |
| Background dispatch | setTimeout / setInterval | Inngest (already in stack) | Durable execution, automatic retries |
| Notification logging | ad-hoc console.log | notification_log table | Visibility in portal, failure tracking |

**Key insight:** Twilio and Telegram APIs have rate limits and require proper error handling. The SDKs abstract this complexity while providing type-safe interfaces.

## Common Pitfalls

### Pitfall 1: WhatsApp Template Not Approved
**What goes wrong:** `sendWhatsApp` fails with "template not found" or "template not approved" error.
**Why it happens:** WABA templates require Meta approval (3-7 business days). Using Content SIDs before approval fails.
**How to avoid:** Submit templates early (week 1 of Phase 5). Use placeholder Content SIDs in code (already done: `HXplaceholder_*`) and replace with real SIDs after approval.
**Warning signs:** Twilio console shows template status "pending" or "rejected".

### Pitfall 2: Telegram Webhook Not Set
**What goes wrong:** Telegram bot never receives /start commands - linking flow doesn't work.
**Why it happens:** Webhook URL not registered with Telegram after deploy.
**How to avoid:** After first Vercel deploy, call:
```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${APP_URL}/api/webhooks/telegram"
```
Or use bot.setWebhook() in code on startup.
**Warning signs:** Telegram Bot API returns "ok: false" on webhook check.

### Pitfall 3: WhatsApp Phone Number Not in E.164
**What goes wrong:** WhatsApp send fails with invalid recipient error.
**Why it happens:** Phone number missing country code or has wrong format.
**How to avoid:** Use libphonenumber-js to validate and format (already in stack from Phase 1). Ensure `whatsapp:+1XXXXXXXXXX` format in `TWILIO_WHATSAPP_FROM`.

### Pitfall 4: Promise.allSettled Without Error Re-throw
**What goes wrong:** All channels report failure but Inngest doesn't retry because error was swallowed.
**Why it happens:** Missing `throw` after Promise.allSettled failure handling.
**How to avoid:** Always throw after logging failures - Inngest's retry mechanism depends on thrown errors (line 243 in retell-notify-dispatch.ts).

### Pitfall 5: Notification Log Not Written Before Send
**What goes wrong:** If process crashes mid-send, no record of the attempt exists.
**Why it happens:** Writing log after send, not before.
**How to avoid:** Always `await writeNotificationLog({..., status: 'pending'})` before the API call (D-12 pattern).

## Code Examples

### Sending SMS with Twilio
```typescript
// Source: src/lib/notifications/sms.ts
import twilio from 'twilio'

const client = twilio(accountSid, authToken)
const message = await client.messages.create({
  to: '+15558675309',        // E.164 format
  from: '+15551234567',      // From env TWILIO_FROM_NUMBER
  body: 'New call from +1555...',
})
return { sid: message.sid, status: message.status }
```

### Sending WhatsApp Template Message
```typescript
// Source: src/lib/notifications/whatsapp.ts
const message = await client.messages.create({
  to: `whatsapp:+15558675309`,  // Prefix required
  from: 'whatsapp:+15551234567', // From env TWILIO_WHATSAPP_FROM
  contentSid: 'HXplaceholder_new_lead', // Approved template SID
  contentVariables: JSON.stringify({
    '1': '+15558675309',  // callerPhone
    '2': 'HVAC repair',   // serviceRequested
    '3': 'Appointment booked', // bookingStatus
  }),
})
```

### Sending Telegram Message
```typescript
// Source: src/lib/notifications/telegram.ts
import { Bot } from 'grammy'

const bot = new Bot(botToken)
const result = await bot.api.sendMessage(chatId, 'New call from +1555...')
return { messageId: result.message_id }
```

### Inngest Function with Retries
```typescript
// Source: src/inngest/functions/retell-notify-dispatch.ts
export const retellNotifyDispatch = inngest.createFunction(
  {
    id: 'retell-notify-dispatch',
    retries: 5,                    // Inngest auto-retries on thrown errors
    idempotency: 'event.data.callId', // Prevent duplicate dispatch
    triggers: [{ event: 'retell/call.notify' }],
    onFailure: async ({ event }) => {
      console.error(`[retell-notify-dispatch] all retries exhausted`)
    },
  },
  async ({ event, step }) => {
    // Implementation...
  }
)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling for Telegram updates | Webhook-based (grammY) | Standard practice | Serverless-compatible, instant response |
| Blocking send calls | Promise.allSettled | Phase 5 design (D-08) | One channel failure doesn't block others |
| Log after send | Log before send (pending) | Phase 5 design (D-12) | Crash-safe notification tracking |
| SMS-only notifications | Multi-channel (SMS, WA, Telegram) | Phase 5 requirement | Contractors can choose preferred channel |

**Deprecated/outdated:**
- Twilio legacy REST API without SDK — use twilio@6.x SDK
- Telegram long-polling in serverless — use webhooks
- Single-channel sync sends — use Promise.allSettled for independence

## Assumptions Log

> List all claims tagged `[ASSUMED]` in this research. The planner and discuss-phase use this section to identify decisions that need user confirmation before execution.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | WABA templates (voicedesk_new_lead, voicedesk_emergency) have been submitted for approval | Common Pitfalls | Template approval is a pre-requisite - without it, WhatsApp notifications will fail |
| A2 | TELEGRAM_WEBHOOK_SECRET env var will be set in production | Telegram Webhook | Telegram validates secret token on webhook calls - missing secret = 403 error |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

## Open Questions

1. **WABA Template Approval Status**
   - What we know: Templates need to be registered with Meta via Twilio Console
   - What's unclear: Current approval status of voicedesk_new_lead and voicedesk_emergency
   - Recommendation: Check Twilio Console → Messaging → Content Template Builder

2. **Telegram Bot Registration**
   - What we know: @VoiceDeskBot needs to be registered with @BotFather
   - What's unclear: Whether bot username is confirmed and set up
   - Recommendation: Verify @VoiceDeskBot exists and TELEGRAM_BOT_TOKEN is configured

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| twilio | SMS, WhatsApp dispatch | ✓ (in package.json) | 6.0.2 | — |
| grammy | Telegram bot | ✓ (in package.json) | 1.42.0 | — |
| inngest | Background job execution | ✓ (in package.json) | 4.4.0 | — |
| TELEGRAM_BOT_TOKEN | Telegram webhook | ✗ (env var) | — | Cannot proceed - must be set |
| TWILIO_ACCOUNT_SID | Twilio API | ✗ (env var) | — | Cannot proceed - must be set |
| TWILIO_AUTH_TOKEN | Twilio API | ✗ (env var) | — | Cannot proceed - must be set |
| TWILIO_FROM_NUMBER | SMS dispatch | ✗ (env var) | — | Cannot proceed - must be set |
| TWILIO_WHATSAPP_FROM | WhatsApp dispatch | ✗ (env var) | — | Cannot proceed - must be set |

**Missing dependencies with no fallback:**
- All Twilio env vars (ACCOUNT_SID, AUTH_TOKEN, FROM_NUMBER, WHATSAPP_FROM) - block SMS and WhatsApp
- TELEGRAM_BOT_TOKEN env var - blocks Telegram notifications
- TELEGRAM_WEBHOOK_SECRET env var - blocks secure webhook validation

**Missing dependencies with fallback:**
- None identified - all env vars are required for notification functionality

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (from Phase 1) |
| Config file | vitest.config.ts |
| Quick run command | `npm run test -- --run` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTIF-01 | SMS fires for lead/emergency/info within 60s | Integration | `npm run test` (Inngest function test) | ✅ src/inngest/functions/retell-notify-dispatch.ts |
| NOTIF-02 | WhatsApp fires for lead/emergency, falls back to SMS on failure | Integration | `npm run test` | ✅ src/lib/notifications/whatsapp.ts |
| NOTIF-03 | Telegram fires for lead/emergency | Integration | `npm run test` | ✅ src/lib/notifications/telegram.ts |
| EMRG-03 | Emergency includes "EMERGENCY" in message | Unit | `npm run test` | ✅ In dispatch logic |

### Sampling Rate
- **Per task commit:** `npm run test -- --run`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] Test file for `retell-notify-dispatch.ts` - covers NOTIF-01, NOTIF-02, NOTIF-03, EMRG-03
- [ ] Test file for `telegram/route.ts` - covers Telegram webhook linking flow
- [ ] Integration test for full dispatch pipeline

*(If no gaps: "None — existing test infrastructure covers all phase requirements")*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A - notifications are outbound |
| V3 Session Management | No | N/A - notifications are outbound |
| V4 Access Control | No | N/A - notifications are outbound |
| V5 Input Validation | Yes | Telegram webhook input validation via grammY |
| V6 Cryptography | No | N/A - no encryption of notification content |

### Known Threat Patterns for Notification Domain

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Twilio credentials exposed | Information Disclosure | Never prefix with NEXT_PUBLIC_, use server-only imports |
| Telegram webhook spoofed | Tampering | TELEGRAM_WEBHOOK_SECRET validation (D-22) |
| Notification log injection | Tampering | Parameterized SQL via Supabase client (already used) |
| Rate limit exhaustion | Denial of Service | Twilio handles rate limits; Inngest retries with backoff |

## Sources

### Primary (HIGH confidence)
- [Context7: twilio-node](https://context7.com/twilio/twilio-node) - SMS and WhatsApp message sending patterns
- [Context7: grammY](https://context7.com/grammyjs/website) - Telegram bot webhook and message sending
- [Context7: inngest-js](https://context7.com/inngest/inngest-js) - createFunction, step.sendEvent, retry patterns
- Existing implementation in `src/lib/notifications/*`, `src/inngest/functions/retell-notify-dispatch.ts`, `src/app/api/webhooks/telegram/route.ts`

### Secondary (MEDIUM confidence)
- [Twilio WhatsApp API docs](https://www.twilio.com/docs/whatsapp/api) - Template requirements (referenced in code comments)

### Tertiary (LOW confidence)
- None required - all claims verified via Context7 or existing code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - versions verified via npm, libraries confirmed in project
- Architecture: HIGH - implementation already exists and follows documented patterns
- Pitfalls: HIGH - based on existing code analysis and library documentation

**Research date:** 2026-05-12
**Valid until:** 2026-06-12 (30 days - notification patterns are stable)
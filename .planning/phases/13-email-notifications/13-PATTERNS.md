# Phase 13: Email Notifications - Pattern Map

**Mapped:** 2026-05-25  
**Files analyzed:** 5 (2 modified, 3 new)  
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/inngest/functions/retell-notify-dispatch.ts` | inngest-function | event-driven | self (existing SMS/Telegram pattern) | exact |
| `src/inngest/functions/stripe-payment-failure.ts` | inngest-function | event-driven | self (existing payment-alert pattern) | exact |
| `src/lib/notifications/templates/LeadNotificationEmail.tsx` | template | transform | none (new React Email component) | new |
| `src/lib/notifications/templates/EmergencyNotificationEmail.tsx` | template | transform | none (new React Email component) | new |
| `src/lib/notifications/templates/PaymentFailureEmail.tsx` | template | transform | none (new React Email component) | new |

---

## Pattern Assignments

### `src/inngest/functions/retell-notify-dispatch.ts` (inngest-function, event-driven)

**Analog:** self (existing SMS/Telegram dispatch in same file)

**Role:** Extends existing multi-channel notification dispatcher to add email channel.

**Modifications:**
1. Extend `computeChannels()` function signature to include email fields
2. Add email gating logic to `computeChannels()` return value
3. Add new `step.run('send-email')` block alongside existing SMS/WhatsApp/Telegram

**Imports pattern** (lines 1-18):
```typescript
import 'server-only'
import { NonRetriableError } from 'inngest'
import { inngest } from '@/inngest/client'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { sendSms } from '@/lib/notifications/sms'
import { sendWhatsApp } from '@/lib/notifications/whatsapp'
import { sendTelegram } from '@/lib/notifications/telegram'
import { sendEmail } from '@/lib/notifications/email'  // NEW IMPORT
import { writeNotificationLog, updateNotificationLog } from '@/lib/notifications/log'
import type { CallIntent, NotificationSettings } from '@/types/database'
```

**computeChannels() signature extension** (lines 30-44):
```typescript
export function computeChannels(
  settings: Pick<
    NotificationSettings,
    | 'sms_number'
    | 'whatsapp_number'
    | 'telegram_chat_id'
    | 'notify_email_enabled'      // NEW
    | 'email_address'              // NEW
    | 'notify_on_lead'
    | 'notify_on_emergency'
    | 'notify_on_general_inquiry'
    | 'notify_sms_enabled'
    | 'notify_whatsapp_enabled'
    | 'notify_telegram_enabled'
  > | null,
  intent: CallIntent | null
): { 
  shouldSendSms: boolean
  shouldSendWhatsApp: boolean
  shouldSendTelegram: boolean
  shouldSendEmail: boolean  // NEW
}
```

**computeChannels() email gating logic** (add after line 81, in return block):
```typescript
const shouldSendEmail =
  settings?.email_address != null &&
  settings?.notify_email_enabled === true &&
  (
    (intent === 'emergency' && (settings.notify_on_emergency ?? true)) ||
    (intent === 'lead'      && (settings.notify_on_lead      ?? true)) ||
    (intent === 'info'      && (settings.notify_on_general_inquiry === true))
  )

return { shouldSendSms, shouldSendWhatsApp, shouldSendTelegram, shouldSendEmail }
```

**load-notification-data step expansion** (lines 116-126):
Expand the notification_settings select to include new email fields:
```typescript
const notifyData = await step.run('load-notification-data', async () => {
  const db = createServiceRoleClient()
  
  const [callResult, leadResult, settingsResult] = await Promise.all([
    db.from('calls').select('caller_phone, intent, summary').eq('id', callId).maybeSingle(),
    db.from('leads').select('id, service_requested, status, booking_conflict').eq('call_id', callId).maybeSingle(),
    db.from('notification_settings')
      .select('sms_number, whatsapp_number, telegram_chat_id, notify_email_enabled, email_address, notify_on_lead, notify_on_emergency, notify_on_general_inquiry, notify_sms_enabled, notify_whatsapp_enabled, notify_telegram_enabled')
      .eq('contractor_id', contractorId)
      .maybeSingle(),
  ])
  // ... rest unchanged
})
```

**send-email step pattern** (insert after send-telegram, line 312):
Copy from `send-sms` pattern (lines 180-209) and adapt:
```typescript
// Email dispatch (D-06: lead/emergency/info, gated by intent prefs)
if (shouldSendEmail) {
  await step.run('send-email', async () => {
    let logId: string | null = null
    try {
      // Template imports and render call
      const { render } = await import('@react-email/render')
      const { LeadNotificationEmail } = await import('@/lib/notifications/templates/LeadNotificationEmail')
      const { EmergencyNotificationEmail } = await import('@/lib/notifications/templates/EmergencyNotificationEmail')
      
      const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/calls`
      
      const emailSubject = isEmergency
        ? `EMERGENCY: New call from ${callerPhone}`
        : `New lead from ${callerPhone} — ${serviceRequested}`
      
      const emailHtml = render(
        isEmergency
          ? <EmergencyNotificationEmail 
              callerPhone={callerPhone}
              serviceRequested={serviceRequested}
              dashboardUrl={dashboardUrl}
            />
          : <LeadNotificationEmail 
              callerPhone={callerPhone}
              serviceRequested={serviceRequested}
              appointmentStatus={bookingStatus}
              dashboardUrl={dashboardUrl}
            />
      )
      
      // Log, send, update pattern (WR-02)
      logId = await writeNotificationLog({
        contractorId,
        callId,
        channel: 'email',
        recipient: settings!.email_address!,
        message: emailSubject,
      })
      
      const result = await sendEmail({
        to: settings!.email_address!,
        subject: emailSubject,
        html: emailHtml,
      })
      
      if (!result.success) {
        throw new Error(result.error || 'sendEmail failed')
      }
      
      await updateNotificationLog(logId, { status: 'sent', sentAt: new Date().toISOString() })
    } catch (err: unknown) {
      if (logId) {
        await updateNotificationLog(logId, {
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        })
      }
      throw err  // Re-throw so Inngest retries this step
    }
  })
}
```

---

### `src/inngest/functions/stripe-payment-failure.ts` (inngest-function, event-driven)

**Analog:** self (existing send-payment-alert pattern in same file)

**Role:** Extends payment failure handler to add email notification.

**Modifications:**
1. Expand `load-contractor` step's notification_settings select to include email fields
2. Add new `step.run('send-email-alert')` block after `send-payment-alert`

**Imports pattern** (lines 1-15):
```typescript
import 'server-only'
import { NonRetriableError } from 'inngest'
import { inngest } from '@/inngest/client'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { getRetellClient } from '@/lib/retell/client'
import { sendPaymentFailureAlert } from '@/lib/notifications/payment-alert'
import { sendEmail } from '@/lib/notifications/email'  // NEW IMPORT
import { writeNotificationLog, updateNotificationLog } from '@/lib/notifications/log'  // NEW IMPORT
```

**load-contractor step expansion** (lines 54-67):
Expand the notification_settings select to include email fields:
```typescript
const contractor = await step.run('load-contractor', async () => {
  const db = createServiceRoleClient()
  const { data, error } = await db
    .from('contractors')
    .select('id, retell_agent_id, twilio_number, phone_number, notification_settings(sms_number, whatsapp_number, email_address, notify_sms_enabled, notify_whatsapp_enabled, notify_email_enabled, notify_on_payment_failure)')
    .eq('id', contractorId)
    .maybeSingle()
  if (error || !data) {
    throw new NonRetriableError(
      `[stripe-payment-failure] contractor ${contractorId} not found`
    )
  }
  return data
})
```

**send-email-alert step pattern** (insert after send-payment-alert, after line 93):
Copy from `send-payment-alert` pattern and adapt with triple-gate:
```typescript
// Email alert step (D-07: added after send-payment-alert)
await step.run('send-email-alert', async () => {
  const ns = (contractor.notification_settings as Array<{
    email_address: string | null
    notify_email_enabled: boolean
    notify_on_payment_failure: boolean
  }> | null)?.[0]
  
  // Triple gate: all three conditions must be true (D-08)
  if (!ns?.email_address || !ns?.notify_email_enabled || !ns?.notify_on_payment_failure) {
    return  // Silently skip — no log entry
  }
  
  let logId: string | null = null
  try {
    const { render } = await import('@react-email/render')
    const { PaymentFailureEmail } = await import('@/lib/notifications/templates/PaymentFailureEmail')
    
    const billingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/settings/account`
    
    const emailHtml = render(
      <PaymentFailureEmail billingUrl={billingUrl} />
    )
    
    logId = await writeNotificationLog({
      contractorId,
      callId: null,  // Payment failure is not call-related (D-18)
      channel: 'email',
      recipient: ns.email_address,
      message: 'Payment failure alert',
    })
    
    const result = await sendEmail({
      to: ns.email_address,
      subject: 'Action required: VoiceDesk payment failed',
      html: emailHtml,
    })
    
    if (!result.success) {
      throw new Error(result.error || 'sendEmail failed')
    }
    
    await updateNotificationLog(logId, { status: 'sent', sentAt: new Date().toISOString() })
  } catch (err: unknown) {
    if (logId) {
      await updateNotificationLog(logId, {
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      })
    }
    throw err  // Re-throw so Inngest retries
  }
})
```

---

### `src/lib/notifications/templates/LeadNotificationEmail.tsx` (template, transform)

**Analog:** React Email official documentation + Phase 13 RESEARCH patterns

**Role:** Renders lead notification email body as JSX component.

**Template structure pattern**:
```typescript
import 'server-only'
import { Html, Body, Section, Text, Button, Link } from '@react-email/components'

export interface LeadNotificationEmailProps {
  callerPhone: string
  serviceRequested: string
  appointmentStatus: string
  dashboardUrl: string
}

export function LeadNotificationEmail(props: LeadNotificationEmailProps) {
  return (
    <Html>
      <Body style={{ fontFamily: 'Arial, sans-serif', padding: '0', margin: '0' }}>
        <Section style={{ padding: '20px', backgroundColor: '#ffffff' }}>
          <Text style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 16px 0' }}>
            New Lead from {props.callerPhone}
          </Text>
          
          <Text style={{ fontSize: '16px', margin: '8px 0' }}>
            Service: <strong>{props.serviceRequested}</strong>
          </Text>
          
          <Text style={{ fontSize: '16px', margin: '8px 0' }}>
            Status: {props.appointmentStatus}
          </Text>
          
          <Section style={{ margin: '20px 0 0 0' }}>
            <Button
              href={props.dashboardUrl}
              style={{
                background: '#007bff',
                color: '#ffffff',
                padding: '12px 24px',
                textDecoration: 'none',
                borderRadius: '4px',
                fontSize: '16px',
                fontWeight: 'bold',
              }}
            >
              View in Dashboard
            </Button>
          </Section>
        </Section>
      </Body>
    </Html>
  )
}
```

**Key requirements:**
- `import 'server-only'` at top (D-16)
- Props interface with required fields: callerPhone, serviceRequested, appointmentStatus, dashboardUrl
- Use `@react-email/components` primitives (Html, Body, Section, Text, Button) — never raw HTML
- Inline styles via `style={{}}` objects
- All variables are auto-escaped by React Email Text component
- No external styling or CSS files

---

### `src/lib/notifications/templates/EmergencyNotificationEmail.tsx` (template, transform)

**Analog:** React Email official documentation + Phase 13 RESEARCH patterns

**Role:** Renders emergency notification email body with "EMERGENCY" prominently featured.

**Template structure pattern** (copy LeadNotificationEmail structure, modify):
```typescript
import 'server-only'
import { Html, Body, Section, Text, Button, Link } from '@react-email/components'

export interface EmergencyNotificationEmailProps {
  callerPhone: string
  serviceRequested: string
  dashboardUrl: string
}

export function EmergencyNotificationEmail(props: EmergencyNotificationEmailProps) {
  return (
    <Html>
      <Body style={{ fontFamily: 'Arial, sans-serif', padding: '0', margin: '0' }}>
        <Section style={{ padding: '20px', backgroundColor: '#ffebee' }}>  {/* Light red background */}
          <Text style={{ 
            fontSize: '22px', 
            fontWeight: 'bold', 
            margin: '0 0 16px 0',
            color: '#d32f2f'  /* Red text */
          }}>
            🚨 EMERGENCY: New call from {props.callerPhone}
          </Text>
          
          <Text style={{ fontSize: '16px', margin: '8px 0' }}>
            Service: <strong>{props.serviceRequested}</strong>
          </Text>
          
          <Text style={{ fontSize: '16px', margin: '8px 0', fontWeight: 'bold', color: '#d32f2f' }}>
            ⚠️ CALL BACK IMMEDIATELY
          </Text>
          
          <Section style={{ margin: '20px 0 0 0' }}>
            <Button
              href={props.dashboardUrl}
              style={{
                background: '#d32f2f',
                color: '#ffffff',
                padding: '12px 24px',
                textDecoration: 'none',
                borderRadius: '4px',
                fontSize: '16px',
                fontWeight: 'bold',
              }}
            >
              View in Dashboard
            </Button>
          </Section>
        </Section>
      </Body>
    </Html>
  )
}
```

**Key requirements:**
- "EMERGENCY" must appear prominently in subject line (handled by Inngest) and body (D-15, EMAIL-03)
- Red/alert visual styling (background color, red text, warning emoji)
- `import 'server-only'` at top (D-16)
- All other patterns identical to LeadNotificationEmail

---

### `src/lib/notifications/templates/PaymentFailureEmail.tsx` (template, transform)

**Analog:** React Email official documentation + Phase 13 RESEARCH patterns

**Role:** Renders payment failure alert email with billing link.

**Template structure pattern**:
```typescript
import 'server-only'
import { Html, Body, Section, Text, Button, Link } from '@react-email/components'

export interface PaymentFailureEmailProps {
  billingUrl: string
}

export function PaymentFailureEmail(props: PaymentFailureEmailProps) {
  return (
    <Html>
      <Body style={{ fontFamily: 'Arial, sans-serif', padding: '0', margin: '0' }}>
        <Section style={{ padding: '20px', backgroundColor: '#fff3cd' }}>  {/* Light yellow background */}
          <Text style={{ 
            fontSize: '22px', 
            fontWeight: 'bold', 
            margin: '0 0 16px 0',
            color: '#856404'  /* Brown text */
          }}>
            PAYMENT FAILED
          </Text>
          
          <Text style={{ fontSize: '16px', margin: '12px 0' }}>
            Your payment method failed. Your VoiceDesk agent will be deactivated in 72 hours if payment is not updated.
          </Text>
          
          <Text style={{ fontSize: '16px', margin: '12px 0', fontWeight: 'bold' }}>
            Update your payment method immediately to keep your service active.
          </Text>
          
          <Section style={{ margin: '20px 0 0 0' }}>
            <Button
              href={props.billingUrl}
              style={{
                background: '#856404',
                color: '#ffffff',
                padding: '12px 24px',
                textDecoration: 'none',
                borderRadius: '4px',
                fontSize: '16px',
                fontWeight: 'bold',
              }}
            >
              Update Payment Method
            </Button>
          </Section>
          
          <Text style={{ fontSize: '12px', margin: '20px 0 0 0', color: '#666666' }}>
            If you need assistance, please contact support or reply to this email.
          </Text>
        </Section>
      </Body>
    </Html>
  )
}
```

**Key requirements:**
- "PAYMENT FAILED" in subject and body prominently (D-15, EMAIL-04)
- Warning/alert visual styling (yellow background, brown text)
- Button links to `/settings/account` (NOT Stripe portal) (D-10, D-15)
- `import 'server-only'` at top (D-16)
- `callId` is null for payment emails (handled in Inngest, not template)

---

## Shared Patterns

### Non-Throwing Email Transport
**Source:** `src/lib/notifications/email.ts` (lines 50-79)

**Apply to:** All Inngest steps that call `sendEmail()`

**Pattern:**
```typescript
// sendEmail() NEVER throws — always returns { success, messageId?, error? }
const result = await sendEmail({
  to: email_address,
  subject: emailSubject,
  html: emailHtml,
})

// ALWAYS inspect result.success before proceeding
if (!result.success) {
  throw new Error(result.error || 'sendEmail failed')  // Throw for Inngest retry
}
```

**Rationale:** Matches SMS/WhatsApp/Telegram pattern; exception handling is centralized in step.run()

---

### Pending-Before-Send Notification Logging Pattern
**Source:** `src/lib/notifications/log.ts` (lines 15-55)

**Apply to:** All email send steps (retell-notify-dispatch and stripe-payment-failure)

**Pattern:**
```typescript
let logId: string | null = null
try {
  // 1. Write PENDING log entry first (WR-02)
  logId = await writeNotificationLog({
    contractorId,
    callId,  // null for payment failure emails
    channel: 'email',
    recipient: email_address,
    message: emailSubject,
  })
  
  // 2. Send the email
  const result = await sendEmail({ to, subject, html })
  
  if (!result.success) {
    throw new Error(result.error || 'sendEmail failed')
  }
  
  // 3. Update log to SENT on success
  await updateNotificationLog(logId, { status: 'sent', sentAt: new Date().toISOString() })
} catch (err: unknown) {
  // 4. Update log to FAILED on any error
  if (logId) {
    await updateNotificationLog(logId, {
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    })
  }
  // 5. Re-throw so Inngest retries this step
  throw err
}
```

**Rationale:** Ensures audit trail completeness even on crashes; matches existing SMS/WhatsApp pattern

---

### Email Template Server-Only Enforcement
**Source:** N/A (new pattern in Phase 13, recommended best practice)

**Apply to:** All email template files

**Pattern:**
```typescript
// ALWAYS first line in template file
import 'server-only'

// Template is now safe from browser import
// TypeScript will error if a Client Component tries to import it
```

**Rationale:** Prevents React Email library + template code from being bundled into browser JS; protects server-side logic

---

### Email Gating Decision Function
**Source:** `src/inngest/functions/retell-notify-dispatch.ts` lines 30-84

**Apply to:** `computeChannels()` function after email fields are added

**Pattern:**
```typescript
export function computeChannels(
  settings: Pick<
    NotificationSettings,
    | 'sms_number'
    | 'whatsapp_number'
    | 'telegram_chat_id'
    | 'notify_email_enabled'        // NEW
    | 'email_address'                // NEW
    | 'notify_on_lead'
    | 'notify_on_emergency'
    | 'notify_on_general_inquiry'
    | 'notify_sms_enabled'
    | 'notify_whatsapp_enabled'
    | 'notify_telegram_enabled'
  > | null,
  intent: CallIntent | null
): { 
  shouldSendSms: boolean
  shouldSendWhatsApp: boolean
  shouldSendTelegram: boolean
  shouldSendEmail: boolean  // NEW
} {
  if (!intent || intent === 'no_action' || intent === 'unknown') {
    return { 
      shouldSendSms: false, 
      shouldSendWhatsApp: false, 
      shouldSendTelegram: false,
      shouldSendEmail: false  // NEW
    }
  }

  const isInfoWithOptIn = intent === 'info' && settings?.notify_on_general_inquiry === true

  // ... existing SMS/WhatsApp/Telegram logic ...

  const shouldSendEmail =
    settings?.email_address != null &&
    settings?.notify_email_enabled === true &&
    (
      (intent === 'emergency' && (settings.notify_on_emergency ?? true)) ||
      (intent === 'lead'      && (settings.notify_on_lead      ?? true)) ||
      (intent === 'info'      && (settings.notify_on_general_inquiry === true))
    )

  return { shouldSendSms, shouldSendWhatsApp, shouldSendTelegram, shouldSendEmail }
}
```

**Rationale:** Centralized gating prevents intent-rule bugs; email uses identical rules to SMS/Telegram

---

### Payment Failure Triple-Gate Pattern
**Source:** `src/inngest/functions/stripe-payment-failure.ts` (new pattern, D-08)

**Apply to:** Payment failure email step only

**Pattern:**
```typescript
const ns = (contractor.notification_settings as Array<{
  email_address: string | null
  notify_email_enabled: boolean
  notify_on_payment_failure: boolean
}> | null)?.[0]

// All three conditions must be true (D-08)
if (!ns?.email_address || !ns?.notify_email_enabled || !ns?.notify_on_payment_failure) {
  return  // Silently skip — no log entry
}

// Email is sent only if all three gates pass
```

**Rationale:** Payment failure emails require explicit opt-in on a separate `notify_on_payment_failure` flag (distinct from general email opt-in); triple-gate prevents unwanted payment alerts

---

## No Analog Found

Files with no close match requiring patterns from RESEARCH.md:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/notifications/templates/LeadNotificationEmail.tsx` | template | transform | New React Email template component — no existing analog in codebase; pattern from official @react-email/components docs |
| `src/lib/notifications/templates/EmergencyNotificationEmail.tsx` | template | transform | New React Email template component — no existing analog in codebase; pattern from official @react-email/components docs |
| `src/lib/notifications/templates/PaymentFailureEmail.tsx` | template | transform | New React Email template component — no existing analog in codebase; pattern from official @react-email/components docs |

---

## Environment Variables & Dependencies

**New npm dependencies (from RESEARCH.md):**
- `@react-email/components@1.0.12`
- `@react-email/render@2.0.8`

**Environment variables already in place (Phase 12+):**
- `RESEND_API_KEY` — server-only secret (exists from Phase 12)
- `RESEND_FROM_ADDRESS` — verified sending domain (exists from Phase 12)
- `NEXT_PUBLIC_APP_URL` — base URL for email links (exists from Phase 7, used by Stripe portal)

**Installation:**
```bash
npm install @react-email/components@1.0.12 @react-email/render@2.0.8
```

---

## Metadata

**Analog search scope:**
- `src/inngest/functions/` — existing Inngest patterns for event-driven dispatch
- `src/lib/notifications/` — existing transport and logging patterns
- `src/types/database.ts` — NotificationSettings type definition
- `tests/notifications/` — test structure patterns

**Files scanned:** 8 core files (retell-notify-dispatch, stripe-payment-failure, email.ts, sms.ts, log.ts, payment-alert.ts, database.ts, sms.test.ts)

**Pattern extraction date:** 2026-05-25

**Quality indicators:**
- **computeChannels() extension:** Exact match — builds on proven SMS/Telegram pattern
- **Inngest step.run() structure:** Exact match — copy-paste from existing send-sms pattern
- **Pending-before-send logging:** Exact match — identical to Phase 5 SMS implementation
- **Template structure:** New pattern, verified against @react-email/components official docs
- **Non-throwing transport:** Exact match — sendEmail() already implements Phase 12 contract


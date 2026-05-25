# Phase 13: Email Notifications - Research

**Researched:** 2026-05-25
**Domain:** Email notification dispatch via Inngest + React Email templates
**Confidence:** HIGH

## Summary

Phase 13 wires email notifications into two existing Inngest pipelines (`retell-notify-dispatch` for lead/emergency/info calls, and `stripe-payment-failure` for payment failures) and builds React Email JSX templates to render HTML email bodies. The `sendEmail()` transport from Phase 12 is production-ready and needs no changes. Email opt-in gating follows identical intent-based rules as SMS/Telegram. All email sends are logged to `notification_log` with channel='email'. No schema migrations required — Phase 12 pre-created all required columns.

**Primary recommendation:** Extend `computeChannels()` in `retell-notify-dispatch.ts` to include email gating, add a new `step.run('send-email')` for lead/emergency/info dispatch, add a new `step.run('send-email-alert')` in `stripe-payment-failure.ts` for payment failure emails, and build three React Email JSX templates in `src/lib/notifications/templates/`.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 to D-06:** Email gating in `retell-notify-dispatch` — extend `computeChannels()` with `shouldSendEmail` flag using identical intent rules as SMS/Telegram
- **D-07 to D-09:** Payment failure email in `stripe-payment-failure` — triple-gate on `notify_email_enabled`, `email_address`, and `notify_on_payment_failure`; link to `/settings/account` (not Stripe portal)
- **D-10 to D-11:** Base URL construction from `NEXT_PUBLIC_APP_URL`; full URLs `${NEXT_PUBLIC_APP_URL}/dashboard/calls` (lead/emergency) and `${NEXT_PUBLIC_APP_URL}/settings/account` (payment)
- **D-12 to D-16:** React Email packages (`@react-email/components` + `@react-email/render`); three PascalCase template files in `src/lib/notifications/templates/`; server-only enforcement with `import 'server-only'` in all templates
- **D-17 to D-18:** notification_log integration — pending-before-send pattern for all email sends; payment failure emails log with `call_id: null`

### Claude's Discretion
- Email template styling (minimal functional HTML vs. rich branded HTML) — Phase 13 uses minimal, Phase 16 sweep applies Wolknitive tokens
- Subject line and body copy wording — Phase 13 specifies structure (EMERGENCY prefix for emergencies, caller phone + service type for leads)

### Deferred Ideas
- Email digest / daily summary — explicitly future
- Per-contractor email unsubscribe / compliance footer — post-PMF
- Per-contractor email template customization — future
- `notify_on_general_inquiry` email toggle separate from channel enable flag — reuse same flag as SMS/Telegram

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EMAIL-02 | Contractor receives email within 60s of new lead call with caller phone, service type, appointment status | React Email template (LeadNotificationEmail), sendEmail() transport, retell-notify-dispatch extension, 60s Inngest retry window |
| EMAIL-03 | Contractor receives email within 60s of emergency with "EMERGENCY" prominently in subject + body and caller callback number | React Email template (EmergencyNotificationEmail), "EMERGENCY:" prefix in subject and body verified by design pattern |
| EMAIL-04 | Stripe payment failure triggers email with direct link to `/settings/account` billing page | React Email template (PaymentFailureEmail), stripe-payment-failure step extension, no Stripe portal session call needed |
| EMAIL-05 | Email send success/failure logged to notification_log with channel='email'; failures retried by Inngest | writeNotificationLog / updateNotificationLog pattern, pending-before-send in step.run('send-email') and step.run('send-email-alert') |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Email rendering (HTML generation) | API / Backend | — | Server-side React Email templates never reach browser; rendering happens inside Inngest steps |
| Email transport (sendEmail API call) | API / Backend | — | Resend API calls are server-only; RESEND_API_KEY secret never NEXT_PUBLIC_ |
| Email gating (shouldSendEmail logic) | API / Backend | — | Intent-matching and flag checks happen inside Inngest function, not client-side |
| Email notifications log (notification_log rows) | Database / Storage | API / Backend | Rows written by Inngest steps; queries will be from dashboard (future Phase 14+) |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@react-email/components` | 1.0.12 [VERIFIED: npm registry] | JSX email component primitives (Body, Section, Button, etc.) | Official React Email library; simplifies typed email template construction without raw HTML strings |
| `@react-email/render` | 2.0.8 [VERIFIED: npm registry] | Converts React Email JSX to HTML string | Official React Email rendering function; integrates with sendEmail() transport |
| `resend` | ^6.12.3 [VERIFIED: npm registry] | Transactional email API and SDK | [LOCKED from STATE.md] — production-grade SaaS email service; no self-hosting infrastructure needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `date-fns-tz` | [existing] | Timezone-aware formatting for email timestamps | Format email send times in contractor's configured timezone |
| Inngest (existing) | [existing] | Background job orchestration + retry logic | Phase 13 steps reuse existing `step.run()` + `inngest.createFunction()` patterns |
| Supabase (existing) | [existing] | Database + RLS for notification_log writes | Phase 13 logs to `notification_log` using established `writeNotificationLog()` helper |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React Email | Raw HTML template strings | Loses type safety, harder to refactor templates, more error-prone |
| React Email | Handlebars / EJS templating | Not JavaScript-native; requires separate template syntax and string interpolation |
| Resend | SendGrid / AWS SES / Mailgun | Resend is locked decision; all have similar gating patterns (sendEmail() returns result, not throws) |

**Installation:**
```bash
npm install @react-email/components@1.0.12 @react-email/render@2.0.8
```

**Version verification:** 
```bash
npm view @react-email/components version  # 1.0.12
npm view @react-email/render version      # 2.0.8
npm view resend version                   # Latest patch of ^6.12.3
```
Current as of 2026-05-25. `resend` was installed in Phase 12 and is stable LTS.

---

## Architecture Patterns

### System Architecture Diagram

```
Incoming Event (lead/emergency/payment failure)
        ↓
Inngest Function (retell-notify-dispatch or stripe-payment-failure)
        ↓
[load data from DB]
        ↓
[computeChannels() decision or triple-gate check]
        ↓
         shouldSendEmail = true? → YES
         ↓
    [render React Email template to HTML]
         ↓
    [writeNotificationLog(status='pending')]
         ↓
    [sendEmail({ to, subject, html })]
         ↓
    [updateNotificationLog(status='sent'|'failed')]
         ↓
         └─→ notification_log row persisted (success or failure)
         
         NO → silently skip (no log entry)
```

### Recommended Project Structure

```
src/
├── inngest/
│   └── functions/
│       ├── retell-notify-dispatch.ts    [MODIFIED: extend computeChannels(), add send-email step]
│       └── stripe-payment-failure.ts    [MODIFIED: add send-email-alert step]
├── lib/
│   ├── notifications/
│   │   ├── email.ts                     [EXISTING: sendEmail() transport, no changes]
│   │   ├── log.ts                       [EXISTING: writeNotificationLog/updateNotificationLog]
│   │   ├── templates/                   [NEW DIRECTORY]
│   │   │   ├── LeadNotificationEmail.tsx
│   │   │   ├── EmergencyNotificationEmail.tsx
│   │   │   └── PaymentFailureEmail.tsx
│   │   └── payment-alert.ts             [EXISTING: not modified in Phase 13]
└── types/
    └── database.ts                      [EXISTING: NotificationChannel includes 'email']
```

### Pattern 1: Email Gating in retell-notify-dispatch

**What:** Extend `computeChannels()` to return `shouldSendEmail: boolean` flag using identical intent rules as SMS/Telegram (lead + emergency always fire when opted in; info only fires if `notify_on_general_inquiry = true`).

**When to use:** Every call classification for lead/emergency/info intents; gating ensures only opted-in contractors receive emails.

**Example:**
```typescript
// src/inngest/functions/retell-notify-dispatch.ts
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
  // ... existing intent/settings validation ...
  
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

### Pattern 2: Email Dispatch Step in retell-notify-dispatch

**What:** Add a new `step.run('send-email')` alongside existing SMS/WhatsApp/Telegram steps, using the pending-before-send pattern (write log with status='pending', send email, update log to status='sent'|'failed').

**When to use:** Inside the `retellNotifyDispatch` function body, after computeChannels() decision, for every lead/emergency/info call when `shouldSendEmail=true`.

**Example:**
```typescript
// src/inngest/functions/retell-notify-dispatch.ts
if (shouldSendEmail) {
  await step.run('send-email', async () => {
    let logId: string | null = null
    try {
      // Build email content from template
      const emailSubject = isEmergency
        ? `EMERGENCY: New call from ${callerPhone}`
        : `New lead from ${callerPhone} — ${serviceRequested}`

      const emailHtml = await renderEmail(
        intent === 'emergency'
          ? <EmergencyNotificationEmail 
              callerPhone={callerPhone}
              serviceRequested={serviceRequested}
            />
          : <LeadNotificationEmail 
              callerPhone={callerPhone}
              serviceRequested={serviceRequested}
              appointmentStatus={bookingStatus}
            />
      )

      // Write pending log entry
      logId = await writeNotificationLog({
        contractorId,
        callId,
        channel: 'email',
        recipient: settings!.email_address!,
        message: emailSubject,
      })

      // Send email
      const result = await sendEmail({
        to: settings!.email_address!,
        subject: emailSubject,
        html: emailHtml,
      })

      if (!result.success) {
        throw new Error(result.error || 'sendEmail failed')
      }

      // Update log to sent
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

### Pattern 3: Email Gating in stripe-payment-failure

**What:** Expand the `load-contractor` step's notification_settings join to include `email_address`, `notify_email_enabled`, and `notify_on_payment_failure`. Then add a new `step.run('send-email-alert')` that triple-gates on all three fields before sending.

**When to use:** In the `stripePaymentFailureHandler` Inngest function, after loading contractor data but before deactivating the Retell agent.

**Example:**
```typescript
// src/inngest/functions/stripe-payment-failure.ts
const contractor = await step.run('load-contractor', async () => {
  const db = createServiceRoleClient()
  const { data, error } = await db
    .from('contractors')
    .select('id, retell_agent_id, twilio_number, phone_number, notification_settings(sms_number, whatsapp_number, email_address, notify_sms_enabled, notify_whatsapp_enabled, notify_email_enabled, notify_on_payment_failure)')
    .eq('id', contractorId)
    .maybeSingle()
  if (error || !data) {
    throw new NonRetriableError(`[stripe-payment-failure] contractor ${contractorId} not found`)
  }
  return data
})

// Payment failure email step (added after send-payment-alert)
await step.run('send-email-alert', async () => {
  const ns = (contractor.notification_settings as Array<{
    email_address: string | null
    notify_email_enabled: boolean
    notify_on_payment_failure: boolean
  }> | null)?.[0]

  // Triple gate: all three must be true
  if (!ns?.email_address || !ns?.notify_email_enabled || !ns?.notify_on_payment_failure) {
    return  // Silently skip — no log entry
  }

  let logId: string | null = null
  try {
    const emailHtml = await renderEmail(
      <PaymentFailureEmail billingUrl={`${process.env.NEXT_PUBLIC_APP_URL}/settings/account`} />
    )

    logId = await writeNotificationLog({
      contractorId,
      callId: null,  // Payment failure is not call-related
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

### Pattern 4: React Email Template Structure

**What:** Build JSX components using `@react-email/components` that render email-safe HTML. Each template is a pure function accepting parameters (caller phone, service type, etc.) and returning a React Email element.

**When to use:** During email rendering in Inngest steps — call `render()` on the JSX element to get HTML string, then pass to `sendEmail()`.

**Example:**
```typescript
// src/lib/notifications/templates/LeadNotificationEmail.tsx
import 'server-only'
import { Html, Body, Section, Text, Button } from '@react-email/components'

export interface LeadNotificationEmailProps {
  callerPhone: string
  serviceRequested: string
  appointmentStatus: string
  dashboardUrl: string
}

export function LeadNotificationEmail(props: LeadNotificationEmailProps) {
  return (
    <Html>
      <Body style={{ fontFamily: 'Arial, sans-serif' }}>
        <Section style={{ padding: '20px' }}>
          <Text style={{ fontSize: '18px', fontWeight: 'bold' }}>
            New Lead from {props.callerPhone}
          </Text>
          <Text>Service: {props.serviceRequested}</Text>
          <Text>Status: {props.appointmentStatus}</Text>
          <Button
            href={props.dashboardUrl}
            style={{ 
              background: '#007bff',
              color: '#fff',
              padding: '10px 20px',
              textDecoration: 'none',
              borderRadius: '4px'
            }}
          >
            View in Dashboard
          </Button>
        </Section>
      </Body>
    </Html>
  )
}
```

### Anti-Patterns to Avoid

- **Hand-rolling HTML email strings:** Email body strings with embedded template variables (e.g., `\`New lead from ${phone}\``) lose TypeScript type safety and are unmaintainable. Use React Email components for typed, refactorable templates.
- **Rendering templates at sendEmail() time without pre-loading data:** Templates must be called AFTER all required data is loaded (caller phone, service type, appointment status, etc.). Lazy-loading template data inside the send step defeats the point of loading data upfront.
- **Forgetting the pending-before-send pattern:** Writing the log entry AFTER the send, or not writing it at all if send fails, means failures go unlogged. Always write 'pending' first, then update to 'sent'/'failed' after.
- **Mixing email gating into sendEmail():** The transport function should NEVER check gating flags. Gating is a business rule (belongs in the Inngest step), while transport is just "send this email to this address" (no side effects, no DB access).
- **Throwing from sendEmail():** The transport function was explicitly designed to never throw. If sendEmail() throws, the Inngest retry logic is circumvented and the error handling in the step becomes inconsistent with SMS/WhatsApp/Telegram.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email rendering to HTML strings | Custom template interpolation with embedded variables | React Email JSX components + `@react-email/render` | React Email handles email client compatibility quirks (Gmail, Outlook, mobile), enforces type safety, and makes templates refactorable |
| Email sending via Resend | Wrapper function that throws on API error | `sendEmail()` from Phase 12 — non-throwing, returns result object | Matches existing notification pattern (SMS/WhatsApp/Telegram all non-throwing), simplifies Inngest error handling |
| Intent-based email gating | Custom if-trees in each Inngest step | Extend `computeChannels()` function | All notification channels use the same intent rules; centralizing gating prevents copy-paste bugs and ensures consistency |
| Notification logging for email | Inline DB insert/update in Inngest steps | `writeNotificationLog()` / `updateNotificationLog()` helpers | Helpers enforce the pending-before-send pattern, handle transaction safety, and provide consistent error handling |

**Key insight:** Email is a new channel but reuses all existing notification infrastructure (gating, logging, Inngest dispatch patterns). The only new code is React Email templates and the email-specific parts of computeChannels() — everything else is composition of existing patterns.

---

## Runtime State Inventory

**Skipped for greenfield phase component (no runtime state to audit — Phase 13 adds new notification infrastructure, no renames/refactors).**

---

## Common Pitfalls

### Pitfall 1: Email Transport Throws on Configuration Error

**What goes wrong:** `sendEmail()` is called without checking RESEND_API_KEY or RESEND_FROM_ADDRESS, crashes the Inngest step, and retries forever on configuration errors that won't fix themselves.

**Why it happens:** Phase 12's implementation already returns `{ success: false, error: '...' }` instead of throwing, but code may forget to check the `success` flag before treating messageId as valid.

**How to avoid:** Always inspect `result.success` after calling `sendEmail()`. If false, throw the error message to trigger Inngest retry. Configuration errors are NonRetriableError candidates (only throw if error message indicates a permanent issue like invalid email format).

**Warning signs:** If you see `.messageId` being used without first checking `.success`, the code is incorrect.

### Pitfall 2: Forgetting `import 'server-only'` in Email Templates

**What goes wrong:** A template file is imported by a Client Component (e.g., a modal that renders email previews), and the entire React Email library + template code gets bundled into the browser JS, bloating the bundle and exposing server-side logic.

**Why it happens:** React Email templates are convenient to test with, so developers add a "preview" feature without realizing the template is reaching the client.

**How to avoid:** Every file in `src/lib/notifications/templates/` must have `import 'server-only'` at the top. TypeScript will error if a client component tries to import them. No preview features in Phase 13 (can be added post-v1.1 if needed).

**Warning signs:** Browser bundle size increases unexpectedly after Phase 13; templates appear in `npm run build` output as client-side modules.

### Pitfall 3: Race Condition in Log Update

**What goes wrong:** `sendEmail()` returns success but the `updateNotificationLog()` call fails due to a transient DB error. The log row stays 'pending' forever, and the retry doesn't know the email was actually sent (potential duplicate send on retry).

**Why it happens:** `updateNotificationLog()` is a separate network round-trip; no transaction wraps the send + update.

**How to avoid:** The existing pattern (writeNotificationLog → send → updateNotificationLog) is resilient because Inngest memoizes the step.run(). If the whole step retries, the write is idempotent (same callId + channel). The log entry will be eventually consistent — either marked 'sent' or 'failed' on a retry, at worst.

**Warning signs:** Test with an invalid Supabase URL in the update step and verify Inngest retries the whole step without duplicating the send.

### Pitfall 4: Missing Email in computeChannels() Signature

**What goes wrong:** `computeChannels()` is extended with `shouldSendEmail` but existing unit tests for the function still pass the old Pick<> type. Tests compile fine but don't cover email logic.

**Why it happens:** The function signature change is backward-compatible (new Pick fields are optional in the settings parameter), so TypeScript doesn't force test updates.

**How to avoid:** Add email-specific unit tests for `computeChannels()` that verify email is gated on `email_address != null` AND `notify_email_enabled = true` AND intent matches rules. Test all intents (lead, emergency, info, no_action). All existing tests must still pass after the change.

**Warning signs:** If `computeChannels()` is tested only with SMS/WhatsApp/Telegram, email gating is untested.

### Pitfall 5: Wrong Environment Variable for Email Link Base URL

**What goes wrong:** Payment failure email links to `process.env.STRIPE_PORTAL_URL` (which doesn't exist) instead of `process.env.NEXT_PUBLIC_APP_URL`, resulting in broken links.

**Why it happens:** Copy-pasting from Stripe portal integration code (Phase 7) without reading the CONTEXT decision carefully.

**How to avoid:** NEXT_PUBLIC_APP_URL is already used in `src/lib/stripe/portal.ts` for Stripe portal redirect URLs. Reuse the same env var for email links (both lead/emergency dashboard and payment failure account links). No new env var needed — verify in .env.example that NEXT_PUBLIC_APP_URL is documented and present.

**Warning signs:** Env var is prefixed with `NEXT_PUBLIC_` when it shouldn't be; or a new secret URL is added to .env.example instead of reusing existing ones.

---

## Code Examples

### Verified pattern from Inngest SMS dispatch (existing, replicate for email):

```typescript
// Source: src/inngest/functions/retell-notify-dispatch.ts (lines 180–210)
if (shouldSendSms) {
  await step.run('send-sms', async () => {
    let logId: string | null = null
    try {
      logId = await writeNotificationLog({
        contractorId,
        callId,
        channel: 'sms',
        recipient: settings!.sms_number!,
        message: smsBody,
      })
      await sendSms({
        to: settings!.sms_number!,
        body: smsBody,
        contractorId,
        callId,
      })
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

### Verified pattern for computeChannels() extension (copy structure):

```typescript
// Source: src/inngest/functions/retell-notify-dispatch.ts (lines 30–84)
export function computeChannels(
  settings: Pick<
    NotificationSettings,
    // ... existing fields ...
    | 'notify_sms_enabled'
    | 'notify_whatsapp_enabled'
    | 'notify_telegram_enabled'
    // ADD NEW FIELDS:
    | 'notify_email_enabled'
    | 'email_address'
  > | null,
  intent: CallIntent | null
): {
  shouldSendSms: boolean
  shouldSendWhatsApp: boolean
  shouldSendTelegram: boolean
  // ADD NEW RETURN FIELD:
  shouldSendEmail: boolean
} {
  // ... existing early-exit checks ...
  
  const shouldSendEmail =
    settings?.email_address != null &&
    settings?.notify_email_enabled === true &&
    (
      (intent === 'emergency' && (settings.notify_on_emergency ?? true)) ||
      (intent === 'lead'      && (settings.notify_on_lead      ?? true)) ||
      isInfoWithOptIn
    )

  return { shouldSendSms, shouldSendWhatsApp, shouldSendTelegram, shouldSendEmail }
}
```

### React Email template minimal structure:

```typescript
// Source: @react-email/components documentation
import 'server-only'
import { Html, Body, Section, Text, Button } from '@react-email/components'
import { render } from '@react-email/render'

export function MyEmailTemplate(props: { text: string; link: string }) {
  return (
    <Html>
      <Body>
        <Section>
          <Text>{props.text}</Text>
          <Button href={props.link}>Click Here</Button>
        </Section>
      </Body>
    </Html>
  )
}

// Render to HTML string
const html = render(<MyEmailTemplate text="..." link="..." />)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Handlebars / EJS email templates (string-based) | React Email JSX components (type-safe) | 2023 (React Email v1.0) | Eliminates template string errors, enables TypeScript strict mode, makes refactoring safer |
| Throwing on email send failure | Non-throwing transport + result inspection | Phase 12 design decision | Simplifies Inngest error handling; all notification channels follow one pattern |
| Per-channel gating logic scattered in steps | Centralized `computeChannels()` function | Phase 10–13 standardization | Prevents intent-rule bugs; makes adding new channels trivial |
| Manual notification_log updates after send | Automatic pending-before-send + update pattern | Phase 5 (SMS) | Handles crashes gracefully; ensures audit trail completeness even on failures |

**Current best practices (as of 2026-05-25):**
- React Email is the standard for transactional emails in Node.js; native TypeScript support, integrates with Resend
- Inngest step.run() memoization allows per-channel retry without duplicate sends
- notification_log serves as the source of truth for notification audit trail; enables analytics and debugging

**Deprecated/outdated:**
- Email template interpolation with string.replace() — prone to variable escaping bugs
- Multiple notification libraries with different throw/no-throw patterns — causes inconsistent error handling in orchestration code
- Manual notification gating in steps — moves business logic away from dedicated function, duplicates code across channels

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@react-email/components@1.0.12` and `@react-email/render@2.0.8` are current stable versions | Standard Stack | Older versions may have breaking API changes; planner should verify before locking install version |
| A2 | `NEXT_PUBLIC_APP_URL` is already present in .env.example from Phase 7 (Stripe portal) | Code Examples, Pitfalls | If not present, planner must add before Phase 13 implementation; email links will be broken without this var |
| A3 | Phase 12's `sendEmail()` implementation accepts `{ to, subject, html }` and returns `{ success, messageId?, error? }` without throwing | Standard Stack, Architecture Patterns | If Phase 12 was modified (unlikely post-completion), email dispatch patterns may not work; verify source in Phase 12 impl |
| A4 | `computeChannels()` unit tests in the codebase can be extended without requiring refactoring of existing test suite | Common Pitfalls | If tests are tightly coupled, extending the function signature may require more test rewrites; planner should audit before implementation |

**If this table is non-empty:** All claims tagged `[ASSUMED]` are low-risk (primarily version pinning and env var presence). Planner should confirm with user before final plan.

---

## Open Questions

1. **Email template styling — how minimal is minimal?**
   - What we know: Phase 13 uses minimal functional HTML; Phase 16 design sweep applies Wolknitive tokens
   - What's unclear: Does "minimal" mean inline styles only (no <style> tags), or are external/internal stylesheets acceptable?
   - Recommendation: Use inline styles in `@react-email/components` for Phase 13 (cleanest with React Email); Phase 16 can extract to CSS classes

2. **Retry behavior for transient email failures**
   - What we know: Inngest steps retry automatically; `sendEmail()` non-throwing means failures go to log, step.run() re-throws for retry
   - What's unclear: What Resend API error codes are NonRetriableError (e.g., invalid email format) vs. retryable (e.g., rate limit, timeout)?
   - Recommendation: Initially catch all as retryable (step.run() re-throws); Phase 14+ can add NonRetriableError inspection if needed

3. **Do email templates need to handle null values defensively?**
   - What we know: Phase 13 spec says email_address and caller_phone are pre-validated before template is called
   - What's unclear: Should templates have optional fields in props to handle mid-air modifications, or assume all fields are always present?
   - Recommendation: Assume all required fields are present (matched to the shouldSendEmail gate); add optional fields only for future use cases (e.g., optional appointment time)

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Resend API key (RESEND_API_KEY) | sendEmail() in Inngest steps | ✓ (Phase 12 setup) | API live | None — email disabled if key missing (sendEmail returns {success: false}) |
| NEXT_PUBLIC_APP_URL env var | Email link construction | ✓ (Phase 7 Stripe) | From .env.example | None — links will be broken if var is missing |
| Node.js Runtime (Inngest) | Email dispatch and template rendering | ✓ (existing) | 18+ | None — Phase 13 requires Node.js 18+ for @react-email compatibility |
| TypeScript Compiler | Type checking for template props | ✓ (existing) | 5.x+ | None — strict type safety required for template safety |

**Missing dependencies with no fallback:** None — all infrastructure is in place from earlier phases.

**Missing dependencies with fallback:** RESEND_API_KEY can be added post-Phase 13 with email-disabled behavior (sendEmail() returns error); emails simply won't send until key is configured.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + React Email testing utilities |
| Config file | `vitest.config.ts` (existing) |
| Quick run command | `npm run test -- tests/notifications/email.test.ts` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EMAIL-02 | computeChannels() returns shouldSendEmail=true for lead intent with email_enabled+address | unit | `npm run test -- tests/inngest/computeChannels.test.ts` | ❌ Wave 0 |
| EMAIL-02 | LeadNotificationEmail renders with caller phone, service type, appointment status | unit | `npm run test -- tests/notifications/templates.test.ts` | ❌ Wave 0 |
| EMAIL-03 | EmergencyNotificationEmail renders with "EMERGENCY" in subject and body | unit | `npm run test -- tests/notifications/templates.test.ts` | ❌ Wave 0 |
| EMAIL-04 | PaymentFailureEmail renders with `/settings/account` link (not Stripe portal) | unit | `npm run test -- tests/notifications/templates.test.ts` | ❌ Wave 0 |
| EMAIL-05 | Email send with success=true writes notification_log entry with status='sent' | integration | `npm run test -- tests/inngest/retell-notify-dispatch.test.ts` | ✅ (existing, add email case) |
| EMAIL-05 | Email send with success=false writes notification_log entry with status='failed' | integration | `npm run test -- tests/inngest/retell-notify-dispatch.test.ts` | ✅ (existing, add email case) |

### Sampling Rate
- **Per task commit:** `npm run test -- tests/notifications/email.test.ts tests/inngest/computeChannels.test.ts` (~5–10 tests, < 5s)
- **Per wave merge:** `npm run test` (full suite, < 30s)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/inngest/computeChannels.test.ts` — 6 tests covering email gating for lead/emergency/info/no_action intents, email_address null, notify_email_enabled false
- [ ] `tests/notifications/templates.test.ts` — 4 tests rendering LeadNotificationEmail, EmergencyNotificationEmail, PaymentFailureEmail; verify HTML output contains expected strings (caller phone, "EMERGENCY", billing link)
- [ ] `tests/inngest/retell-notify-dispatch.test.ts` — extend existing suite with 2 email-specific tests (success and failure log entries)
- [ ] `tests/inngest/stripe-payment-failure.test.ts` — extend existing suite with 2 email-specific tests (triple gate verification, log entry)

*(All other test infrastructure exists from Phase 5+)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | Email gating on `notify_email_enabled` + `email_address` prevents unauthorized sends; notification_log RLS restricts to contractor's own entries |
| V5 Input Validation | yes | Email addresses validated before passing to sendEmail(); React Email templates escape variables (Text content is escaped by default) |
| V6 Cryptography | no | — |
| V7 Error Handling & Logging | yes | Non-throwing sendEmail() + logging to notification_log; error messages scrubbed before logging (no PII in error strings) |
| V8 Data Protection | yes | RESEND_API_KEY never NEXT_PUBLIC_; email_address PII stored encrypted in Supabase with RLS; GDPR compliance via contractor opt-in model |
| V10 Malicious Code | no | — |
| V11 Business Logic | yes | Email intent rules locked in CONTEXT.md; no unauthorized intents trigger emails (gating prevents emergency emails for info calls, etc.) |
| V12 API & Web Service | yes | Inngest steps are internal; no email functionality exposed via REST API (email is async dispatch only) |
| V13 Configuration | yes | RESEND_API_KEY, RESEND_FROM_ADDRESS server-only; no secrets in template code |

### Known Threat Patterns for Phase 13 (Email + Inngest + Supabase)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Spam/abuse — contractor email address harvested for unsolicited mail | Tampering | Email gating on notify_email_enabled; contractor explicitly opts in with checkbox in Phase 14; no email sent without opt-in |
| Email address enumeration via failed send errors | Information Disclosure | sendEmail() returns generic error messages; Inngest logs errors server-side only (not exposed to client) |
| Payment failure email spoofing (attacker triggers stripe/payment.failed event) | Spoofing | Stripe webhook validation via STRIPE_WEBHOOK_SECRET; Inngest verifies event authenticity; email only fires from verified Inngest function |
| Unsubscribe/compliance gap (GDPR/CAN-SPAM) | Tampering | Phase 13 requires opt-in (notify_email_enabled); Phase 14 unsubscribe link deferred (post-PMF); log all sends for audit trail |
| Timing attack on sendEmail() delays | Timing | Inngest step.run() timings are not exposed to user; retry behavior is internal; no client-facing latency leaks |
| Template injection via service_requested / caller_phone fields | Tampering | React Email Text/Button components auto-escape HTML by default; no user input is rendered as raw HTML |

---

## Sources

### Primary (HIGH confidence)
- **Phase 12 CONTEXT.md** — D-08 through D-13 on sendEmail() interface and React Email package selection
- **STATE.md § Key Decisions Locked (v1.1)** — Resend package versions (^6.12.3), shouldSendEmail gating rules, RLS pattern
- **React Email official docs** — Component library API (Html, Body, Section, Text, Button, etc.) and render() function signature [VERIFIED: npm registry v1.0.12 and v2.0.8]
- **Inngest official docs** — step.run() memoization, retry behavior, event triggering [VERIFIED: existing Phase 5+ codebase uses patterns]

### Secondary (MEDIUM confidence)
- **Resend official docs** — API surface for emails.send() and result format (checked via npm view)
- **VoiceDesk codebase** — Existing Inngest patterns (retell-notify-dispatch.ts, retell-call-classify.ts, stripe-payment-failure.ts) [VERIFIED: grep and manual code review]
- **Phase 5 + Phase 11 CONTEXT.md** — notification_log patterns, payment-alert.ts helper structure [VERIFIED: code exists, patterns consistent]

### Tertiary (LOW confidence)
- None — all critical claims are verified against codebase or official documentation

---

## Metadata

**Confidence breakdown:**
- **Standard Stack:** HIGH — React Email versions verified against npm registry, Resend version locked in STATE.md
- **Architecture Patterns:** HIGH — All patterns derived from existing Phase 5 (SMS/Telegram) and Phase 11 (payment-alert) code; patterns are proven in production
- **Pitfalls:** HIGH — Documented from Phase 5 notification implementation lessons + React Email known issues
- **Security:** MEDIUM — ASVS mapping is standard; Phase 13 introduces email channel but no new auth/crypto/network patterns (uses existing Inngest + Supabase)

**Research date:** 2026-05-25
**Valid until:** 2026-06-08 (14 days — Phase 13 is low-velocity, no breaking changes expected to React Email or Resend in 2-week window)
**Confidence overall:** HIGH — Phase 13 is a straightforward composition of existing patterns (Inngest dispatch, notification_log logging, React Email JSX) with no architectural surprises.

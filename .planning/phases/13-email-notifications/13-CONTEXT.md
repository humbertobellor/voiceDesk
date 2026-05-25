# Phase 13: Email Notifications - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire `sendEmail()` (Phase 12 transport) into two existing Inngest pipelines — `retell-notify-dispatch` for lead/emergency/info calls, and `stripe-payment-failure` for payment failures — and build three React Email HTML templates. Install `@react-email/components` + `@react-email/render`. No UI changes, no schema migrations (Phase 12 already added all columns). Every email send is logged in `notification_log` with `channel: 'email'`.

</domain>

<decisions>
## Implementation Decisions

### Email Gating in retell-notify-dispatch

- **D-01:** Extend `computeChannels()` in `src/inngest/functions/retell-notify-dispatch.ts` to add `shouldSendEmail` — keeps all channel gating in one tested function and one DB select.
- **D-02:** Email intent rules are **identical to SMS/Telegram**: lead + emergency always fire when opted in; info only fires if `notify_on_general_inquiry = true`.
- **D-03:** Expand the `notification_settings` select in the `load-notification-data` step to include `notify_email_enabled` and `email_address`. One DB round-trip, consistent with all other channels.
- **D-04:** `computeChannels()` Pick<NotificationSettings> type must be expanded to include `notify_email_enabled` and `email_address`. Downstream: all existing unit tests for `computeChannels()` must still pass after the extension.
- **D-05:** `shouldSendEmail` gate: `notify_email_enabled === true AND email_address !== null AND intent-matches-channel-rules`. Matches the locked `shouldSendEmail` pattern from STATE.md.
- **D-06:** Email dispatch runs in its own `step.run('send-email')` inside `retellNotifyDispatch` — same pattern as `send-sms`, `send-whatsapp`, `send-telegram`. Independent Inngest retry, independent `notification_log` entries.

### Payment Failure Email

- **D-07:** Add a new `step.run('send-email-alert')` in `stripe-payment-failure.ts`, inserted **after** the existing `send-payment-alert` step. The Inngest function remains the orchestrator. `sendPaymentFailureAlert()` helper is NOT modified.
- **D-08:** Payment failure email gating is a **triple gate**: `notify_email_enabled = true AND email_address IS NOT NULL AND notify_on_payment_failure = true`. All three must be true or the email step is silently skipped (no log entry).
- **D-09:** Expand the `notification_settings(...)` join in the `load-contractor` step of `stripe-payment-failure.ts` to include `email_address`, `notify_email_enabled`, and `notify_on_payment_failure`. Pass these fields forward to the new `send-email-alert` step via the contractor data object.

### Billing Portal Link

- **D-10:** Payment failure email links to `/settings/account` — the existing account page that already has the "Update Payment Method" CTA (Phase 11). Link never expires, no Stripe API call needed in Inngest.
- **D-11:** Base URL constructed from `process.env.NEXT_PUBLIC_APP_URL` (already in `.env.example`). Full URL: `${NEXT_PUBLIC_APP_URL}/settings/account`. This env var is already used for Stripe portal callbacks.

### Email Templates

- **D-12:** Install `@react-email/components` and `@react-email/render` in Phase 13. Use them to build typed React Email JSX components. `@react-email/render` converts to HTML string passed to `sendEmail()`.
- **D-13:** Three dedicated template files — one per email type — at `src/lib/notifications/templates/`:
  - `LeadNotificationEmail.tsx` — for intent = 'lead'
  - `EmergencyNotificationEmail.tsx` — for intent = 'emergency' (with `EMERGENCY` prominently in subject + body)
  - `PaymentFailureEmail.tsx` — for payment failure alert
- **D-14:** Lead/emergency email content: caller phone, service type, appointment status (lead) or EMERGENCY prefix + callback number (emergency), plus a "View in Dashboard" link to `${NEXT_PUBLIC_APP_URL}/dashboard/calls`. All fields already loaded in `load-notification-data`.
- **D-15:** Payment failure email content: "PAYMENT FAILED" subject, plain message explaining deactivation timeline (72 hours), and a direct link to `${NEXT_PUBLIC_APP_URL}/settings/account`. No Stripe portal session URL.
- **D-16:** Template files have `import 'server-only'` — they render server-side and are never imported by client components.

### notification_log Integration

- **D-17:** Every email send attempt (success or failure) writes a `notification_log` row with `channel: 'email'`. Follow the established pending-before-send pattern: `writeNotificationLog` → `sendEmail()` → `updateNotificationLog`. Skipped sends (gating = false) write NO log entry.
- **D-18:** Payment failure email logs to `notification_log` with `call_id: null` — same as existing SMS/WhatsApp payment alert log pattern in `payment-alert.ts`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Inngest Functions to Modify
- `src/inngest/functions/retell-notify-dispatch.ts` — `computeChannels()` to extend + new `step.run('send-email')` to add
- `src/inngest/functions/stripe-payment-failure.ts` — `load-contractor` join to expand + new `step.run('send-email-alert')` to add

### Email Transport (Phase 12 — ready to call)
- `src/lib/notifications/email.ts` — `sendEmail({ to, subject, html })` returns `{ success, messageId?, error? }`, never throws
- `src/types/database.ts` — `NotificationSettings` type (includes `notify_email_enabled`, `email_address`, `notify_on_payment_failure` from Phase 12)

### Existing Notification Patterns
- `src/lib/notifications/log.ts` — `writeNotificationLog` / `updateNotificationLog` — pending-before-send pattern to replicate
- `src/lib/notifications/sms.ts` — non-throwing transport pattern, channel step structure
- `src/lib/notifications/payment-alert.ts` — payment alert helper (NOT modified in Phase 13)

### Test Patterns
- `tests/notifications/sms.test.ts` — `vi.mock('twilio', ...)` pattern; replicate with `vi.mock('resend', ...)` for email tests
- `tests/notifications/retell-notify-dispatch.test.ts` (or equivalent) — existing `computeChannels()` unit tests that MUST still pass after D-01/D-04 extension

### Schema and Migration Context
- `.planning/phases/12-notification-foundation/12-CONTEXT.md` — full Phase 12 decisions; `app_notifications` schema, `sendEmail()` transport interface, `notification_settings` new columns
- `.planning/ROADMAP.md` §Phase 13 — 5 success criteria, requirements EMAIL-02/03/04/05
- `.planning/REQUIREMENTS.md` — EMAIL-02, EMAIL-03, EMAIL-04 (pending), EMAIL-05 (complete in Phase 12)

### Environment Variables
- `RESEND_API_KEY` — Resend API secret (server-only, in `.env.example` from Phase 12)
- `RESEND_FROM_ADDRESS` — verified sending domain (server-only, in `.env.example` from Phase 12)
- `NEXT_PUBLIC_APP_URL` — base URL for email links (already in `.env.example` for Stripe portal)

### State and Locked Decisions
- `.planning/STATE.md` §"Key Decisions Locked (v1.1)" — Resend package versions, shouldSendEmail gating rules, React Email packages

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `writeNotificationLog` / `updateNotificationLog` (`src/lib/notifications/log.ts`): Call exactly as SMS/WhatsApp steps do — pending-before-send, update on success/failure
- `computeChannels()` (`src/inngest/functions/retell-notify-dispatch.ts` line 30): Function to extend with `shouldSendEmail` return value and two new Pick<> fields
- Existing `step.run('send-sms')` block: Structural template for the new `step.run('send-email')` block — same try/catch/log pattern
- Existing `step.run('send-payment-alert')` in `stripe-payment-failure.ts`: Reference for the new `step.run('send-email-alert')` step structure

### Established Patterns
- All notification libs: `import 'server-only'` at top — enforce in all new template files
- Non-throwing return: `sendEmail()` already matches this; Inngest steps re-throw for retry
- `notification_log` pending-before-send: `logId = await writeNotificationLog(...)`, then send, then `updateNotificationLog(logId, { status: 'sent' | 'failed' })`
- `computeChannels()` returns a flat `{ shouldSendX: boolean }` object — extend to `{ ..., shouldSendEmail: boolean }`

### Integration Points
- `retellNotifyDispatch`: Email `step.run` slots in alongside SMS/WhatsApp/Telegram, after the existing channel steps
- `stripePaymentFailureHandler`: `send-email-alert` step slots between `send-payment-alert` and `deactivate-retell-agent`
- `src/app/api/inngest/route.ts`: No changes needed — functions are already registered
- `NEXT_PUBLIC_APP_URL`: Used in `src/lib/stripe/portal.ts` already; consistent env var for email links

</code_context>

<specifics>
## Specific Ideas

- Email template naming convention: `LeadNotificationEmail`, `EmergencyNotificationEmail`, `PaymentFailureEmail` — PascalCase React components, one per file
- Emergency email must have "EMERGENCY" prominently in both subject line and body (ROADMAP success criterion 2 and EMAIL-03)
- Lead email subject: something like "New lead from [caller phone] — [service type]"
- Emergency subject: "EMERGENCY: New call from [caller phone]"
- Payment failure subject: "Action required: VoiceDesk payment failed"
- Dashboard link for call notifications: `${NEXT_PUBLIC_APP_URL}/dashboard/calls`
- Account link for payment failure: `${NEXT_PUBLIC_APP_URL}/settings/account`

</specifics>

<deferred>
## Deferred Ideas

- Email digest / daily summary — explicitly future; don't implement
- Per-contractor email unsubscribe link / compliance footer — post-PMF
- Rich HTML email with brand styling / Wolknitive design tokens — Phase 16 design sweep; Phase 13 uses minimal functional HTML
- `notify_on_general_inquiry` email toggle (separate from general `notify_email_enabled`) — not scoped, use the same flag as other channels

</deferred>

---

*Phase: 13-Email Notifications*
*Context gathered: 2026-05-25*

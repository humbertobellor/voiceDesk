# Phase 13: Email Notifications - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 13-Email Notifications
**Areas discussed:** Email gating wiring, Payment failure email, Billing portal link, Email template structure

---

## Email Gating Wiring

| Option | Description | Selected |
|--------|-------------|----------|
| Extend computeChannels() | Add shouldSendEmail to existing tested function, expand DB select. Consistent with all channels in one place. | ✓ |
| Separate shouldSendEmail() helper | New isolated function, doesn't touch existing tests. Slightly more code. | |
| You decide | Leave to planner/executor. | |

**User's choice:** Extend computeChannels()
**Notes:** Intent rules identical to SMS/Telegram (lead+emergency always, info if notify_on_general_inquiry). Expand notification_settings select in load-notification-data to include notify_email_enabled + email_address.

---

## Payment Failure Email

| Option | Description | Selected |
|--------|-------------|----------|
| New step.run('send-email-alert') in Inngest | Dedicated step after send-payment-alert. Independent retry, consistent pattern. | ✓ |
| Extend sendPaymentFailureAlert() helper | Helper accepts email params. Groups all channels in one function. | |

**Gating sub-question:**

| Option | Description | Selected |
|--------|-------------|----------|
| Triple gate (email_enabled + address + payment_failure flag) | Strongest opt-in. notify_on_payment_failure DEFAULT FALSE. | ✓ |
| Double gate (email_enabled + address only) | Simpler, but can't suppress payment emails without disabling all email. | |

**DB select sub-question:**

| Option | Description | Selected |
|--------|-------------|----------|
| Expand existing notification_settings join | Add 3 email fields to load-contractor. One round-trip. | ✓ |
| Separate DB fetch inside new step | More isolated but extra round-trip. | |

**User's choice:** New Inngest step, triple gate, expand existing join.

---

## Billing Portal Link

| Option | Description | Selected |
|--------|-------------|----------|
| Static link to /settings/account | No Stripe API call. Link never expires. Account page has Update Payment CTA. | ✓ |
| Dynamic Stripe portal session URL | Real Stripe billing portal. URLs expire in ~5 minutes. Requires Stripe API call in Inngest. | |

**Base URL sub-question:**

| Option | Description | Selected |
|--------|-------------|----------|
| NEXT_PUBLIC_APP_URL env var | Already in .env.example, used in Stripe portal callback. | ✓ |
| VERCEL_URL env var | Auto-injected on Vercel but breaks local dev. | |

**User's choice:** Static /settings/account with NEXT_PUBLIC_APP_URL base.

---

## Email Template Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated file per type | LeadNotificationEmail.tsx, EmergencyNotificationEmail.tsx, PaymentFailureEmail.tsx. Simple, no branching inside templates. | ✓ |
| Single shared template with props | One file with isEmergency/type prop. Fewer files but conditional rendering. | |

**Template location sub-question:**

| Option | Description | Selected |
|--------|-------------|----------|
| src/lib/notifications/templates/ | Co-located with sms.ts, whatsapp.ts, email.ts. | ✓ |
| src/emails/ | React Email top-level convention. Adds new top-level module for 3 files. | |

**Content sub-question:**

| Option | Description | Selected |
|--------|-------------|----------|
| Essential fields + dashboard link | Caller phone, service type, appointment status, "View in Dashboard" link. | ✓ |
| Full call details | AI summary, transcript excerpt, full appointment time. Richer but more data loading. | |

**User's choice:** Dedicated files at src/lib/notifications/templates/, essential content + dashboard link.

---

## Claude's Discretion

None — user made explicit choices on all decisions.

## Deferred Ideas

- Rich HTML email with Wolknitive brand styling — Phase 16 design sweep
- Email unsubscribe / compliance footer — post-PMF
- Per-event email toggles beyond notify_on_payment_failure — not scoped for Phase 13
- Email digest / daily summary — future requirement

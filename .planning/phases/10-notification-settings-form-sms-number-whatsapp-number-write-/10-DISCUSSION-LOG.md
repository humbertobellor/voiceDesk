# Phase 10: Notification Settings Form — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-23
**Phase:** 10-notification-settings-form-sms-number-whatsapp-number-write-
**Areas discussed:** Form scope, Email scope, Channel enable model, Telegram UI, Phone input UX, Field layout, Save UX, Migration defaults, WhatsApp Content SIDs, Dispatch update scope

---

## Form Scope

| Option | Description | Selected |
|--------|-------------|----------|
| sms_number + whatsapp_number only | Just the two fields blocking NOTIF-01/02 | |
| Phone numbers + event toggles | Add notify_on_* boolean toggles | |
| Full channel management | Phone numbers + toggles + Telegram status + channel enable/disable | ✓ |

**User's choice:** Full channel management
**Notes:** User also raised "offer user to select preferred notification channels: SMS, WhatsApp, Telegram, email" — interpreted as full channel management with explicit enable/disable per channel.

---

## Email Notifications

| Option | Description | Selected |
|--------|-------------|----------|
| Defer email to a future phase | Requires new provider, new DB column, new dispatch channel | |
| Add email to Phase 10 | Add email_address field and send alongside SMS | ✓ (user selection) |

**User's choice:** User selected "Add email to Phase 10"
**Notes:** Flagged as scope creep — email requires a new notification channel, new DB column, and email provider integration (Resend/SendGrid). Redirected and deferred to a future phase. User accepted.

---

## Channel Enable Model

| Option | Description | Selected |
|--------|-------------|----------|
| Active-when-configured | SMS fires when sms_number is set; clear to disable | |
| Explicit enable/disable per channel | Add notify_sms_enabled / notify_whatsapp_enabled / notify_telegram_enabled columns | ✓ |

**User's choice:** Add explicit enable/disable per channel
**Notes:** Requires new DB migration with three boolean columns.

---

## Telegram UI

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only status badge | Show Connected/Not connected with link to setup | |
| Status + unlink action | Connection status + Unlink button → sets telegram_chat_id = NULL | ✓ |

**User's choice:** Status + unlink action

---

## Phone Input UX

| Option | Description | Selected |
|--------|-------------|----------|
| Normalize to E.164 on save | libphonenumber-js validates + normalizes on save; US-only | ✓ |
| Accept any format, store as-is | No validation | |
| Country picker + validation | Flag + country code dropdown | |

**User's choice:** Normalize to E.164 on save (libphonenumber-js, US default region)

---

## Placeholder Text

| Option | Description | Selected |
|--------|-------------|----------|
| (305) 555-1234 | US format hint | |
| +1 (305) 555-1234 | E.164 hint with country code | ✓ |

**User's choice:** `+1 (305) 555-1234`

---

## SMS vs WhatsApp Field Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Two separate fields | Independent inputs for SMS and WhatsApp | ✓ |
| One field + 'use same for WhatsApp' checkbox | Common-case UX optimization | |

**User's choice:** Two separate fields

---

## Save Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Single Save button | All fields + toggles saved together | ✓ |
| Auto-save on blur | Each field saves individually on tab-away | |

**User's choice:** Single Save button

---

## Migration Defaults

| Option | Description | Selected |
|--------|-------------|----------|
| TRUE (opt-out model) | All channels on by default | |
| FALSE (opt-in model) | All channels start disabled | |
| Per-channel defaults | SMS=ON, WhatsApp=OFF, Telegram=OFF | ✓ |

**User's choice:** "Email and SMS are ON by default, Telegram and WhatsApp are OFF by default"
**Notes:** Email deferred, so applied: notify_sms_enabled=TRUE, notify_whatsapp_enabled=FALSE, notify_telegram_enabled=FALSE.

---

## WhatsApp Content SIDs

| Option | Description | Selected |
|--------|-------------|----------|
| Replace with env vars, defer actual values | Change to WHATSAPP_CONTENT_SID_* env vars now | |
| Leave as-is, defer entirely | Don't touch placeholders in Phase 10 | ✓ |

**User's choice:** Leave as-is, defer entirely

---

## Dispatch Function Update Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Enable flags only | Add 3 enable-flag checks to computeChannels() | ✓ |
| Also fix payment alert inconsistency | Fix stripe-payment-failure.ts using contractor.phone_number | |

**User's choice:** Enable flags only

---

## Claude's Discretion

- API route path: `PATCH /api/notification-settings`
- Telegram unlink route: `POST /api/notification-settings/telegram/unlink`
- Form component name: `NotificationSettingsForm`
- Toggle UI style: match existing conventions in the codebase
- Error handling: inline field errors for phone validation; inline/toast for save errors

## Deferred Ideas

- **Email notifications** — future phase; requires email provider integration
- **WhatsApp Content SID wiring** — when WABA approval arrives
- **Country picker for phone input** — when international contractors onboard
- **Payment alert consistency** — `stripe-payment-failure.ts` uses `contractor.phone_number` instead of `notification_settings.sms_number`; deferred to Phase 11 or standalone fix

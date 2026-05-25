# Phase 11: Account page subscription load fix + BILL-03 deactivation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-24
**Phase:** 11-account-page-subscription-load-fix-bill-03-deactivation
**Areas discussed:** Account page load bug, BILL-03 channel flags, Deactivation state, Gate logic, Trial UI, Trial date source, Middleware redirect, Reactivation flow, SMS number source

---

## Account Page — Load Bug

| Option | Description | Selected |
|--------|-------------|----------|
| Silent failure — no error shown | Fetch fails, page shows "No subscription" with no indication | ✓ |
| Trialing status missing | No color/label for trialing status | ✓ |
| Page stuck loading | useEffect hangs or prevents loaded=true | ✓ |
| Something specific | A failure mode not listed above | ✓ |

**User's choice:** All four — confirmed via code analysis: silent failure on non-ok fetch, missing trialing color treatment, duplicate loading UI (inline "Loading..." + bottom block), and the visual layout break from two simultaneous loading states.

**Notes:** Claude identified Bug 4 from code: the bottom `!loaded` block renders below the subscription card simultaneously with the inline "Loading..." text, causing a visually broken layout during fetch.

---

## BILL-03 Channel Flags

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — respect both flags | Check notify_sms_enabled and notify_whatsapp_enabled | ✓ |
| No — always alert regardless of flags | Payment failure overrides preferences | |
| Partial — always SMS, respect WhatsApp flag | SMS always, WhatsApp gated | |

**User's choice:** Respect both flags.
**Notes:** notify_sms_enabled defaults TRUE so existing contractors are unaffected. notify_whatsapp_enabled defaults FALSE so no behavior change for non-opted-in contractors.

---

## Deactivation State Column

| Option | Description | Selected |
|--------|-------------|----------|
| Add is_active boolean to contractors | Clean semantic column, agent_sync_status for its intended purpose | ✓ |
| Keep agent_sync_status workaround | No schema change, conflates sync failure with intentional deactivation | |

**User's choice:** Add is_active boolean.

---

## Gate Logic (is_active=false enforcement layers)

| Option | Description | Selected |
|--------|-------------|----------|
| Webhook handler | retell-call-classify checks is_active, returns early if false | ✓ |
| Middleware | Redirect dashboard routes to billing page | ✓ |
| Account page | Show deactivated banner | ✓ |
| All three | Enforce at every layer | ✓ |

**User's choice:** All three layers.

---

## Trial UI

| Option | Description | Selected |
|--------|-------------|----------|
| Status badge + trial end date + Manage button | Indigo badge, formatted trial_ends_at, portal CTA | ✓ |
| Status badge only | Color-code trialing, no extra info | |
| Same as active | No distinction needed | |

**User's choice:** Full trialing UI with badge, end date, and Manage button.

---

## Trial Date Source

| Option | Description | Selected |
|--------|-------------|----------|
| Store trial_ends_at in contractors via Stripe webhook | Fast DB read, set on checkout.session.completed | ✓ |
| Fetch live from Stripe API on account page load | Always accurate, adds latency and Stripe API call | |

**User's choice:** Store in DB via webhook.

---

## Middleware Redirect Target

| Option | Description | Selected |
|--------|-------------|----------|
| Account settings page with deactivated banner | Redirect to /settings/account — in the app, close to resolution | ✓ |
| Dedicated /suspended page | Separate route outside dashboard shell | |
| Pricing page | Redirect to /pricing | |

**User's choice:** /settings/account — keeps contractor in the app near the resolution action.

---

## Reactivation Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-reactivate — is_active=true + re-link Retell | subscription.updated → active triggers full reactivation | ✓ |
| Manual reactivation only | No auto-reactivation, support must act | |
| Auto-reactivate DB only, Retell re-link manual | is_active=true automatically, Retell re-link separate | |

**User's choice:** Full auto-reactivation including Retell re-link.

---

## SMS Number Source for Payment Alert

| Option | Description | Selected |
|--------|-------------|----------|
| notification_settings.sms_number if set, else contractor.phone_number | Respects dedicated notification number, falls back to account phone | ✓ |
| Always contractor.phone_number | Simple, no notification_settings dependency | |
| notification_settings.sms_number only — skip if not set | Strict opt-in | |

**User's choice:** sms_number with fallback to phone_number.

---

## Claude's Discretion

None — all decisions were made explicitly by the user.

## Deferred Ideas

None — discussion stayed within phase scope.

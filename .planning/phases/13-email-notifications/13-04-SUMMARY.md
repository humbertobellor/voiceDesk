---
phase: 13-email-notifications
plan: "04"
subsystem: notifications
tags: [tdd, wave-3, email, inngest, retell-notify-dispatch, stripe-payment-failure]
dependency_graph:
  requires:
    - "13-02 (React Email templates: LeadNotificationEmail, EmergencyNotificationEmail, PaymentFailureEmail)"
    - "13-03 (computeChannels() extended with shouldSendEmail)"
  provides:
    - "step.run('send-email') in retellNotifyDispatch — pending-before-send logging, correct template per intent"
    - "step.run('send-email-alert') in stripePaymentFailureHandler — triple-gate, callId: null logging"
    - "tests/notifications/notify-dispatch.test.ts — 2 new email dispatch tests (success + failure paths)"
    - "tests/inngest/stripe-payment-failure-email.test.ts — 2 triple-gate tests (pre-existing, remain GREEN)"
  affects:
    - "EMAIL-02, EMAIL-03, EMAIL-04, EMAIL-05 requirements — all satisfied"
tech_stack:
  added: []
  patterns:
    - "Static imports at file top per D-06 (sendEmail, render, templates)"
    - "Pending-before-send notification_log pattern: writeNotificationLog (pending) → sendEmail → updateNotificationLog (sent/failed)"
    - "Triple-gate pattern for payment failure email: email_address != null AND notify_email_enabled AND notify_on_payment_failure"
    - "callId: null for payment failure emails per D-18"
    - "await render() — @react-email/render@2.0.8 returns Promise<string>, not string"
key_files:
  created: []
  modified:
    - "src/inngest/functions/retell-notify-dispatch.ts (send-email step + static imports)"
    - "src/inngest/functions/stripe-payment-failure.ts (send-email-alert step + expanded DB select + static imports)"
    - "tests/notifications/notify-dispatch.test.ts (email dispatch mocks + 2 new tests)"
decisions:
  - "await render() required — @react-email/render@2.0.8 returns Promise<string>, not synchronous string (plan note was incorrect — fixed as Rule 1 deviation)"
  - "Static imports at file top (not dynamic imports inside step.run) per D-06 pattern from 13-CONTEXT.md"
  - "PaymentFailureEmail step logs callId: null per D-18 — payment failure is not call-related"
metrics:
  duration: "~4 minutes"
  completed_date: "2026-05-25T07:53:47Z"
  tasks_completed: 2
  files_changed: 3
---

# Phase 13 Plan 04: Wire Email Send Steps into Inngest Functions

**One-liner:** Wired step.run('send-email') into retellNotifyDispatch and step.run('send-email-alert') into stripePaymentFailureHandler with triple-gate, pending-before-send logging, and await render() fix — completing Phase 13 email notification delivery.

## What Was Built

**Task 1 — send-email step in retellNotifyDispatch**

Changes to `src/inngest/functions/retell-notify-dispatch.ts`:

| Change | Description |
|--------|-------------|
| Static imports | sendEmail, render, LeadNotificationEmail, EmergencyNotificationEmail added at file top |
| send-email step | Inserted after send-telegram block; gated by shouldSendEmail |
| Email subject | `EMERGENCY: New call from {callerPhone}` for emergencies; `New lead from {callerPhone} — {serviceRequested}` for leads/info |
| Template selection | isEmergency → EmergencyNotificationEmail; else → LeadNotificationEmail with bookingStatus as appointmentStatus |
| dashboardUrl | `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/calls` |
| Logging | channel='email', recipient=settings.email_address, pending-before-send pattern |
| Error handling | Re-throws on sendEmail failure for Inngest retry |

Changes to `tests/notifications/notify-dispatch.test.ts`:

- Added vi.mock for sendEmail, @react-email/render, LeadNotificationEmail, EmergencyNotificationEmail
- Added imports for sendEmail, writeNotificationLog, updateNotificationLog
- Added 2 new tests in `email dispatch` describe block:
  - Test A: sendEmail success → writeNotificationLog(channel='email'), updateNotificationLog(status='sent')
  - Test B: sendEmail failure → updateNotificationLog(status='failed'), step re-throws

**Task 2 — send-email-alert step in stripePaymentFailureHandler**

Changes to `src/inngest/functions/stripe-payment-failure.ts`:

| Change | Description |
|--------|-------------|
| Static imports | sendEmail, writeNotificationLog, updateNotificationLog, render, PaymentFailureEmail added at file top |
| DB select expanded | notification_settings select now includes email_address, notify_email_enabled, notify_on_payment_failure |
| send-email-alert step | Inserted after send-payment-alert, before deactivate-retell-agent |
| Triple-gate | !ns?.email_address OR !ns?.notify_email_enabled OR !ns?.notify_on_payment_failure → return early (no log) |
| billingUrl | `${process.env.NEXT_PUBLIC_APP_URL}/settings/account` |
| Logging | callId: null per D-18, channel='email', pending-before-send pattern |
| Email subject | "Action required: VoiceDesk payment failed" |

## Test Results

| Suite | Before Plan | After Plan | Delta |
|-------|-------------|------------|-------|
| notify-dispatch.test.ts | 17 GREEN | 19 GREEN | +2 |
| stripe-payment-failure-email.test.ts | 2 GREEN | 2 GREEN | 0 (pre-existing) |
| Full suite passing | 175 | 177 | +2 |
| Full suite failing (pre-existing RED) | 31 | 31 | 0 |

## Task Commits

1. **a477d2d** — `feat(13-04): add send-email step to retellNotifyDispatch`
2. **e94f32f** — `feat(13-04): add send-email-alert step to stripePaymentFailureHandler`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] await render() — @react-email/render@2.0.8 returns Promise<string>**
- **Found during:** Task 2 TypeScript typecheck (`npx tsc --noEmit`)
- **Issue:** Plan note stated "render() in @react-email/render v2.x is synchronous". Actual package at v2.0.8 returns `Promise<string>`. TypeScript reported `TS2322: Type 'Promise<string>' is not assignable to type 'string'` at `html: emailHtml` in both files. Runtime verification confirmed: `render(null)` returns a Promise.
- **Fix:** Changed `const emailHtml = render(...)` to `const emailHtml = await render(...)` in both retell-notify-dispatch.ts and stripe-payment-failure.ts.
- **Files modified:** `src/inngest/functions/retell-notify-dispatch.ts`, `src/inngest/functions/stripe-payment-failure.ts`
- **Commit:** e94f32f

## Threat Model Coverage

| Threat ID | Mitigation Applied |
|-----------|-------------------|
| T-13-04-01 | contractorId loaded from DB (not from event payload email field); validated before dispatch |
| T-13-04-03 | retries: 5 / retries: 3 already set; sendEmail never-throws contract means config errors return success=false on first call |
| T-13-04-04 | Every email attempt writes pending row before send, updated to sent/failed after — full audit trail |

## Known Stubs

None — both email send steps wire real sendEmail() transport with actual templates. No hardcoded placeholder content in any email path.

## Threat Flags

None — no new network endpoints or auth paths. Email dispatch runs in existing Inngest function step boundaries with service role client (already established pattern).

## Requirements Satisfied

- EMAIL-02: Lead email dispatch via step.run('send-email') in retellNotifyDispatch — DONE
- EMAIL-03: Emergency email dispatch (EMERGENCY prefix in subject + EmergencyNotificationEmail template) — DONE
- EMAIL-04: Payment failure email dispatch via step.run('send-email-alert') in stripePaymentFailureHandler — DONE
- EMAIL-05: notification_log entries with channel='email' for all email sends — DONE

## Self-Check: PASSED

- [x] `src/inngest/functions/retell-notify-dispatch.ts` contains `step.run('send-email'`: VERIFIED (grep returns 1)
- [x] `src/inngest/functions/stripe-payment-failure.ts` contains `step.run('send-email-alert'`: VERIFIED (grep returns 1)
- [x] `channel: 'email'` in retell-notify-dispatch.ts: VERIFIED (grep returns 1)
- [x] `callId: null` in stripe-payment-failure.ts: VERIFIED (grep returns 1)
- [x] `retell-notify-dispatch.ts` imports sendEmail from '@/lib/notifications/email': VERIFIED
- [x] `retell-notify-dispatch.ts` imports render from '@react-email/render': VERIFIED
- [x] `stripe-payment-failure.ts` load-contractor select includes email_address, notify_email_enabled, notify_on_payment_failure: VERIFIED
- [x] `stripe-payment-failure.ts` imports sendEmail, writeNotificationLog, updateNotificationLog, render, PaymentFailureEmail: VERIFIED
- [x] `notify-dispatch.test.ts` 19 tests GREEN: VERIFIED
- [x] `stripe-payment-failure-email.test.ts` 2 tests GREEN: VERIFIED
- [x] `npx tsc --noEmit` exits 0: VERIFIED
- [x] Commit a477d2d (Task 1): FOUND
- [x] Commit e94f32f (Task 2): FOUND

---
*Phase: 13-email-notifications*
*Completed: 2026-05-25*

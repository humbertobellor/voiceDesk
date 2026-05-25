---
phase: 13-email-notifications
reviewed: 2026-05-25T00:00:00Z
depth: deep
files_reviewed: 10
files_reviewed_list:
  - package.json
  - src/inngest/functions/retell-notify-dispatch.ts
  - src/inngest/functions/stripe-payment-failure.ts
  - src/lib/notifications/templates/EmergencyNotificationEmail.tsx
  - src/lib/notifications/templates/LeadNotificationEmail.tsx
  - src/lib/notifications/templates/PaymentFailureEmail.tsx
  - tests/inngest/computeChannels-email.test.ts
  - tests/inngest/stripe-payment-failure-email.test.ts
  - tests/notifications/notify-dispatch.test.ts
  - tests/notifications/templates.test.ts
findings:
  critical: 2
  warning: 4
  info: 1
  total: 7
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-05-25T00:00:00Z
**Depth:** deep
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 13 adds email notification channels to the existing multi-channel dispatch infrastructure. The core logic in `computeChannels` and the three React Email templates is sound. The primary concerns are: a broken URL fallback pattern that diverges from the project's own established convention, a `render()` placement inconsistency between the two Inngest functions that produces an untraceable render failure in `stripe-payment-failure.ts`, and a test file that tests a shadow copy of the gate predicate rather than the implementation itself, leaving the actual gate untested.

---

## Critical Issues

### CR-01: `NEXT_PUBLIC_APP_URL` used without fallback or guard — produces `"undefined/..."` links

**File:** `src/inngest/functions/retell-notify-dispatch.ts:342`
**Also:** `src/inngest/functions/stripe-payment-failure.ts:114`

**Issue:** Both Inngest functions construct email CTA URLs directly from `process.env.NEXT_PUBLIC_APP_URL` with no null guard and no fallback:

```ts
// retell-notify-dispatch.ts:342
const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/calls`

// stripe-payment-failure.ts:114
const billingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/settings/account`
```

`NEXT_PUBLIC_*` variables are inlined by Next.js at build time for the browser bundle. In Inngest worker contexts (server-side, separate process), `NEXT_PUBLIC_APP_URL` may be `undefined` at runtime if the deployment does not explicitly export it as a server-side env var. When undefined, JavaScript template literals produce `"undefined/dashboard/calls"` — a silently broken link delivered to contractors in the email body.

The project already has the correct pattern in two other files:

```ts
// src/lib/stripe/checkout.ts:49
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL
if (!appUrl) throw new Error('APP_URL or NEXT_PUBLIC_APP_URL is not set')

// src/app/api/stripe/portal/route.ts:59
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL
```

**Fix:** Apply the same pattern as the rest of the codebase:

```ts
// retell-notify-dispatch.ts — inside send-email step
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL
if (!appUrl) {
  throw new Error('[retell-notify-dispatch] NEXT_PUBLIC_APP_URL / APP_URL env var is not set')
}
const dashboardUrl = `${appUrl}/dashboard/calls`
```

```ts
// stripe-payment-failure.ts — inside send-email-alert step
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL
if (!appUrl) {
  throw new Error('[stripe-payment-failure] NEXT_PUBLIC_APP_URL / APP_URL env var is not set')
}
const billingUrl = `${appUrl}/settings/account`
```

---

### CR-02: `render()` called outside `try/catch` in `stripe-payment-failure.ts` — render failures leave no audit log

**File:** `src/inngest/functions/stripe-payment-failure.ts:117`

**Issue:** In `stripe-payment-failure.ts`, `render()` is called before the `try/catch` block that manages `logId`:

```ts
// stripe-payment-failure.ts:117
const emailHtml = await render(PaymentFailureEmail({ billingUrl }))

let logId: string | null = null
try {
  logId = await writeNotificationLog(...)
  ...
} catch (err) {
  if (logId) { /* update log to failed */ }
  throw err
}
```

If `render()` throws (template bug, malformed JSX, React rendering error), the step re-throws with no `notification_log` row ever written. Inngest will retry the step, but every retry attempt is invisible in the audit log. This directly contradicts the D-12 design requirement ("Write row BEFORE send — ensures log entry exists even if process crashes").

The sibling function `retell-notify-dispatch.ts:349` correctly places `render()` inside the `try` block, so `logId` gets written before the render call can fail on retry.

**Fix:** Move `render()` inside the `try` block, consistent with `retell-notify-dispatch.ts`:

```ts
let logId: string | null = null
try {
  const emailHtml = await render(PaymentFailureEmail({ billingUrl }))

  logId = await writeNotificationLog({
    contractorId,
    callId: null,
    channel: 'email',
    recipient: ns.email_address,
    message: 'Payment failure alert',
  })

  const result = await sendEmail({ ... })
  ...
} catch (err: unknown) {
  if (logId) {
    await updateNotificationLog(logId, { status: 'failed', error: ... })
  }
  throw err
}
```

---

## Warnings

### WR-01: `stripe-payment-failure-email.test.ts` tests an inline shadow predicate, not the implementation

**File:** `tests/inngest/stripe-payment-failure-email.test.ts:32`

**Issue:** The test file defines its own `shouldSendPaymentFailureEmail()` function as an inline copy of the gate predicate and tests that copy. It does not import `stripePaymentFailureHandler` or the actual gate logic from `stripe-payment-failure.ts`. This means the test can pass even if the real implementation has a divergent gate (e.g., uses `!=` instead of `!==`, checks fields in a different order, or has a typo in a field name).

Additionally, only 2 of the 5 meaningful gate combinations are covered (all-true, and `notify_on_payment_failure=false`). Missing cases: `email_address=null`, `notify_email_enabled=false`, and `ns=null/undefined`.

**Fix:** Either:
1. Export the gate predicate from `stripe-payment-failure.ts` and import it in the test, or
2. Write an integration test that invokes the actual `step.run('send-email-alert')` closure, or
3. At minimum, add the 3 missing gate combinations to the inline test.

Suggested missing test cases:
```ts
it('email_address=null → should not send', () => {
  expect(shouldSendPaymentFailureEmail({ email_address: null, notify_email_enabled: true, notify_on_payment_failure: true })).toBe(false)
})
it('notify_email_enabled=false → should not send', () => {
  expect(shouldSendPaymentFailureEmail({ email_address: 'a@b.com', notify_email_enabled: false, notify_on_payment_failure: true })).toBe(false)
})
it('ns=null → should not send', () => {
  expect(shouldSendPaymentFailureEmail(null)).toBe(false)
})
```

---

### WR-02: `info` intent emails incorrectly rendered and titled as "New Lead"

**File:** `src/inngest/functions/retell-notify-dispatch.ts:344-352`

**Issue:** The `isEmergency` flag is the only branch condition for email template and subject selection. For `intent === 'info'`, `isEmergency` is `false`, so the code selects `LeadNotificationEmail` (header: "New Lead Received") and the subject line "New lead from...":

```ts
const emailSubject = isEmergency
  ? `EMERGENCY: New call from ${callerPhone}`
  : `New lead from ${callerPhone} — ${serviceRequested}`   // ← "lead" for info calls too

const emailHtml = await render(
  isEmergency
    ? EmergencyNotificationEmail(...)
    : LeadNotificationEmail(...)   // ← "New Lead Received" header for info calls too
)
```

A contractor who opted in to `notify_on_general_inquiry` and receives a general inquiry email will see "New Lead Received" in the header and "New lead from..." in the subject, which is factually incorrect (it was a general inquiry, not a lead).

**Fix:** Add a three-way branch (or at minimum fix the subject line):

```ts
const emailSubject = intent === 'emergency'
  ? `EMERGENCY: New call from ${callerPhone}`
  : intent === 'lead'
    ? `New lead from ${callerPhone} — ${serviceRequested}`
    : `New inquiry from ${callerPhone} — ${serviceRequested}`
```

For the template: either create an `InfoNotificationEmail` or reuse `LeadNotificationEmail` with a dynamic header prop. At minimum, the subject line fix avoids the most visible user-facing inaccuracy.

---

### WR-03: No test verifies which email template is selected based on call intent

**File:** `tests/notifications/notify-dispatch.test.ts`

**Issue:** Both `LeadNotificationEmail` and `EmergencyNotificationEmail` are mocked as `vi.fn(() => null)`. The test suite never asserts that:
- `EmergencyNotificationEmail` is called for `intent='emergency'`
- `LeadNotificationEmail` is called for `intent='lead'` or `intent='info'`

If the template selection conditional were inverted (emergency → LeadNotificationEmail, lead → EmergencyNotificationEmail), no existing test would catch it. This is the highest-risk untested path given that emergency notifications have contractual urgency requirements (EMRG-03).

**Fix:** Add assertions in the email dispatch tests:

```ts
import { LeadNotificationEmail } from '@/lib/notifications/templates/LeadNotificationEmail'
import { EmergencyNotificationEmail } from '@/lib/notifications/templates/EmergencyNotificationEmail'
const mockLeadEmail = vi.mocked(LeadNotificationEmail)
const mockEmergencyEmail = vi.mocked(EmergencyNotificationEmail)

// In the emergency email test:
expect(mockEmergencyEmail).toHaveBeenCalledWith(expect.objectContaining({ callerPhone, serviceRequested }))
expect(mockLeadEmail).not.toHaveBeenCalled()

// In the lead email test:
expect(mockLeadEmail).toHaveBeenCalledWith(expect.objectContaining({ callerPhone, serviceRequested, appointmentStatus: expect.any(String) }))
expect(mockEmergencyEmail).not.toHaveBeenCalled()
```

---

### WR-04: `stripeCustomerId` destructured as required but never validated; logs "undefined" if absent

**File:** `src/inngest/functions/stripe-payment-failure.ts:39-55`

**Issue:** `contractorId` is validated with a `NonRetriableError` guard. `stripeCustomerId` is typed as `string` (non-optional) but never validated. If the Stripe webhook sends an event without `stripeCustomerId` (malformed event), the function continues silently and logs `"undefined"` in the audit trail:

```ts
console.log(`...Processing payment failure for contractor ${contractorId} (customer: ${stripeCustomerId}).`)
// → "...customer: undefined..." when stripeCustomerId is absent
```

This degrades the audit log quality and could hide misconfigured webhook payloads.

**Fix:** Add a guard, or at minimum use `stripeCustomerId ?? 'unknown'` consistently:

```ts
const { contractorId, stripeCustomerId, failureReason } = event.data as {
  contractorId: string
  stripeCustomerId?: string   // mark optional to reflect reality
  failureReason?: string
}

console.log(
  `[stripe-payment-failure] Processing payment failure for contractor ${contractorId} (customer: ${stripeCustomerId ?? 'unknown'}). Reason: ${failureReason ?? 'unknown'}`
)
```

---

## Info

### IN-01: `makeSettings` and `makeSettingsWithEnableFlags` are near-identical helpers with different defaults

**File:** `tests/notifications/notify-dispatch.test.ts:49-149`

**Issue:** Two helper functions exist with almost the same shape, differing only in the default values for `notify_whatsapp_enabled` and `notify_telegram_enabled` (`true` vs `false`). The difference is intentional (legacy Phase 5 tests expect the old defaults), but the duplication adds maintenance overhead — when new `NotificationSettings` fields are added, both functions must be updated in sync. Phase 13 email fields were added to both correctly, but this pattern will re-appear for every future phase that extends `NotificationSettings`.

**Fix:** Consolidate into one helper with a comment explaining the two call-site default regimes, or rename to make the intent explicit (e.g., `makeSettingsLegacy` / `makeSettingsStrict`). Not urgent but reduces future maintenance risk.

---

_Reviewed: 2026-05-25T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

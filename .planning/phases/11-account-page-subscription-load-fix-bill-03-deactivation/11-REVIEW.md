---
phase: 11
status: fixed
depth: deep
reviewed_at: 2026-05-24
files_reviewed: 11
files_reviewed_list:
  - middleware.ts
  - src/app/(dashboard)/settings/account/page.tsx
  - src/app/api/stripe/subscription/route.ts
  - src/app/api/webhooks/stripe/handlers.ts
  - src/inngest/functions/retell-call-classify.ts
  - src/inngest/functions/stripe-payment-failure.ts
  - src/lib/notifications/payment-alert.ts
  - src/types/database.ts
  - supabase/migrations/20260524000016_phase11_is_active_trial_ends_at.sql
  - tests/lib/retell-call-classify.test.ts
  - tests/notifications/payment-alert.test.ts
findings:
  critical: 2
  warning: 5
  info: 2
  total: 9
---

# Phase 11: Code Review Report

**Reviewed:** 2026-05-24
**Depth:** deep
**Files Reviewed:** 11
**Status:** findings

## Summary

Phase 11 introduces `is_active` deactivation enforcement, `trial_ends_at` storage, and account page fixes. The implementation is mostly well-structured with correct idempotency patterns and proper channel-flag gating. However, two critical bugs were found: the deactivation gate in middleware only covers one URL prefix and misses all portal pages under `/settings/*`, `/calls`, and `/leads`; and the `customer.subscription.updated` idempotency key is the subscription ID, which means the reactivation handler will be silently skipped any time a repeat subscription.updated event arrives for a subscription that already processed once. There are also several warnings around unchecked DB update errors, a type violation on `'unknown'` subscription status, a spurious Stripe type cast for `trial_ends_at`, and a false audit log entry when SMS delivery actually fails.

---

## Critical Issues

### CR-01: Middleware `is_active` gate only covers `/dashboard` — all other portal routes bypass it

**File:** `middleware.ts:53-66`

**Issue:** The `is_active === false` redirect guard is nested inside `if (user && path.startsWith('/dashboard'))`. However, the actual portal routes in the `(dashboard)` route group are `/calls`, `/leads`, `/connect-calendar`, `/settings/agent`, `/settings/calendar`, `/settings/phone`, `/settings/go-live`, and `/settings/notifications` — none of which start with `/dashboard`. Only the literal `/dashboard` landing page path triggers this block. A deactivated contractor can freely browse `/calls`, `/leads`, and every settings page other than account.

The Sidebar confirms the actual hrefs: `'/calls'`, `'/leads'`, `'/settings/agent'`, `'/settings/calendar'`, `'/settings/phone'`, `'/settings/go-live'`, `'/settings/notifications'`, `'/settings/account'`. The `/dashboard` path prefix covers only the dashboard home page.

**Fix:** Extend the guard condition to cover all portal routes. The matcher already excludes `_next/static`, `_next/image`, and API routes, so a broadened check is safe:

```typescript
// Replace the single path.startsWith('/dashboard') condition with a helper
// that covers all routes inside the (dashboard) route group.
const isDashboardRoute =
  path.startsWith('/dashboard') ||
  path.startsWith('/calls') ||
  path.startsWith('/leads') ||
  path.startsWith('/settings') ||
  path.startsWith('/connect-calendar')

if (user && isDashboardRoute) {
  const { data: contractor } = await supabase
    .from('contractors')
    .select('phone_number, is_active')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!contractor?.phone_number) {
    return NextResponse.redirect(new URL('/setup/phone', request.url))
  }
  // D-09: Deactivated contractor — redirect to account page
  // Exempt /settings/account itself to prevent redirect loop
  if (contractor.is_active === false && !path.startsWith('/settings/account')) {
    return NextResponse.redirect(new URL('/settings/account', request.url))
  }
}
```

Note: the unauthenticated guard on line 33 also only checks `/dashboard` and `/setup`. If the intent is to gate ALL portal routes, that condition needs the same expansion.

---

### CR-02: `handleSubscriptionUpdated` idempotency key is subscription ID — deduplicates all future events for the same subscription, silently dropping reactivation

**File:** `src/app/api/webhooks/stripe/handlers.ts:195-202`

**Issue:** `checkAndInsertIdempotency` is called with `subscription.id` as `external_id` and `'customer.subscription.updated'` as `event_type`. The unique constraint is on `(source, event_type, external_id)`. Stripe's `customer.subscription.updated` event fires repeatedly over the lifecycle of a subscription — whenever the status changes (trial → active, active → past_due, past_due → active on recovery). Every one of these events carries the same subscription ID.

Once the first `customer.subscription.updated` event is processed (e.g., `trialing → active` on checkout), the `(stripe, customer.subscription.updated, sub_XXXXXX)` row is in `webhook_events`. Every subsequent status change fires the same event type with the same subscription ID. The unique constraint returns `23505`, the function returns early, and the reactivation path (D-10) is silently skipped.

The correct deduplication key for subscription events should be the **Stripe event ID** (the `evt_...` ID), not the subscription ID. The event ID is unique per webhook delivery. The subscription route does this correctly — callers pass `session.id` or `invoice.id` as `external_id`, both of which are unique per event occurrence.

**Fix:** Pass the Stripe event ID as `external_id`. The event object is available in the route handler and can be threaded through to the handlers, or the handlers can accept it as a parameter:

```typescript
// In route.ts, thread the event ID:
case 'customer.subscription.updated':
  await handleSubscriptionUpdated(
    event.data.object as Subscription,
    event.id  // Stripe event ID — unique per delivery
  )
  break

// In handlers.ts, accept and use it:
export async function handleSubscriptionUpdated(
  subscription: Subscription,
  stripeEventId: string
) {
  const isNew = await checkAndInsertIdempotency(
    'stripe',
    'customer.subscription.updated',
    stripeEventId,  // evt_XXXXX — unique per delivery, not sub_XXXXX
    subscription
  )
  if (!isNew) return
  // ...
}
```

The same fix should be applied to `handleCheckoutCompleted` and `handlePaymentFailed` for consistency (though those event types are less likely to repeat with the same object ID).

---

## Warnings

### WR-01: `handleCheckoutCompleted` DB update errors are silently swallowed

**File:** `src/app/api/webhooks/stripe/handlers.ts:101-115`

**Issue:** The `await db.from('contractors').update({...}).eq('id', contractorId)` call has no error check. If the update fails (network error, constraint violation, contractor row deleted), the function completes without logging or throwing. Stripe will receive a 200 from the webhook route (the route itself returned 200 before `after()` ran), and the contractor record will be left in an inconsistent state with no trace of the failure.

**Fix:**
```typescript
const { error: updateError } = await db
  .from('contractors')
  .update({
    stripe_customer_id: session.customer as string,
    stripe_subscription_id: session.subscription as string,
    subscription_status: 'trialing',
    subscription_tier: subscriptionTier,
    trial_ends_at: trialEndsAt,
  })
  .eq('id', contractorId)

if (updateError) {
  console.error(
    `[webhook/stripe] handleCheckoutCompleted: DB update failed for contractor ${contractorId}:`,
    updateError.message
  )
  throw new Error(updateError.message)  // propagates to after() catch block for logging
}
```

---

### WR-02: `handleSubscriptionUpdated` writes `'unknown'` to `subscription_status`, violating the `SubscriptionStatus` type

**File:** `src/app/api/webhooks/stripe/handlers.ts:218-224`

**Issue:** The `default` case in the switch assigns `internalStatus = 'unknown'`. This value is then written directly to `contractors.subscription_status`. The `SubscriptionStatus` type in `database.ts:6` is `'trialing' | 'active' | 'past_due' | 'canceled'` — `'unknown'` is not a member. TypeScript does not catch this because `internalStatus` is typed as `string`. Any code that reads `contractor.subscription_status` and compares against the `SubscriptionStatus` union will behave unexpectedly with an `'unknown'` value.

Stripe statuses that could reach the default case include `'incomplete'`, `'incomplete_expired'` (wait — `'incomplete_expired'` is handled), `'paused'`. For `incomplete`, the contractor would get `subscription_status='unknown'` written to DB.

**Fix:** Map unknown Stripe statuses to a safe internal value, or skip the update if the status cannot be mapped:

```typescript
default:
  // Stripe statuses not mapped to internal (e.g., 'incomplete', 'paused')
  // Do not write an invalid value — log and skip the status update.
  console.warn(
    `[webhook/stripe] handleSubscriptionUpdated: unmapped Stripe status "${subscription.status}" ` +
    `for contractor ${contractorId} — skipping subscription_status update`
  )
  return
```

---

### WR-03: `checkout.session.completed` `subscription_data.trial_end` extraction always returns `undefined`

**File:** `src/app/api/webhooks/stripe/handlers.ts:94-98`

**Issue:** The code casts the session to a local type with `subscription_data?: { trial_end?: number | null }` and reads `session.subscription_data?.trial_end`. In the Stripe `checkout.session.completed` webhook payload, `subscription_data` on a `Checkout.Session` is the object passed at session creation time — it contains `trial_period_days` and `metadata`, but **not** `trial_end`. The `trial_end` timestamp is a property of the resulting `Stripe.Subscription` object, not of the session's `subscription_data`.

The type cast masks a type error: `Stripe.Checkout.Session.subscription_data` is of type `Stripe.Checkout.Session.SubscriptionData | null` and has no `trial_end` field. `rawTrialEnd` will always be `undefined`, so `trialEndsAt` will always be `null` in this path.

This is partially mitigated by the `handleSubscriptionUpdated` primary path (D-04 comment), but the fallback is misleading and introduces dead code that gives the false impression it handles a real case.

**Fix:** Remove the dead fallback extraction. The comment says this is a secondary/best-effort path, but it never works. Either retrieve the subscription ID from `session.subscription` and fetch `trial_end` from the Stripe API, or remove the extraction and rely solely on `handleSubscriptionUpdated`:

```typescript
// D-04: trial_ends_at is reliably set by handleSubscriptionUpdated (primary path).
// The checkout.session.completed payload does not include subscription.trial_end —
// that field lives on the Stripe Subscription object, not the CheckoutSession.
// No secondary extraction here; handleSubscriptionUpdated covers it.
const trialEndsAt = null
```

---

### WR-04: `payment-alert.ts` logs `smsSent=true` in audit DB even when `sendSms` throws

**File:** `src/lib/notifications/payment-alert.ts:112-120`

**Issue:** `logPaymentAlertToDb` is called with `smsSent: smsEnabled && !!smsNumber` (line 117). This is evaluated before `sendSms` completes and independently of whether it throws. If `sendSms` throws at line 75 (caught by the try/catch at 74-82, which merely logs and continues), `smsSent` is still `true` in the audit log. The `notification_log` table will record a `status: 'sent'` entry for an SMS that was never delivered. This is a false audit record.

**Fix:** Track actual send outcome with a result variable:

```typescript
let smsSentActual = false
let whatsappSentActual = false

if (smsEnabled && smsNumber) {
  try {
    await sendSms(smsParams)
    smsSentActual = true
  } catch (err) {
    console.error(`[payment-alert] SMS send failed ...`, ...)
  }
}

// ... WhatsApp equivalent ...

await logPaymentAlertToDb({
  contractorId,
  smsNumber: smsSentActual ? smsNumber : null,
  smsSent: smsSentActual,
  whatsappNumber: whatsappSentActual ? whatsappNumber : null,
  whatsappSent: whatsappSentActual,
  smsBody,
})
```

---

### WR-05: `handleSubscriptionUpdated` second DB UPDATE for `trial_ends_at` is unguarded against errors

**File:** `src/app/api/webhooks/stripe/handlers.ts:256-264`

**Issue:** The `trial_ends_at` update (lines 257-261) runs in a separate `await db.from('contractors').update(...)` call with no error check — mirroring the same pattern as WR-01. If this second update fails, `subscription_status` will be `'trialing'` but `trial_ends_at` will remain `null`, causing the account page to show "trialing" without a trial end date even though one should be displayed.

**Fix:** Check and log the error from the second update, and consider merging both updates into a single DB call when `internalStatus === 'trialing'`:

```typescript
// Merge into first update when trialing
await db
  .from('contractors')
  .update({
    subscription_status: internalStatus,
    stripe_subscription_id: subscription.id,
    ...(internalStatus === 'trialing' && subscription.trial_end
      ? { trial_ends_at: new Date(subscription.trial_end * 1000).toISOString() }
      : {}),
  })
  .eq('id', contractorId)
```

---

## Info

### IN-01: Test handler extraction is fragile against Inngest SDK version changes

**File:** `tests/lib/retell-call-classify.test.ts:90, 146, 165`

**Issue:** `(retellCallClassify as any).fn ?? (retellCallClassify as any).handler ?? retellCallClassify` uses reflection on Inngest internals that are not part of the public API. If the Inngest SDK changes how it exposes the handler, all three tests will silently call the function object itself (which is not the handler), and the test will pass vacuously without actually executing the production code path.

**Fix:** Expose a named exported handler function from `retell-call-classify.ts` that can be tested directly, separate from the Inngest function registration. Tests can import and call the handler directly without touching Inngest internals.

---

### IN-02: `SubscriptionStatus` type missing `'unknown'` variant breaks type safety end-to-end

**File:** `src/types/database.ts:6`

**Issue:** Related to WR-02 — `SubscriptionStatus` does not include `'unknown'`, but `handleSubscriptionUpdated` can write that string to the DB. Even if WR-02 is fixed to not write `'unknown'`, the type definition is the authoritative contract. Adding `'unknown'` as a declared member (or auditing all enum consumers) would prevent silent type mismatches from future handlers.

This is an INFO item if WR-02 is fixed (the value is never written), but becomes a BLOCKER if it is not.

**Fix (if keeping the `'unknown'` default case as a sentinel):** Add it to the type union:
```typescript
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unknown'
```
Or, fix WR-02 and remove `'unknown'` from the switch entirely.

---

## Recommendations

1. **Fix CR-01 before deploying.** The deactivation enforcement has a near-complete bypass — only `/dashboard` is gated. Every other contractor-facing page is fully accessible to deactivated accounts. This also applies to the unauthenticated redirect on line 33 if the intent is to gate all portal routes.

2. **Fix CR-02 before deploying.** The subscription idempotency key being the subscription ID means the reactivation flow (D-10) is unreachable after the first `customer.subscription.updated` event. Thread the Stripe event `evt_...` ID through to `checkAndInsertIdempotency` as `external_id` for this event type.

3. **WR-01 and WR-05 should be fixed together** — both are unchecked DB update errors in the same file, and fixing one without the other leaves the same silent failure pattern in place.

4. **WR-03** (dead `subscription_data.trial_end` extraction) is low risk since the primary path in `handleSubscriptionUpdated` covers it, but the dead code creates misleading documentation and should be removed.

5. **WR-04** (false audit entry) is a data integrity issue in the notification log — low operational risk but breaks the audit guarantee cited in T-07-05-01.

---

_Reviewed: 2026-05-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

# Phase 11: Account page subscription load fix + BILL-03 deactivation - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Two targeted fixes: (1) repair the account page subscription load — silent failure, missing trialing UI, duplicate loading states — and store `trial_ends_at` via Stripe webhook; (2) update BILL-03 deactivation to respect Phase 10's channel-enable flags, introduce a proper `is_active` boolean, and implement auto-reactivation when payment recovers.

</domain>

<decisions>
## Implementation Decisions

### Account Page — Subscription Load Fix

- **D-01:** Show an explicit error state when the `/api/stripe/subscription` fetch fails or returns non-ok. "No subscription" must not appear for load errors — differentiate "no subscription" from "failed to load".
- **D-02:** Add `trialing` status display: indigo/blue badge, trial end date formatted from `trial_ends_at` (stored in contractors table), and a "Manage" portal button CTA so contractors can add payment before trial ends.
- **D-03:** Remove the duplicate loading state. The bottom `!loaded && <div>Loading subscription details...</div>` block (`account/page.tsx:132-136`) conflicts with the inline `'Loading...'` text in the status card. Keep the inline loading text only.
- **D-04:** `trial_ends_at` stored in the `contractors` table (TIMESTAMPTZ, nullable). Set by Stripe `checkout.session.completed` webhook when `subscription.trial_end` is present. Account page reads from DB — no extra Stripe API call.

### BILL-03 Deactivation — Phase 10 Integration

- **D-05:** Payment failure alert respects Phase 10 channel flags:
  - Gate SMS on `notify_sms_enabled = true` (default TRUE — existing contractors unaffected)
  - Gate WhatsApp on `notify_whatsapp_enabled = true` (default FALSE — no change in behavior for contractors who haven't opted in)
  - SMS number source: use `notification_settings.sms_number` if set, else fall back to `contractor.phone_number`
  - WhatsApp number source: `notification_settings.whatsapp_number` (current — unchanged)
- **D-06:** `stripe-payment-failure.ts` load-contractor step must select `notification_settings(sms_number, whatsapp_number, notify_sms_enabled, notify_whatsapp_enabled)` to support D-05.

### Deactivation State — is_active Column

- **D-07:** Add `is_active BOOLEAN NOT NULL DEFAULT TRUE` to the `contractors` table via migration. `agent_sync_status` reverts to its intended purpose (Retell sync state, not deactivation state).
- **D-08:** `stripe-payment-failure.ts` deactivation step sets `is_active = false` (replaces the `agent_sync_status: 'failed'` workaround). Also sets `subscription_status = 'past_due'` as before.
- **D-09:** Enforce `is_active = false` at three layers:
  1. **Webhook handler** (`retell-call-classify.ts`): load contractor step checks `is_active`; if false, return early (log + no lead/appointment creation).
  2. **Middleware** (`middleware.ts`): if `is_active = false`, redirect all dashboard routes to `/settings/account` (the account page with the deactivated banner).
  3. **Account page**: show a prominent deactivated banner when `is_active = false`, with a "Update Payment" CTA linking to the Stripe Customer Portal.

### Reactivation Flow

- **D-10:** Auto-reactivation on payment recovery. When Stripe fires `customer.subscription.updated` and the new status is `active` while `contractors.is_active = false`, the Stripe webhook handler:
  1. Sets `is_active = true`, `subscription_status = 'active'`
  2. Calls Retell `phoneNumber.update(twilio_number, { inbound_agents: [retell_agent_id] })` to re-link the agent
  3. Logs success/failure structured
- **D-11:** Re-link Retell agent only if both `retell_agent_id` and `twilio_number` are non-null (same guard as deactivation step).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Account Page & Subscription Route
- `src/app/(dashboard)/settings/account/page.tsx` — Current broken account page; all four bugs exist here
- `src/app/api/stripe/subscription/route.ts` — API route returning stripe_customer_id and subscription_status; needs trial_ends_at added

### BILL-03 Deactivation
- `src/inngest/functions/stripe-payment-failure.ts` — Current Inngest function; D-06 and D-08 changes go here
- `src/lib/notifications/payment-alert.ts` — Payment alert helper; needs D-05 channel-flag gating
- `src/app/api/webhooks/stripe/handlers.ts` — Stripe webhook handlers; D-04 (trial_ends_at) and D-10 (reactivation) go here

### Phase 10 Schema (channel enable flags)
- `supabase/migrations/20260523000015_phase10_notification_settings.sql` — Adds notify_sms_enabled (DEFAULT TRUE), notify_whatsapp_enabled (DEFAULT FALSE), notify_telegram_enabled (DEFAULT FALSE)
- `src/types/database.ts` — NotificationSettings interface; already has the three boolean fields from Phase 10

### Middleware & Auth
- `middleware.ts` — Current middleware; D-09 adds is_active=false redirect guard

### Phase 7 Gap-Closure Plans (fixed issues)
- `.planning/phases/07-billing-onboarding/07-07-PLAN.md` — BLOCKER fixes applied; contractor column names now correct
- `.planning/phases/07-billing-onboarding/FULL-REVIEW.md` — Full review findings; BLOCKER-01 and BLOCKER-02 were fixed in 07-07

### Requirements
- `.planning/REQUIREMENTS.md` §BILL-03 — "failing payment deactivates Retell agent within 72 hours + WhatsApp/SMS alert before deactivation"

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/supabase/service.ts` — `createServiceRoleClient()` for all server-side DB writes in this phase
- `src/lib/retell/client.ts` — `getRetellClient()` for Retell API calls (deactivation + reactivation)
- `src/app/api/stripe/portal/route.ts` — Portal session creation pattern; account page "Update Payment" CTA reuses this

### Established Patterns
- Inngest step pattern: `step.run('step-name', async () => { ... })` with NonRetriableError for invalid state — follow in D-10 reactivation step
- Stripe webhook idempotency: `webhook_events` table with `source + event_type + external_id` unique constraint — D-10 reactivation handler must use this
- `maybeSingle()` + `!data` → 404 pattern used in subscription route; keep consistent
- Middleware RLS pattern: `supabase.auth.getUser()` then DB lookup — D-09 follows same pattern; check `is_active` in the same contractor lookup already done by middleware

### Integration Points
- `contractors` table: add `is_active` (D-07) and `trial_ends_at` (D-04) columns via migration
- `stripe-payment-failure.ts` step 2 → `payment-alert.ts`: D-05 flag gating happens in payment-alert.ts, not the Inngest function
- Middleware contractor lookup already fetches `subscription_status` — extend to also fetch `is_active` for D-09 redirect guard
- `handlers.ts` `checkout.session.completed` handler: already sets `subscription_status`; add `trial_ends_at` write alongside (D-04)

</code_context>

<specifics>
## Specific Ideas

- Deactivated banner on account page: prominent, above the subscription card — "Service suspended. Update your payment method to restore your VoiceDesk agent." with "Update Payment" button going to Stripe portal.
- `trialing` badge: indigo/blue color (distinct from active green and past_due yellow). Show trial end date as "Trial ends [formatted date]" below status.
- Middleware redirect target: `/settings/account` (not `/pricing` or a dedicated `/suspended` page) — keeps the contractor in the app and close to the resolution action.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 11-account-page-subscription-load-fix-bill-03-deactivation*
*Context gathered: 2026-05-24*

# Phase 7: Billing & Onboarding - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 7 delivers Stripe-powered subscription billing with a self-serve onboarding wizard that gates "go live" status until a test call is verified. Contractors sign up via Stripe Checkout, configure their agent, connect Google Calendar, provision a phone number, and forward their existing number — all through a modal wizard. Payment failures trigger immediate agent deactivation with notification.

Out of scope: billing analytics, invoice customization, multi-location support.

</domain>

<decisions>
## Implementation Decisions

### Checkout Flow (BILL-01, BILL-02)
- **D-01:** Stripe Hosted Checkout — full redirect to Stripe, return to app on success/cancel
- **D-02:** No-card 14-day trial — no credit card required to start, first charge happens at trial end
- **D-03:** Three pricing tiers — Basic $299/mo, Professional $499/mo, Enterprise $799/mo
- **D-04:** Stripe Customer Portal accessible from account settings for plan changes, payment updates, cancellation

### Wizard Structure (ONBOARD-01)
- **D-05:** Modal wizard — opens within existing portal dashboard, not new pages
- **D-06:** Single modal with tabs — all steps visible at once (not sequential step-by-step)
- **D-07:** Wizard steps in order: Agent configuration → Google Calendar connection → Phone provisioning → Call forwarding instructions (with AT&T/Verizon/T-Mobile carrier codes)

### Test Call Verification (ONBOARD-02)
- **D-08:** Supabase Realtime subscription — portal subscribes to `calls` table filtered by contractor_id, auto-advances when new call detected
- **D-09:** Verification criteria — any call logged for the contractor's VoiceDesk number (not just test calls specifically)

### Payment Failure Handling (BILL-03)
- **D-10:** Immediate deactivation — Retell agent disabled immediately after Stripe's final failed retry (no grace period)
- **D-11:** Alert before deactivation — WhatsApp/SMS notification sent with "PAYMENT FAILED" alert before agent is deactivated

### Claude's Discretion
- Stripe webhook endpoint path: `POST /api/webhooks/stripe` (following Retell webhook pattern)
- Trial end handling: if card not provided by trial end, subscription remains in trialing until card added or manually activated
- Agent deactivation via Retell API: use existing `retell-agent-sync` Inngest function pattern from Phase 2

</decisions>

<canonical_refs>
## Canonical References

### Requirements
- `.planning/REQUIREMENTS.md` — BILL-01, BILL-02, BILL-03, ONBOARD-01, ONBOARD-02

### Phase Context
- `.planning/ROADMAP.md` § Phase 7 — goal, success criteria, notes
- `.planning/phases/06-portal-ui/06-CONTEXT.md` — existing dashboard structure, real-time pattern to reuse
- `.planning/phases/04-scheduling-lead-capture/04-CONTEXT.md` — Google Calendar OAuth flow (wizard step 2 pattern)

### Existing Patterns
- `src/app/api/webhooks/retell/route.ts` — webhook handler pattern to follow for Stripe webhook
- `src/inngest/functions/retell-call-classify.ts` — Inngest function pattern for agent deactivation function
- Phase 6 real-time subscription pattern in dashboard pages

### Schema
- `src/types/database.ts` — Contractor type with stripe_customer_id, stripe_subscription_id, subscription_status, subscription_tier
- `supabase/migrations/` — existing tables (no new tables needed for Phase 7)

</canonical_refs>

## Existing Code Insights

### Reusable Assets
- `SubscriptionStatus` type: `'trialing' | 'active' | 'past_due' | 'canceled'` — already defined in database.ts
- Contractor has stripe_customer_id, stripe_subscription_id columns already
- Phase 6 Supabase Realtime subscription pattern for live updates

### Established Patterns
- Stripe webhook: follows same structure as Retell webhook (verify signature, return 200 immediately, process in after())
- Inngest function: follow retell-call-classify pattern for any background jobs (payment retry, deactivation)
- Modal wizard: reuse Phase 4 calendar connect banner → modal flow as template

### Integration Points
- Stripe webhook: `POST /api/webhooks/stripe` — new route, handles checkout.session.completed, invoice.payment_failed, customer.subscription.updated
- Onboarding modal: likely in `src/app/(dashboard)/dashboard/page.tsx` — check subscription_status and show wizard if not active
- Agent deactivation: extend existing retell-agent-sync or create new Inngest function triggered by Stripe webhook

</code_context>

<specifics>
## Specific Ideas

- Carrier forwarding codes: AT&T (*72), Verizon (*72), T-Mobile (##21#) — include in wizard
- 14-day trial: no card upfront, first charge at trial end via Stripe trial configuration
- Three tiers: Basic ($299), Professional ($499), Enterprise ($799) — create in Stripe Dashboard

</specifics>

<deferred>
## Deferred Ideas

- Multi-location contractor support — future phase (v2)
- Custom invoice branding — future phase (v2)
- WhatsApp opt-in consent checkbox during onboarding — mentioned in ROADMAP.md notes, not discussed in detail

None — discussion stayed within phase scope otherwise.

</deferred>

---

*Phase: 7-Billing & Onboarding*
*Context gathered: 2026-05-12*
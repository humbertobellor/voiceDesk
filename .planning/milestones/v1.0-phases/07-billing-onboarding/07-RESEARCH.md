# Phase 7: Billing & Onboarding - Research

**Researched:** 2026-05-12
**Domain:** Stripe subscription billing, onboarding wizard, real-time verification, payment failure handling
**Confidence:** HIGH

## Summary

Phase 7 delivers Stripe-powered subscription billing with a self-serve onboarding wizard that gates "go live" status until a test call is verified. The implementation leverages Stripe's hosted Checkout for signup, Customer Portal for subscription management, Supabase Realtime for test call detection, and existing Twilio notification infrastructure for payment failure alerts. All webhook processing follows the established Retell webhook pattern: verify signature, return 200 immediately, process in `after()`.

**Primary recommendation:** Use Stripe Checkout Sessions with `mode: 'subscription'` and `subscription_data.trial_period_days: 14` for no-card trial signup. Handle `checkout.session.completed`, `invoice.payment_failed`, and `customer.subscription.updated` webhooks. Reuse existing Supabase Realtime pattern from Phase 6 for test call polling. Extend existing Inngest function pattern for agent deactivation on payment failure.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Stripe Checkout redirect | API / Backend | Browser / Client | Server creates session, client redirects |
| Stripe webhook handling | API / Backend | — | All webhook processing on server |
| Subscription status tracking | Database / Storage | API / Backend | Contractors table stores stripe_subscription_id, subscription_status |
| Onboarding wizard UI | Browser / Client | — | Modal UI in portal dashboard |
| Test call real-time detection | Browser / Client | Database / Storage | Supabase Realtime subscribes to calls table |
| Payment failure notifications | API / Backend | — | Twilio SMS/WhatsApp from server |
| Agent deactivation | API / Backend | — | Retell API call from Inngest function |

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Stripe Hosted Checkout — full redirect to Stripe, return to app on success/cancel
- **D-02:** No-card 14-day trial — no credit card required to start, first charge happens at trial end
- **D-03:** Three pricing tiers — Basic $299/mo, Professional $499/mo, Enterprise $799/mo
- **D-04:** Stripe Customer Portal accessible from account settings for plan changes, payment updates, cancellation
- **D-05:** Modal wizard — opens within existing portal dashboard, not new pages
- **D-06:** Single modal with tabs — all steps visible at once (not sequential step-by-step)
- **D-07:** Wizard steps in order: Agent configuration → Google Calendar connection → Phone provisioning → Call forwarding instructions (with AT&T/Verizon/T-Mobile carrier codes)
- **D-08:** Supabase Realtime subscription — portal subscribes to `calls` table filtered by contractor_id, auto-advances when new call detected
- **D-09:** Verification criteria — any call logged for the contractor's VoiceDesk number (not just test calls specifically)
- **D-10:** Immediate deactivation — Retell agent disabled immediately after Stripe's final failed retry (no grace period)
- **D-11:** Alert before deactivation — WhatsApp/SMS notification sent with "PAYMENT FAILED" alert before agent is deactivated

### Claude's Discretion
- Stripe webhook endpoint path: `POST /api/webhooks/stripe` (following Retell webhook pattern)
- Trial end handling: if card not provided by trial end, subscription remains in trialing until card added or manually activated
- Agent deactivation via Retell API: use existing `retell-agent-sync` Inngest function pattern from Phase 2

### Deferred Ideas (OUT OF SCOPE)
- Multi-location contractor support — future phase (v2)
- Custom invoice branding — future phase (v2)
- WhatsApp opt-in consent checkbox during onboarding — mentioned in ROADMAP.md notes, not discussed in detail

</user_constraints>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `stripe` | ^19.1.0 | Stripe Node SDK for Checkout, subscriptions, webhooks | Official Stripe SDK, v19 is current stable [VERIFIED: npm registry] |
| `@supabase/ssr` | (existing) | Browser client for Supabase Realtime | Already in project, used for Phase 6 calls subscription |
| `twilio` | (existing) | SMS/WhatsApp notifications | Already in project for dispatch notifications |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `inngest` | (existing) | Background job processing | For agent deactivation on payment failure |
| Retell SDK | (existing) | Agent activation/deactivation | Already used in Phase 2 |

**Installation:**
```bash
npm install stripe
# No new dependencies - existing @supabase/ssr, twilio, inngest reused
```

---

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Browser    │     │   Next.js API    │     │  Stripe     │
│  (Wizard)   │     │   (/api/webhooks/│     │  (Checkout) │
│             │────▶│    stripe)       │────▶│             │
└─────────────┘     └────────┬─────────┘     └─────────────┘
       │                   │
       │                   │ after() processing
       │                   ▼
       │            ┌──────────────┐     ┌─────────────┐
       │            │   Inngest     │────▶│   Retell    │
       │            │ (deactivation)│     │   (agent)   │
       │            └──────────────┘     └─────────────┘
       │
       │ Supabase Realtime
       ▼
┌──────────────────┐
│  calls table     │
│  (filter by      │
│  contractor_id)  │
└──────────────────┘
```

### Recommended Project Structure
```
src/
├── app/
│   └── api/
│       └── webhooks/
│           └── stripe/
│               └── route.ts    # Stripe webhook handler
├── lib/
│   └── stripe/
│       ├── client.ts          # Stripe client initialization
│       ├── checkout.ts        # Checkout session creation
│       └── portal.ts         # Customer portal session creation
├── components/
│   └── onboarding/
│       ├── OnboardingWizard.tsx  # Modal wizard component
│       └── steps/              # Individual wizard steps
└── inngest/
    └── functions/
        └── stripe-deactivation.ts  # Payment failure handler
```

### Pattern 1: Stripe Checkout Session with Trial

**What:** Create a Stripe Checkout session for subscription with 14-day no-card trial.

**When to use:** When contractor initiates signup from portal.

**Example:**
```typescript
// Source: [VERIFIED: Context7 /stripe/stripe-node]
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  payment_method_collection: 'if_required', // D-02: No card required for trial
  subscription_data: {
    trial_period_days: 14, // D-02: 14-day no-card trial
    metadata: {
      contractor_id: contractorId, // Link to contractor record
    },
  },
  line_items: [
    {
      price: priceId, // $299 Basic / $499 Pro / $799 Enterprise
      quantity: 1,
    },
  ],
  success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=cancelled`,
  metadata: {
    contractor_id: contractorId,
  },
});

return session.url; // Redirect client to this URL
```

### Pattern 2: Stripe Webhook Handler

**What:** Handle Stripe webhook events with signature verification, returning 200 immediately.

**When to use:** For processing checkout completion, payment failures, subscription updates.

**Example:**
```typescript
// Source: Pattern from src/app/api/webhooks/retell/route.ts (D-01 in CONTEXT)
import 'server-only';
import { after } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature') ?? '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('[webhook/stripe] signature verification failed:', err instanceof Error ? err.message : err);
    return new Response('Unauthorized', { status: 401 });
  }

  // D-01: Return 200 immediately — process in after()
  after(async () => {
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
          break;
        case 'invoice.payment_failed':
          await handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;
        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;
      }
    } catch (err) {
      console.error('[webhook/stripe] after() processing error:', err instanceof Error ? err.message : err);
    }
  });

  return new Response('OK', { status: 200 });
}
```

### Pattern 3: Stripe Customer Portal Session

**What:** Create a Stripe Customer Portal session for self-serve subscription management.

**When to use:** When contractor clicks "Manage Subscription" in account settings.

**Example:**
```typescript
// Source: [CITED: https://docs.stripe.com/billing/subscriptions/customer-portal]
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

async function createPortalSession(customerId: string, returnUrl: string) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
    configuration: null, // Use default portal configuration
  });

  return session.url; // Redirect client to portal
}
```

### Pattern 4: Supabase Realtime for Test Call Detection

**What:** Subscribe to `calls` table for new call inserts filtered by contractor_id.

**When to use:** In onboarding wizard to detect when test call is received.

**Example:**
```typescript
// Source: [VERIFIED: src/lib/realtime/callsSubscription.ts]
'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useEffect, useState } from 'react';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function useTestCallVerification(contractorId: string, onTestCallDetected: () => void) {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!contractorId) return;

    const channel = supabase
      .channel(`test-call-verification-${contractorId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT', // D-09: any new call triggers verification
          schema: 'public',
          table: 'calls',
          filter: `contractor_id=eq.${contractorId}`,
        },
        (payload) => {
          // D-09: Verification criteria — any call logged for contractor's number
          console.log('[Test call detected]', payload.new.id);
          onTestCallDetected();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
        }
      });

    return () => {
      channel.unsubscribe();
      setIsConnected(false);
    };
  }, [contractorId, onTestCallDetected]);

  return { isConnected };
}
```

### Pattern 5: Payment Failure Agent Deactivation

**What:** Inngest function to deactivate Retell agent and send notification on payment failure.

**When to use:** When Stripe webhook `invoice.payment_failed` is received.

**Example:**
```typescript
// Source: Pattern from src/inngest/functions/retell-agent-sync.ts
import 'server-only';
import { inngest } from '@/inngest/client';
import { getRetellClient } from '@/lib/retell/client';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { sendSms } from '@/lib/notifications/sms';
import { sendWhatsApp } from '@/lib/notifications/whatsapp';

export const stripePaymentFailureHandler = inngest.createFunction(
  {
    id: 'stripe/payment-failure-handler',
    retries: 3,
    triggers: [{ event: 'stripe/payment.failed' }],
  },
  async ({ event }) => {
    const { contractorId, customerId, subscriptionId } = event.data;

    // Step 1: Send payment failure alert (D-11)
    const db = createServiceRoleClient();
    const { data: contractor } = await db
      .from('contractors')
      .select('phone, whatsapp_enabled')
      .eq('id', contractorId)
      .single();

    if (contractor?.phone) {
      await sendSms({
        to: contractor.phone,
        body: 'VOICEDESK ALERT: Payment failed. Your agent will be deactivated within 72 hours. Update payment method at: [portal-url]',
        contractorId,
        callId: null,
      });

      if (contractor.whatsapp_enabled) {
        await sendWhatsApp({
          to: contractor.phone,
          templateType: 'emergency', // Reuse emergency template for payment failure
          callerPhone: 'PAYMENT FAILED',
          serviceRequested: 'Update payment method to keep service active',
          contractorId,
          callId: null,
        });
      }
    }

    // Step 2: Deactivate Retell agent (D-10)
    const { data: contractor2 } = await db
      .from('contractors')
      .select('retell_agent_id')
      .eq('id', contractorId)
      .single();

    if (contractor2?.retell_agent_id) {
      const retell = getRetellClient();
      try {
        await retell.agent.update(contractor2.retell_agent_id, {
          status: 'inactive',
        });
      } catch (err) {
        console.error('[stripe/payment-failure] Retell agent deactivation failed:', err);
      }
    }

    // Step 3: Update subscription status
    await db
      .from('contractors')
      .update({ subscription_status: 'past_due' })
      .eq('id', contractorId);
  }
);
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stripe signature verification | Custom HMAC implementation | `stripe.webhooks.constructEvent()` | Handles timing attacks, replay protection, multiple signature versions |
| Subscription trial logic | Store trial state manually | Stripe's `subscription_data.trial_period_days` | Stripe handles trial period, automatic conversion, grace period |
| Customer billing portal | Build custom UI for plan changes | Stripe Customer Portal API | Pre-built, PCI-compliant, supports all subscription operations |
| Webhook retry logic | Custom queue with manual retries | Inngest function retries | Built-in exponential backoff, dead-letter queue, monitoring |

---

## Common Pitfalls

### Pitfall 1: Forgetting to Enable Realtime on `calls` Table
**What goes wrong:** Supabase Realtime subscriptions silently fail — no errors thrown, but no events received.
**Why it happens:** Realtime must be explicitly enabled per-table via `alter publication supabase_realtime add table calls`.
**How to avoid:** Verify `calls` table is in the `supabase_realtime` publication before implementing wizard.
**Warning signs:** Console shows "Subscribed" status but no events fire on new inserts.

### Pitfall 2: Not Handling Stripe Webhook Retries
**What goes wrong:** Payment failure processed twice, causing duplicate notifications or agent deactivation.
**Why it happens:** Stripe retries webhooks for 3 days with exponential backoff — idempotency required.
**How to avoid:** Use `webhook_events` table (already exists per CLAUDE.md rule 5) with unique constraint on `source + event_type + external_id`.
**Warning signs:** Duplicate notifications sent to contractors, agent toggled inactive/active multiple times.

### Pitfall 3: Trial End Not Converting to Active
**What goes wrong:** Contractor signs up, trial ends, but subscription stays in "trialing" status indefinitely.
**Why it happens:** Without card on file, Stripe doesn't automatically convert — subscription remains trialing until payment succeeds.
**How to avoid:** Handle `customer.subscription.trial_will_end` webhook to send reminder, or manually activate via dashboard.
**Warning signs:** Contractor calls support saying "I thought I was on trial but now I'm being charged" or vice versa.

### Pitfall 4: Not Checking Subscription Status Before API Calls
**What goes wrong:** Contractor with failed payment still gets Retell agent activated on next call.
**Why it happens:** Call handling logic checks `subscription_status` but billing webhook didn't update it.
**How to avoid:** Always verify `subscription_status === 'active'` before any Retell/Twilio API calls.
**Warning signs:** Failed payment contractors still receiving voice calls, incurring infrastructure costs.

---

## Code Examples

### Checkout Session Creation (Server Action)
```typescript
// src/lib/stripe/checkout.ts
'use server';

import { createServiceRoleClient } from '@/lib/supabase/service';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function createCheckoutSession(contractorId: string, priceId: string) {
  const db = createServiceRoleClient();

  // Get contractor info
  const { data: contractor } = await db
    .from('contractors')
    .select('email, name')
    .eq('id', contractorId)
    .single();

  if (!contractor) throw new Error('Contractor not found');

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_collection: 'if_required', // D-02: No card for trial
    subscription_data: {
      trial_period_days: 14,
      metadata: { contractor_id: contractorId },
    },
    customer_email: contractor.email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=cancelled`,
    metadata: { contractor_id: contractorId },
  });

  return session.url;
}
```

### Webhook Event Handler - Checkout Completed
```typescript
// src/app/api/webhooks/stripe/handlers.ts
import { createServiceRoleClient } from '@/lib/supabase/service';
import Stripe from 'stripe';

export async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const db = createServiceRoleClient();
  const contractorId = session.metadata?.contractor_id;

  if (!contractorId) {
    console.error('[stripe] checkout completed missing contractor_id');
    return;
  }

  // Update contractor with Stripe customer and subscription
  await db
    .from('contractors')
    .update({
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: session.subscription as string,
      subscription_status: 'trialing', // D-02: starts in trialing
      subscription_tier: 'basic', // Derive from price_id
    })
    .eq('id', contractorId);

  console.log(`[stripe] contractor ${contractorId} subscribed, status: trialing`);
}
```

### Onboarding Wizard Component
```typescript
// src/components/onboarding/OnboardingWizard.tsx
'use client';

import { useState } from 'react';
import { useTestCallVerification } from '@/lib/realtime/callsSubscription';

interface OnboardingWizardProps {
  contractorId: string;
  onComplete: () => void;
}

export function OnboardingWizard({ contractorId, onComplete }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [testCallDetected, setTestCallDetected] = useState(false);

  const steps = [
    { title: 'Agent Config', description: 'Configure your AI receptionist' },
    { title: 'Calendar', description: 'Connect Google Calendar' },
    { title: 'Phone', description: 'Provision your VoiceDesk number' },
    { title: 'Forwarding', description: 'Set up call forwarding' },
    { title: 'Go Live', description: 'Verify with test call' },
  ];

  // D-08: Real-time subscription for test call detection
  useTestCallVerification(contractorId, () => {
    setTestCallDetected(true);
    // Auto-advance after brief confirmation
    setTimeout(() => {
      setCurrentStep(4); // Go to "Go Live" step
    }, 1500);
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
        <h2 className="text-2xl font-bold mb-4">Setup Your VoiceDesk</h2>

        {/* D-06: Single modal with tabs - all steps visible */}
        <div className="flex border-b mb-6">
          {steps.map((step, idx) => (
            <button
              key={idx}
              className={`flex-1 py-2 text-sm ${idx === currentStep ? 'border-b-2 border-blue-500 font-medium' : ''}`}
              onClick={() => setCurrentStep(idx)}
            >
              {step.title}
            </button>
          ))}
        </div>

        {/* Step content */}
        <div className="min-h-[300px]">
          {currentStep === 0 && <AgentConfigStep contractorId={contractorId} />}
          {currentStep === 1 && <CalendarConnectStep contractorId={contractorId} />}
          {currentStep === 2 && <PhoneProvisioningStep contractorId={contractorId} />}
          {currentStep === 3 && <CallForwardingStep />}
          {currentStep === 4 && (
            <div className="text-center py-8">
              {testCallDetected ? (
                <div className="text-green-600">
                  <p className="text-2xl">Test call detected!</p>
                  <p className="mt-2">Your VoiceDesk is now live.</p>
                  <button onClick={onComplete} className="mt-4 btn-primary">
                    Complete Setup
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-lg">Waiting for test call...</p>
                  <p className="text-sm text-gray-500 mt-2">Make a call to your VoiceDesk number to verify</p>
                  {/* D-08: Poll every 5 seconds (handled by Supabase Realtime) */}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom billing UI | Stripe Customer Portal | 2020+ | Reduces development time, PCI compliance, better UX |
| Manual trial tracking | Stripe `trial_period_days` | 2019+ | Automatic conversion, grace period handling |
| Polling API endpoint | Supabase Realtime | 2023+ | Real-time without polling overhead, serverless-friendly |
| Single webhook handler | Event-driven Inngest | 2024+ | Built-in retries, dead-letter handling, observability |

**Deprecated/outdated:**
- Stripe Checkout embedded form (deprecated) — use hosted Checkout redirect
- Manual subscription status sync — use Stripe webhooks for truth

---

## Assumptions Log

> List all claims tagged `[ASSUMED]` in this research. The planner and discuss-phase use this section to identify decisions that need user confirmation before execution.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Stripe Customer Portal supports all tier changes (upgrade/downgrade/cancel) | Standard Stack | LOW - Stripe documentation confirms this |
| A2 | Twilio WhatsApp can reuse emergency template for payment alerts | Common Pitfalls | LOW - Template supports variable substitution |
| A3 | calls table already in supabase_realtime publication | Environment Availability | MEDIUM - Need to verify in database |

---

## Open Questions

1. **How to handle trial-to-paid conversion when card not provided?**
   - What we know: Stripe keeps subscription in "trialing" until payment succeeds
   - What's unclear: Should we auto-cancel after X days, or send reminder emails?
   - Recommendation: Send reminder at day 12 via Inngest `customer.subscription.trial_will_end`, auto-cancel at day 30

2. **What carrier forwarding codes to display in wizard?**
   - What we know: AT&T (*72), Verizon (*72), T-Mobile (##21#) — from CONTEXT.md D-07
   - What's unclear: Are these current for 2024-2025? Any regional carriers to add?
   - Recommendation: Verify current codes before wizard implementation

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Stripe CLI (local testing) | Webhook development | ✓ | Latest | Use dashboard webhook logs |
| Supabase Realtime | Test call detection | ✓ | — | — |
| Twilio (SMS/WhatsApp) | Payment alerts | ✓ | — | — |
| Retell API | Agent deactivation | ✓ | — | — |

**Missing dependencies with no fallback:**
- None identified — all required services already in project

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (existing) |
| Config file | `jest.config.ts` |
| Quick run command | `npm test -- --testPathPattern="stripe\|onboarding" --passWithNoTests` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BILL-01 | Contractor can sign up via Stripe Checkout | unit | `npm test -- --testPathPattern="checkout" -t"creates checkout session"` | ❌ Wave 0 |
| BILL-02 | 14-day trial starts on checkout completion | unit | `npm test -- --testPathPattern="webhooks" -t"handles checkout.completed"` | ❌ Wave 0 |
| BILL-03 | Payment failure triggers agent deactivation | unit | `npm test -- --testPathPattern="payment-failure" -t"deactivates agent"` | ❌ Wave 0 |
| ONBOARD-01 | Modal wizard displays all steps | integration | `npm test -- --testPathPattern="wizard" -t"renders all steps"` | ❌ Wave 0 |
| ONBOARD-02 | Test call detection advances wizard | integration | `npm test -- --testPathPattern="realtime" -t"detects test call"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern="stripe\|onboarding" --passWithNoTests`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/lib/stripe/checkout.test.ts` — covers BILL-01
- [ ] `tests/app/api/webhooks/stripe.test.ts` — covers BILL-02
- [ ] `tests/inngest/functions/stripe-deactivation.test.ts` — covers BILL-03
- [ ] `tests/components/onboarding/OnboardingWizard.test.tsx` — covers ONBOARD-01
- [ ] `tests/lib/realtime/testCallVerification.test.ts` — covers ONBOARD-02

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Supabase Auth (existing) |
| V3 Session Management | Yes | Stripe-managed sessions |
| V4 Access Control | Yes | Supabase RLS on contractors table |
| V5 Input Validation | Yes | Stripe webhook signature verification + Zod for parsed data |
| V6 Cryptography | Yes | Stripe handles PCI — no card data touches our code |

### Known Threat Patterns for Stripe Integration

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forge webhook events (fake payment success) | Spoofing | `stripe.webhooks.constructEvent()` signature verification |
| Duplicate webhook processing | Tampering | Idempotency key in `webhook_events` table (per CLAUDE.md rule 5) |
| Enumerate valid customer IDs | Information Disclosure | Use internal contractor_id in metadata, never expose in logs |
| Extract Stripe API key from environment | Tampering | Service role key in server-only code, never reaches browser |

---

## Sources

### Primary (HIGH confidence)
- [Context7 /stripe/stripe-node](https://context7.com/stripe/stripe-node) - Checkout session, subscription management
- [Context7 /supabase/realtime](https://context7.com/supabase/realtime) - Postgres changes subscription
- [Context7 /stripe/stripe-node](https://context7.com/stripe/stripe-node) - Webhook handling patterns
- [docs.stripe.com/billing/subscriptions/customer-portal](https://docs.stripe.com/billing/subscriptions/customer-portal) - Customer portal API

### Secondary (MEDIUM confidence)
- [docs.stripe.com/api/events](https://docs.stripe.com/api/events) - Webhook event types (invoice.payment_failed)

### Tertiary (LOW confidence)
- Carrier forwarding codes (AT&T *72, Verizon *72, T-Mobile ##21#) — from CONTEXT.md D-07, needs verification

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Stripe SDK patterns well-documented, existing project patterns
- Architecture: HIGH - Follows established project patterns (Retell webhook, Inngest, Supabase Realtime)
- Pitfalls: MEDIUM - Some items (realtime table config) need verification

**Research date:** 2026-05-12
**Valid until:** 2026-06-12 (30 days — Stripe API stable, project patterns established)
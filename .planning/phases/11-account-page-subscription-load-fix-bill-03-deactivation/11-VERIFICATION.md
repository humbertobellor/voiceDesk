---
phase: 11-account-page-subscription-load-fix-bill-03-deactivation
verified: 2026-05-24T11:40:00Z
status: gaps_found
score: 11/11 requirements verified (goal achieved, but TypeScript compilation broken)
overrides_applied: 0
gaps:
  - truth: "npx tsc --noEmit exits 0 (TypeScript strict compilation clean)"
    status: failed
    reason: "tests/api/stripe-handlers.test.ts calls handleSubscriptionUpdated with 1 argument but the function now requires 2 (stripeEventId added in CR-02 fix). 3 type errors. This file was not updated after the signature change."
    artifacts:
      - path: "tests/api/stripe-handlers.test.ts"
        issue: "Lines 243, 255, 269: Expected 2 arguments, but got 1 for handleSubscriptionUpdated calls"
    missing:
      - "Pass a second string argument (Stripe event ID) to all three handleSubscriptionUpdated calls in stripe-handlers.test.ts, or use a stub string like 'evt_test_123'"
human_verification:
  - test: "Verify account page subscription state rendering"
    expected: "Active subscription shows green badge. Trialing shows indigo badge + 'Trial ends [date]'. Deactivated (is_active=false) shows red suspension banner with Update Payment button. Blocked subscription fetch shows error banner rather than 'No subscription'."
    why_human: "JSX conditionals verified by code inspection but live rendering in browser cannot be confirmed programmatically"
  - test: "Verify middleware is_active redirect for all portal routes"
    expected: "Authenticated contractor with is_active=false is redirected to /settings/account when navigating to /calls, /leads, /settings/agent, /settings/calendar, /settings/phone, /settings/go-live, /settings/notifications, /connect-calendar, /dashboard. /settings/account itself is NOT redirected."
    why_human: "Middleware path coverage logic verified by code inspection; end-to-end browser navigation cannot be asserted programmatically without a running server"
  - test: "Verify Retell re-link on payment recovery (D-10/D-11)"
    expected: "When Stripe fires customer.subscription.updated with status=active for a contractor whose is_active=false, the reactivation path fires exactly once: is_active set to true and Retell phoneNumber.update called. No double re-link."
    why_human: "Requires a real or simulated Stripe webhook delivery; cannot be verified via static code analysis alone"
---

# Phase 11: Account Page Subscription Load Fix + BILL-03 Deactivation — Verification Report

**Phase Goal:** Fix account page subscription loading bugs (D-01, D-02, D-03) and implement BILL-03 deactivation enforcement (D-05 through D-11).
**Verified:** 2026-05-24T11:40:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | D-01: Error state shown when subscription fetch fails or returns non-ok | VERIFIED | `loadError` state declared; `!res.ok` and `catch` both call `setLoadError(true)`; JSX renders error banner when `loaded && loadError` |
| 2 | D-02: Trialing badge rendered with indigo color and trial end date | VERIFIED | `subscription_status === 'trialing'` maps to `text-indigo-400`; trial end date rendered below status when `trial_ends_at` non-null |
| 3 | D-03: Duplicate bottom loading block removed | VERIFIED | `grep 'Loading subscription details' account/page.tsx` returns 0 lines; only inline `'Loading...'` text remains in status span |
| 4 | D-04: trial_ends_at stored in DB, set by handleSubscriptionUpdated, returned by /api/stripe/subscription | VERIFIED | Migration adds `TIMESTAMPTZ` column; handleSubscriptionUpdated merges `trial_ends_at` into status update when trialing; /api/stripe/subscription SELECT and response both include the field |
| 5 | D-05: payment-alert.ts gates SMS on notify_sms_enabled and WhatsApp on notify_whatsapp_enabled | VERIFIED | `if (!smsEnabled || !smsNumber)` guard present; `if (whatsappEnabled && whatsappNumber)` guard present; 6/6 channel-gate tests pass |
| 6 | D-06: stripe-payment-failure load-contractor selects all four notification_settings channel fields | VERIFIED | `.select('... notification_settings(sms_number, whatsapp_number, notify_sms_enabled, notify_whatsapp_enabled)')` present |
| 7 | D-07: contractors.is_active BOOLEAN NOT NULL DEFAULT TRUE column exists | VERIFIED | Migration `ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE`; `Contractor` interface has `is_active: boolean` |
| 8 | D-08: stripe-payment-failure writes is_active=false + subscription_status=past_due atomically | VERIFIED | `mark-agent-inactive` step calls `.update({ is_active: false, subscription_status: 'past_due' })`; old `agent_sync_status='failed'` write gone |
| 9 | D-09: Three-layer is_active enforcement (middleware + retell-call-classify + account page banner) | VERIFIED | middleware redirects deactivated contractors to /settings/account for all portal routes; retell-call-classify returns early with structured log; account page renders deactivated banner; 3/3 D-09 tests pass |
| 10 | D-10: Auto-reactivation sets is_active=true when Stripe reports active and was deactivated | VERIFIED | `wasDeactivated = contractor.is_active === false`; reactivation branch sets `is_active: true` and calls Retell re-link; uses Stripe event ID (evt_...) as idempotency key so repeat events are not silently deduplicated |
| 11 | D-11: Retell re-link on reactivation guarded by retell_agent_id AND twilio_number non-null | VERIFIED | Both reactivation and existing-active branches check `contractorFull?.retell_agent_id && contractorFull?.twilio_number` before calling `retell.phoneNumber.update` |
| 12 | TypeScript compilation clean (npx tsc --noEmit exits 0) | FAILED | 3 errors in tests/api/stripe-handlers.test.ts: handleSubscriptionUpdated called with 1 argument after CR-02 added required stripeEventId parameter |

**Score:** 11/11 requirements verified; 1 TypeScript gap blocks clean compilation

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260524000016_phase11_is_active_trial_ends_at.sql` | Schema additions is_active, trial_ends_at | VERIFIED | Both ADD COLUMN IF NOT EXISTS clauses present with COMMENT ON COLUMN |
| `src/types/database.ts` | Contractor interface has is_active: boolean and trial_ends_at: string \| null | VERIFIED | Both fields present at lines 32-33 |
| `src/lib/notifications/payment-alert.ts` | Channel-flag-gated SMS/WhatsApp alert | VERIFIED | smsEnabled/whatsappEnabled gates present; 6 tests pass |
| `tests/notifications/payment-alert.test.ts` | 6 passing GREEN tests for D-05 | VERIFIED | 6/6 pass |
| `src/inngest/functions/stripe-payment-failure.ts` | D-06 join + D-08 is_active write | VERIFIED | Both present; update-subscription-status step removed |
| `src/app/api/webhooks/stripe/handlers.ts` | trial_ends_at write + wasDeactivated reactivation | VERIFIED | Primary path in handleSubscriptionUpdated; CR-02 idempotency fix applied |
| `src/app/api/stripe/subscription/route.ts` | Returns trial_ends_at and is_active | VERIFIED | SELECT and response both include both fields |
| `middleware.ts` | is_active redirect guard for all portal routes | VERIFIED | isDashboardRoute covers /calls, /leads, /settings/*, /connect-calendar, /dashboard |
| `src/inngest/functions/retell-call-classify.ts` | is_active early-return guard in load-contractor | VERIFIED | `!data.is_active` returns sentinel; sentinel checked after step.run |
| `tests/lib/retell-call-classify.test.ts` | 3 passing GREEN tests for D-09 is_active guard | VERIFIED | 3/3 pass with vi.mock approach; afterEach vi.restoreAllMocks present |
| `src/app/(dashboard)/settings/account/page.tsx` | Error state, trialing badge, deactivated banner, no duplicate loading | VERIFIED | All four fixes confirmed in source |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `account/page.tsx` | `/api/stripe/subscription` | `useEffect fetch`, sets `loadError` on `!res.ok` | VERIFIED | Pattern `res.ok` present at line 27 |
| `account/page.tsx` | `/api/stripe/portal` | `handleManageSubscription POST` | VERIFIED | Pattern `api/stripe/portal` present; deactivated banner reuses same handler |
| `handlers.ts handleSubscriptionUpdated` | `contractors.trial_ends_at` | DB update when `internalStatus === 'trialing' && subscription.trial_end` | VERIFIED | Merged into status update via `trialEndsAtUpdate` spread |
| `handlers.ts handleSubscriptionUpdated` | `contractors.is_active` | `wasDeactivated` guard + `is_active: true` write on reactivation | VERIFIED | `wasDeactivated` captured from `contractor.is_active === false` |
| `subscription/route.ts` | `contractors.trial_ends_at` | SELECT and JSON response | VERIFIED | Both present |
| `middleware.ts` | `contractors.is_active` | contractor lookup selects `phone_number, is_active` | VERIFIED | Both selects (auth redirect + dashboard gate) include `is_active` |
| `stripe-payment-failure.ts` | `payment-alert.ts` | `sendPaymentFailureAlert` call in send-payment-alert step | VERIFIED | Import and call present; new 5-arg signature used |
| `payment-alert.ts` | `notify_sms_enabled` | `if (!smsEnabled || !smsNumber)` gate before `sendSms()` | VERIFIED | Gate present at line 63 |
| `retell-call-classify.ts` | `contractors.is_active` | load-contractor step select includes `is_active`; early return on `!data.is_active` | VERIFIED | Select includes field; early return at line 79 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `account/page.tsx` | `subscription` (SubscriptionStatus) | `fetch('/api/stripe/subscription')` → DB SELECT with `trial_ends_at, is_active` | Yes — DB query against contractors table | FLOWING |
| `stripe-payment-failure.ts` | `contractor.notification_settings` | Supabase join: `notification_settings(sms_number, whatsapp_number, notify_sms_enabled, notify_whatsapp_enabled)` | Yes — live join from notification_settings table | FLOWING |
| `retell-call-classify.ts` | `data.is_active` | `.select('id, retell_llm_id, timezone, is_active, contractor_settings(*)')` on contractors | Yes — DB query | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| payment-alert D-05 channel-flag tests (6) | `npx vitest run tests/notifications/payment-alert.test.ts` | 6 passed, 0 failed | PASS |
| retell-call-classify D-09 is_active guard tests (3) | `npx vitest run tests/lib/retell-call-classify.test.ts` | 3 passed, 0 failed | PASS |
| TypeScript compilation clean | `npx tsc --noEmit` | Exit 1 — 3 errors in tests/api/stripe-handlers.test.ts | FAIL |
| stripe-handlers tests runtime | `npx vitest run tests/api/stripe-handlers.test.ts` | 19 passed (vitest transform bypasses strict type check) | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|------------|------------|-------------|--------|----------|
| D-01 | 11-05 | Error state on subscription fetch failure | SATISFIED | `loadError` boolean + error banner in account/page.tsx |
| D-02 | 11-05 | Trialing badge with indigo color and trial end date | SATISFIED | `text-indigo-400` + `trial_ends_at` render in account/page.tsx |
| D-03 | 11-05 | Remove duplicate bottom loading block | SATISFIED | Block absent from account/page.tsx |
| D-04 | 11-01, 11-03, 11-05 | trial_ends_at column + set via handleSubscriptionUpdated + returned by API | SATISFIED | Migration + handler + route all confirmed |
| D-05 | 11-02, 11-06 | payment-alert.ts channel-flag gating | SATISFIED | 6/6 tests pass; gates verified in source |
| D-06 | 11-02 | stripe-payment-failure selects all 4 notification_settings fields | SATISFIED | All 4 fields in select string |
| D-07 | 11-01 | is_active BOOLEAN NOT NULL DEFAULT TRUE in migration | SATISFIED | Migration confirmed |
| D-08 | 11-02 | stripe-payment-failure writes is_active=false atomically | SATISFIED | `{ is_active: false, subscription_status: 'past_due' }` in mark-agent-inactive |
| D-09 | 11-04, 11-05, 11-07 | Three-layer is_active enforcement | SATISFIED | Middleware + retell-call-classify + account page banner all confirmed; 3 tests pass |
| D-10 | 11-03 | Auto-reactivation on payment recovery | SATISFIED | wasDeactivated guard + is_active=true write + stripeEventId idempotency key |
| D-11 | 11-03 | Retell re-link guarded by retell_agent_id AND twilio_number non-null | SATISFIED | Null checks present in both reactivation branches |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `tests/api/stripe-handlers.test.ts` | 243, 255, 269 | TypeScript TS2554: Expected 2 arguments, but got 1 for `handleSubscriptionUpdated` | BLOCKER | `npx tsc --noEmit` exits non-zero; CLAUDE.md requires TypeScript clean after changes. The signature was updated in the CR-02 fix (commit 90bd236) to require a second `stripeEventId` string argument but the pre-existing test file was not updated to match. |
| `src/app/api/webhooks/stripe/handlers.ts` | 95 | `TODO: if needed, retrieve the subscription via stripe.subscriptions.retrieve(...)` — no formal issue/PR reference | WARNING | Unresolved TODO without traceable follow-up. The body of the comment makes clear the primary path covers it, so this is low-risk, but it lacks an issue number per the debt marker gate rule. |

---

### Human Verification Required

#### 1. Account Page Subscription State Rendering

**Test:** Log in as a contractor. Visit `/settings/account`. Verify the subscription status card renders correctly for each state: (a) active — green badge, no banners; (b) temporarily set `subscription_status='trialing'` and `trial_ends_at='2026-06-07T00:00:00.000Z'` in Supabase — verify indigo badge and "Trial ends June 7, 2026"; (c) temporarily set `is_active=false` — verify red suspension banner above subscription card with "Update Payment" button; (d) block `/api/stripe/subscription` in DevTools Network — verify "Failed to load subscription details. Please refresh the page." appears instead of "No subscription".
**Expected:** Each state renders its distinct UI with correct copy and colors.
**Why human:** JSX conditionals verified by code inspection; browser rendering requires a live session.

#### 2. Middleware is_active Redirect — All Portal Routes

**Test:** As an authenticated contractor, set `is_active=false` in Supabase. Navigate to each of: `/calls`, `/leads`, `/settings/agent`, `/settings/calendar`, `/settings/phone`, `/settings/go-live`, `/settings/notifications`, `/connect-calendar`, `/dashboard`. Verify each redirects to `/settings/account`. Then navigate to `/settings/account` directly — verify it does NOT redirect (no loop).
**Expected:** All portal routes redirect; `/settings/account` exempt.
**Why human:** Middleware path coverage confirmed by code inspection; requires a running Next.js server to verify end-to-end redirect behavior.

#### 3. Retell Re-Link on Payment Recovery (D-10/D-11)

**Test:** Simulate the full reactivation cycle: (1) deactivate a contractor (set `is_active=false`); (2) trigger a `customer.subscription.updated` Stripe webhook with `status=active`. Verify: `is_active` is set back to `true` in the DB, Retell `phoneNumber.update` is called exactly once (check Retell dashboard or logs), and a second identical webhook delivery is skipped by idempotency (evt_... key).
**Expected:** Single reactivation write and single Retell call per Stripe event delivery.
**Why human:** Requires a real or simulated Stripe webhook delivery to a running server with Retell credentials configured.

---

### Gaps Summary

One TypeScript gap blocks clean compilation:

**`tests/api/stripe-handlers.test.ts` — 3 calls to `handleSubscriptionUpdated` use the old 1-argument signature.**

After the CR-02 fix (commit 90bd236) added a required `stripeEventId: string` second parameter to `handleSubscriptionUpdated`, the pre-existing test file was not updated. `npx tsc --noEmit` fails with:

```
tests/api/stripe-handlers.test.ts(243,11): error TS2554: Expected 2 arguments, but got 1.
tests/api/stripe-handlers.test.ts(255,11): error TS2554: Expected 2 arguments, but got 1.
tests/api/stripe-handlers.test.ts(269,11): error TS2554: Expected 2 arguments, but got 1.
```

**Fix:** Add a second string argument to the three `handleSubscriptionUpdated(makeSubscription(...))` calls, e.g. `handleSubscriptionUpdated(makeSubscription('active'), 'evt_test_123')`.

This is the only gap. All 11 requirements (D-01 through D-11) are implemented and wired correctly in the production code. The TypeScript error is confined to a test file.

---

_Verified: 2026-05-24T11:40:00Z_
_Verifier: Claude (gsd-verifier)_

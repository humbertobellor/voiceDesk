---
phase: 11-account-page-subscription-load-fix-bill-03-deactivation
plan: "03"
subsystem: billing-webhooks
tags: [stripe, webhooks, billing, reactivation, trial, tdd]
dependency_graph:
  requires:
    - 11-01 (is_active: boolean, trial_ends_at: string | null in Contractor type)
  provides:
    - trial_ends_at written via handleSubscriptionUpdated (primary) and handleCheckoutCompleted (secondary)
    - is_active=true set on subscription reactivation (D-10)
    - Retell re-link guarded by wasDeactivated XOR existing-active (D-11 — exactly once per event)
    - /api/stripe/subscription response includes trial_ends_at and is_active
  affects:
    - src/app/api/webhooks/stripe/handlers.ts
    - src/app/api/stripe/subscription/route.ts
tech_stack:
  added: []
  patterns:
    - wasDeactivated guard — read contractor.is_active before status update, capture as boolean
    - Mutually exclusive active branches — wasDeactivated path returns early (no double Retell call)
    - Secondary/best-effort pattern — checkout session trial_end as fallback when subscription.updated hasn't fired
key_files:
  created: []
  modified:
    - src/app/api/webhooks/stripe/handlers.ts
    - src/app/api/stripe/subscription/route.ts
decisions:
  - D-04: trial_ends_at primary path via handleSubscriptionUpdated (Subscription.trial_end reliable when trialing); secondary via handleCheckoutCompleted (session.subscription_data?.trial_end best-effort)
  - D-10: Auto-reactivation path fires only when contractor.is_active === false AND Stripe status becomes active
  - D-11: Retell phoneNumber.update guarded by retell_agent_id AND twilio_number non-null; exactly one call per event
metrics:
  duration: "~10 minutes"
  completed: "2026-05-24T06:00:00Z"
  tasks_completed: 2
  files_created: 0
  files_modified: 2
---

# Phase 11 Plan 03: Stripe webhook trial_ends_at write + is_active guarded reactivation — Summary

**One-liner:** handleSubscriptionUpdated writes trial_ends_at (primary D-04 path) and guards is_active reactivation with wasDeactivated flag (D-10/D-11); handleCheckoutCompleted adds secondary trial_ends_at from session; subscription route returns both fields.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | handleSubscriptionUpdated — trial_ends_at write + is_active guarded reactivation | df9f7e7 | src/app/api/webhooks/stripe/handlers.ts |
| 2 | handleCheckoutCompleted secondary trial_ends_at + subscription route update | 5e416d5 | src/app/api/webhooks/stripe/handlers.ts, src/app/api/stripe/subscription/route.ts |

## Verification Results

- `handleSubscriptionUpdated` contractor lookup changed to `.select('id, is_active')`
- `wasDeactivated = contractor.is_active === false` captured before status update
- `trial_ends_at` written when `internalStatus === 'trialing' && subscription.trial_end` non-null (primary D-04 path)
- `wasDeactivated && active` branch: sets `is_active: true` then re-links Retell (D-10/D-11)
- `!wasDeactivated && active` branch: existing outer re-link fires unchanged
- Exactly one `retell.phoneNumber.update` call per event — branches are mutually exclusive
- `handleCheckoutCompleted` update includes `trial_ends_at: trialEndsAt` (best-effort from `session.subscription_data?.trial_end`)
- `/api/stripe/subscription` SELECT expanded to include `trial_ends_at, is_active`
- `/api/stripe/subscription` response includes `trial_ends_at` and `is_active` (no Stripe API call)
- `npx tsc --noEmit` exits 0 after both tasks

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All fields are wired to DB columns added in Plan 01 (is_active, trial_ends_at).

## Threat Flags

None. No new network endpoints introduced. The `/api/stripe/subscription` route already existed — the change expands the SELECT and response payload only. is_active and trial_ends_at are non-sensitive contractor self-data behind existing auth guard.

## Self-Check: PASSED

- [x] `src/app/api/webhooks/stripe/handlers.ts` contains `wasDeactivated`, `trial_ends_at`, `is_active: true`
- [x] `src/app/api/stripe/subscription/route.ts` contains `trial_ends_at` in both SELECT and response
- [x] Commit df9f7e7 present in git log (Task 1)
- [x] Commit 5e416d5 present in git log (Task 2)
- [x] `npx tsc --noEmit` exits 0

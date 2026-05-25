---
phase: 11-account-page-subscription-load-fix-bill-03-deactivation
plan: "05"
subsystem: ui
tags: [react, stripe, subscription, billing, account-page, error-state, trial]

# Dependency graph
requires:
  - phase: 11-03
    provides: /api/stripe/subscription returns is_active and trial_ends_at fields
  - phase: 11-01
    provides: contractors.is_active and contractors.trial_ends_at columns

provides:
  - account page shows explicit load-error banner when subscription fetch fails (D-01)
  - account page shows indigo trialing badge with trial end date (D-02)
  - duplicate bottom loading block removed (D-03)
  - deactivated service banner with Update Payment CTA when is_active=false (D-09)

affects:
  - middleware redirect guard (D-09 enforcement — middleware already redirects to /settings/account)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Separate loadError state to distinguish fetch failure from empty data
    - Conditional banner above subscription card for is_active=false

key-files:
  created: []
  modified:
    - src/app/(dashboard)/settings/account/page.tsx

key-decisions:
  - "D-01: loadError boolean state separate from subscription null — prevents 'No subscription' appearing on network failure"
  - "D-09: Deactivated banner reuses handleManageSubscription portal redirect — no new endpoint needed"
  - "D-02: trialing maps to text-indigo-400, distinct from active (green) and past_due (yellow)"

patterns-established:
  - "Subscription status color map: active=green-400, past_due=yellow-400, trialing=indigo-400, other=slate-400"

requirements-completed:
  - D-01
  - D-02
  - D-03
  - D-09

# Metrics
duration: 5min
completed: 2026-05-24
---

# Phase 11 Plan 05: Account page — error state, trialing badge, deactivated banner — Summary

**Account page now shows load-error banner on fetch failure, indigo trialing badge with trial end date, deactivated suspension banner with Update Payment CTA, and the duplicate bottom loading block is removed.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-24T06:05:00Z
- **Completed:** 2026-05-24T06:10:00Z
- **Tasks:** 1 (Task 2 is checkpoint:human-verify — user approved)
- **Files modified:** 1

## Accomplishments

- Explicit error differentiation: `loadError` state set on `!res.ok` or catch; load failure shows red banner instead of silently displaying "No subscription"
- Trialing UI: `trialing` status maps to `text-indigo-400` badge; trial end date formatted as "Trial ends [Month Day, Year]" below status
- Removed duplicate `!loaded && Loading subscription details...` block at bottom of page
- Deactivated banner: when `is_active === false`, shows red suspension banner above subscription card with "Update Payment" button wired to existing portal redirect

## Task Commits

1. **Task 1: Fix all 4 account page bugs** - `e5383a3` (fix — on worktree branch `worktree-agent-a223d0914d9c10113`)

## Files Created/Modified

- `src/app/(dashboard)/settings/account/page.tsx` — Expanded SubscriptionStatus interface; added loadError state; fixed loadSubscription to differentiate failure from empty; added trialing color + trial end date; removed duplicate loading block; added deactivated banner

## Decisions Made

- Reused `handleManageSubscription()` for the deactivated banner's "Update Payment" button — same Stripe portal redirect, no new endpoint needed
- loadError state stays false when fetch returns 200 with no subscription — contractor sees "No subscription" only when the API call actually succeeds with an empty result

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Account page is ready for visual verification at `/settings/account`
- Visual changes approved by user at checkpoint
- Middleware redirect guard (Plan 04) and call-classify early return (Plan 04) complete the D-09 enforcement stack

## Threat Flags

None. No new network endpoints introduced. is_active and trial_ends_at are non-sensitive contractor self-data behind existing auth. The deactivated banner is additive UX — middleware (Plan 04) is the authoritative enforcement gate.

## Self-Check: PASSED

- [x] `src/app/(dashboard)/settings/account/page.tsx` contains `loadError` (3 references)
- [x] `src/app/(dashboard)/settings/account/page.tsx` contains `text-indigo-400` (trialing badge)
- [x] `src/app/(dashboard)/settings/account/page.tsx` contains `is_active === false` (deactivated banner)
- [x] grep for 'Loading subscription details' in non-comment lines returns 0 (D-03 duplicate removed)
- [x] Commit e5383a3 present in git log (worktree branch `worktree-agent-a223d0914d9c10113`)
- [x] User approved visual changes at checkpoint

---
*Phase: 11-account-page-subscription-load-fix-bill-03-deactivation*
*Completed: 2026-05-24*

---
phase: 13-email-notifications
plan: "01"
subsystem: notifications
tags: [react-email, tdd, wave-0, test-scaffold, email]
dependency_graph:
  requires: []
  provides:
    - "@react-email/components@1.0.12 installed"
    - "@react-email/render@2.0.8 installed"
    - "tests/notifications/templates.test.ts (RED)"
    - "tests/inngest/computeChannels-email.test.ts (RED)"
    - "tests/inngest/stripe-payment-failure-email.test.ts (contract)"
  affects:
    - "src/lib/notifications/templates/ (import targets - Plan 02)"
    - "src/inngest/functions/retell-notify-dispatch.ts (computeChannels extension - Plan 03)"
    - "src/inngest/functions/stripe-payment-failure.ts (send-email-alert step - Plan 02)"
tech_stack:
  added:
    - "@react-email/components@1.0.12 (exact pin, no caret)"
    - "@react-email/render@2.0.8 (exact pin, no caret)"
  patterns:
    - "TDD RED phase: test contracts written before source implementation"
    - "vi.mock('@react-email/render') for deterministic HTML output in template tests"
    - "Inline predicate test for D-08 triple-gate contract documentation"
key_files:
  created:
    - "tests/notifications/templates.test.ts"
    - "tests/inngest/computeChannels-email.test.ts"
    - "tests/inngest/stripe-payment-failure-email.test.ts"
  modified:
    - "package.json (added @react-email/components@1.0.12 and @react-email/render@2.0.8)"
    - "package-lock.json"
decisions:
  - "Pin exact versions (no caret) per threat model T-13-01-01 — changed from npm-default caret ranges"
  - "stripe-payment-failure-email.test.ts uses inline predicate (not imported) — function not exported from Inngest file"
metrics:
  duration: "~10 minutes"
  completed_date: "2026-05-25T07:38:17Z"
  tasks_completed: 2
  files_changed: 5
---

# Phase 13 Plan 01: Install @react-email Packages and RED Test Scaffolds

**One-liner:** Installed @react-email/components@1.0.12 + @react-email/render@2.0.8 and created three RED test scaffolds defining TDD contracts for email templates, computeChannels() email extension, and stripe-payment-failure triple-gate.

## What Was Built

**Task 1 — Install @react-email packages**
- Installed `@react-email/components@1.0.12` and `@react-email/render@2.0.8` as exact-pinned (no caret) dependencies
- Verified both packages importable via `node -e "require(...)"` 
- Confirmed npm audit ran; 163 previously passing tests remain GREEN

**Task 2 — RED test scaffolds (TDD Wave 0 gate)**

Three test files created:

| File | Tests | State | Reason |
|------|-------|-------|--------|
| `tests/notifications/templates.test.ts` | 4 | RED (import error) | src templates don't exist yet — created by Plan 02 |
| `tests/inngest/computeChannels-email.test.ts` | 6 | RED (assertion fail) | `computeChannels()` returns `undefined` for `shouldSendEmail` — fixed by Plan 03 |
| `tests/inngest/stripe-payment-failure-email.test.ts` | 2 | GREEN (inline predicate) | Pure self-contained predicate — documents D-08 contract |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Security] Exact version pinning for supply-chain policy**
- **Found during:** Task 1
- **Issue:** `npm install` added caret ranges (`^1.0.12`, `^2.0.8`) to package.json; threat model T-13-01-01 requires exact pinning
- **Fix:** Edited package.json to remove caret ranges → `"1.0.12"` and `"2.0.8"` exact
- **Files modified:** `package.json`
- **Commit:** 0eafffc

## Test Results Summary

| Suite | Before Plan | After Plan | Delta |
|-------|-------------|------------|-------|
| Passing tests | 163 | 165 | +2 (stripe predicate tests) |
| Failing tests (pre-existing) | 31 | 31 | 0 |
| New RED tests | 0 | 10 | +10 (templates 4 RED + computeChannels 6 RED) |

All pre-existing 163 passing tests remain GREEN. New RED tests are expected — they define contracts for Plans 02 and 03.

## Known Stubs

None — this plan creates only test scaffolds. No source implementations with stubs.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. Package install threat T-13-01-SC mitigated per plan (packages verified on npm registry).

## Self-Check: PASSED

- [x] `tests/notifications/templates.test.ts` exists: FOUND
- [x] `tests/inngest/computeChannels-email.test.ts` exists: FOUND  
- [x] `tests/inngest/stripe-payment-failure-email.test.ts` exists: FOUND
- [x] Commit 0eafffc (chore - package install): FOUND
- [x] Commit d815af8 (test - RED scaffolds): FOUND
- [x] `package.json` contains `"@react-email/components": "1.0.12"` (exact pin): VERIFIED
- [x] `package.json` contains `"@react-email/render": "2.0.8"` (exact pin): VERIFIED

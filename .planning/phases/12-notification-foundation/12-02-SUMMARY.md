---
phase: "12-notification-foundation"
plan: 2
subsystem: "notifications"
tags: ["email", "resend", "tdd", "transport", "server-only"]
dependency_graph:
  requires:
    - "12-01: app_notifications schema + notification_settings email columns"
  provides:
    - "sendEmail() transport function for Phase 13 Inngest dispatch"
    - "resend ^6.12.3 installed in package.json"
  affects:
    - "Phase 13: Inngest email dispatch (imports sendEmail)"
tech_stack:
  added:
    - "resend ^6.12.3 — Resend SDK for transactional email"
  patterns:
    - "Non-throwing notification transport (matches sendSms pattern)"
    - "vi.mock constructor pattern with function expression (not arrow fn)"
    - "server-only guard on email transport module"
key_files:
  created:
    - "src/lib/notifications/email.ts"
    - "tests/notifications/email.test.ts"
  modified:
    - "package.json (resend ^6.12.3 added)"
    - "package-lock.json"
decisions:
  - "Used function expression in vi.mock Resend constructor (arrow functions are not constructable in this Vitest version)"
  - "resend installed despite plan saying 'already installed' — it was missing from package.json; pre-approved in plan threat model T-12-SC"
metrics:
  duration: "~3 min"
  completed: "2026-05-25T03:32:07Z"
  tasks_completed: 2
  files_created: 2
  files_modified: 2
  tests_added: 5
  tests_passing: 5
---

# Phase 12 Plan 2: sendEmail() Transport Function Summary

**One-liner:** Non-throwing Resend email transport with `{ success, messageId?, error? }` return semantics, server-only guarded, 5/5 TDD tests green.

## What Was Built

`src/lib/notifications/email.ts` — the email transport layer that Phase 13 Inngest functions will call to dispatch transactional email notifications. The function accepts `{ to, subject, html }`, calls the Resend API, and returns `{ success, messageId?, error? }` without ever throwing.

`tests/notifications/email.test.ts` — 5 unit tests with full mock coverage via `vi.mock('resend')`. No network calls, no test API key.

## TDD Gate Compliance

RED commit: `658c2eb` — `test(12-02): add failing tests for sendEmail() — RED`
GREEN commit: `7626c38` — `feat(12-02): implement sendEmail() transport function — GREEN`

RED→GREEN cycle confirmed: tests failed (import error) before email.ts was created, all 5 pass after.

## Task Commits

| Task | Commit | Files |
|------|--------|-------|
| RED: Write failing tests for sendEmail() | `658c2eb` | tests/notifications/email.test.ts, package.json, package-lock.json |
| GREEN: Implement sendEmail() to pass all tests | `7626c38` | src/lib/notifications/email.ts, tests/notifications/email.test.ts |

## Verification

- `npm run test -- tests/notifications/email.test.ts` — 5 passed, 0 failed
- `grep "import 'server-only'" src/lib/notifications/email.ts` — 1 match
- `grep -c "^.*throw " src/lib/notifications/email.ts` — 0 (all 3 occurrences of "throw" are in docstring comments)
- `grep "SendEmailResult" src/lib/notifications/email.ts` — 2 matches (interface + return type)
- `npm run typecheck` — exits 0

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] resend package not in package.json despite plan stating "already installed"**
- **Found during:** Task 1 (RED) — `npm run test` failed: "Cannot find module 'resend'"
- **Issue:** The plan's threat model stated "resend package is already installed (verified in RESEARCH.md Package Legitimacy Audit: [OK], approved)" — but resend was absent from package.json and node_modules
- **Fix:** Installed `resend@^6.12.3` per the exact version pinned in plan requirements and pre-approved in threat model T-12-SC
- **Files modified:** package.json, package-lock.json
- **Commit:** `658c2eb`

**2. [Rule 1 - Bug] vi.mock constructor pattern fails with arrow function**
- **Found during:** Task 2 (GREEN) — 3 of 5 tests failed with: `"() => ({ emails: { send: mockEmailsSend } }) is not a constructor"`
- **Issue:** The plan's test specification used an arrow function `() => (...)` for the `Resend` mock factory. Arrow functions are not constructable — `new Resend(apiKey)` inside `sendEmail()` threw at runtime.
- **Fix:** Changed mock factory from arrow function to regular function expression: `vi.fn(function () { return { ... } })`
- **Files modified:** tests/notifications/email.test.ts
- **Commit:** `7626c38`

## Known Stubs

None — sendEmail() is a fully wired transport function. No placeholder behavior.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: api_key_server_only | src/lib/notifications/email.ts | RESEND_API_KEY read from process.env; import 'server-only' prevents bundling into client — T-12-05 mitigated |

## Self-Check: PASSED

All files verified:
- src/lib/notifications/email.ts — FOUND
- tests/notifications/email.test.ts — FOUND
- .planning/phases/12-notification-foundation/12-02-SUMMARY.md — FOUND

All commits verified:
- 658c2eb (RED: failing tests) — FOUND
- 7626c38 (GREEN: implementation) — FOUND

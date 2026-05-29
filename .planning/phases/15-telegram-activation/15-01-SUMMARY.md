---
phase: 15-telegram-activation
plan: "01"
subsystem: notifications/telegram
tags: [tdd, test-scaffolding, red-phase, telegram, webhook]
dependency_graph:
  requires: []
  provides:
    - RED test stubs for activateTelegramWebhook() server action (7 tests)
    - RED test stubs for NotificationSettingsForm webhook card (7 tests)
    - TELEGRAM_WEBHOOK_URL env var documentation in .env.example
  affects:
    - tests/actions/telegram-webhook.test.ts
    - tests/components/notification/NotificationSettingsForm.webhook.test.tsx
    - .env.example
tech_stack:
  added: []
  patterns:
    - vi.hoisted() for grammy mock setup
    - "@ts-expect-error markers to document missing props in RED state"
    - process.env mutation in beforeEach for env var failure testing
key_files:
  created:
    - tests/actions/telegram-webhook.test.ts
    - tests/components/notification/NotificationSettingsForm.webhook.test.tsx
  modified:
    - .env.example
decisions:
  - "@ts-expect-error used instead of type casting to explicitly document that initialWebhookInfo prop does not yet exist on NotificationSettingsForm — will be resolved in Plan 02"
  - "Component test also fails at import time (actions.ts missing) which makes all 7 tests RED — acceptable since that is the TDD gate requirement"
metrics:
  duration: "3 min"
  completed: "2026-05-29T19:55:34Z"
  tasks_completed: 3
  files_created: 2
  files_modified: 1
---

# Phase 15 Plan 01: Telegram Activation — Wave 0 Test Scaffolding Summary

RED test scaffolding for Phase 15 Telegram webhook activation: 14 failing tests (7 server action + 7 component) and TELEGRAM_WEBHOOK_URL documented in .env.example.

## What Was Built

Three artifacts created for the TDD RED gate:

1. **`tests/actions/telegram-webhook.test.ts`** — 7 unit tests for `activateTelegramWebhook()` server action covering authentication, contractor lookup, env var validation (HTTPS URL + secret), the happy path (setWebhook + getWebhookInfo called), and error resilience (never throws). File fails at import time because `src/app/(dashboard)/settings/notifications/actions.ts` does not exist.

2. **`tests/components/notification/NotificationSettingsForm.webhook.test.tsx`** — 7 component tests for the Telegram Bot Webhook card covering heading render, "Not registered" status, registered URL display, button presence/enabled state, loading state on click, status update after successful activation, and inline error display. File also fails at import time because the same actions.ts is missing.

3. **`.env.example`** — Added `TELEGRAM_WEBHOOK_URL` entry after `TELEGRAM_WEBHOOK_SECRET` with explanatory comments per D-04.

## Task Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | RED test stubs for activateTelegramWebhook() | a9395c9 | tests/actions/telegram-webhook.test.ts |
| 2 | RED test stubs for NotificationSettingsForm webhook card | f19ca4f | tests/components/notification/NotificationSettingsForm.webhook.test.tsx |
| 3 | Add TELEGRAM_WEBHOOK_URL to .env.example | 69609d7 | .env.example |

## Verification Results

- `tests/actions/telegram-webhook.test.ts` — 7 tests defined, fails at import (RED gate confirmed)
- `tests/components/notification/NotificationSettingsForm.webhook.test.tsx` — 7 tests defined, fails at import (RED gate confirmed)
- `grep -c "TELEGRAM_WEBHOOK_URL=" .env.example` outputs 1

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this is a test-scaffolding plan. No production code was changed.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. .env.example contains placeholder values only.

## Self-Check: PASSED

- [x] tests/actions/telegram-webhook.test.ts exists (a9395c9)
- [x] tests/components/notification/NotificationSettingsForm.webhook.test.tsx exists (f19ca4f)
- [x] .env.example contains TELEGRAM_WEBHOOK_URL= (69609d7)
- [x] Both test files have exactly 7 tests each
- [x] Both test files fail with import error (RED state confirmed)
- [x] No production files modified

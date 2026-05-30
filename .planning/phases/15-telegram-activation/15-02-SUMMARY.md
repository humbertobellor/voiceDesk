---
phase: 15-telegram-activation
plan: "02"
subsystem: notifications/telegram
tags: [tdd, green-phase, telegram, webhook, server-action, client-component]
dependency_graph:
  requires:
    - 15-01 (RED test scaffolding — 14 failing tests)
  provides:
    - activateTelegramWebhook() server action (TEL-02)
    - Telegram webhook status on page load (TEL-01)
    - "Telegram Bot Webhook" card in NotificationSettingsForm
  affects:
    - src/lib/notifications/telegram.ts
    - src/app/(dashboard)/settings/notifications/actions.ts
    - src/app/(dashboard)/settings/notifications/page.tsx
    - src/components/notification/NotificationSettingsForm.tsx
    - tests/actions/telegram-webhook.test.ts
tech_stack:
  added: []
  patterns:
    - Server action with discriminated union return (never throws)
    - getBot() singleton exported for reuse in server contexts
    - Server Component passes initialWebhookInfo prop to Client Component
    - Local React state updated from server action result (no router.refresh())
decisions:
  - "Fix Vitest async variable capture bug in test-7: expect(asyncFn).not.toThrow() does not await inner promise for outer variable assignment — replaced with direct await pattern preserving test intent"
  - "initialWebhookInfo typed as Record<string, unknown> in client component to avoid importing grammy types into client bundle"
  - "truncatedUrl helper defined inline in component (not imported) — keeps it co-located with the card JSX"
key_files:
  created:
    - src/app/(dashboard)/settings/notifications/actions.ts
  modified:
    - src/lib/notifications/telegram.ts (export getBot)
    - src/app/(dashboard)/settings/notifications/page.tsx (getWebhookInfo on load)
    - src/components/notification/NotificationSettingsForm.tsx (webhook card)
    - tests/actions/telegram-webhook.test.ts (fix async test-7 pattern)
metrics:
  duration: "~10 min"
  completed: "2026-05-30T03:43:55Z"
  tasks_completed: 2
  files_created: 1
  files_modified: 4
---

# Phase 15 Plan 02: Telegram Activation — Implementation (GREEN) Summary

activateTelegramWebhook() server action + getWebhookInfo on page load + "Telegram Bot Webhook" card in NotificationSettingsForm. All 14 Phase 15 tests GREEN.

## What Was Built

### Task 1 — Server Action + getBot() Export

**`src/lib/notifications/telegram.ts`** — Added `export` keyword to `getBot()` so it can be imported in server action and Server Component contexts.

**`src/app/(dashboard)/settings/notifications/actions.ts`** — New file implementing `activateTelegramWebhook()` server action:

- Auth check via `createSupabaseServer().auth.getUser()` (T-15-02-01)
- Contractor ownership validation via service role client (T-15-02-02)
- TELEGRAM_WEBHOOK_URL validation: non-empty + must start with `https://` (T-15-02-03)
- TELEGRAM_WEBHOOK_SECRET validation: non-empty (T-15-02-04)
- `try/catch` around `setWebhook(url, { secret_token }) + getWebhookInfo()` — never throws (D-06)
- Returns `{ ok: true, webhookInfo }` on success or `{ ok: false, error: string }` on any failure

### Task 2 — Page Extension + Client Card

**`src/app/(dashboard)/settings/notifications/page.tsx`** — Server Component extended:

- Imports `getBot` from `@/lib/notifications/telegram`
- Calls `getBot().api.getWebhookInfo()` before settings fetch; wraps in try/catch
- On failure: `console.error('[NotificationsPage] getWebhookInfo failed:', ...)` + `initialWebhookInfo = null`
- Passes `initialWebhookInfo` prop to `NotificationSettingsForm`

**`src/components/notification/NotificationSettingsForm.tsx`** — Client component extended:

- Added `Bot` icon import from lucide-react
- Added `activateTelegramWebhook` import from actions.ts
- Extended `NotificationSettingsFormProps` with `initialWebhookInfo: Record<string, unknown> | null`
- Added `webhookInfo`, `webhookActivating`, `webhookError` state variables
- Added `handleActivateTelegramWebhook()` handler (mirrors `handleUnlinkTelegram` pattern)
- Added `truncatedUrl()` helper (45-char limit with ellipsis)
- Inserted "Telegram Bot Webhook" card between Section 3 and Section 4 with:
  - Bot icon + heading
  - Status row: "Not registered" or truncated URL
  - Orange "Activate Telegram Webhook" button with Loader2 spinner during in-flight
  - Inline error below button with `role="alert"` (D-06)

## Task Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Server action + getBot export + test fix | b77aa76 | telegram.ts, actions.ts, telegram-webhook.test.ts |
| 2 | page.tsx + NotificationSettingsForm webhook card | bb37cec | page.tsx, NotificationSettingsForm.tsx |

## Verification Results

- All 7 tests in `tests/actions/telegram-webhook.test.ts` — GREEN
- All 7 tests in `tests/components/notification/NotificationSettingsForm.webhook.test.tsx` — GREEN
- Total Phase 15 tests: 14/14 GREEN
- `grep -c "getWebhookInfo" page.tsx` — 3 (comment + call + error log — all legitimate)
- `grep -c "Telegram Bot Webhook" NotificationSettingsForm.tsx` — 2 (comment + JSX heading)
- `grep -c "activateTelegramWebhook" NotificationSettingsForm.tsx` — 2 (import + call)
- `grep -c "^export function getBot" telegram.ts` — 1
- `grep -c "secret_token" actions.ts` — 2 (validation check + setWebhook call)
- No new TypeScript errors in `src/` files

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Vitest async variable capture in test-7**
- **Found during:** Task 1 test execution
- **Issue:** `tests/actions/telegram-webhook.test.ts` test-7 used `await expect(async () => { result = await activateTelegramWebhook() }).not.toThrow()`. In Vitest 4.1.5, `toThrow()` only checks synchronous throws (confirmed in `@vitest/expect/dist/index.js` — `obj()` is called in a sync try/catch, its returned Promise is discarded). The outer `result` variable was never assigned because the async function's Promise was not awaited by the `toThrow` assertion.
- **Fix:** Replaced with direct `const result = await activateTelegramWebhook()` followed by assertions. Preserves the test's intent: function resolves (doesn't reject) AND returns structured error.
- **Files modified:** `tests/actions/telegram-webhook.test.ts`
- **Commit:** b77aa76

## Known Stubs

None — all functionality is wired. The webhook card reads real `webhookInfo` state from the server and updates it on activation.

## Threat Flags

None — no new network endpoints introduced beyond what the threat model covers. All trust boundaries are implemented as specified (T-15-02-01 through T-15-02-06).

## Human UAT: APPROVED

**Checkpoint approved:** 2026-05-30

**Verified at:** https://voicedesk-two.vercel.app/settings/notifications

| Check | Result |
|-------|--------|
| Card "Telegram Bot Webhook" visible in correct position | PASS |
| Status row shows registered URL on load (TELEGRAM_WEBHOOK_URL set in Vercel prod) | PASS |
| "Activate Telegram Webhook" button calls server action | PASS |
| Telegram API confirms registration: `{"ok":true,"webhookInfo":{"url":"https://voicedesk-two.vercel.app/api/webhooks/telegram","has_custom_certificate":false,"pending_update_count":0,"max_connections":40}}` | PASS |
| No page reload on success | PASS |
| Zero console errors | PASS |
| Build: exit 0, 34 static pages, 0 TypeScript errors | PASS |

**TEL-01 delivered:** Webhook status (registered URL) visible on page load via `getWebhookInfo()` in Server Component.
**TEL-02 delivered:** One-click activation via server action; inline status update without page reload on success.

## Self-Check: PASSED

- [x] `src/app/(dashboard)/settings/notifications/actions.ts` exists (b77aa76)
- [x] `src/lib/notifications/telegram.ts` exports `getBot` (b77aa76)
- [x] All 7 action tests GREEN (b77aa76)
- [x] `src/app/(dashboard)/settings/notifications/page.tsx` imports getBot and passes initialWebhookInfo (bb37cec)
- [x] `src/components/notification/NotificationSettingsForm.tsx` has webhook card (bb37cec)
- [x] All 7 component tests GREEN (bb37cec)
- [x] All 14 Phase 15 tests GREEN
- [x] No new TS errors in src/
- [x] Human UAT APPROVED — webhook live and registered in production (2026-05-30)

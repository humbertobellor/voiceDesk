---
phase: 07-billing-onboarding
plan: "07"
subsystem: billing-security
tags: [security, schema-fix, stripe, telegram, whatsapp, migration]
dependency_graph:
  requires: [07-01, 07-02, 07-03, 07-04, 07-05]
  provides: [production-safe-billing, schema-aligned-notifications]
  affects: [stripe-webhook, telegram-bot, recordings-api, payment-alerts]
tech_stack:
  added: []
  patterns:
    - fail-hard env var guard at module load (telegram secret)
    - type-safe narrowing instead of (X as any) cast
    - env var tier map with fail-fast on unknown price ID
    - idempotent SQL migration with DEFAULT '' + DROP DEFAULT
key_files:
  created: []
  modified:
    - src/inngest/functions/stripe-payment-failure.ts
    - src/lib/notifications/payment-alert.ts
    - src/app/api/webhooks/telegram/route.ts
    - src/app/api/stripe/portal/route.ts
    - src/app/api/stripe/checkout/route.ts
    - src/app/api/recordings/route.ts
    - src/app/api/webhooks/stripe/handlers.ts
    - src/lib/notifications/whatsapp.ts
    - supabase/migrations/20260514000011_add_contractor_email.sql
    - .env.example
    - tests/api/stripe-checkout.test.ts
    - tests/api/stripe-handlers.test.ts
    - tests/notifications/whatsapp.test.ts
decisions:
  - D-16 (WhatsApp SIDs as TypeScript constants) overridden — env vars required for production configurability without code deployment
  - Unknown Stripe price IDs now fail-fast (error + return) instead of silently defaulting to 'basic' tier
  - Stripe checkout blocks trialing + past_due in addition to active (prevents duplicate subscriptions)
metrics:
  duration: ~25min
  completed: "2026-05-20"
  tasks_completed: 5
  files_changed: 13
---

# Phase 7 Plan 07: Gap-Closure (BLOCKER + HIGH Findings) Summary

**One-liner:** Fixed 5 BLOCKER + 6 HIGH production-safety issues: schema column mismatches, open-redirect, Telegram auth bypass, client/server mismatch, hardcoded secrets, and unsafe migration — making Phase 7 production-safe.

---

## What Was Built

Gap-closure plan targeting all 11 findings (5 BLOCKER, 6 HIGH) from the 2026-05-20 full codebase review. No new features — strictly correctness and security fixes across 9 source files, 1 migration, and 1 env example file.

---

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Fix schema mismatches in payment failure Inngest function and notification log | daaea83 | stripe-payment-failure.ts, payment-alert.ts |
| 2 | Fix Telegram secret guard, Stripe portal open-redirect, and checkout duplicate-subscription gate | daaea83 | telegram/route.ts, portal/route.ts, checkout/route.ts |
| 3 | Fix server-client mismatch in recordings, invoice type safety, hardcoded WhatsApp SIDs, and hardcoded Stripe price IDs | daaea83 | recordings/route.ts, handlers.ts, whatsapp.ts, .env.example |
| 4 | Make email NOT NULL migration safe with DEFAULT guard | daaea83 | 20260514000011_add_contractor_email.sql |
| 5 | Full build and test verification | daaea83 | (tests only) |

---

## Findings Closed

### BLOCKER-01 — stripe-payment-failure.ts queried nonexistent columns
- **File:** `src/inngest/functions/stripe-payment-failure.ts`
- **Fix:** Changed `.select('id, retell_llm_id, phone, whatsapp_enabled')` to `.select('id, retell_llm_id, phone_number, notification_settings(whatsapp_number)')`. Updated `sendPaymentFailureAlert` call to pass `contractor.phone_number` and derive `whatsappEnabled` from nested notification_settings.

### BLOCKER-02 — payment-alert.ts wrote nonexistent columns to notification_log
- **File:** `src/lib/notifications/payment-alert.ts`
- **Fix:** Both `notification_log` inserts: removed `notification_type` (column doesn't exist), renamed `recipient_phone` → `recipient`, set `call_id: null` (non-UUID string fails FK), added `message` column. Captured `smsBody` const and threaded to `logPaymentAlertToDb`.

### BLOCKER-03 — Telegram webhook accepted unauthenticated messages when secret unset
- **File:** `src/app/api/webhooks/telegram/route.ts`
- **Fix:** Replaced `process.env.TELEGRAM_WEBHOOK_SECRET ?? ''` with a hard throw at module initialization. Without the secret, grammY skips all signature validation — the route now fails to load entirely, preventing unauthenticated injection.

### BLOCKER-04 — Stripe portal returnUrl used attacker-controlled Origin header
- **File:** `src/app/api/stripe/portal/route.ts`
- **Fix:** Replaced `new URL(req.headers.get('origin') ?? '')` with `process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL`. Returns 500 if neither is set. Origin header is no longer referenced.

### BLOCKER-05 — Checkout allowed trialing/past_due contractors to create duplicate subscriptions
- **File:** `src/app/api/stripe/checkout/route.ts`
- **Fix:** Replaced single `=== 'active'` check with `BLOCKED_STATUSES = ['active', 'trialing', 'past_due']` guard. Prevents contractors already in trial or with failed payment from creating a second Stripe subscription.

### HIGH-01 — recordings/route.ts used createBrowserClient in server API route
- **File:** `src/app/api/recordings/route.ts`
- **Fix:** Removed `createBrowserClient` import and `NEXT_PUBLIC_SUPABASE_ANON_KEY` usage. Replaced with `createServiceRoleClient` for signed URL generation (ownership already verified above via authenticated server client).

### HIGH-02 — handlers.ts bypassed type safety on invoice.subscription
- **File:** `src/app/api/webhooks/stripe/handlers.ts`
- **Fix:** Replaced `(invoice as any).subscription ?? invoice.id` with type-safe narrowing: defined `InvoiceWithSubscription` type extension, extracted `rawSub`, then narrowed string/object/null to `string | null`. No mixing of subscription IDs with invoice IDs.

### HIGH-03 — whatsapp.ts had hardcoded HXplaceholder Content SIDs
- **File:** `src/lib/notifications/whatsapp.ts`
- **Fix:** Removed `WHATSAPP_CONTENT_SIDS` const (D-16 overridden). Added `getWhatsAppContentSids()` function reading `TWILIO_WHATSAPP_SID_NEW_LEAD` / `TWILIO_WHATSAPP_SID_EMERGENCY` env vars. Added guard to throw if SID is empty. Updated `.env.example` with both entries.

### HIGH-04 — handlers.ts tier map used hardcoded test-mode Stripe price IDs
- **File:** `src/app/api/webhooks/stripe/handlers.ts`
- **Fix:** Replaced 3 hardcoded `price_1TWn...` keys with `process.env.STRIPE_BASIC_PLAN_ID`, `STRIPE_PROFESSIONAL_PLAN_ID`, `STRIPE_ENTERPRISE_PLAN_ID`. Unknown price IDs now fail-fast with `console.error + return` instead of silently defaulting to 'basic'.

### HIGH-05 — telegram/route.ts passed unvalidated contractorId to DB
- **File:** `src/app/api/webhooks/telegram/route.ts`
- **Fix:** Added UUID v4 regex guard (`/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`) after the `!contractorId` check. Malformed IDs return user-facing error without touching the DB, preventing Postgres 22P02 errors.

### HIGH-06 — Email NOT NULL migration would fail on orphaned contractor rows
- **File:** `supabase/migrations/20260514000011_add_contractor_email.sql`
- **Fix:** Rewrote to use safe idempotent pattern: `ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT ''` then `UPDATE` from auth.users for rows with empty-string email, then `ALTER COLUMN email DROP DEFAULT`. No row can have NULL after ADD COLUMN, so the NOT NULL constraint never fails.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test suite regressions from behavior changes**
- **Found during:** Task 5 (test verification)
- **Issue:** Three test files referenced the old behavior that was intentionally changed:
  - `tests/notifications/whatsapp.test.ts` imported `WHATSAPP_CONTENT_SIDS` (now `getWhatsAppContentSids()`)
  - `tests/api/stripe-handlers.test.ts` expected "defaults to basic" on unknown price IDs (now fails-fast)
  - `tests/api/stripe-checkout.test.ts` used `mockContractor` with `subscription_status: 'trialing'` (now blocked) and checked for `/active subscription/i` message (now `/subscription already exists/i`)
- **Fix:** Updated all three test files to match the new correct behavior. Added two new test cases for trialing and past_due BLOCKER-05 blocking.
- **Files modified:** tests/notifications/whatsapp.test.ts, tests/api/stripe-handlers.test.ts, tests/api/stripe-checkout.test.ts
- **Commit:** daaea83

---

## Verification Results

- `npm run build` — exits 0, all 9 changed source files compile cleanly
- `npm test -- --passWithNoTests` — 121 pass; 27 pre-existing failures (Wave-0 "not yet implemented" stubs + DB integration tests requiring live Supabase credentials — all pre-existing, none caused by this plan)
- `grep 'phone_number.*notification_settings' src/inngest/functions/stripe-payment-failure.ts` — 1 match
- `grep 'recipient_phone' src/lib/notifications/payment-alert.ts` — 0 matches
- `grep 'notification_type' src/lib/notifications/payment-alert.ts` — 0 matches
- `grep 'throw new Error' src/app/api/webhooks/telegram/route.ts` — 1 match
- `grep 'UUID_V4_REGEX' src/app/api/webhooks/telegram/route.ts` — 2 matches (declaration + usage)
- `grep 'NEXT_PUBLIC_APP_URL' src/app/api/stripe/portal/route.ts` — present
- `grep 'origin' src/app/api/stripe/portal/route.ts` — 0 matches
- `grep 'trialing' src/app/api/stripe/checkout/route.ts` — 1 match
- `grep 'createBrowserClient' src/app/api/recordings/route.ts` — 0 matches
- `grep 'HXplaceholder' src/lib/notifications/whatsapp.ts` — 0 matches
- `grep 'price_1TWn' src/app/api/webhooks/stripe/handlers.ts` — 0 matches
- `.env.example TWILIO_WHATSAPP_SID count` — 2
- Migration `IF NOT EXISTS` — present; `DEFAULT ''` — present; `DROP DEFAULT` — present

---

## Known Stubs

None introduced by this plan. All pre-existing stubs in Wave-0 test files are tracked in prior plan summaries.

---

## Threat Flags

None. All security-relevant surface was already in the plan's threat model (T-07-07-01 through T-07-07-06).

---

## Self-Check: PASSED

- [x] All 9 source files modified exist on disk
- [x] Migration file rewritten with safe pattern
- [x] Commit daaea83 exists: `git log --oneline | grep daaea83`
- [x] `npm run build` exits 0
- [x] All 11 BLOCKER/HIGH findings closed

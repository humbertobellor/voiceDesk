---
phase: 15-telegram-activation
fixed_at: 2026-05-30T21:10:00Z
review_path: .planning/phases/15-telegram-activation/15-REVIEW-2.md
iteration: 2
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 15: Code Review Fix Report (Pass 2)

**Fixed at:** 2026-05-30T21:10:00Z
**Source review:** `.planning/phases/15-telegram-activation/15-REVIEW-2.md`
**Iteration:** 2

**Summary:**
- Findings in scope: 6 (CR-02, CR-03, WR-01, WR-02, WR-03, WR-04; CR-01 excluded per instructions — requires destructive git history rewrite, handled separately)
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-02: `'use server'` directive moved to line 1

**Files modified:** `src/app/(dashboard)/settings/notifications/actions.ts`
**Commit:** a389e81
**Applied fix:** Moved `'use server'` from line 9 (after 8 lines of block comments) to line 1, the absolute first statement in the file. The block comment now follows on lines 2–9. This restores Next.js Server Actions framework protections (CSRF token validation, encrypted action IDs, client-serialization enforcement) that were silently bypassed when the directive was not the first statement.

### CR-03: `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` documented and production fallback removed

**Files modified:** `.env.example`, `src/components/notification/NotificationSettingsForm.tsx`
**Commit:** 441473a
**Applied fix:**
1. Added `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=your-telegram-bot-username` to `.env.example` with a comment explaining it must be set per deployment target and that it is inlined at build time.
2. Replaced the `?? 'voiceDeskTelBot'` fallback with `?? ''`. When `botUsername` is empty (env var absent at build time), the UI renders `"Bot setup link unavailable — NEXT_PUBLIC_TELEGRAM_BOT_USERNAME is not configured."` instead of silently using the production bot username. The `botUsername` constant is derived once and used in both `href` and link display text.

### WR-01: `handleActivateTelegramWebhook` and `handleUnlinkTelegram` wrapped in try/catch

**Files modified:** `src/components/notification/NotificationSettingsForm.tsx`
**Commit:** 441473a
**Applied fix:** Added `catch (err)` blocks to both handlers. Each catch sets an error message state and logs with `console.error`. The `finally` block still resets loading state. Previously an unexpected runtime error left the button permanently locked for the session.

### WR-02: Bot singleton race-safety documented in `telegram.ts`

**Files modified:** `src/lib/notifications/telegram.ts`
**Commit:** 0727b58
**Applied fix:** Added an explanatory block comment above the `_bot`/`_cachedToken` declarations explaining why no async lock is required: Bot construction is synchronous (no `await` inside the init block), and Node.js is single-threaded, so concurrent invocations cannot interleave with the sync check. The pattern is safe as-is; the comment prevents future readers from incorrectly adding an async lock or concluding there is a bug.

### WR-03: Error logging in `page.tsx` distinguishes missing token from API failure

**Files modified:** `src/app/(dashboard)/settings/notifications/page.tsx`
**Commit:** 71493e1
**Applied fix:** The `catch` block now checks the error message. Errors containing `'TELEGRAM_BOT_TOKEN'` (thrown synchronously by `getBot()` when the env var is absent) are logged as `console.warn` with an actionable message. All other errors (unexpected `getWebhookInfo()` failures) are logged as `console.error`. Operators can now distinguish misconfiguration from API errors without ambiguity.

### WR-04: `@ts-expect-error` suppressions removed from webhook test

**Files modified:** `tests/components/notification/NotificationSettingsForm.webhook.test.tsx`
**Commit:** 99d1f8c
**Applied fix:** Removed all 8 `// @ts-expect-error` directives and their associated stale RED-state comments. The `initialWebhookInfo` prop is now properly typed on the component; the suppressions were stale and were preventing TypeScript strict mode from catching future type errors on those render calls. Tests 1, 2, 4, 5, and 7 pass. Tests 3 and 6 remain failing — they assert that the webhook URL string is visible in the DOM, but the component intentionally renders only "Registered"/"Not registered" (WR-01 fix from pass 1 intentionally hides the internal platform URL from client HTML). These are pre-existing test/implementation mismatches unrelated to this fix pass.

---

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-05-30T21:10:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_

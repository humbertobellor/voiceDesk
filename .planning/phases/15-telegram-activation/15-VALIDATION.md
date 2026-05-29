---
phase: 15
slug: telegram-activation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-29
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 + React Testing Library 16.3.2 |
| **Config file** | vitest.config.ts (inherited from Next.js) |
| **Quick run command** | `npm test -- tests/actions/telegram-webhook.test.ts -x` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~30 seconds (quick), ~90 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- tests/actions/telegram-webhook.test.ts -x`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green + manual smoke test of Notifications Settings page
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-W0-01 | W0 | 0 | TEL-01 | — | N/A | unit | `npm test -- tests/integrations/notifications-page.test.tsx` | ❌ W0 | ⬜ pending |
| 15-W0-02 | W0 | 0 | TEL-02 | — | N/A | unit | `npm test -- tests/actions/telegram-webhook.test.ts` | ❌ W0 | ⬜ pending |
| 15-W0-03 | W0 | 0 | TEL-02 | — | N/A | unit | `npm test -- tests/components/notification/NotificationSettingsForm.test.tsx` | ❌ W0 | ⬜ pending |
| 15-01-01 | 01 | 1 | TEL-01 | — | `getWebhookInfo()` fetched server-side only; result passed as prop — no client-side Telegram API calls | integration | `npm test -- --grep "webhook.*status"` | ❌ W0 | ⬜ pending |
| 15-01-02 | 01 | 1 | TEL-02 | T-15-01 | Server action validates `TELEGRAM_WEBHOOK_URL` is non-empty HTTPS before calling `setWebhook` | unit | `npm test -- --grep "activate.*webhook"` | ❌ W0 | ⬜ pending |
| 15-01-03 | 01 | 1 | TEL-02 | T-15-01 | Error message displayed inline; page does not crash; previous status remains visible | unit | `npm test -- --grep "webhook.*error"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/actions/telegram-webhook.test.ts` — unit tests for `activateTelegramWebhook()` server action (mocked grammy, Supabase client)
- [ ] `tests/components/notification/NotificationSettingsForm.test.tsx` — rendering + interaction tests for webhook card (mocked server action)
- [ ] `tests/integrations/notifications-page.test.tsx` — Server Component + Client Component integration (mocked `getBot()`, verified prop threading)
- [ ] `.env.example` update — add `TELEGRAM_WEBHOOK_URL` entry

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Webhook status display on page load (real Telegram API) | TEL-01 | Requires live `TELEGRAM_BOT_TOKEN` and network access to Telegram API | Load Notification Settings page; verify status shows "Not registered" or a full HTTPS URL |
| Activate button triggers real webhook registration | TEL-02 | End-to-end requires live Telegram Bot API call | Click "Activate Telegram Webhook"; verify status updates to registered URL without page reload |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

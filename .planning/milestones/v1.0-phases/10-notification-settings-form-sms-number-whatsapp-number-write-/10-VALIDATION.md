---
phase: 10
slug: notification-settings-form-sms-number-whatsapp-number-write
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-23
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + @testing-library/react |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test -- --run src/lib/query/ src/inngest/functions/retell-notify-dispatch.test.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run src/lib/query/ src/inngest/functions/retell-notify-dispatch.test.ts`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | migration | 0 | NOTIF-01/02/03 | T-10-04 | Columns NOT NULL, defaults prevent NULL dispatch errors | unit | `npm run test -- --run src/inngest/functions/retell-notify-dispatch.test.ts` | ✅ (needs update) | ⬜ pending |
| 10-01-02 | types | 0 | NOTIF-01/02/03 | — | N/A | type-check | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 10-02-01 | form stubs | 0 | PORTAL-04 | — | N/A | unit | `npm run test -- --run src/components/notification/NotificationSettingsForm.test.ts` | ❌ W0 | ⬜ pending |
| 10-02-02 | api stubs | 0 | PORTAL-04 | T-10-01/02 | RLS enforced; contractor_id from session | integration | `npm run test -- --run src/app/api/notification-settings/route.test.ts` | ❌ W0 | ⬜ pending |
| 10-02-03 | unlink stubs | 0 | NOTIF-03 | T-10-01 | telegram_chat_id = NULL; auth required | integration | `npm run test -- --run src/app/api/notification-settings/telegram/unlink.test.ts` | ❌ W0 | ⬜ pending |
| 10-03-01 | NotificationSettingsForm | 1 | PORTAL-04 | — | N/A | unit | `npm run test -- --run src/components/notification/NotificationSettingsForm.test.ts` | ❌ W0 | ⬜ pending |
| 10-03-02 | PATCH route | 1 | PORTAL-04 | T-10-01/02 | contractor_id from session only; phone normalized | integration | `npm run test -- --run src/app/api/notification-settings/route.test.ts` | ❌ W0 | ⬜ pending |
| 10-03-03 | unlink route | 1 | NOTIF-03 | T-10-01 | sets telegram_chat_id = NULL for auth user | integration | `npm run test -- --run src/app/api/notification-settings/telegram/unlink.test.ts` | ❌ W0 | ⬜ pending |
| 10-04-01 | computeChannels | 1 | NOTIF-01/02/03 | — | enable flags checked before dispatch | unit | `npm run test -- --run src/inngest/functions/retell-notify-dispatch.test.ts` | ✅ (needs update) | ⬜ pending |
| 10-04-02 | page wiring | 2 | PORTAL-04 | — | N/A | manual | Load settings/notifications page | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/notification/NotificationSettingsForm.test.ts` — stubs for form rendering, phone validation (D-04), single save button (D-05), Telegram status (D-06)
- [ ] `src/app/api/notification-settings/route.test.ts` — stubs for PATCH endpoint, phone normalization, RLS (IDOR guard from T-10-01)
- [ ] `src/app/api/notification-settings/telegram/unlink.test.ts` — stubs for POST unlink, sets telegram_chat_id = NULL
- [ ] Update `src/inngest/functions/retell-notify-dispatch.test.ts` — add test cases for notify_sms_enabled, notify_whatsapp_enabled, notify_telegram_enabled flags (D-07)

*(computeChannels tests exist from Phase 5; must be extended, not replaced)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Phone input accepts `3055551234`, `(305) 555-1234`, `305-555-1234` formats | D-04 | Browser input behavior requires DOM interaction | Load /settings/notifications; enter each format in SMS field; verify save succeeds without error |
| Telegram "Connected" → Unlink → "Not connected" transition | D-06 | Requires live Telegram bot state | Link Telegram bot; navigate to /settings/notifications; click Unlink; verify page shows "Not connected" + setup instructions |
| Settings persist across page reload | PORTAL-04 | Full round-trip test (Server Component fetch) | Save phone numbers + toggle states; reload page; verify values match what was saved |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

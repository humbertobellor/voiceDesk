---
phase: 13
slug: email-notifications
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-25
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + React Email testing utilities |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npm run test -- tests/notifications/email.test.ts tests/inngest/computeChannels.test.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~10 seconds (quick), ~30 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- tests/notifications/email.test.ts tests/inngest/computeChannels.test.ts`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-W0-01 | Wave 0 | 0 | EMAIL-02 | T-13-01 | computeChannels() email gating (6 tests) | unit | `npm run test -- tests/inngest/computeChannels.test.ts` | ❌ Wave 0 | ⬜ pending |
| 13-W0-02 | Wave 0 | 0 | EMAIL-02,03,04 | — | Template rendering: HTML output contains expected strings | unit | `npm run test -- tests/notifications/templates.test.ts` | ❌ Wave 0 | ⬜ pending |
| 13-01 | 01 | 1 | EMAIL-02 | T-13-01 | computeChannels() returns shouldSendEmail for lead intent with flags | unit | `npm run test -- tests/inngest/computeChannels.test.ts` | ❌ Wave 0 | ⬜ pending |
| 13-02 | 01 | 1 | EMAIL-05 | T-13-02 | notification_log row written with channel=email on success | integration | `npm run test -- tests/inngest/retell-notify-dispatch.test.ts` | ✅ extend | ⬜ pending |
| 13-03 | 02 | 1 | EMAIL-03 | T-13-03 | EmergencyNotificationEmail has EMERGENCY in subject and body | unit | `npm run test -- tests/notifications/templates.test.ts` | ❌ Wave 0 | ⬜ pending |
| 13-04 | 02 | 1 | EMAIL-04 | T-13-04 | PaymentFailureEmail has /settings/account link | unit | `npm run test -- tests/notifications/templates.test.ts` | ❌ Wave 0 | ⬜ pending |
| 13-05 | 03 | 2 | EMAIL-04 | T-13-04 | stripe-payment-failure triple-gate: all three flags required | unit | `npm run test -- tests/inngest/stripe-payment-failure.test.ts` | ✅ extend | ⬜ pending |
| 13-06 | 03 | 2 | EMAIL-05 | T-13-02 | notification_log with call_id=null for payment failure email | integration | `npm run test -- tests/inngest/stripe-payment-failure.test.ts` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/inngest/computeChannels.test.ts` — 6 tests: shouldSendEmail for lead intent with enabled+address, emergency intent, info intent (off by default), info intent (on if notify_on_general_inquiry), null email_address gate, notify_email_enabled=false gate
- [ ] `tests/notifications/templates.test.ts` — 4 tests: LeadNotificationEmail renders caller phone + service type + appointment status; EmergencyNotificationEmail has "EMERGENCY" in both subject and body + callback number; PaymentFailureEmail has "/settings/account" link; template renders without throwing
- [ ] Extend `tests/inngest/retell-notify-dispatch.test.ts` — 2 email-specific tests: email success writes notification_log with status='sent', email failure writes status='failed'
- [ ] Extend `tests/inngest/stripe-payment-failure.test.ts` — 2 email-specific tests: triple gate (all three flags required), log entry with call_id=null

*All other test infrastructure exists from Phase 5+*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Email arrives in contractor inbox within 60s of lead call | EMAIL-02 | Requires live Resend + real email address | Trigger test call → check email inbox within 60s |
| Payment failure email fires from Inngest stripe-payment-failure | EMAIL-04 | Requires live Stripe test webhook | Fire stripe `invoice.payment_failed` test event → check email inbox |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

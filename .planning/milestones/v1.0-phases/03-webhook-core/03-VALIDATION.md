---
phase: 3
slug: webhook-core
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-08
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run tests/api/webhook.test.ts tests/lib/classification.test.ts tests/lib/after-hours.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/api/webhook.test.ts tests/lib/classification.test.ts tests/lib/after-hours.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-00-01 | W0 | 0 | CALL-01 | — | Webhook returns 200 before any async work | unit | `npx vitest run tests/api/webhook.test.ts` | ❌ W0 | ⬜ pending |
| 03-00-02 | W0 | 0 | D-02 | spoofing | Invalid signature returns 401, not 200 | unit | `npx vitest run tests/api/webhook.test.ts` | ❌ W0 | ⬜ pending |
| 03-00-03 | W0 | 0 | D-05 | tampering | Duplicate call_ended for same call_id creates exactly one calls row | unit | `npx vitest run tests/api/webhook.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-01 | Migration | 1 | D-03 | — | analysis_status column exists on calls table | unit | `npx vitest run tests/api/webhook.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-02 | Migration | 1 | D-15 | — | notify_on_general_inquiry column exists on notification_settings | unit | `npx vitest run tests/api/webhook.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-01 | Classify | 2 | EMRG-02 | — | "gas smell" always returns intent=emergency regardless of LLM | unit | `npx vitest run tests/lib/classification.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-02 | Classify | 2 | EMRG-02 | — | "co alarm" always returns intent=emergency regardless of LLM | unit | `npx vitest run tests/lib/classification.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-03 | Classify | 2 | EMRG-01 | — | Non-hard-coded keywords pass to LLM (not auto-classified) | unit | `npx vitest run tests/lib/classification.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-04 | Classify | 2 | CALL-02 | — | LLM returns valid intent enum (lead/emergency/info/no_action) | unit (mocked) | `npx vitest run tests/lib/classification.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-05 | Classify | 2 | CALL-03 | — | Trade-specific extraction returns correct fields per trade_type | unit (mocked) | `npx vitest run tests/lib/classification.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-01 | AfterHours | 2 | CALL-04 | — | Call at 08:00 Mon inside business_hours returns is_after_hours=false | unit | `npx vitest run tests/lib/after-hours.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-02 | AfterHours | 2 | CALL-04 | — | Call at Saturday (disabled day) returns is_after_hours=true | unit | `npx vitest run tests/lib/after-hours.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-03 | AfterHours | 2 | CALL-04 | — | After-hours detection correctly handles DST transitions (America/New_York) | unit | `npx vitest run tests/lib/after-hours.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/api/webhook.test.ts` — stubs for CALL-01, D-02, D-05 (verify/reject/idempotency/200 response)
- [ ] `tests/lib/classification.test.ts` — stubs for CALL-02, CALL-03, EMRG-01, EMRG-02
- [ ] `tests/lib/after-hours.test.ts` — stubs for CALL-04 (business hours detection with DST)
- [ ] `tests/__mocks__/openai.ts` — mock OpenAI client (same pattern as existing `server-only` mock)
- [ ] `npm install openai date-fns-tz` — required before any test stubs compile

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Test call produces calls row with caller name, phone, duration, transcript, and intent within 5 min | CALL-01, CALL-02 | Requires live Retell test call to VoiceDesk number | Place test call to provisioned number; check Supabase calls table within 5 min |
| Gas smell keyword produces emergency classification end-to-end | EMRG-02 | Live call with real Retell pipeline | Say "I smell gas" during test call; verify intent=emergency in calls table |
| Duplicate webhook delivery produces exactly one calls row | D-05 | Requires Retell test dashboard replay | Use Retell webhook test feature to replay same event; verify single row |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

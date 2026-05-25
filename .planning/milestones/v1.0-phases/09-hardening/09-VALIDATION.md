---
phase: 9
slug: 09-hardening
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-20
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + jsdom |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/notifications/telegram.test.ts tests/ui/phone-settings.test.tsx` |
| **Full suite command** | `npx vitest run tests/` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | NOTIF-03 | — | N/A | grep | `grep -rn "VoiceDeskBot" src/ \| wc -l` returns 0 | ✅ | ⬜ pending |
| 09-01-02 | 01 | 1 | — | — | N/A | manual | Inspect Vercel runtime logs for structured JSON format | N/A | ⬜ pending |
| 09-01-03 | 01 | 1 | EMRG-01 | — | N/A | grep | `grep -n "KeywordsForm\|emergency_keywords" src/app/\(dashboard\)/settings/agent/page.tsx` | ✅ | ⬜ pending |
| 09-02-W0 | 02 | 1 | ONBOARD-01 | — | N/A | unit | `npx vitest run tests/ui/phone-settings.test.tsx` (stubs — RED) | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 1 | ONBOARD-01 | T-09-02-01 | contractor_id derived from JWT not form body | unit | `npx vitest run tests/ui/phone-settings.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/ui/phone-settings.test.tsx` — stubs for ONBOARD-01 (provisioning form renders, API call, error states)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Structured log emitted on after() catch | D-02 | console.error cannot be meaningfully unit-tested in Next.js after() closure without significant test infrastructure | Trigger a test Retell webhook with invalid payload; inspect Vercel runtime logs for JSON with event, contractor_id, error keys |
| Inngest onFailure handlers emit structured log | D-02 | Inngest onFailure runs in cloud context | Trigger a failing Inngest run; inspect Inngest dashboard for structured log line |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (tests/ui/phone-settings.test.tsx)
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

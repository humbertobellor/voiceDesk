---
phase: 2
slug: provisioning
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-06
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.5 |
| **Config file** | `vitest.config.ts` (exists from Phase 1) |
| **Quick run command** | `npx vitest run tests/lib/ --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/lib/ --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd-verify-work`:** Full suite green + `npx tsc --noEmit` + `supabase db push` succeeds
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | LANG-01 | T-2-01 | Language type does not include 'ht' | unit | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | D-01 | — | N/A | unit | `npx vitest run tests/lib/validations.test.ts -x` | ❌ W0 | ⬜ pending |
| 2-01-03 | 02 | 2 | LANG-01 | — | N/A | unit | `npx vitest run tests/lib/retell-language-mapper.test.ts -x` | ❌ | ⬜ pending |
| 2-02-01 | 02 | 1 | D-11 | T-2-02 | agent_sync_status column exists | integration | `npx vitest run tests/db/provisioning.test.ts -x` | ❌ W0 | ⬜ pending |
| 2-03-01 | 03 | 2 | LANG-01 | — | N/A | unit | `npx vitest run tests/lib/system-prompt.test.ts -x` | ❌ W0 | ⬜ pending |
| 2-04-01 | 04 | 2 | D-12 | T-2-03 | Already-provisioned returns 409 | unit | `npx vitest run tests/api/provisioning.test.ts -x` | ❌ W0 | ⬜ pending |
| 2-04-02 | 04 | 2 | D-10 | — | 422 with area code suggestions | unit | `npx vitest run tests/api/provisioning.test.ts -x` | ❌ W0 | ⬜ pending |
| 2-05-01 | 05 | 3 | D-11 | T-2-04 | DB written before Retell; Inngest queued on failure | unit | `npx vitest run tests/api/provisioning.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lib/system-prompt.test.ts` — stubs for LANG-01 prompt builder (EN-only, EN+ES)
- [x] `tests/lib/validations.test.ts` — HC removal from zod schema (`['ht']` → parse error)
- [ ] `tests/api/provisioning.test.ts` — API route unit tests (mocked Retell client)
- [x] `tests/db/provisioning.test.ts` — `agent_sync_status` column existence (live Supabase)
- [x] Package installs: `npm install retell-sdk@5.18.0 inngest@4.3.0`
- [ ] `src/app/api/inngest/route.ts` — Inngest serve endpoint (required before any `inngest.send()` works)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Test call answered by Retell agent within 3 rings | Success Criterion 2 | Requires live Retell + active phone number | Dial provisioned number; confirm AI answers within 3 rings, not voicemail |
| Agent greets with configured business name | Success Criterion 3 | Requires live Retell agent + audio verification | Listen to greeting; confirm business name + "Para español, oprima dos" if Spanish enabled |
| Voice ID `elevenlabs-myra` is valid Retell voice | A3 | Requires Retell voice catalog lookup | Check Retell dashboard voice list before executing plan 04; substitute if invalid |
| `agent_sync_status` banner visible in portal | D-12 | Phase 6 portal not yet built | Verify column value set correctly; banner tested in Phase 6 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** Wave 0 items from Plans 02-01a and 02-01b complete — remaining items (system-prompt.test.ts, api/inngest/route.ts, tests/api/provisioning.test.ts) delivered by Plans 02, 03, and 04

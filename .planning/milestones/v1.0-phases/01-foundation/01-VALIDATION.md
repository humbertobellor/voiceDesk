---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-04
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (unit) + Supabase local (RLS) + playwright (e2e auth) |
| **Config file** | `vitest.config.ts` — Wave 0 installs |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run && npx playwright test --reporter=list` |
| **Estimated runtime** | ~30 seconds (unit) / ~90 seconds (with playwright) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run && npx playwright test --reporter=list`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds (unit only)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-schema-01 | schema | 1 | LANG-01, LANG-02 | T-1-01 | contractor_settings.supported_languages only allows [en,es,ht] | unit | `npx vitest run tests/schema.test.ts` | ❌ W0 | ⬜ pending |
| 1-rls-01 | schema | 1 | — | T-1-02 | Unprivileged user cannot SELECT another tenant's contractors row | integration | `npx supabase test db` | ❌ W0 | ⬜ pending |
| 1-rls-02 | schema | 1 | — | T-1-02 | Unprivileged user cannot INSERT into another tenant's rows | integration | `npx supabase test db` | ❌ W0 | ⬜ pending |
| 1-rls-03 | schema | 1 | — | T-1-02 | Unprivileged user cannot UPDATE another tenant's rows | integration | `npx supabase test db` | ❌ W0 | ⬜ pending |
| 1-rls-04 | schema | 1 | — | T-1-02 | Unprivileged user cannot DELETE another tenant's rows | integration | `npx supabase test db` | ❌ W0 | ⬜ pending |
| 1-idempotency-01 | schema | 1 | — | T-1-03 | webhook_events unique constraint on (source, event_type, external_id) rejects duplicates | integration | `npx supabase test db` | ❌ W0 | ⬜ pending |
| 1-encrypt-01 | auth | 2 | — | T-1-04 | AES-256-GCM encrypt(x) then decrypt returns x | unit | `npx vitest run tests/crypto.test.ts` | ❌ W0 | ⬜ pending |
| 1-encrypt-02 | auth | 2 | — | T-1-04 | Two encryptions of same value produce different ciphertexts (random IV) | unit | `npx vitest run tests/crypto.test.ts` | ❌ W0 | ⬜ pending |
| 1-encrypt-03 | auth | 2 | — | T-1-04 | Decrypt with wrong key throws error, does not return plaintext | unit | `npx vitest run tests/crypto.test.ts` | ❌ W0 | ⬜ pending |
| 1-auth-01 | auth | 2 | LANG-01 | — | Signup → redirects to /setup/phone, not dashboard | e2e | `npx playwright test tests/auth.spec.ts` | ❌ W0 | ⬜ pending |
| 1-auth-02 | auth | 2 | — | — | Phone capture completes → redirects to /dashboard | e2e | `npx playwright test tests/auth.spec.ts` | ❌ W0 | ⬜ pending |
| 1-lang-01 | settings | 3 | LANG-02 | — | contractor_settings.supported_languages stored and retrieved correctly | unit | `npx vitest run tests/settings.test.ts` | ❌ W0 | ⬜ pending |
| 1-defaults-01 | settings | 3 | LANG-01 | — | Account creation populates emergency_keywords with defaults for all enabled languages | unit | `npx vitest run tests/settings.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/schema.test.ts` — stubs for supported_languages CHECK constraint validation
- [ ] `tests/crypto.test.ts` — stubs for AES-256-GCM encrypt/decrypt round-trip
- [ ] `tests/settings.test.ts` — stubs for contractor_settings defaults and language selection
- [ ] `tests/auth.spec.ts` — playwright stubs for signup → phone capture → dashboard flow
- [ ] `supabase/tests/rls.test.sql` — pg_tap tests for RLS policies (all 4 operations, all tables)
- [ ] `vitest.config.ts` — vitest configuration (install vitest, @vitest/coverage-v8)
- [ ] `playwright.config.ts` — playwright configuration (install @playwright/test)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Google OAuth sign-in flow | — | Requires live Google OAuth credentials in browser | Start dev server, click "Continue with Google", complete OAuth flow, verify redirect to /setup/phone |
| Dashboard shell visual inspection | — | Visual layout (navy + orange, responsive breakpoints) cannot be fully automated | Open /dashboard on mobile viewport (375px) and desktop (1280px), verify nav collapses to bottom bar on mobile |
| "Complete Setup" banner visible on new account | D-12 | Requires end-to-end account creation | After full signup, verify prominent banner appears at top of dashboard with setup progress indicator |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

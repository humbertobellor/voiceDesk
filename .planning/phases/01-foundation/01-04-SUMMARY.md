---
phase: 01-foundation
plan: "04"
subsystem: auth
tags: [auth, middleware, oauth, phone-capture, onboarding]
dependency_graph:
  requires: [01-01, 01-02, 01-03]
  provides: [auth-flow, phone-capture-gate, onboarding-api]
  affects: [01-05]
tech_stack:
  added:
    - class-variance-authority (required by shadcn/ui Button + Label)
  patterns:
    - getUser-not-getSession (Supabase SSR Pitfall 2 enforcement)
    - dual-cookie-write (Pitfall 3: request + response cookies in middleware)
    - phone-capture-gate (Pitfall 4: null row AND null phone_number → /setup/phone)
    - service-role-isolation (anon client for identity; service role for DB writes)
    - idempotent-upsert (existing contractor row → update, not duplicate insert)
    - rollback-cascade (3-table insert with sequential rollback on failure)
key_files:
  created:
    - middleware.ts
    - src/app/(auth)/auth/callback/route.ts
    - src/app/(auth)/auth/login/page.tsx
    - src/app/(auth)/auth/signup/page.tsx
    - src/app/(auth)/setup/phone/page.tsx
    - src/app/api/onboarding/create-account/route.ts
    - src/components/auth/LoginForm.tsx
    - src/components/auth/SignupForm.tsx
    - src/components/auth/PhoneCaptureForm.tsx
    - src/components/ui/button.tsx
    - src/components/ui/card.tsx
    - src/components/ui/input.tsx
    - src/components/ui/label.tsx
    - src/app/(dashboard)/dashboard/page.tsx
  modified:
    - tests/middleware/phone_capture.test.ts
    - package.json
    - tsconfig.json
decisions:
  - "middleware matcher excludes api/onboarding/create-account to avoid double auth check (API route does its own getUser)"
  - "LoginForm uses local loginSchema (email+min1password) not signupSchema — avoids confirmPassword field in login context"
  - "idempotency path in create-account route: existing contractor row is updated (not rejected) to support form re-submission"
  - "class-variance-authority installed as deviation Rule 3 (blocking: shadcn Button/Label fail tsc without it)"
metrics:
  duration: "9 min"
  completed: "2026-05-04"
  tasks_completed: 2
  files_created: 14
  files_modified: 3
---

# Phase 1 Plan 04: Auth Flow + Phone Capture Summary

**One-liner:** Google OAuth + email/password auth with cookie-dual-write middleware, phone capture gate using getUser(), and atomic 3-table onboarding API using service role.

---

## What Was Built

### Task 1: shadcn/ui primitives + Middleware + OAuth callback + Login/Signup pages

**Commit:** 39afc18

- **`middleware.ts`** — Route protection + phone capture gate using `getUser()` (not `getSession()`). Cookies written to BOTH `request.cookies` and `response.cookies` (Pitfall 3). Handles both "no contractor row" AND "contractor row with null phone_number" → /setup/phone (Pitfall 4).
- **`src/app/(auth)/auth/callback/route.ts`** — PKCE-based OAuth code exchange via `exchangeCodeForSession`. Redirects to `/setup/phone` on success.
- **`src/components/auth/LoginForm.tsx`** — Client component. Google OAuth (orange CTA, primary per D-01) + email/password (outline secondary). Uses `access_type: 'offline'` + `prompt: 'consent'` for Phase 4 calendar refresh tokens.
- **`src/components/auth/SignupForm.tsx`** — Client component. Mirrors login with `signUp()`. Email + password + confirm password fields.
- **`src/app/(auth)/auth/login/page.tsx`** — Server component wrapper; passes OAuth error params to LoginForm.
- **`src/app/(auth)/auth/signup/page.tsx`** — Server component wrapper.
- **`src/components/ui/{button,card,input,label}.tsx`** — shadcn/ui primitives installed via `npx shadcn@latest add`.
- **`tests/middleware/phone_capture.test.ts`** — 4 real assertions replace Wave 0 placeholders. All 4 pass.

### Task 2: Phone capture form + setup page + create-account API + dashboard placeholder

**Commit:** 8b25996

- **`src/components/auth/PhoneCaptureForm.tsx`** — Client component. Validates with `phoneSchema` from onboarding.ts. POSTs to `/api/onboarding/create-account`. Shows "One more thing" heading + 3 fields + "Complete Setup" CTA + "Sign out instead" link.
- **`src/app/(auth)/setup/phone/page.tsx`** — Server component. Guards unauthenticated users (→ /auth/login). If contractor already has phone_number, redirects to /dashboard.
- **`src/app/api/onboarding/create-account/route.ts`** — POST handler. `getUser()` auth check, `phoneSchema.safeParse` validation, service role for 3-table insert: `contractors` + `contractor_settings` + `notification_settings`. Idempotent retry path (update existing). Rollback cascade on partial failure.
- **`src/app/(dashboard)/dashboard/page.tsx`** — Placeholder page. Plan 05 replaces with full dashboard shell.

---

## Verification Results

| Check | Result |
|-------|--------|
| `npx vitest run --no-coverage tests/middleware/phone_capture.test.ts` | 4/4 PASS |
| `npx tsc --noEmit` | Exit 0 |
| `npx next build` | Exit 0 — 6 routes compiled |
| `grep -c getSession middleware.ts` (code only) | 0 (only in comment) |
| `grep -c 'response.cookies.set' middleware.ts` | 1 |
| `grep -c 'request.cookies.set' middleware.ts` | 1 |
| `grep -c createServiceRoleClient route.ts` | 2 |
| `grep -rn 'SUPABASE_SERVICE_ROLE_KEY' src/` | Only in service.ts (not in route.ts directly) |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] class-variance-authority missing**
- **Found during:** Task 1 TypeScript check
- **Issue:** `npx tsc --noEmit` failed with "Cannot find module 'class-variance-authority'" in `src/components/ui/button.tsx` and `label.tsx`. The shadcn/ui installer does not automatically add this dependency to package.json even though the generated code requires it.
- **Fix:** `npm install class-variance-authority --legacy-peer-deps`
- **Files modified:** `package.json`, `package-lock.json`
- **Commit:** 39afc18 (included in Task 1 commit)

---

## Known Stubs

- **`src/app/(dashboard)/dashboard/page.tsx`** — Placeholder with static text "Account created. Plan 05 will fill in the full shell." This is intentional per the plan spec; Plan 05 replaces it with the full dashboard shell, sidebar, and Setup Banner.

---

## Threat Surface Scan

No new threat surface beyond what the plan's `<threat_model>` already covers. All 6 STRIDE threats (T-1-S11 through T-1-S16) are mitigated by the implementation:

| Threat | Mitigation Confirmed |
|--------|---------------------|
| T-1-S11 (Spoofing on create-account) | `getUser()` called before any DB write; 401 if no user |
| T-1-S12 (Phone number injection) | `phoneSchema.safeParse` with `/^\+1\d{10}$/` regex before any DB write |
| T-1-S13 (Session cookie spoofing) | middleware uses `getUser()` not `getSession()` |
| T-1-S14 (Account creation race) | `maybeSingle()` check before insert; update path if row exists |
| T-1-S15 (Middleware bypass) | matcher excludes only static assets + create-account (has own auth); /dashboard and /setup gated |
| T-1-S16 (CSRF on OAuth callback) | Supabase PKCE flow via `exchangeCodeForSession` |

---

## Checkpoint Pending

**Task 3** is a `checkpoint:human-verify`. The automated build is green. The following browser verifications are pending human execution:

1. Visual check: `/auth/login` — orange Google CTA prominent, email/password below divider
2. Visual check: `/auth/signup` — "Create your account" heading
3. Auth flow: signup with email → auto-login → `/setup/phone` redirect
4. Phone capture: submit with valid data → `/dashboard` placeholder
5. Gate: revisit `/setup/phone` after phone captured → redirects to `/dashboard`
6. Gate: sign out, visit `/dashboard` → redirects to `/auth/login`
7. Google OAuth: (requires Supabase Google provider configured)
8. Database: verify contractors + contractor_settings + notification_settings rows created

---

## Self-Check

Checking created files exist:

- middleware.ts: FOUND
- src/app/(auth)/auth/callback/route.ts: FOUND
- src/app/(auth)/auth/login/page.tsx: FOUND
- src/app/(auth)/auth/signup/page.tsx: FOUND
- src/app/(auth)/setup/phone/page.tsx: FOUND
- src/app/api/onboarding/create-account/route.ts: FOUND
- src/components/auth/LoginForm.tsx: FOUND
- src/components/auth/SignupForm.tsx: FOUND
- src/components/auth/PhoneCaptureForm.tsx: FOUND
- src/components/ui/button.tsx: FOUND
- src/components/ui/card.tsx: FOUND
- src/components/ui/input.tsx: FOUND
- src/components/ui/label.tsx: FOUND
- src/app/(dashboard)/dashboard/page.tsx: FOUND
- tests/middleware/phone_capture.test.ts: FOUND

Checking commits:
- 39afc18: FOUND (Task 1)
- 8b25996: FOUND (Task 2)

## Self-Check: PASSED

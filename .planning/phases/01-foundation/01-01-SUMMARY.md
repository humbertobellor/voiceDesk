---
phase: 01-foundation
plan: 01
subsystem: infra
tags: [nextjs, tailwind, typescript, vitest, playwright, supabase, shadcn, inter-font]

# Dependency graph
requires: []
provides:
  - Next.js 16.2.4 App Router project with all Phase 1 dependencies installed
  - Tailwind CSS v4 with navy (#0F172A) + orange (#F97316) design tokens
  - Inter font wired into root layout via next/font/google
  - shadcn/ui pre-configured via components.json (new-york style)
  - cn() utility helper in src/lib/utils.ts
  - vitest 4.1.5 + playwright 1.59.1 test infrastructure
  - Wave 0 test stubs for crypto (D-17), RLS (D-18), webhook idempotency (D-16), language constraint (LANG-02), phone capture (D-02)
  - src/lib/crypto/tokens.ts stub (throw-on-call, resolved by Plan 03)
  - .env.example and .env.test.example documenting all required env vars
  - Service role key env var separation enforced (no NEXT_PUBLIC_ prefix)
affects: [01-02, 01-03, 01-04, 01-05]

# Tech tracking
tech-stack:
  added:
    - next@16.2.4
    - react@^19.0.0
    - "@supabase/ssr@0.10.2"
    - "@supabase/supabase-js@2.105.1"
    - react-hook-form@7.75.0
    - zod@4.4.2
    - lucide-react@1.14.0
    - clsx, tailwind-merge
    - libphonenumber-js
    - tailwindcss@4.2.4
    - vitest@4.1.5
    - "@testing-library/react@16.3.2"
    - "@playwright/test@1.59.1"
  patterns:
    - Tailwind v4 with @import 'tailwindcss' in globals.css (not @tailwind directives)
    - postcss.config.mjs uses @tailwindcss/postcss plugin
    - Inter font via next/font/google with CSS variable --font-inter
    - CSS custom properties for design tokens in :root
    - Wave 0 stubs: test files import future modules; stubs throw meaningful errors

key-files:
  created:
    - package.json
    - tsconfig.json
    - next.config.ts
    - tailwind.config.ts
    - postcss.config.mjs
    - src/app/layout.tsx
    - src/app/globals.css
    - src/lib/utils.ts
    - src/lib/crypto/tokens.ts
    - components.json
    - vitest.config.ts
    - playwright.config.ts
    - tests/setup.ts
    - tests/lib/crypto.test.ts
    - tests/db/rls.test.ts
    - tests/db/webhook_events.test.ts
    - tests/db/contractor_settings.test.ts
    - tests/middleware/phone_capture.test.ts
    - tests/auth.spec.ts
    - .env.example
    - .env.test.example
    - .gitignore
  modified: []

key-decisions:
  - "Next.js 16.2.4 used (RESEARCH.md recommends current stable; CLAUDE.md says 14+ — assumption A1 in RESEARCH.md accepted)"
  - "Tailwind CSS v4 config uses @import 'tailwindcss' (not @tailwind base/components/utilities from v3)"
  - "Crypto stub created in src/lib/crypto/tokens.ts so tsc --noEmit exits 0; Plan 03 replaces with real AES-256-GCM implementation"
  - "Service role key env var has NO NEXT_PUBLIC_ prefix — enforced by grep in acceptance criteria"
  - "Wave 0 stubs import future modules; they fail at runtime with throw errors (not module resolution errors) after crypto stub added"

patterns-established:
  - "Tailwind v4: use @import 'tailwindcss' not @tailwind directives"
  - "Design tokens: defined in tailwind.config.ts AND as CSS custom properties in globals.css :root"
  - "Test setup: tests/setup.ts sets OAUTH_ENCRYPTION_KEY deterministically for all crypto tests"
  - "Wave 0 stub pattern: test file exists + stub implementation throws 'not yet implemented' for correct TDD flow"
  - "Env var discipline: NEXT_PUBLIC_ prefix only for browser-safe values; service role key NEVER prefixed"

requirements-completed: []

# Metrics
duration: 6min
completed: 2026-05-04
---

# Phase 1 Plan 01: Scaffold Summary

**Next.js 16 App Router project with Tailwind v4 navy/orange design tokens, Inter font, and Wave 0 test stubs for crypto, RLS, webhook idempotency, language constraints, and phone capture middleware**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-04T10:26:03Z
- **Completed:** 2026-05-04T10:32:00Z
- **Tasks:** 2
- **Files modified:** 23

## Accomplishments

- Bootstrapped greenfield Next.js 16.2.4 App Router project with all Phase 1 dependencies (492 packages installed)
- Configured Tailwind CSS v4 with navy (#0F172A) / orange (#F97316) design tokens in both tailwind.config.ts and CSS custom properties
- Wired Inter font via next/font/google into root layout; shadcn/ui pre-configured via components.json (new-york style) for downstream `npx shadcn@latest add` commands
- Created all 5 Wave 0 unit/integration test stubs from RESEARCH.md exact content (crypto, RLS, webhook_events, contractor_settings, phone_capture) plus Playwright e2e stub
- Established service role key env var separation (no NEXT_PUBLIC_ prefix) verified by grep in acceptance criteria

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize Next.js project, Tailwind v4, Inter font, shadcn/ui** - `adbf1f8` (feat)
2. **Task 2: Wave 0 test infrastructure — vitest + playwright + 5 test stubs** - `c05b5c2` (chore)
3. **Auto-fix: Crypto stub for tsc --noEmit** - `1d26c32` (fix)

**Plan metadata:** (pending final metadata commit)

## Files Created/Modified

- `package.json` - All Phase 1 dependencies pinned (next 16.2.4, @supabase/ssr 0.10.2, vitest 4.1.5, etc.)
- `tsconfig.json` - TypeScript config with @/* path alias to src/
- `next.config.ts` - Next.js config with typedRoutes experimental flag
- `tailwind.config.ts` - Tailwind v4 with navy/orange design token colors + Inter font family
- `postcss.config.mjs` - Uses @tailwindcss/postcss plugin (v4 pattern)
- `src/app/globals.css` - @import 'tailwindcss' + CSS variables + prefers-reduced-motion
- `src/app/layout.tsx` - Root layout with Inter font, navy bg, html lang="en"
- `src/lib/utils.ts` - cn() helper using clsx + tailwind-merge
- `src/lib/crypto/tokens.ts` - Stub (throws "not yet implemented"); Plan 03 replaces with AES-256-GCM
- `components.json` - shadcn/ui config (new-york style, slate base, RSC enabled)
- `vitest.config.ts` - Vitest 4.1.5 with jsdom, @vitejs/plugin-react, @ alias
- `playwright.config.ts` - Playwright 1.59.1 with chromium and dev server webServer block
- `tests/setup.ts` - Sets deterministic OAUTH_ENCRYPTION_KEY for test suite
- `tests/lib/crypto.test.ts` - AES-256-GCM round-trip, tampered-ciphertext, random-IV tests (Wave 0)
- `tests/db/rls.test.ts` - Cross-tenant SELECT/UPDATE/INSERT isolation tests (Wave 0, D-18)
- `tests/db/webhook_events.test.ts` - Unique constraint (source, event_type, external_id) test (Wave 0, D-16)
- `tests/db/contractor_settings.test.ts` - supported_languages CHECK constraint test (Wave 0, LANG-02)
- `tests/middleware/phone_capture.test.ts` - Phone capture redirect placeholder tests (4 passing stubs)
- `tests/auth.spec.ts` - Playwright e2e stub with 3 skipped auth flow tests
- `.env.example` - Documents all env vars; service role key explicitly NOT NEXT_PUBLIC_
- `.env.test.example` - Documents RLS test fixture env vars (TEST_USER_A_JWT, etc.)
- `.gitignore` - Excludes .env* real secrets, node_modules/, .next/, coverage/

## Decisions Made

- Used Next.js 16.2.4 (RESEARCH.md recommends current stable; CLAUDE.md says "Next.js 14+" — treated as minimum, not ceiling per assumption A1)
- Tailwind CSS v4 uses `@import 'tailwindcss'` directive (not v3's `@tailwind base/components/utilities`)
- postcss.config.mjs uses `@tailwindcss/postcss` plugin instead of `tailwindcss` directly (v4 pattern)
- `SUPABASE_SERVICE_ROLE_KEY` env var name deliberately omits `NEXT_PUBLIC_` prefix (CLAUDE.md Critical Rule 3)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added crypto/tokens.ts stub to fix tsc --noEmit failure**
- **Found during:** Task 2 verification
- **Issue:** tests/lib/crypto.test.ts imports `@/lib/crypto/tokens` (created in Plan 03). Including test files in tsconfig.json causes `tsc --noEmit` to fail with "Cannot find module" error, breaking the Task 1 acceptance criterion
- **Fix:** Created `src/lib/crypto/tokens.ts` stub with throw-on-call exports so TypeScript resolves the import; Plan 03 replaces with real AES-256-GCM implementation
- **Files modified:** src/lib/crypto/tokens.ts (created)
- **Verification:** `npx tsc --noEmit` exits 0; `npx vitest run tests/lib/crypto.test.ts` discovers 5 tests and fails with "not yet implemented" (not module resolution error)
- **Committed in:** `1d26c32`

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Necessary for tsc to exit 0 per acceptance criteria. Crypto stub is intentionally incomplete and throws; Plan 03 replaces it. No scope creep.

## Known Stubs

- `src/lib/crypto/tokens.ts` — exports `encryptToken`/`decryptToken` that throw "not yet implemented". Plan 03 (D-17) will replace with AES-256-GCM implementation.
- `tests/middleware/phone_capture.test.ts` — 4 placeholder `expect(true).toBe(true)` assertions. Plan 04 will replace with real middleware mocks.
- `tests/auth.spec.ts` — 3 `test.skip` blocks. Plans 04/05 will fill in.
- `tests/db/rls.test.ts` — 6 `it.skip` blocks for leads/appointments/calendar_credentials/notification_log/notification_settings/webhook_events. Plan 05 seed script fills in.

## Issues Encountered

None beyond the crypto stub deviation documented above.

## User Setup Required

None - no external service configuration required for this scaffolding plan. Env vars are documented in `.env.example` and `.env.test.example` for contractor setup in later plans.

## Next Phase Readiness

- Plan 02 (Supabase schema + RLS migrations) can begin immediately — Next.js project is ready
- Plan 03 (crypto utility) can fill in `src/lib/crypto/tokens.ts` which already has the correct export signatures
- Plan 04 (middleware + auth pages) can use the test stubs in `tests/middleware/phone_capture.test.ts`
- All `npx shadcn@latest add <component>` commands will work with `components.json` in place

## Self-Check: PASSED

All 22 created files verified on disk. All 3 task commits confirmed in git log.

---
*Phase: 01-foundation*
*Completed: 2026-05-04*

---
phase: 01-foundation
plan: 05
subsystem: ui
tags: [nextjs, tailwindcss, supabase, rls, typescript, vitest, dashboard]

# Dependency graph
requires:
  - phase: 01-foundation
    plan: 03
    provides: languageSchema, createServiceRoleClient, createSupabaseServer, DB types
  - phase: 01-foundation
    plan: 04
    provides: auth middleware, dashboard placeholder at /dashboard, contractor table row
provides:
  - Dashboard shell at /dashboard with Server Component layout, Sidebar, SetupBanner, BottomTabBar
  - 6 dashboard page routes: /dashboard, /calls, /leads, /settings/agent, /settings/notifications, /settings/account
  - LanguageSettingsForm (Client Component) with 3 checkboxes (en/es/ht) + updateLanguages server action
  - LANG-02 wired end-to-end: DB CHECK constraint + zod languageSchema + service-role read + Server action mutation
  - seed-rls-test-fixtures.ts: idempotent seeder for 2 test contractors via auth.admin API
  - Full RLS isolation test suite: 19 assertions covering all 9 tables (D-18 satisfied)
  - All 33 Wave 0 vitest tests passing against live Supabase DB
affects: [02-provisioning, 03-webhook, 06-portal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Component layout pattern: auth + contractor data fetched once, passed to Client Components as props"
    - "Route<T> typed links: use `href as Route` cast when hrefs come from data arrays (typedRoutes experiment)"
    - "Active nav pattern: label === 'Settings' check instead of href === '/settings' (no /settings page, routes are /settings/agent etc)"
    - "TDD seed pattern: seed script → .env.test (gitignored) → test suite reads JWTs for authed Supabase clients"

key-files:
  created:
    - src/app/(dashboard)/layout.tsx
    - src/app/(dashboard)/calls/page.tsx
    - src/app/(dashboard)/leads/page.tsx
    - src/app/(dashboard)/settings/agent/page.tsx
    - src/app/(dashboard)/settings/agent/_components/LanguageSettingsForm.tsx
    - src/app/(dashboard)/settings/notifications/page.tsx
    - src/app/(dashboard)/settings/account/page.tsx
    - src/app/actions/settings.ts
    - src/components/dashboard/Sidebar.tsx
    - src/components/dashboard/SetupBanner.tsx
    - src/components/dashboard/EmptyState.tsx
    - src/components/dashboard/BottomTabBar.tsx
    - scripts/seed-rls-test-fixtures.ts
  modified:
    - src/app/(dashboard)/dashboard/page.tsx
    - tests/db/rls.test.ts
    - .env.test.example
    - .gitignore

key-decisions:
  - "LANG-02 server action uses getUser() not getSession() per RESEARCH.md Pitfall 2"
  - "LanguageSettingsForm uses form action (not react-hook-form) — simple checkbox list doesn't need full form library"
  - "Sidebar mainNav routes use /settings/agent (not /settings) to avoid needing a /settings/index page — isActive detection uses label === 'Settings' check"
  - "Route<T> cast pattern via `as Route` for dynamic hrefs in arrays (typedRoutes experiment strictness)"
  - "RLS test seeder uses auth.admin.deleteUser for idempotent re-seeding; JWTs written to .env.test (gitignored)"

requirements-completed:
  - LANG-02

# Metrics
duration: 7min
completed: 2026-05-05
---

# Phase 1 Plan 5: Dashboard Shell + RLS Isolation Tests Summary

**Full dashboard shell (Sidebar/SetupBanner/BottomTabBar + 6 page slots) with LANG-02 end-to-end wiring and all 9-table RLS isolation tests passing live against Supabase**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-05T23:28:11Z
- **Completed:** 2026-05-05T23:35:13Z
- **Tasks:** 2 of 3 (Task 3 is checkpoint:human-verify — awaiting visual inspection)
- **Files created/modified:** 17

## Accomplishments

- Dashboard shell at `/dashboard` renders with Sidebar nav (orange active-state border-l-4 + bg-[#1E293B]), SetupBanner (4-step progress, step 1 complete), BottomTabBar (hidden md:flex for mobile), and 6 page slots
- LANG-02 fully wired end-to-end at Phase 1: DB CHECK constraint (Plan 02) + zod `languageSchema` (Plan 03) + service-role default insert (Plan 04) + Server Component read + Client Component 3-checkbox form + `updateLanguages` server action mutation with revalidation
- RLS isolation test suite (19 assertions) passes against live Supabase DB for all 9 tables — D-18 satisfied: User A's anon client cannot SELECT/INSERT/UPDATE/DELETE User B's rows, and webhook_events deny-all is enforced
- All 33 Wave 0 vitest tests green (rls + contractor_settings + webhook_events + crypto + middleware/phone_capture)

## Task Commits

1. **Task 1: Dashboard shell, components, 6 page slots, LanguageSettingsForm, updateLanguages action** — `667223f` (feat)
2. **Task 2: Seed RLS fixtures + replace Wave 0 stubs with live assertions** — `25bb67e` (feat)
3. **Task 3: Checkpoint (human-verify)** — pending

**Plan metadata:** pending (Task 3 checkpoint — committed after human verification)

## Files Created/Modified

- `src/app/(dashboard)/layout.tsx` — Server Component layout: auth guard, phone gate, renders Sidebar + SetupBanner + BottomTabBar
- `src/components/dashboard/Sidebar.tsx` — Client Component: usePathname active-state, settings sub-nav reveal, sign-out handler
- `src/components/dashboard/SetupBanner.tsx` — 4-step progress banner (step 1 complete)
- `src/components/dashboard/EmptyState.tsx` — Reusable empty state (icon/heading/body/optional CTA)
- `src/components/dashboard/BottomTabBar.tsx` — Mobile bottom nav (flex md:hidden)
- `src/app/(dashboard)/dashboard/page.tsx` — LayoutDashboard empty state (replaced placeholder)
- `src/app/(dashboard)/calls/page.tsx` — PhoneCall empty state + "Complete Setup" CTA
- `src/app/(dashboard)/leads/page.tsx` — Users empty state + "Complete Setup" CTA
- `src/app/(dashboard)/settings/agent/page.tsx` — Server Component reading supported_languages via service role, rendering LanguageSettingsForm
- `src/app/(dashboard)/settings/agent/_components/LanguageSettingsForm.tsx` — Client Component: 3 checkboxes, min-1 enforced client-side, submits via updateLanguages
- `src/app/(dashboard)/settings/notifications/page.tsx` — Bell empty state (no CTA)
- `src/app/(dashboard)/settings/account/page.tsx` — CreditCard empty state (no CTA)
- `src/app/actions/settings.ts` — updateLanguages server action: getUser() auth + languageSchema.safeParse + service-role mutation + revalidatePath
- `scripts/seed-rls-test-fixtures.ts` — Idempotent seeder: auth.admin.createUser + contractor + settings + call + lead rows; outputs JWTs to stdout
- `tests/db/rls.test.ts` — Full 19-assertion suite; replaced all it.skip placeholders
- `.env.test.example` — Updated to document seed-script workflow
- `.gitignore` — Added `.env.test` (holds JWTs, must never be committed)

## Decisions Made

- Sidebar mainNav points to `/settings/agent` instead of `/settings` to avoid requiring a `/settings/index` route. Active detection uses `label === 'Settings'` check with `pathname.startsWith('/settings')`.
- `Route<T>` typed routes: dynamic href arrays use `as Route` cast. Literal string hrefs in JSX work without cast.
- `LanguageSettingsForm` uses React's `form action` (async function) rather than `onSubmit` handler because the server action receives `FormData` implicitly — simpler than react-hook-form for a 3-item checkbox list.
- RLS test seeder deletes any existing fixture user first (by email lookup) before re-creating, making it safe to run repeatedly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Typed routes (`experimental.typedRoutes`) required `as Route` cast for dynamic hrefs**

- **Found during:** Task 1 (build verification)
- **Issue:** `next build` failed with `Type 'string' is not assignable to type 'UrlObject | RouteImpl<string>'` in Sidebar and BottomTabBar because hrefs came from typed data arrays, not literal strings
- **Fix:** Added `import type { Route } from 'next'` and cast each href as `href as Route` in mainNav and settingsSubNav arrays. Also updated EmptyState `cta.href` type from `string` to `Route`
- **Files modified:** `src/components/dashboard/Sidebar.tsx`, `src/components/dashboard/BottomTabBar.tsx`, `src/components/dashboard/EmptyState.tsx`
- **Verification:** `npx next build` exits 0
- **Committed in:** `667223f` (Task 1 commit)

**2. [Rule 1 - Bug] Sidebar mainNav used `/settings` href which doesn't exist as a route**

- **Found during:** Task 1 (TypeScript check)
- **Issue:** `typedRoutes` enforces that all hrefs must match existing routes. `/settings` has no page file — only `/settings/agent`, `/settings/notifications`, `/settings/account` exist.
- **Fix:** Changed mainNav Settings entry href to `/settings/agent`; updated isActive check to use `label === 'Settings'` with `pathname.startsWith('/settings')` to keep the active state working for all settings sub-routes.
- **Files modified:** `src/components/dashboard/Sidebar.tsx`
- **Verification:** `npx tsc --noEmit` exits 0; Settings nav item highlights correctly for all `/settings/*` paths
- **Committed in:** `667223f` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - bugs found during build verification)
**Impact on plan:** Both fixes necessary for type-safe compilation with `typedRoutes` experiment. No scope creep.

## Issues Encountered

None beyond the Route type fixes documented above.

## User Setup Required

None — RLS test fixtures are seeded automatically by the seed script. Test JWT credentials are written to `.env.test` (gitignored).

## Known Stubs

None — all 6 page slots render real UI (EmptyState or LanguageSettingsForm). No hardcoded empty values flow to rendering.

## Next Phase Readiness

- Phase 1 is complete: schema + RLS + auth flow + dashboard shell + LANG-02 wiring all done
- Task 3 checkpoint awaits visual inspection of the dashboard at /dashboard (see checkpoint details below)
- After checkpoint approval: Phase 2 (Provisioning — Twilio + Retell) can begin

---
*Phase: 01-foundation*
*Completed: 2026-05-05*

---
phase: 10-notification-settings-form-sms-number-whatsapp-number-write
plan: "02"
subsystem: notification-settings
tags: [tdd, api-routes, react-query, green-phase, phone-normalization, idor]
dependency_graph:
  requires:
    - 10-01 (migration, types, RED stubs)
  provides:
    - src/app/api/notification-settings/route.ts (PATCH)
    - src/app/api/notification-settings/telegram/unlink/route.ts (POST)
    - src/lib/query/client.tsx#useNotificationSettings
    - src/lib/query/client.tsx#useUpdateNotificationSettings
    - src/lib/query/client.tsx#useTelegramUnlink
  affects:
    - Wave 3 (UI form component — consumes these hooks)
tech_stack:
  added: []
  patterns:
    - libphonenumber-js E.164 normalization with US default region
    - Service role client for contractor lookup (bypass RLS for FK join)
    - IDOR guard: contractor_id always from getUser() session, never request body
    - Defense-in-depth: session contractor_id filter + RLS (double enforcement)
    - React Query invalidateQueries on mutation success
key_files:
  created:
    - src/app/api/notification-settings/route.ts
    - src/app/api/notification-settings/telegram/unlink/route.ts
  modified:
    - tests/api/notification-settings.test.ts (RED stubs → GREEN tests)
    - tests/api/notification-settings-telegram-unlink.test.ts (RED stubs → GREEN tests)
    - src/lib/query/client.tsx (3 new hooks appended; existing hooks unchanged)
decisions:
  - "E.164 normalization uses parsePhoneNumber(input, 'US').format('E.164') from libphonenumber-js — consistent with Phase 5 notification dispatch pattern"
  - "PATCH route uses zod optional fields (not required) so partial updates are valid without sending all 8 fields"
  - "Unlink route takes no request body — POST with empty body signals intent; contractor identity from session only"
  - "Red test stubs replaced entirely with real tests that import and call actual route handlers"
metrics:
  duration_minutes: 8
  completed_date: "2026-05-23T21:26:58Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 3
---

# Phase 10 Plan 02: API Routes and React Query Hooks Summary

**One-liner:** PATCH notification-settings route with E.164 phone normalization + Telegram unlink POST route + 3 React Query hooks (query + 2 mutations) — all 9 API tests GREEN, tsc clean.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | PATCH + Telegram unlink routes | 9ccb3c8 | src/app/api/notification-settings/route.ts, src/app/api/notification-settings/telegram/unlink/route.ts, tests/api/notification-settings.test.ts, tests/api/notification-settings-telegram-unlink.test.ts |
| 2 | React Query hooks | 1d179d6 | src/lib/query/client.tsx |

## What Was Built

**Task 1 — API Routes:**

`PATCH /api/notification-settings`:
- Auth via `createSupabaseServer().auth.getUser()` → 401 if unauthenticated
- Contractor lookup via `createServiceRoleClient()` by `user_id` → 404 if not found
- Zod schema validation for 8 fields (all optional for partial updates)
- `normalizePhoneNumber()` using `parsePhoneNumber(input, 'US').format('E.164')` → 422 on invalid
- Accepts `null` for phone fields (clears them)
- DB update filtered by `contractor.id` from session (T-10-01 IDOR guard)
- Returns 200 with updated NotificationSettings row

`POST /api/notification-settings/telegram/unlink`:
- Same auth + service role contractor lookup pattern
- Sets `telegram_chat_id = null, updated_at = now()`
- Filtered by `contractor.id` from session
- Returns 200 with updated row; re-throws on DB error

**Task 2 — React Query hooks (appended to client.tsx):**
- `useNotificationSettings()`: useQuery, queryKey `['notification-settings', contractorId]`, enabled: !!contractorId
- `useUpdateNotificationSettings()`: useMutation, PATCH fetch, invalidates cache on success
- `useTelegramUnlink()`: useMutation, POST fetch, invalidates cache on success
- `NotificationSettings` added to import from `@/types/database`

## Deviations from Plan

None — plan executed exactly as written.

The test stubs from Plan 10-01 that threw "not yet implemented" were replaced with real tests that import and call the route handlers with Supabase mocks. This was the intended GREEN phase behavior — the stub files were overwritten in their entirety with proper test implementations.

## TDD Gate Compliance

Wave 2 is the GREEN phase of the TDD cycle started in Wave 1 (Plan 10-01):
- RED commit (Plan 10-01): 925ec0a — test stubs established
- GREEN commit (Plan 10-02): 9ccb3c8 — routes implemented, tests pass
- All 9 tests GREEN; tsc exits 0

## Known Stubs

None — both API routes are fully implemented. No placeholder data or TODO patterns in production code.

## Threat Flags

None — no new network endpoints beyond those specified in the plan's threat model. T-10-01 (IDOR) and T-10-02 (phone tampering) are both mitigated as planned.

## Self-Check: PASSED

- [x] `src/app/api/notification-settings/route.ts` exists and exports `PATCH`
- [x] `src/app/api/notification-settings/telegram/unlink/route.ts` exists and exports `POST`
- [x] PATCH route returns 401 for unauthenticated requests (test GREEN)
- [x] PATCH route normalizes phone to E.164 (test GREEN)
- [x] PATCH route returns 422 for invalid phone (test GREEN)
- [x] PATCH route derives contractor_id from session (test GREEN, grep confirms no body.contractor_id)
- [x] PATCH route persists all 8 fields (test GREEN)
- [x] Unlink route returns 401 for unauthenticated requests (test GREEN)
- [x] Unlink route sets telegram_chat_id = NULL (test GREEN)
- [x] Unlink route derives contractor_id from session (test GREEN)
- [x] `useNotificationSettings` exported from client.tsx
- [x] `useUpdateNotificationSettings` exported from client.tsx
- [x] `useTelegramUnlink` exported from client.tsx
- [x] `NotificationSettings` imported from `@/types/database` in client.tsx
- [x] Existing hooks unmodified (useCalls, useUpdateLeadStatus, useContractorSettings, etc.)
- [x] `npx tsc --noEmit` exits 0
- [x] Commits 9ccb3c8 and 1d179d6 exist in git log

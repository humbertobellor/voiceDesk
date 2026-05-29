---
phase: 14-in-app-notification-bell
plan: 03
subsystem: api
tags: [tdd, vitest, notifications, supabase, zod, email]

# Dependency graph
requires:
  - 14-01: mark-all-read.test.ts RED stubs from Plan 14-01
provides:
  - "src/app/api/notifications/mark-all-read/route.ts: PATCH handler GREEN (3/3 tests)"
  - "src/app/api/notification-settings/route.ts: Zod schema extended with email_address + notify_email_enabled"
affects:
  - 14-04: NotificationSettingsForm email card can now save email fields via PATCH

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PATCH route: auth → contractor lookup → UPDATE app_notifications WHERE is_read=false"
    - "IDOR guard: contractor_id from session-derived lookup, body ignored entirely"
    - "Vitest dynamic import in test for post-stub route module access"
    - "Zod schema extension: additive fields to existing object schema"

key-files:
  created:
    - src/app/api/notifications/mark-all-read/route.ts
  modified:
    - tests/notifications/mark-all-read.test.ts
    - src/app/api/notification-settings/route.ts

key-decisions:
  - "Test 3 uses a thenable mock on the notifications update chain to allow await without .single()"
  - "email_address uses z.string().email().nullable().optional() — invalid format rejected at Zod parse (400-level response)"
  - "Route ignores request body entirely (no req.json()) — eliminates body-injection attack surface"

# Metrics
duration: 12min
completed: 2026-05-29
---

# Phase 14 Plan 03: Mark-All-Read Route and Email Schema Extension Summary

**PATCH /api/notifications/mark-all-read implemented GREEN (3/3 tests); notification-settings Zod schema extended with email_address and notify_email_enabled for EMAIL-01**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-29T11:17:00Z
- **Completed:** 2026-05-29T11:19:00Z
- **Tasks:** 3 (RED confirmation + GREEN implementation + schema extension)
- **Files modified:** 3

## Accomplishments

- Verified RED gate: all 3 mark-all-read stubs failed with "not implemented" before implementation
- Created `src/app/api/notifications/mark-all-read/route.ts` implementing PATCH handler with auth guard, contractor lookup, and UPDATE app_notifications WHERE is_read=false
- Updated `tests/notifications/mark-all-read.test.ts` with real assertions — all 3 tests GREEN
- Extended `src/app/api/notification-settings/route.ts` Zod schema with `email_address` and `notify_email_enabled`; added both to updatePayload builder

## Task Commits

1. **PATCH /api/notifications/mark-all-read route + GREEN tests** — `05c8e13` (feat)
2. **notification-settings Zod schema email extension** — `46a60fd` (feat)

## Files Created/Modified

- `src/app/api/notifications/mark-all-read/route.ts` — NEW: PATCH handler (auth + contractor + UPDATE app_notifications)
- `tests/notifications/mark-all-read.test.ts` — MODIFIED: stubs replaced with real assertions (3 GREEN)
- `src/app/api/notification-settings/route.ts` — MODIFIED: Zod schema + updatePayload extended with email fields

## Security (Threat Model)

All T-14-03 threats mitigated as planned:

| Threat | Mitigation |
|--------|------------|
| T-14-03-01 IDOR | contractor_id from session lookup; body not parsed at all |
| T-14-03-02 Spoofing | getUser() auth check; 401 for any unauthenticated request |
| T-14-03-03 email disclosure | z.string().email() rejects invalid format at parse; server-only import |
| T-14-03-04 email injection | Supabase parameterized queries; Zod validates format before DB write |

## Deviations from Plan

**1. [Rule 1 - Bug] Test 3 Vitest mock chain for update result**

- **Found during:** GREEN phase implementation
- **Issue:** The app_notifications update chain ends with `.eq('is_read', false)` — no `.single()` terminal, so the returned object is the chain itself, not a Promise. Standard `vi.fn().mockResolvedValue()` on a chain object doesn't propagate to `await serviceClient.from('app_notifications').update().eq().eq()`.
- **Fix:** Used a `then` property on the notifications chain object to make it thenable, resolving `{ error: null }` on await. This correctly represents how Supabase's fluent API resolves its query chain.
- **Files modified:** `tests/notifications/mark-all-read.test.ts`
- **Commit:** `05c8e13`

## Known Stubs

None — all implemented code is production-ready.

The pre-existing RED stubs in `tests/notifications/bell-formatter.test.ts` and the `write-bell-notification guard` block in `tests/notifications/notify-dispatch.test.ts` remain RED as intended — they are scoped to Plan 14-02 (Inngest write step), not this plan.

## Threat Flags

None — no new network endpoints beyond what the plan specified. The mark-all-read route follows the same auth pattern as all other PATCH routes. The email_address field is validated before persistence.

## Self-Check: PASSED

- [x] `src/app/api/notifications/mark-all-read/route.ts` exists
- [x] `grep "export async function PATCH"` exits 0
- [x] `grep "app_notifications"` exits 0
- [x] `grep "is_read.*false"` exits 0
- [x] `grep "email_address" src/app/api/notification-settings/route.ts` returns 2 lines
- [x] `grep "notify_email_enabled" src/app/api/notification-settings/route.ts` returns 2 lines
- [x] 3/3 mark-all-read tests GREEN
- [x] Both task commits exist: 05c8e13, 46a60fd

---
*Phase: 14-in-app-notification-bell*
*Completed: 2026-05-29*

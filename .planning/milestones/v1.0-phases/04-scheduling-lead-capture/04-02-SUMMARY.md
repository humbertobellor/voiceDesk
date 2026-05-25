---
phase: 04-scheduling-lead-capture
plan: "02"
subsystem: auth
tags: [googleapis, google-calendar, oauth2, token-refresh, aes-256-gcm, server-only]

requires:
  - phase: 04-01
    provides: googleapis installed, Wave-0 TDD stub files (oauth.test.ts), Phase 4 DB migration live

provides:
  - createOAuth2Client() factory function in src/lib/google/client.ts (new OAuth2Client per call, env validation)
  - getCalendarClient(contractorId) refresh-on-use utility in src/lib/google/auth.ts (D-05, D-15)

affects: [04-03, 04-04, 04-05, 04-06]

tech-stack:
  added: []
  patterns:
    - "OAuth2Client per-call factory: returns new instance each invocation (not module singleton) because setCredentials() is per-request"
    - "Refresh-on-use: check token_expiry before every Calendar API call; refresh if within 5-minute buffer (D-05)"
    - "Conditional refresh_token write: only update DB if Google returns a new one (token rotation not guaranteed)"
    - "Null-return for disconnected calendar: D-15 — callers must handle null gracefully (set google_sync_status='skipped')"

key-files:
  created:
    - src/lib/google/client.ts
    - src/lib/google/auth.ts
  modified: []

key-decisions:
  - "createOAuth2Client() returns a new OAuth2Client per call (not module singleton) — required because each call may invoke setCredentials() with different per-request credentials"
  - "REFRESH_BUFFER_MS = 5 * 60 * 1000 — refresh token if expiry is within 5 minutes (D-05)"
  - "Errors from refreshAccessToken() are intentionally re-thrown — Inngest retry backoff will call getCalendarClient() again with the freshly-written token"
  - "refresh_token write-back is conditional — only updated if Google returns a new one in the refresh response (token rotation is not guaranteed)"

patterns-established:
  - "import 'server-only' as first line in all lib/google/ modules"
  - "No token values in any log statement — only contractorId and operation name logged"
  - "token_expiry stored as ISO string in Supabase TIMESTAMPTZ; converted via new Date(str).getTime() for ms comparison"

requirements-completed:
  - SCHED-01

duration: ~2 min
completed: "2026-05-08"
---

# Phase 4 Plan 02: Google OAuth Utility Modules Summary

**Google OAuth2Client factory and refresh-on-use token utility created with 5-minute expiry buffer, AES-256-GCM re-encryption on refresh, and null return for disconnected calendars**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-08T19:59:26Z
- **Completed:** 2026-05-08T20:01:27Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `src/lib/google/client.ts`: `createOAuth2Client()` factory with env var validation — throws with all three missing var names if any absent; returns new `google.auth.OAuth2` instance each call (not a singleton)
- `src/lib/google/auth.ts`: `getCalendarClient(contractorId)` refresh-on-use pattern — reads `calendar_credentials`, checks expiry 5-minute buffer, refreshes and re-encrypts when needed, returns configured `google.calendar({ version: 'v3' })` client
- Both files have `import 'server-only'` as first line; no token values logged anywhere; TypeScript clean (0 errors in new files)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create src/lib/google/client.ts** - `0f09cef` (feat)
2. **Task 2: Create src/lib/google/auth.ts (refresh-on-use)** - `4a44d8d` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `src/lib/google/client.ts` — `createOAuth2Client()` factory: env var validation, new OAuth2Client per call, server-only, CASA Tier 2 security note in JSDoc
- `src/lib/google/auth.ts` — `getCalendarClient(contractorId)`: reads `calendar_credentials`, 5-min refresh buffer (D-05), AES-256-GCM re-encryption on refresh, returns null when no creds (D-15), throws on errors for Inngest retry

## Decisions Made

- `createOAuth2Client()` creates a new instance each call rather than caching at module level because `OAuth2Client.setCredentials()` is per-request. Module singleton would cause credential leakage between concurrent requests.
- `REFRESH_BUFFER_MS = 5 * 60 * 1000` (D-05) — standard OAuth client refresh margin; avoids race at exact expiry boundary.
- `refresh_token` write-back is conditional (`credentials.refresh_token ? ... : {}`) — Google only returns a new refresh token on token rotation (not guaranteed); overwriting with undefined would break future refreshes.
- Errors from `refreshAccessToken()` are re-thrown — Inngest retry mechanism will call `getCalendarClient()` again and read the now-fresh token from DB.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Threat Model Compliance

| Threat ID | Status |
|-----------|--------|
| T-04-02-01 — Information Disclosure in auth.ts | Mitigated: `import 'server-only'` on both files; no token values in any `console.log` |
| T-04-02-02 — Tampering via token_expiry unit confusion | Mitigated: `new Date(creds.token_expiry).getTime()` for ms comparison; `new Date(credentials.expiry_date!).toISOString()` for write-back |
| T-04-02-03 — Information Disclosure via refreshAccessToken network | Accepted: TLS enforced by googleapis; no token logging |
| T-04-02-04 — EoP via contractor_id parameter | Mitigated: contractorId flows from Inngest event payload (server-side context), never from user request |

## Known Stubs

None — both implementation files are complete. The Wave-0 test stubs (`tests/lib/oauth.test.ts`) remain in RED phase intentionally; they will be updated with actual test logic in a later plan when test scaffolding is wired to these modules.

## Next Phase Readiness

- `createOAuth2Client()` and `getCalendarClient()` are available for all downstream consumers:
  - Plan 03: Google OAuth callback route (`/api/auth/google/callback`) uses `createOAuth2Client().getToken(code)`
  - Plan 04: Inngest `retell-call-classify` function uses `getCalendarClient(contractorId)` for Calendar event creation
- No blockers. Plans 03-06 can proceed.

---

*Phase: 04-scheduling-lead-capture*
*Completed: 2026-05-08*

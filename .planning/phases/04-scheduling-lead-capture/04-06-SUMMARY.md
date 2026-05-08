---
phase: 04-scheduling-lead-capture
plan: "06"
subsystem: auth
tags: [google-oauth, calendar, oauth2, csrf, aes-256-gcm, next.js, supabase]

# Dependency graph
requires:
  - phase: 04-scheduling-lead-capture
    plan: "01"
    provides: calendar_credentials table migration + googleapis installed
  - phase: 04-scheduling-lead-capture
    plan: "02"
    provides: createOAuth2Client() and getCalendarClient() from src/lib/google/client.ts and auth.ts
  - phase: 01-foundation
    plan: "03"
    provides: encryptToken()/decryptToken() AES-256-GCM utilities from src/lib/crypto/tokens.ts
provides:
  - GET /api/auth/google/initiate — generates CSRF state token, sets httpOnly oauth_state cookie, redirects to Google OAuth consent screen
  - GET /api/auth/google/callback — verifies state cookie, exchanges OAuth code, encrypts tokens with AES-256-GCM, upserts calendar_credentials row, redirects to /dashboard?calendarConnected=1
  - /dashboard/connect-calendar — Server Component page showing calendar connection status with ConnectCalendarForm client button
  - Dashboard success/error banners — ?calendarConnected=1 shows green banner; ?calendarError=* shows red banner with human-readable messages
affects:
  - 04-scheduling — calendar_credentials row now exists for contractors who have connected; getCalendarClient() in Plan 02 can now retrieve live tokens
  - 05-notifications — lead/appointment notifications can reference calendar connection status
  - 06-portal-ui — connect-calendar page will be embedded in Settings section; dashboard banners already in place

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "OAuth CSRF prevention: randomBytes(32) state token stored in httpOnly SameSite=lax cookie, verified before any DB interaction, deleted after verification"
    - "JWT-only contractor derivation: contractor_id always from supabase.auth.getUser() → .eq('user_id', user.id) — never from URL params"
    - "Async cookies() pattern for Next.js 16.x: const cookieStore = await cookies() (not cookies().set())"
    - "prompt:'consent' hardcoded in generateAuthUrl() — guarantees fresh refresh_token on re-auth"
    - "tokens.expiry_date in milliseconds: new Date(tokens.expiry_date).toISOString() (NOT * 1000)"
    - "Server Component + Client Form split: page.tsx checks RLS-scoped calendar_credentials; ConnectCalendarForm.tsx handles button state"

key-files:
  created:
    - src/app/api/auth/google/initiate/route.ts
    - src/app/api/auth/google/callback/route.ts
    - src/app/(dashboard)/connect-calendar/page.tsx
    - src/app/(dashboard)/connect-calendar/_components/ConnectCalendarForm.tsx
  modified:
    - src/app/(dashboard)/dashboard/page.tsx

key-decisions:
  - "SameSite='lax' (not 'strict') on oauth_state cookie — OAuth callback is a cross-site GET redirect; 'strict' silently blocks the cookie and breaks the flow"
  - "prompt:'consent' required in generateAuthUrl() — omitting causes null refresh_token on re-auth; explicit code comment warns against removal"
  - "tokens.expiry_date is milliseconds since epoch (not seconds) — Risk 2 pattern from research; new Date(ms).toISOString() is correct conversion"
  - "contractor_id derived from JWT user.id only — never from code, state, or URL params (STRIDE: Elevation of Privilege T-04-06-02)"
  - "Both access_token and refresh_token encrypted with encryptToken() before DB write — neither value ever logged or exposed in error URLs"
  - "connect-calendar page uses user's own Supabase client (not service role) for calendar_credentials read — RLS enforces ownership at DB layer"

patterns-established:
  - "OAuth state verification pattern: verify cookie → delete cookie → check code → auth check → contractor lookup → exchange tokens"
  - "Error redirect pattern: generic error code in ?calendarError query param (never token values or raw error messages)"

requirements-completed: [SCHED-01]

# Metrics
duration: ~30min (previous session) + human UAT verification
completed: 2026-05-08
---

# Phase 4 Plan 06: Google OAuth Calendar Connection Summary

**Google Calendar OAuth flow with CSRF state cookie, AES-256-GCM token encryption, JWT-only contractor derivation, and contractor-facing connect-calendar page with dashboard success/error banners**

## Performance

- **Duration:** ~30 min (Tasks 1-2 in previous session) + human UAT verification
- **Started:** 2026-05-08
- **Completed:** 2026-05-08
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 5

## Accomplishments

- OAuth initiate route generates cryptographically random 32-byte state token, stores it in httpOnly SameSite=lax cookie, and redirects to Google consent screen with `access_type:'offline'` + `prompt:'consent'` guaranteeing a fresh refresh_token on every authorization
- OAuth callback route verifies state cookie (CSRF prevention), exchanges authorization code, encrypts both access_token and refresh_token with AES-256-GCM, and upserts to calendar_credentials — contractor_id always derived from JWT, never from URL params
- `/dashboard/connect-calendar` page checks calendar connection status via RLS-scoped Supabase query and renders a client form component that shows "Connected" status when credentials exist and provides a "Reconnect" path
- Dashboard updated with searchParams support: success banner for `?calendarConnected=1` and specific error messages for `?calendarError=state_mismatch`, `?calendarError=missing_tokens`, and generic errors
- Human UAT confirmed: OAuth round-trip works end-to-end, calendar_credentials row written with encrypted tokens in iv:tag:ciphertext format

## Task Commits

Each task was committed atomically:

1. **Task 1: Create OAuth initiate and callback API routes** - `5d26815` (feat)
2. **Task 2: Create connect-calendar page and update dashboard banners** - `3c60b67` (feat)
3. **Task 3: Human-verify checkpoint** - Passed (no commit — verification only)

## Files Created/Modified

- `src/app/api/auth/google/initiate/route.ts` — GET route: state token generation, httpOnly cookie, Google OAuth redirect
- `src/app/api/auth/google/callback/route.ts` — GET route: state verification, code exchange, AES-256-GCM encryption, calendar_credentials upsert, dashboard redirect
- `src/app/(dashboard)/connect-calendar/page.tsx` — Server Component: auth guard, contractor guard, RLS-scoped credentials check, renders ConnectCalendarForm
- `src/app/(dashboard)/connect-calendar/_components/ConnectCalendarForm.tsx` — Client Component: Connect/Reconnect button with navigation loading state
- `src/app/(dashboard)/dashboard/page.tsx` — Updated with searchParams prop (Promise type for Next.js 16), success and error banners

## Decisions Made

- **SameSite='lax' not 'strict':** OAuth callback is a cross-site GET redirect (Google → app). `strict` blocks the cookie entirely, breaking the flow. `lax` is correct and safe for this pattern.
- **prompt:'consent' hardcoded:** Without this, re-authorization returns `refresh_token: null`. Code comment explicitly warns against removal to prevent future regression.
- **tokens.expiry_date is milliseconds:** googleapis returns milliseconds-since-epoch, not seconds. `new Date(ms).toISOString()` is the correct conversion; `new Date(ms * 1000)` would be wrong.
- **JWT-only contractor_id:** The callback route derives contractor_id exclusively from `supabase.auth.getUser()` + `.eq('user_id', user.id)`. Accepting contractor_id from URL params would be STRIDE Elevation of Privilege (T-04-06-02).
- **User client for credentials read:** `connect-calendar/page.tsx` uses the user's own Supabase client (not service role) for the `calendar_credentials` select — RLS enforces row-level ownership at the DB layer.

## Deviations from Plan

None — plan executed exactly as written. All security constraints (D-02 CSRF, JWT-only contractor derivation, AES-256-GCM, prompt:'consent', ms expiry_date conversion) implemented as specified.

## Issues Encountered

None — TypeScript check (`tsc --noEmit`) passed clean. Human UAT confirmed complete OAuth round-trip with calendar_credentials row written.

## User Setup Required

Google OAuth credentials must be configured before the OAuth flow works end-to-end:

- `GOOGLE_CLIENT_ID` — Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID
- `GOOGLE_CLIENT_SECRET` — Same OAuth 2.0 Client ID
- `GOOGLE_REDIRECT_URI` — Must match Authorized redirect URI (e.g., `http://localhost:3000/api/auth/google/callback` for dev)

Dashboard configuration:
1. Enable Google Calendar API v3 in Google Cloud Console
2. Add redirect URI to OAuth 2.0 Client ID Authorized redirect URIs
3. Add test user email in OAuth consent screen → Test users (while app is in testing mode)
4. Move OAuth app to Production mode before beta contractor onboarding (CASA Tier 2 review required for `calendar.events` scope)

## Next Phase Readiness

Phase 4 is fully complete:
- Plan 01: googleapis + migration (calendar_credentials, google_sync_status, booking_conflict)
- Plan 02: createOAuth2Client() + getCalendarClient() with refresh-on-use
- Plan 03: computeAvailableSlots() + buildSlotSection() + buildSystemPrompt() extended
- Plan 04: extract-trade.ts extended with confirmed_appointment_time + service_address
- Plan 05: retell-call-classify extended with create-lead, create-appointment, create-calendar-event, trigger-agent-sync
- Plan 06 (this plan): OAuth routes + connect-calendar page + dashboard banners

Ready for Phase 5: Notifications (SMS/WhatsApp/Telegram dispatch within 60s of call end).

Remaining blockers before Phase 5 ships:
- WhatsApp WABA approval (submit immediately if not already submitted — 3–7 day approval window)
- Google OAuth app production mode before first beta contractor connects calendar

---
*Phase: 04-scheduling-lead-capture*
*Completed: 2026-05-08*

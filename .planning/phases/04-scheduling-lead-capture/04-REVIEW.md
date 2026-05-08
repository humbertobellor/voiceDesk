---
phase: 04-scheduling-lead-capture
reviewed: 2026-05-08T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - src/app/(dashboard)/connect-calendar/_components/ConnectCalendarForm.tsx
  - src/app/(dashboard)/connect-calendar/page.tsx
  - src/app/(dashboard)/dashboard/page.tsx
  - src/app/api/auth/google/callback/route.ts
  - src/app/api/auth/google/initiate/route.ts
  - src/inngest/functions/retell-call-classify.ts
  - src/lib/classification/extract-trade.ts
  - src/lib/google/auth.ts
  - src/lib/google/client.ts
  - src/lib/retell/system-prompt.ts
  - src/lib/scheduling/inject-slots.ts
  - src/lib/scheduling/slots.ts
  - src/types/database.ts
  - supabase/migrations/20260508000008_phase4_scheduling.sql
  - tests/lib/booking.test.ts
  - tests/lib/leads.test.ts
  - tests/lib/oauth.test.ts
  - tests/lib/scheduling.test.ts
findings:
  critical: 4
  warning: 5
  info: 3
  total: 12
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-05-08T00:00:00Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Phase 4 adds Google Calendar OAuth, appointment booking, lead capture, and slot injection into the Retell system prompt. The overall architecture is sound — CSRF state cookie pattern is correct, contractor_id is derived from JWT (not URL params), and the `fromZonedTime` conversion is applied before DB insert.

Four blockers were found: unvalidated user-controlled string rendered directly in JSX (XSS); non-null assertions on `tokens.expiry_date` and `credentials.expiry_date` that crash on token exchanges where Google omits the field; the `Appointment` and `Lead` TypeScript types are missing the new columns added by the Phase 4 migration (causing silent `undefined` at runtime and lying type contracts); and all 18 test cases are `throw new Error('not yet implemented')` stubs — zero logic is covered.

---

## Critical Issues

### CR-01: Reflected XSS — `calendarError` query param rendered raw in JSX

**File:** `src/app/(dashboard)/dashboard/page.tsx:42`
**Issue:** When neither `'state_mismatch'` nor `'missing_tokens'` match, the raw `calendarError` value from the URL query string is interpolated directly into the rendered string:

```tsx
: `Calendar connection failed: ${calendarError}. Please try again.`
```

`calendarError` is `params.calendarError` which comes from `searchParams` — a user-controlled URL parameter. Next.js App Router auto-escapes string interpolation inside JSX text nodes, so a string like `<script>` will not execute as HTML. However, rendering arbitrary attacker-controlled text in a UI element is still a user-interface redress / phishing vector (the attacker crafts a link to the dashboard with any error message), and it violates the project's principle of only exposing known-safe values. More critically, if any future code path passes this value to `dangerouslySetInnerHTML`, `eval`, or a logging sink that interprets format strings, the unsanitized input becomes immediately dangerous.

**Fix:** Allowlist the accepted error codes and fall back to a generic message for anything unknown:

```tsx
const KNOWN_ERRORS: Record<string, string> = {
  state_mismatch: 'Security check failed. Please try again.',
  missing_tokens: 'Authorization was incomplete. Please reconnect and allow all permissions.',
  no_code: 'Authorization was cancelled. Please try again.',
  no_contractor: 'Account setup incomplete. Please finish onboarding.',
  token_exchange_failed: 'Token exchange failed. Please try again.',
}

const errorMessage = calendarError
  ? (KNOWN_ERRORS[calendarError] ?? 'An unexpected error occurred. Please try again.')
  : null
```

Then render `errorMessage` instead of the template literal containing `calendarError`.

---

### CR-02: Non-null assertion on `tokens.expiry_date` crashes when Google omits the field

**File:** `src/app/api/auth/google/callback/route.ts:63`
**Issue:** `new Date(tokens.expiry_date!).toISOString()` uses a non-null assertion. The `googleapis` type for `Credentials.expiry_date` is `number | null | undefined`. Google does not guarantee `expiry_date` in every token response (e.g., when `access_type` is not `'offline'`, or in certain error recovery flows). If `expiry_date` is `null` or `undefined`, `new Date(null)` returns the Unix epoch (`1970-01-01T00:00:00.000Z`), and `new Date(undefined)` returns an `Invalid Date` whose `.toISOString()` throws `RangeError: Invalid time value` — crashing the route and leaving the user stranded on an error page even though their token exchange succeeded.

The same defect exists at `src/lib/google/auth.ts:67` on the refresh path.

**Fix (callback route, line 63):**
```ts
const expiryIso = tokens.expiry_date
  ? new Date(tokens.expiry_date).toISOString()
  : new Date(Date.now() + 3600 * 1000).toISOString() // fallback: 1 hour from now

await db.from('calendar_credentials').upsert({
  // ...
  token_expiry: expiryIso,
  // ...
}, { onConflict: 'contractor_id' })
```

**Fix (auth.ts, line 67):**
```ts
token_expiry: credentials.expiry_date
  ? new Date(credentials.expiry_date).toISOString()
  : new Date(Date.now() + 3600 * 1000).toISOString(),
```

---

### CR-03: `Appointment` and `Lead` TypeScript types are missing Phase 4 migration columns

**File:** `src/types/database.ts:112-125` (Appointment), `src/types/database.ts:96-110` (Lead)
**Issue:** The Phase 4 migration (`20260508000008_phase4_scheduling.sql`) adds:
- `appointments.google_sync_status` (TEXT NOT NULL DEFAULT 'pending')
- `leads.booking_conflict` (BOOLEAN NOT NULL DEFAULT false)

Neither column appears in the corresponding TypeScript interfaces. The `Appointment` interface has `google_event_id` (line 117) but no `google_sync_status`. The `Lead` interface has no `booking_conflict` field.

This means:
1. Any code reading `appointment.google_sync_status` or `lead.booking_conflict` from a Supabase query result gets TypeScript type `undefined`, bypassing type checking entirely. The Inngest function already reads these fields in production logic (`retell-call-classify.ts` lines 219, 259 — though it writes, not reads, via `db.from('appointments').update({google_sync_status: ...})`).
2. The `Appointment` interface also carries a non-nullable `calendar_id: string` field (line 120) and a `status: AppointmentStatus` field (line 123) but the Phase 4 migration does not add `google_sync_status` to that interface — so the type contract misrepresents the actual DB shape throughout the codebase.

**Fix — add missing fields to both interfaces:**
```ts
// In Lead interface (after line 108 status field):
booking_conflict: boolean

// In Appointment interface (after line 123 status field):
google_sync_status: 'pending' | 'synced' | 'failed' | 'skipped'
```

---

### CR-04: All test cases are unimplemented stubs — zero production logic is tested

**Files:** `tests/lib/booking.test.ts`, `tests/lib/leads.test.ts`, `tests/lib/oauth.test.ts`, `tests/lib/scheduling.test.ts`
**Issue:** Every single test body is `throw new Error('not yet implemented')`. All 18 test cases across all four test files will fail immediately on execution. The test suite provides no coverage whatsoever for:
- `computeAvailableSlots` (scheduling logic, DST edge cases, slot exclusion)
- `getCalendarClient` token refresh path
- Lead creation rules (intent gating, status=booked vs new)
- Appointment creation (booking conflict, google_sync_status lifecycle)

This is a blocker because these are the core Phase 4 behaviors. The booking conflict handler (23505 error path), the token refresh logic, and the slot computation all contain non-trivial conditional logic with edge cases. Shipping without any passing tests means regressions will be invisible.

**Fix:** Implement the test bodies. The mocks are already wired (vitest, mockFrom, mockRefreshAccessToken). Each test only needs the mock return values configured and assertions written. Start with `computeAvailableSlots` since it is a pure function requiring no mocks.

---

## Warnings

### WR-01: Slot day-advance arithmetic breaks on DST transition days

**File:** `src/lib/scheduling/slots.ts:57`
**Issue:** The candidate day is computed as:
```ts
const candidateDayStart = startOfDay(addMinutes(nowInTz, dayOffset * 1440))
```

`addMinutes(nowInTz, dayOffset * 1440)` adds exactly 1440 minutes (24 clock hours) per day. On a DST spring-forward day (e.g., US clocks jump from 1:59 AM to 3:00 AM), 1440 minutes forward from midnight lands at 11:00 PM of the same calendar day — `startOfDay` then returns the same date rather than the next date. This causes `dayOffset=1` to alias to the same calendar day as `dayOffset=0`, skipping one business day and returning only 4 days instead of 5.

**Fix:** Use `date-fns` `addDays` on the zoned date instead of `addMinutes` with a fixed 1440 multiple:
```ts
import { addDays, startOfDay } from 'date-fns'
// ...
const candidateDayStart = startOfDay(addDays(nowInTz, dayOffset))
```

`addDays` is DST-safe for calendar-day arithmetic; `addMinutes(x, 1440)` is not.

---

### WR-02: `upsert` result on `calendar_credentials` is not checked for errors

**File:** `src/app/api/auth/google/callback/route.ts:59-65`
**Issue:** The `upsert` call has no error check:
```ts
await db.from('calendar_credentials').upsert({
  // ...
}, { onConflict: 'contractor_id' })
```
If the upsert fails (e.g., RLS policy violation, DB connectivity issue), the error is silently discarded and the route redirects to `/dashboard?calendarConnected=1` — telling the contractor their calendar is connected when it is not.

**Fix:**
```ts
const { error: upsertError } = await db.from('calendar_credentials').upsert({
  // ...
}, { onConflict: 'contractor_id' })

if (upsertError) {
  console.error('[auth/google/callback] upsert calendar_credentials failed:', upsertError.message)
  return NextResponse.redirect(new URL('/dashboard?calendarError=token_exchange_failed', req.url))
}
```

---

### WR-03: Token refresh writes back to DB but does not check for write errors

**File:** `src/lib/google/auth.ts:65-71`
**Issue:** After refreshing, the updated tokens are written back with:
```ts
await db.from('calendar_credentials').update({
  access_token: encryptToken(credentials.access_token!),
  token_expiry: new Date(credentials.expiry_date!).toISOString(),
  // ...
}).eq('contractor_id', contractorId)
```
The return value is discarded. If this write fails silently, the next Inngest retry reads the old (expired) token from DB, calls `refreshAccessToken` again (consuming a refresh token rotation slot), and the cycle repeats until the refresh token itself is invalidated by Google.

**Fix:** Check and throw on write error so Inngest retry semantics work correctly:
```ts
const { error: writeError } = await db.from('calendar_credentials').update({ ... }).eq('contractor_id', contractorId)
if (writeError) {
  console.error('[google/auth] failed to persist refreshed token for contractor:', contractorId)
  throw new Error(writeError.message)
}
```

---

### WR-04: `credentials.access_token!` non-null assertion on refresh response

**File:** `src/lib/google/auth.ts:61, 66`
**Issue:** `credentials.access_token!` is asserted non-null on lines 61 and 66. The `googleapis` type for `Credentials.access_token` is `string | null | undefined`. A failed or partial refresh response (rate-limited, network error handled internally by the library) can return `credentials` with a null `access_token`. The assertion suppresses the type error and causes a runtime crash or passes a null token to `encryptToken`, which would either throw or store an encrypted null string.

**Fix:**
```ts
if (!credentials.access_token) {
  throw new Error('[google/auth] refreshAccessToken returned no access_token')
}
accessToken = credentials.access_token
```

---

### WR-05: `create-lead` step does not handle DB error from `callRow` lookup

**File:** `src/inngest/functions/retell-call-classify.ts:136-138`
**Issue:** The call to load caller details uses:
```ts
const { data: callRow } = await db
  .from('calls')
  .select('caller_name, caller_phone')
  .eq('id', callId)
  .maybeSingle()
```
The `error` field of the result is silently discarded. If this query fails, `callRow` is `undefined` (not `null`), causing `callRow?.caller_name` to be `undefined` and `callRow?.caller_phone` to be `undefined`. The lead insert then proceeds with `caller_phone: ''` (the `?? ''` fallback on line 144) — inserting an empty phone number into a lead record. There is no retry-triggering throw; the Inngest function continues silently with degraded data.

**Fix:** Destructure and check the error:
```ts
const { data: callRow, error: callRowError } = await db
  .from('calls')
  .select('caller_name, caller_phone')
  .eq('id', callId)
  .maybeSingle()
if (callRowError) {
  console.error('[retell-call-classify] failed to load callRow for lead:', callRowError.message)
  throw new Error(callRowError.message)  // triggers Inngest retry
}
```

---

## Info

### IN-01: `system-prompt.ts` does not guard against missing `emergency_keywords.en`

**File:** `src/lib/retell/system-prompt.ts:18`
**Issue:** `settings.emergency_keywords.en.join(', ')` will throw if `emergency_keywords` is `null`/`undefined` or if the `en` array is missing. The `ContractorSettings` type marks `emergency_keywords` as non-nullable, but the field is stored as JSONB — a partial or legacy row in the DB could have a null or malformed value, causing the system prompt build to crash and triggering an Inngest retry loop.

**Fix:** Add a safe fallback:
```ts
const emergencyKeywords = (settings.emergency_keywords?.en ?? []).join(', ')
```

---

### IN-02: `slots.ts` — `format()` call passes `timeZone` option but `slotStartInTz` is already a local-tz Date

**File:** `src/lib/scheduling/slots.ts:87`
**Issue:**
```ts
label: format(slotStartInTz, "EEEE MMMM d 'at' h:mm a", { timeZone: timezone }),
```
`slotStartInTz` is already a `Date` produced by `toZonedTime` (zoned representation) and then mutated via `setHours`/`addMinutes`. Passing `{ timeZone: timezone }` to `date-fns-tz`'s `format` will re-apply the timezone offset, potentially producing an incorrect label when the contractor's timezone differs from UTC. The correct approach is to format without the `timeZone` option since `slotStartInTz` already represents the local time, or use `formatInTimeZone(slotStartUtc, timezone, ...)` on the UTC date directly.

**Fix:**
```ts
import { formatInTimeZone } from 'date-fns-tz'
// ...
label: formatInTimeZone(slotStartUtc, timezone, "EEEE MMMM d 'at' h:mm a"),
```

---

### IN-03: Magic number `15000` duplicated across `retell-call-classify.ts`

**File:** `src/inngest/functions/retell-call-classify.ts:89, 126`
**Issue:** The short-call threshold `15000` ms appears on lines 89 and 126 without a named constant. The two values must stay in sync — a future change to one site risks leaving the other stale, producing inconsistent behavior (classifying a call as short for LLM purposes but creating a lead for it anyway).

**Fix:** Extract to a named constant near the top of the file:
```ts
const SHORT_CALL_THRESHOLD_MS = 15_000
```

---

_Reviewed: 2026-05-08T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

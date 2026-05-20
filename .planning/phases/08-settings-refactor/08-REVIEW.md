---
phase: 08-settings-refactor
reviewed: 2026-05-20T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/app/(dashboard)/settings/calendar/page.tsx
  - src/app/(dashboard)/settings/phone/page.tsx
  - src/app/(dashboard)/settings/go-live/page.tsx
  - src/app/(dashboard)/layout.tsx
  - src/components/dashboard/Sidebar.tsx
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-05-20
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Five files from the Phase 8 settings refactor were reviewed: three new settings pages (calendar, phone, go-live), the dashboard layout, and the Sidebar component. The layout and calendar page are clean server components with correct RLS-via-session patterns. The phone settings page is a clean read-only display. The Sidebar restructuring is functionally correct.

The primary concerns are in `go-live/page.tsx` and the `useTestCallVerification` hook it calls: the UI optimistically reports success before the server action resolves, the server action's return value is discarded so silent failures go undetected, and the polling fallback fires on the very first poll if any prior call already exists in the database (false-positive go-live activation). A secondary group of warnings covers permanently-stuck loading states, missing error boundaries on async fetches, the incorrect T-Mobile forwarding code, and direct `createBrowserClient` calls that bypass the project's utility function.

---

## Critical Issues

### CR-01: Go-live status set to "verified" before server action completes or succeeds

**File:** `src/app/(dashboard)/settings/go-live/page.tsx:46-47`

**Issue:** `setStatus('verified')` is called on line 46, before `await markContractorLive(contractorId)` on line 47. The `markContractorLive` server action returns `{ ok: boolean }` but its return value is never checked. If the server action fails (network error, auth error, Supabase write error), the UI shows "Test Call Verified! Your VoiceDesk is now live." while `is_live` remains `false` in the database. The contractor believes they are live; they are not. On the next page load, `fetchContractor` will show `is_live = false` and reset to `waiting` state, causing a confusing experience and potentially leaving the business unreachable.

**Fix:**
```tsx
const handleTestCallDetected = useCallback(async (callId: string) => {
  if (!contractorId) return
  // Do NOT set verified until the server action confirms success
  const result = await markContractorLive(contractorId)
  if (result.ok) {
    setStatus('verified')
  } else {
    // Surface the error — stay in 'detecting' state so user can retry
    console.error('[GoLive] markContractorLive failed:', result.error)
    // Optionally: setError(result.error) and render an error banner
    setStatus('waiting')
  }
}, [contractorId])
```

---

### CR-02: Polling fallback fires a false positive on the first interval if prior calls exist

**File:** `src/lib/realtime/testCallVerification.ts:58-82` (called from `src/app/(dashboard)/settings/go-live/page.tsx:50-54`)

**Issue:** `lastCallIdRef` is initialized to `null`. The polling query fetches the most recent call for the contractor ordered by `created_at DESC`, limit 1. On the very first poll interval (5 seconds after detecting state is entered), if the contractor already has any call record in the database (from a prior day, a real customer call, etc.), `calls.id !== lastCallIdRef.current` is `true` (because `null !== someUUID`), and `onTestCallDetected` fires immediately. This marks the contractor as live against a stale call — no test was actually made. The Realtime path avoids this because it only triggers on `INSERT` events that occur after the subscription starts. The polling path has no such temporal anchor.

**Fix:** Capture the current timestamp (or the ID of the most recent existing call) before the first poll fires, and only fire `onTestCallDetected` for calls inserted after detection was enabled:

```tsx
// Option A: seed lastCallIdRef with the current latest call ID before starting polling
const seedLastCallId = useCallback(async () => {
  const { data } = await supabase
    .from('calls')
    .select('id')
    .eq('contractor_id', contractorId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  lastCallIdRef.current = data?.id ?? '__none__'
}, [contractorId])

// Call seedLastCallId() before starting the polling interval
```

Or option B: filter by `created_at > [timestamp when detecting mode was entered]` in the poll query.

---

## Warnings

### WR-01: Permanent loading spinner when fetchContractor returns no data or errors

**File:** `src/app/(dashboard)/settings/go-live/page.tsx:28-41`

**Issue:** `fetchContractor()` silently swallows errors (the destructured `{ data }` discards `error`). If the query returns an error or `data` is `null` (e.g. RLS blocks the SELECT, transient network error), the `if (data)` branch is never entered. `status` remains `'loading'` indefinitely. The user sees a spinning `Loader2` with no error message and no way to recover short of a page reload.

**Fix:**
```tsx
async function fetchContractor() {
  const { data, error } = await supabase
    .from('contractors')
    .select('twilio_number, is_live')
    .eq('id', contractorId!)
    .maybeSingle()

  if (error || !data) {
    setStatus('waiting') // degrade gracefully; user can try the test call
    return
  }
  setTwilioNumber(data.twilio_number ?? null)
  setStatus(data.is_live === true ? 'already-live' : 'waiting')
}
```

---

### WR-02: Permanent loading spinner when fetchNumber errors in phone settings page

**File:** `src/app/(dashboard)/settings/phone/page.tsx:30-39`

**Issue:** Same pattern as WR-01. The `fetchNumber` function discards the `error` return from Supabase. If the query fails, `twilioNumber` stays `null` and the page shows "Not yet provisioned" — which is factually incorrect and may mislead the contractor into thinking their number was never assigned, when it was.

**Fix:**
```tsx
async function fetchNumber() {
  const { data, error } = await supabase
    .from('contractors')
    .select('twilio_number')
    .eq('id', contractorId!)
    .maybeSingle()
  if (error) {
    // Surface loading error state or retry logic
    return
  }
  if (data) setTwilioNumber(data.twilio_number ?? null)
}
```

---

### WR-03: T-Mobile call forwarding code is incorrect

**File:** `src/app/(dashboard)/settings/phone/page.tsx:13`

**Issue:** The T-Mobile forwarding code is listed as `##21#` with instructions "Dial ##21# followed by the phone number and call button". The GSM code `##21#` is the **deactivation** (erasure) code for unconditional call forwarding — it cancels existing forwarding, it does not set it up. The correct T-Mobile unconditional forwarding activation code is `**21*[number]#` (dial, then press Call). A contractor following these instructions will believe forwarding is active when it has actually just been cleared.

**Fix:**
```tsx
{ id: 'tmobile', name: 'T-Mobile', code: '**21*', instructions: 'Dial **21* then the full number then # and press Call (e.g. **21*+13055551234#)' },
```

---

### WR-04: Detecting state has no cancel mechanism and no timeout

**File:** `src/app/(dashboard)/settings/go-live/page.tsx:112-155`

**Issue:** Once the user clicks "I've Called — Detect Test Call" and `status` transitions to `'detecting'`, the Realtime subscription and polling fallback both start. There is no way for the user to cancel and return to `'waiting'` state, and no timeout after which detection is abandoned. If the user made a mistake (wrong number, forgot to forward), they are stuck on the detecting screen. The subscription and polling interval will continue running until the component unmounts, potentially triggering `handleTestCallDetected` against an unrelated call in the future.

**Fix:** Add a "Cancel" button that sets `status` back to `'waiting'`, and consider a finite detection window (e.g. 5 minutes):

```tsx
{status === 'detecting' && (
  <div className="space-y-4">
    ...existing detecting UI...
    <button
      type="button"
      onClick={() => setStatus('waiting')}
      className="text-sm text-[#94A3B8] hover:text-[#F8FAFC] underline"
    >
      Cancel and try again
    </button>
  </div>
)}
```

---

### WR-05: Empty string passed to useTestCallVerification when contractorId is null

**File:** `src/app/(dashboard)/settings/go-live/page.tsx:51`

**Issue:** `contractorId: contractorId ?? ''` passes an empty string when `contractorId` is `null`. Inside `useTestCallVerification`, the `enabled` gate correctly prevents subscription when `status !== 'detecting'` but the hook's internal guard `if (!contractorId) return` (line 94) will never be reached because `''` is falsy in JavaScript yet the `if (!contractorId)` check evaluates it as falsy — so the guard does work. However, if `status` somehow reaches `'detecting'` while `contractorId` is still null (possible if the context is slow to hydrate), the Realtime channel name becomes `test-call-verification-` (no UUID suffix) and the filter becomes `contractor_id=eq.` — an invalid filter that could match unexpectedly or cause a subscription error. The `enabled` gate is the only protection, and it is controlled by `status`, which is set by a separate async fetch that could race.

**Fix:** Pass `null` and guard inside the hook, or keep the enabled gate strictly as the guard but make it explicit:

```tsx
const { isConnected, subscriptionStatus } = useTestCallVerification({
  contractorId: contractorId ?? '',
  enabled: status === 'detecting' && !!contractorId,  // add contractorId guard
  onTestCallDetected: handleTestCallDetected,
})
```

---

## Info

### IN-01: Direct createBrowserClient calls bypass project utility function

**File:** `src/app/(dashboard)/settings/phone/page.tsx:7,25` and `src/app/(dashboard)/settings/go-live/page.tsx:7,23`

**Issue:** Both pages import `createBrowserClient` from `@supabase/ssr` directly and repeat the `process.env.NEXT_PUBLIC_SUPABASE_URL!` / `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!` initialization inline. The project already has `createSupabaseBrowser()` in `src/lib/supabase/browser.ts` for exactly this purpose. Additionally, both pages create a new client instance inside `useEffect`, meaning a new client is instantiated on every contractorId change rather than reusing a stable singleton.

**Fix:** Replace inline client creation with the project utility and hoist to module scope or component level:

```tsx
import { createSupabaseBrowser } from '@/lib/supabase/browser'

// Inside the component, or at module scope:
const supabase = createSupabaseBrowser()
```

---

### IN-02: Calendar settings page silently ignores calendar_credentials query error

**File:** `src/app/(dashboard)/settings/calendar/page.tsx:23-27`

**Issue:** The `{ data: creds }` destructuring discards the `error` from the `calendar_credentials` query. If this query fails (permission denied, network timeout), `creds` is `null` and `isConnected` is passed as `false` to `ConnectCalendarForm`. A contractor with a connected calendar will see the "Connect Google Calendar" button instead of "Reconnect", incorrectly suggesting their calendar is disconnected. This is a display-only inaccuracy but can erode contractor trust.

**Fix:**
```tsx
const { data: creds, error: credsError } = await supabase
  .from('calendar_credentials')
  .select('contractor_id')
  .eq('contractor_id', contractor.id)
  .maybeSingle()

// credsError can be logged server-side; the UI can show a neutral state
// or treat connection status as unknown rather than definitely disconnected
```

---

### IN-03: ConnectCalendarForm does not support disconnect

**File:** `src/app/(dashboard)/settings/calendar/page.tsx:38` / `src/app/(dashboard)/connect-calendar/_components/ConnectCalendarForm.tsx`

**Issue:** When `isConnected` is `true`, the form shows "Google Calendar is connected. Click below to reconnect if needed." but provides no disconnect/revoke button. If a contractor wants to stop VoiceDesk from booking to their calendar, they have no UI path — they would need to revoke the OAuth grant directly in their Google account. This is a UX gap that will become a support burden. Note: the comment in `ConnectCalendarForm.tsx` says "Phase 6 replaces with full Settings section" — this page IS the Phase 8 settings section, so that debt has landed.

**Fix:** Add a "Disconnect Calendar" action that deletes the `calendar_credentials` row (via server action) and revokes the Google OAuth token.

---

_Reviewed: 2026-05-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

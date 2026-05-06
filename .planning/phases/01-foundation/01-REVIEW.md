---
phase: 01-foundation
reviewed: 2026-05-05T00:00:00Z
depth: standard
files_reviewed: 45
files_reviewed_list:
  - .env.example
  - .env.test.example
  - middleware.ts
  - scripts/seed-rls-test-fixtures.ts
  - src/app/(auth)/auth/callback/route.ts
  - src/app/(auth)/auth/login/page.tsx
  - src/app/(auth)/auth/signup/page.tsx
  - src/app/(auth)/setup/phone/page.tsx
  - src/app/(dashboard)/calls/page.tsx
  - src/app/(dashboard)/dashboard/page.tsx
  - src/app/(dashboard)/layout.tsx
  - src/app/(dashboard)/leads/page.tsx
  - src/app/(dashboard)/settings/account/page.tsx
  - src/app/(dashboard)/settings/agent/_components/LanguageSettingsForm.tsx
  - src/app/(dashboard)/settings/agent/page.tsx
  - src/app/(dashboard)/settings/notifications/page.tsx
  - src/app/actions/settings.ts
  - src/app/api/onboarding/create-account/route.ts
  - src/app/layout.tsx
  - src/components/auth/LoginForm.tsx
  - src/components/auth/PhoneCaptureForm.tsx
  - src/components/auth/SignupForm.tsx
  - src/components/dashboard/BottomTabBar.tsx
  - src/components/dashboard/EmptyState.tsx
  - src/components/dashboard/SetupBanner.tsx
  - src/components/dashboard/Sidebar.tsx
  - src/components/ui/button.tsx
  - src/components/ui/card.tsx
  - src/components/ui/input.tsx
  - src/components/ui/label.tsx
  - src/lib/crypto/tokens.ts
  - src/lib/supabase/browser.ts
  - src/lib/supabase/server.ts
  - src/lib/supabase/service.ts
  - src/lib/utils.ts
  - src/lib/validations/onboarding.ts
  - src/types/database.ts
  - supabase/migrations/20260504000001_initial_schema.sql
  - supabase/migrations/20260504000002_rls_policies.sql
  - supabase/migrations/20260504000003_contractor_defaults.sql
  - tests/db/contractor_settings.test.ts
  - tests/db/rls.test.ts
  - tests/db/webhook_events.test.ts
  - tests/lib/crypto.test.ts
  - tests/middleware/phone_capture.test.ts
findings:
  critical: 1
  warning: 6
  info: 2
  total: 9
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-05-05T00:00:00Z
**Depth:** standard
**Files Reviewed:** 45
**Status:** issues_found

## Summary

Phase 1 delivers the foundational schema, RLS policies, auth flow, and language-settings UI. The overall architecture is sound: `getUser()` is used consistently over `getSession()`, RLS is enabled on all nine tables, the service role key is not `NEXT_PUBLIC_`-prefixed, and AES-256-GCM token encryption is correctly implemented. However, one BLOCKER and six WARNING-level defects were identified that require remediation before this code is production-ready.

The most significant finding is the absence of a `'server-only'` import guard on `src/lib/supabase/service.ts`. CLAUDE.md Critical Rule 3 mandates that the service role key never reaches the browser; the only build-time enforcement of that rule is the `server-only` package. Without it, Next.js will silently bundle the module if it is ever accidentally imported in a Client Component — the build passes, and the runtime error appears only under load. The remaining findings cover unvalidated OAuth redirect parameters, raw database error exposure, crypto key validation gaps, a non-atomic rollback strategy, a seed-script pagination defect, and a hardcoded UI state.

---

## Critical Issues

### CR-01: `src/lib/supabase/service.ts` has no `server-only` build-time guard

**File:** `src/lib/supabase/service.ts:1`
**Issue:** The file carries a comment stating it is server-only, but there is no `import 'server-only'` statement. The `server-only` npm package causes Next.js to emit a build error if the module is ever imported inside a Client Component (`'use client'`). Without it, an accidental import (e.g., in a shared utility or a component that later gets the `'use client'` directive added) will silently bundle the file client-side. `SUPABASE_SERVICE_ROLE_KEY` is not `NEXT_PUBLIC_`-prefixed, so it will be `undefined` at runtime — the function will throw — but the build will not catch the mistake, and no build-time alert fires. This directly violates CLAUDE.md Critical Rule 3.

The `server-only` package is not in `package.json` and is not installed.

**Fix:**
```bash
# Install the package
npm install server-only
```
```typescript
// src/lib/supabase/service.ts — add as the very first line
import 'server-only'
import { createClient } from '@supabase/supabase-js'
// ... rest of file unchanged
```

---

## Warnings

### WR-01: OAuth callback `next` parameter is not validated — potential open redirect

**File:** `src/app/(auth)/auth/callback/route.ts:11,40`
**Issue:** The `next` query parameter is accepted from the URL without any validation and is appended directly to `origin`:
```typescript
const next = searchParams.get('next') ?? '/setup/phone'
// ...
return NextResponse.redirect(`${origin}${next}`)
```
An attacker who can craft a Supabase OAuth callback URL (e.g., by phishing a contractor into clicking a modified Google auth link) can supply `next=//evil.com` or `next=%2F%2Fevil.com`. While browsers typically do not follow `https://origin.com//evil.com` as a cross-origin redirect, some HTTP clients, proxies, and older browsers normalize double-slash URLs to `//evil.com` (protocol-relative), which resolves to the attacker's domain. The parameter must be validated to a known-safe relative path before use.

**Fix:**
```typescript
// src/app/(auth)/auth/callback/route.ts
const rawNext = searchParams.get('next') ?? '/setup/phone'
// Accept only relative paths that start with / but not //
const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/setup/phone'

return NextResponse.redirect(`${origin}${next}`)
```

### WR-02: Raw database error messages exposed to API callers

**File:** `src/app/api/onboarding/create-account/route.ts:46,78,88`
**Issue:** Three error paths return the raw Supabase/PostgREST error message directly to the client:
```typescript
return NextResponse.json({ error: uErr.message }, { status: 500 })
// also lines 78, 88
```
These messages can contain internal schema details, constraint names, and table names (e.g., `"duplicate key value violates unique constraint \"contractors_user_id_key\""`, `"new row for relation \"contractor_settings\" violates..."`). This leaks structural information that aids enumeration and targeted attacks. The same pattern occurs in `src/app/actions/settings.ts:36`.

**Fix:**
```typescript
// In route.ts, replace raw error leakage with a generic message
if (uErr) {
  console.error('[create-account] contractor update failed:', uErr.message)
  return NextResponse.json({ error: 'Failed to update account.' }, { status: 500 })
}

// In settings.ts
if (uErr) {
  console.error('[updateLanguages] update failed:', uErr.message)
  return { ok: false, error: 'Failed to save language settings. Please try again.' }
}
```

### WR-03: `getEncryptionKey()` validates string length but not hex character validity

**File:** `src/lib/crypto/tokens.ts:14-21`
**Issue:** The guard checks `hex.length !== 64` but does not verify that every character is a valid hexadecimal digit (`[0-9a-fA-F]`). `Buffer.from(hex, 'hex')` silently discards non-hex characters, producing a buffer shorter than 32 bytes. The subsequent `createCipheriv('aes-256-gcm', key, iv)` call will then throw `"Invalid key length"` at runtime instead of failing with a clear configuration error during startup.

A misconfigured key such as `"zzzz...zzzz"` (64 non-hex characters) passes the length check, returns a zero-length buffer, and the error message `"OAUTH_ENCRYPTION_KEY must be a 64-character hex string"` is never shown — the caller gets a cryptic Node.js crypto error instead.

**Fix:**
```typescript
function getEncryptionKey(): Buffer {
  const hex = process.env.OAUTH_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error(
      'OAUTH_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      'OAUTH_ENCRYPTION_KEY contains non-hex characters. ' +
      'Value must contain only 0-9 and a-f characters.'
    )
  }
  return Buffer.from(hex, 'hex')
}
```

### WR-04: Manual rollback in `create-account` route is non-atomic and error-ignoring

**File:** `src/app/api/onboarding/create-account/route.ts:85-89`
**Issue:** When `notification_settings` insertion fails, the route attempts a manual two-step rollback:
```typescript
await serviceClient.from('contractor_settings').delete().eq('contractor_id', contractor_id)
await serviceClient.from('contractors').delete().eq('id', contractor_id)
```
Two problems:
1. The return values (errors) of both delete operations are silently ignored. If the rollback itself fails (e.g., a concurrent request or a transient DB failure), the `contractors` row persists without its required child rows, leaving the database in an inconsistent state with no logging or alerting.
2. Because `contractor_settings` has `ON DELETE CASCADE` from `contractors`, step 1 (deleting `contractor_settings`) is redundant but harmless. However, step 1 deleting contractor_settings while step 2 is inflight creates a brief window where the contractor row exists with no settings row — observable by concurrent requests.

The root fix is to use a Postgres function or RPC to make the three-row insert atomic. As an interim fix, log rollback failures.

**Fix (interim):**
```typescript
if (nErr) {
  // Attempt rollback — contractor CASCADE deletes contractor_settings automatically
  const { error: rbErr } = await serviceClient
    .from('contractors')
    .delete()
    .eq('id', contractor_id)
  if (rbErr) {
    console.error('[create-account] ROLLBACK FAILED — orphaned contractor row:', contractor_id, rbErr.message)
  }
  return NextResponse.json({ error: 'Failed to complete account setup.' }, { status: 500 })
}
```

### WR-05: Seed script `listUsers()` call is not paginated — cleanup silently skips existing fixtures when user count exceeds 50

**File:** `scripts/seed-rls-test-fixtures.ts:21-25`
**Issue:** `admin.auth.admin.listUsers()` has a default `perPage` of 50. On a Supabase project with more than 50 auth users, the test fixture emails `test-a@voicedesk.test` and `test-b@voicedesk.test` may not appear in the first page. The `find()` call returns `undefined`, the `deleteUser` step is skipped, and the subsequent `createUser` call fails with a duplicate email error — crashing the seed script:
```typescript
const { data: existingList } = await admin.auth.admin.listUsers()
const existing = existingList?.users?.find((u) => u.email === email)
```
This makes the seed non-idempotent in any environment with an active user base.

**Fix:**
```typescript
// Use getUserByEmail instead of listing all users
async function seedUser(email: string, password: string, businessName: string) {
  // Idempotent cleanup: look up by email directly
  const { data: existingUser } = await admin.auth.admin.getUserByEmail(email)
  if (existingUser?.user) {
    await admin.auth.admin.deleteUser(existingUser.user.id)
  }
  // ... rest unchanged
}
```

### WR-06: Service role client used for read-only operation in Server Component where RLS is sufficient

**File:** `src/app/(dashboard)/settings/agent/page.tsx:26-31`
**Issue:** The agent config page uses `createServiceRoleClient()` to read `contractor_settings.supported_languages`, even though the comment acknowledges that "RLS would also allow this read for the owning user." Using the service role for reads that are authorized at the RLS layer violates the principle of least privilege. Any accidental data exposure bug in this code path (e.g., a wrong `contractor_id` filter) bypasses RLS as a safety net. CLAUDE.md Critical Rule 3 scopes the service role to writes that "the user's anon client cannot perform."

**Fix:**
```typescript
// Replace service role read with the user's own server client (RLS enforces ownership)
const { data: settings } = await supabase  // supabase is already created above for getUser()
  .from('contractor_settings')
  .select('supported_languages')
  .eq('contractor_id', contractor.id)
  .maybeSingle()
```

---

## Info

### IN-01: RLS UPDATE test for `contractor_settings` does not verify actual DB state

**File:** `tests/db/rls.test.ts:79-86`
**Issue:** The contractors UPDATE test (lines 39-55) correctly verifies the DB state via service role after the blocked write attempt. The equivalent test for `contractor_settings` (lines 79-86) only checks that the returned `data` array is empty — it does not re-read the row via service role to confirm the DB value was not changed. An RLS policy bug that silently applies the update but returns an empty result set would not be caught.

**Fix:**
```typescript
it('User A UPDATE on User B settings cannot modify rows', async () => {
  const { data } = await clientA
    .from('contractor_settings')
    .update({ business_name: 'HACKED' })
    .eq('contractor_id', contractorBId)
    .select()
  expect((data ?? []).length).toBe(0)

  // Verify DB was not actually modified
  const serviceClient = createClient(url!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: check } = await serviceClient
    .from('contractor_settings')
    .select('business_name')
    .eq('contractor_id', contractorBId)
    .single()
  expect(check?.business_name).not.toBe('HACKED')
})
```

### IN-02: `SetupBanner` step completion state is hardcoded

**File:** `src/components/dashboard/SetupBanner.tsx:10-15`
**Issue:** Step 1 ("Add phone") is hardcoded as `complete: true` and all other steps as `complete: false`, regardless of actual contractor state. If a contractor reaches the dashboard (which requires a phone number per middleware), step 1 will always appear complete — but steps 2-4 will never update even when the contractor completes them in future phases. This creates a UI that permanently shows an incomplete setup banner even for fully configured contractors.

**Fix:** Accept completion state as props derived from the contractor/settings data fetched in `DashboardLayout`, so the banner can be dismissed or updated accurately as phases 2-7 ship.

---

_Reviewed: 2026-05-05T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

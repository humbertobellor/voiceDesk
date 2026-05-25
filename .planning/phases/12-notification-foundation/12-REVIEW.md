---
phase: 12-notification-foundation
reviewed: 2026-05-24T00:00:00Z
depth: deep
files_reviewed: 6
files_reviewed_list:
  - package.json
  - src/lib/notifications/email.ts
  - src/types/database.ts
  - supabase/migrations/20260525000017_phase12_notification_foundation.sql
  - tests/notifications/email.test.ts
  - tests/ui/notification-settings-form.test.tsx
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-05-24T00:00:00Z
**Depth:** deep
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 12 adds: (1) the `app_notifications` table with RLS and Realtime, (2) three email columns on `notification_settings`, (3) a `notification_log` channel constraint extension to include `'email'`, (4) the `sendEmail` transport function, and (5) type and UI additions reflecting the new schema. The email transport and SQL schema are structurally sound. One critical migration correctness defect was found: the `DROP CONSTRAINT` for `notification_log_channel_check` is not guarded with `IF EXISTS`, making the migration non-idempotent and fragile under re-run scenarios. Four warnings cover a phone-validation gating gap that can silently block legitimate saves, a per-call Resend client instantiation, a stale test comment, and a `setTimeout` without cleanup. Two info items cover incomplete mock shape and a pre-existing `Language` type gap.

Cross-file analysis confirmed: the new Phase 12 fields (`notify_email_enabled`, `email_address`, `notify_on_payment_failure`) are correctly absent from `NotificationSettingsForm.tsx` and its `FormData` interface — the migration comments document these as deferred to Phase 13/14 UI. No secret leakage, no XSS vectors in the transport layer, and all four RLS policies (SELECT / INSERT / UPDATE / DELETE) are present on `app_notifications`.

---

## Critical Issues

### CR-01: `DROP CONSTRAINT` Without `IF EXISTS` Makes Migration Non-Idempotent

**File:** `supabase/migrations/20260525000017_phase12_notification_foundation.sql:91`

**Issue:** The `ALTER TABLE notification_log DROP CONSTRAINT notification_log_channel_check` is not guarded with `IF EXISTS`. If this migration is re-applied to a database where it already ran (e.g., a local dev reset that replays only some migrations, a CI environment that restores from a dump made after the initial schema migration but before this one ran, or an error-recovery re-run), the statement will throw `ERROR: constraint "notification_log_channel_check" does not exist` and abort the entire migration transaction. The rest of the same `ALTER TABLE` statement (the `ADD CONSTRAINT`) will also be rolled back, leaving `notification_log` without the `'email'` channel value — silently breaking Phase 13 email logging at runtime rather than at migration time.

Note the inconsistency: the `ADD COLUMN IF NOT EXISTS` lines in the same migration (lines 73–75) are idempotent; the `DROP CONSTRAINT` is not.

The constraint name `notification_log_channel_check` is itself inferred from PostgreSQL's auto-naming convention for inline `CHECK` constraints (pattern: `{table}_{column}_check`). While this matches the initial schema, there is no explicit `CONSTRAINT` name in the original DDL, making this a soft dependency on PostgreSQL internals.

**Fix:**
```sql
ALTER TABLE notification_log
  DROP CONSTRAINT IF EXISTS notification_log_channel_check,
  ADD CONSTRAINT notification_log_channel_check
    CHECK (channel IN ('sms', 'whatsapp', 'telegram', 'email'));
```

---

## Warnings

### WR-01: Phone Validation Runs Unconditionally — Disabled Channel Blocks Unrelated Saves

**File:** `src/components/notification/NotificationSettingsForm.tsx:152-162`

**Issue:** `normalizePhone()` is called for both `sms_number` and `whatsapp_number` regardless of whether `notify_sms_enabled` / `notify_whatsapp_enabled` is `true`. When a channel is disabled, its input is rendered `disabled` (the user cannot clear the value), but form submission still validates the stored value. If the database contains a malformed phone number for a disabled channel (e.g., written by a previous bug, a direct Supabase edit, or an old API version), the contractor cannot save any form changes — including completely unrelated fields like `notify_on_lead` — without first re-enabling the broken channel, correcting the number, and then disabling it again. The user sees an error on a field they cannot interact with.

**Fix:** Gate validation on the channel being enabled:
```ts
// In handleSubmit, replace the unconditional normalizePhone calls:
try {
  smsE164 = formData.notify_sms_enabled
    ? normalizePhone(formData.sms_number)
    : (formData.sms_number.trim() === '' ? null : formData.sms_number) // preserve stored value
} catch (err) {
  newErrors.sms_number = (err as Error).message
}

try {
  waE164 = formData.notify_whatsapp_enabled
    ? normalizePhone(formData.whatsapp_number)
    : (formData.whatsapp_number.trim() === '' ? null : formData.whatsapp_number)
} catch (err) {
  newErrors.whatsapp_number = (err as Error).message
}
```
Alternatively, only normalize when the channel is enabled and skip validation (passing the current stored value as-is) when it is disabled.

---

### WR-02: `Resend` Client Instantiated Per-Call

**File:** `src/lib/notifications/email.ts:62`

**Issue:** `new Resend(apiKey)` is constructed inside the `try` block on every invocation of `sendEmail()`. The Resend SDK performs internal setup (HTTP client, header defaults, retry config) on construction. In an Inngest function that processes a burst of calls, each email dispatch creates a fresh client. Beyond the unnecessary allocation cost, this pattern makes it impossible to test connection reuse or to mock the client at a module level without patching the constructor on every call.

**Fix:** Promote the client to module scope, constructed lazily on first use:
```ts
let _resend: Resend | null = null

function getResendClient(apiKey: string): Resend {
  if (!_resend) {
    _resend = new Resend(apiKey)
  }
  return _resend
}
```
Or, since `apiKey` is always the same env var, construct once at module load after the guard:
```ts
// After the env check, at module scope:
const resend = apiKey ? new Resend(apiKey) : null
```
Note: the current test suite mocks the `Resend` constructor via `vi.mock('resend')` so this refactor will not break tests.

---

### WR-03: `setTimeout` Without Cleanup — State Update on Potentially Unmounted Component

**File:** `src/components/notification/NotificationSettingsForm.tsx:190`

**Issue:** The success-banner auto-dismiss (`setTimeout(() => setFeedback(null), 3000)`) is not captured in a ref and not cancelled in a cleanup. If the user navigates away from the settings page within 3 seconds of a successful save, the timeout callback fires on an unmounted component. React 18 silences the resulting state update (no thrown error), but the pattern still represents a resource leak and produces a warning in React's strict mode dev double-render pass when effects are concerned.

**Fix:** Use `useEffect` cleanup to cancel the timeout:
```ts
const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

// In handleSubmit success block, replace the bare setTimeout:
if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
feedbackTimerRef.current = setTimeout(() => setFeedback(null), 3000)

// Add a cleanup effect:
useEffect(() => {
  return () => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
  }
}, [])
```

---

### WR-04: Test Comment States "All 8 Mutable Fields" — Count Is Wrong After Phase 12

**File:** `tests/ui/notification-settings-form.test.tsx:189`

**Issue:** The comment `// All 8 mutable fields must be present` on line 189 is stale. After Phase 12 adds `notify_email_enabled`, `email_address`, and `notify_on_payment_failure` to `NotificationSettings`, there are now 11 mutable fields in the settings record. The three Phase 12 fields are intentionally absent from the form submission payload (they are deferred to Phase 13/14), but the comment implies completeness that no longer holds. A future developer adding Phase 13 email UI is likely to consult this test as the specification and be misled about which fields the mutation must carry.

Additionally, the test mock returns `isLoading: false` on both `useUpdateNotificationSettings` and `useTelegramUnlink` (lines 26 and 30). TanStack Query v5 (installed: `5.100.10`) renamed `isLoading` to `isPending` on mutation results. The mock shape is incorrect for the installed version. The component does not destructure `isLoading` from these hooks (it uses local `isSaving` state), so this does not cause a test failure today — but it means the mock does not faithfully represent the real hook API and will silently diverge if a future change destructures `isPending` from the mutation.

**Fix:** Update the comment to reflect reality and correct the mock shape:
```ts
// All mutable fields for SMS/WhatsApp/Telegram channels (8 fields).
// Email fields (notify_email_enabled, email_address, notify_on_payment_failure)
// are Phase 13/14 — intentionally absent from this form's payload.

// Fix mock shape for TQ v5:
useUpdateNotificationSettings: () => ({
  mutateAsync: mockMutateAsync,
  isPending: false,  // was: isLoading
}),
useTelegramUnlink: () => ({
  mutateAsync: mockUnlinkMutateAsync,
  isPending: false,  // was: isLoading
}),
```

---

## Info

### IN-01: `Language` Type Missing Haitian Creole (`'ht'`)

**File:** `src/types/database.ts:5`

**Issue:** `export type Language = 'en' | 'es'` does not include Haitian Creole (`'ht'`), despite the project CLAUDE.md explicitly listing Haitian Creole as a supported language for the South Florida market. This is a pre-existing gap (not introduced in Phase 12), but Phase 12 adds `AppNotification` which could carry a language-specific `body` field in future phases. Any future code that stores or routes per-language notifications will either silently exclude Haitian Creole speakers or require a type change at that point.

**Fix:** Add `'ht'` to the union (coordinate with the Retell support verification noted in CLAUDE.md Week-1 items):
```ts
export type Language = 'en' | 'es' | 'ht'
```

---

### IN-02: `sendEmail` Accepts Arbitrary `to` and `html` Without Input Validation

**File:** `src/lib/notifications/email.ts:50-78`

**Issue:** The `to` parameter undergoes no email-format validation before being passed to the Resend API. An empty string, a non-email string, or a string containing whitespace will be dispatched and fail at Resend's end, returning an error that `sendEmail` will surface correctly — but only after an outbound HTTP call is made. Similarly, the `html` parameter has no length guard; a pathologically large HTML body will be sent to Resend (Resend's own limits apply externally). This is noted in the docstring as a "transport-only layer" design decision and is acceptable for Phase 12, but Phase 13 callers should add a pre-call validation step rather than relying on Resend error responses for basic format checks.

**Fix (Phase 13 caller responsibility — not a change to `sendEmail` itself):** Before calling `sendEmail`, validate the recipient address with a lightweight check:
```ts
// In Phase 13 Inngest function, before calling sendEmail:
if (!settings.email_address || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email_address)) {
  return { success: false, error: 'Invalid or missing email address' }
}
```

---

_Reviewed: 2026-05-24T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

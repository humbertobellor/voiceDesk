# Phase 12: Notification Foundation - Research

**Researched:** 2026-05-24
**Domain:** Email notification schema, in-app notification persistence, email transport layer
**Confidence:** HIGH

## Summary

Phase 12 lays the database and code foundation for the notification system without implementing any Inngest dispatch or UI. The phase delivers three locked schema changes (app_notifications table, notification_settings columns), regenerates TypeScript types to include email as a notification channel, and implements a unit-tested email transport function that Inngest will call in Phase 13. No external services (Resend) are invoked during tests; all sendEmail() unit tests mock the transport via vi.mock(). All downstream phases (13, 14, 15) are blocked until this foundation is complete.

**Primary recommendation:** 
1. Create the migration file with `app_notifications` table (4 event types via CHECK constraint, not Postgres enum), three new `notification_settings` columns (email opt-in model), and the Realtime publication registration
2. Implement `sendEmail()` at `src/lib/notifications/email.ts` with non-throwing return pattern matching `sendSms` 
3. Regenerate `src/types/database.ts` to add `'email'` to NotificationChannel union type and export AppNotification interface
4. Write unit tests for email transport with mocked Resend
5. Verify `tsc --noEmit` exits 0 and all tests pass before phase completion

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 through D-14 (Decisions section of 12-CONTEXT.md):** All schema decisions, sendEmail() interface, RLS pattern, and Resend version are locked. No deviations allowed.
  - `app_notifications` RLS must use contractor subquery: `(SELECT id FROM contractors WHERE user_id = auth.uid())`
  - `event_type` constrained via CHECK (not Postgres enum): `('lead', 'emergency', 'payment_failure', 'system')`
  - `notify_email_enabled BOOLEAN NOT NULL DEFAULT FALSE` + `email_address TEXT` + `notify_on_payment_failure BOOLEAN NOT NULL DEFAULT FALSE` on notification_settings
  - `sendEmail()` returns `{ success: boolean; messageId?: string; error?: string }` — never throws
  - Resend version: `^6.12.3`

### Claude's Discretion

- None — all decisions are locked from CONTEXT.md discussion phase.

### Deferred Ideas (Out of Scope)

- @react-email/components + @react-email/render installation → Phase 13
- Email template JSX interface → Phase 13
- Per-notification mark-as-read → future
- Email digest/daily summary → future
- Browser push notifications → future

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EMAIL-01 | Contractor can enter email in Notification Settings and enable email alerts (opt-in, disabled by default) | D-06 schema decisions: three new columns on notification_settings with opt-in model; Phase 14 UI captures email_address and notify_email_enabled |
| EMAIL-05 | Email send success and failure recorded in notification_log with channel='email' — failures visible and retried by Inngest | D-08 sendEmail() non-throwing interface; log.ts writeNotificationLog / updateNotificationLog handle email channel; NotificationChannel type extended to include 'email' |
| BELL-04 | Notifications persisted in database and remain visible after browser close and reopen | D-02 app_notifications schema with persistence; D-05 Realtime publication registered; Phase 14 fetches from DB on mount |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Email transport function | API / Backend | — | `sendEmail()` is server-only (import 'server-only'), called from Inngest functions, never exposed to browser |
| Email settings persistence | Database / Storage | API | `notification_settings` columns (email_address, notify_email_enabled) hold opt-in state; updated via API in Phase 14 |
| In-app notification storage | Database / Storage | API | `app_notifications` table stores all in-app events; read via API queries, subscribed via Supabase Realtime |
| Notification Realtime delivery | Database / Storage | — | Supabase Realtime subscription on app_notifications fires on new inserts, enabling live badge updates in Phase 14 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `resend` | ^6.12.3 | Email transport API | Locked in STATE.md; production-ready, minimal SDK, one API call per email |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | 4.1.5 | Unit test framework | Already installed (Wave 0 from Phase 1); mock Resend for tests |
| `server-only` | ^0.0.1 | Mark server-only modules | Already installed; required on email.ts |
| `@supabase/supabase-js` | 2.105.1 | Database client | Already installed; used in log.ts to write notification_log |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Resend | SendGrid / Mailgun / AWS SES | Resend is lighter SDK (single `send()` method) + EU data residency option + better DX. SendGrid/Mailgun heavier with more boilerplate. Decision locked in STATE.md. |
| CHECK constraint for event_type | Postgres ENUM type | CHECK constraint allows future extension without migration. Enum is stricter but requires ALTER TYPE. Decision locked in CONTEXT.md D-03. |
| Non-throwing sendEmail() | Throwing on error | Inngest functions need explicit error inspection; non-throwing return pattern matches Phase 5 sendSms/sendWhatsApp precedent. |

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| resend | npm | 4 yrs | ~1M/week | github.com/resendlabs/resend-node | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** None
**Packages flagged as suspicious [SUS]:** None

*Note: resend is already installed on the project. Version `^6.12.3` verified against npm registry.*

## Database Schema — app_notifications Table

### Full Table Definition

```sql
CREATE TABLE app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('lead', 'emergency', 'payment_failure', 'system')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_notifications ENABLE ROW LEVEL SECURITY;

-- RLS: contractor subquery pattern
CREATE POLICY "app_notifications_select_own"
  ON app_notifications FOR SELECT
  TO authenticated
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "app_notifications_insert_own"
  ON app_notifications FOR INSERT
  TO authenticated
  WITH CHECK (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "app_notifications_update_own"
  ON app_notifications FOR UPDATE
  TO authenticated
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "app_notifications_delete_own"
  ON app_notifications FOR DELETE
  TO authenticated
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));

-- Critical: register with Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE app_notifications;

-- Create index for Phase 14 queries
CREATE INDEX idx_app_notifications_contractor_id_created_at
  ON app_notifications(contractor_id, created_at DESC);
```

### Design Notes

- **event_type:** CHECK constraint (not Postgres ENUM) allows future event types without ALTER TYPE migration. Four values: `'lead'`, `'emergency'`, `'payment_failure'`, `'system'` (catch-all for platform notifications).
- **is_read / read_at:** Both columns included. Phase 14 implements mark-all-read (sets is_read=true, read_at=NOW() on all rows for contractor); per-notification mark-as-read deferred to future.
- **RLS:** Contractor subquery pattern (`contractor_id IN (SELECT id FROM contractors WHERE user_id = auth.uid())`) prevents cross-tenant access. Service role bypass used only in Inngest functions.
- **Realtime:** `ALTER PUBLICATION supabase_realtime ADD TABLE app_notifications` is CRITICAL. Without it, Supabase Realtime does not fire events on INSERT, and Phase 14 badge updates will not work.

## notification_settings Columns — Phase 12 Additions

Three columns added to existing `notification_settings` table (created in Phase 1, extended in Phase 10):

```sql
ALTER TABLE notification_settings
  ADD COLUMN IF NOT EXISTS notify_email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_address TEXT,
  ADD COLUMN IF NOT EXISTS notify_on_payment_failure BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN notification_settings.notify_email_enabled IS
  'D-06: Email opt-in flag. Default FALSE (opt-in model) — no email until contractor explicitly enables. Phase 14 UI toggles this flag.';

COMMENT ON COLUMN notification_settings.email_address IS
  'D-06: Contractor-supplied send-to email address. Nullable — email gates on BOTH email_address IS NOT NULL AND notify_email_enabled = TRUE (D-07).';

COMMENT ON COLUMN notification_settings.notify_on_payment_failure IS
  'D-06: Gating flag for payment failure emails (Phase 13). Phase 7 payment failure Inngest function will check this before calling sendEmail().';
```

### RLS Coverage

Existing RLS policies on `notification_settings` (from Phase 1) automatically cover all new columns — no new policies needed. Columns added via ALTER TABLE inherit existing SELECT, INSERT, UPDATE, DELETE policies.

### notification_log Channel Extension

The existing `notification_log` table has a CHECK constraint: `channel IN ('sms', 'whatsapp', 'telegram')`. This must be extended in the same migration:

```sql
ALTER TABLE notification_log
  DROP CONSTRAINT notification_log_channel_check,
  ADD CONSTRAINT notification_log_channel_check CHECK (channel IN ('sms', 'whatsapp', 'telegram', 'email'));
```

**TypeScript type update:** `NotificationChannel` type in `src/types/database.ts` is currently `'sms' | 'whatsapp' | 'telegram'`. Must be extended to `'sms' | 'whatsapp' | 'telegram' | 'email'` so Phase 13 can call `writeNotificationLog({ channel: 'email', ... })` without type error.

## Email Transport Implementation — sendEmail()

### Function Signature

```typescript
// src/lib/notifications/email.ts
import 'server-only'
import { Resend } from 'resend'

export interface SendEmailParams {
  to: string            // recipient email address
  subject: string       // email subject
  html: string          // HTML email body
}

export interface SendEmailResult {
  success: boolean
  messageId?: string    // Resend message ID on success
  error?: string        // Error message on failure
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const fromAddress = process.env.RESEND_FROM_ADDRESS

  if (!apiKey || !fromAddress) {
    return {
      success: false,
      error: 'Resend credentials not configured (RESEND_API_KEY or RESEND_FROM_ADDRESS missing)',
    }
  }

  try {
    const resend = new Resend(apiKey)
    const result = await resend.emails.send({
      from: fromAddress,
      to: params.to,
      subject: params.subject,
      html: params.html,
    })

    if (result.error) {
      return { success: false, error: result.error.message }
    }

    return { success: true, messageId: result.data?.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, error: message }
  }
}
```

### Key Design Decisions

1. **Non-throwing:** Returns `{ success: false, error: string }` instead of throwing. Inngest inspects the result and decides retry behavior. Matches existing patterns in `sendSms` and `sendWhatsApp`.

2. **No Resend mock in production:** Resend is called directly; no wrapper/stub layer. Tests mock Resend via `vi.mock('resend', ...)`.

3. **Environment variables:** 
   - `RESEND_API_KEY` — server-only secret, never NEXT_PUBLIC_
   - `RESEND_FROM_ADDRESS` — sending domain (e.g., `noreply@voicedesk.app`), server-only

4. **Missing credentials:** Returns failure gracefully instead of throwing, allowing tests to verify env var handling without network calls.

### Unit Tests

```typescript
// tests/notifications/email.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const mockEmailsSend = vi.fn()
vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: { send: mockEmailsSend },
  })),
}))

import { sendEmail } from '@/lib/notifications/email'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.RESEND_API_KEY = 're_test_key'
  process.env.RESEND_FROM_ADDRESS = 'noreply@voicedesk.app'
})

describe('sendEmail', () => {
  it('returns success with messageId on successful send', async () => {
    mockEmailsSend.mockResolvedValue({ data: { id: 'msg_123' }, error: null })
    const result = await sendEmail({
      to: 'contractor@example.com',
      subject: 'New Lead',
      html: '<p>Caller: John</p>',
    })
    expect(result).toEqual({ success: true, messageId: 'msg_123' })
    expect(mockEmailsSend).toHaveBeenCalledWith({
      from: 'noreply@voicedesk.app',
      to: 'contractor@example.com',
      subject: 'New Lead',
      html: '<p>Caller: John</p>',
    })
  })

  it('returns failure when Resend returns error', async () => {
    mockEmailsSend.mockResolvedValue({ 
      data: null, 
      error: { message: 'Invalid email address' } 
    })
    const result = await sendEmail({
      to: 'invalid-email',
      subject: 'Test',
      html: '<p>Test</p>',
    })
    expect(result).toEqual({ success: false, error: 'Invalid email address' })
  })

  it('returns failure when Resend throws', async () => {
    mockEmailsSend.mockRejectedValue(new Error('Network timeout'))
    const result = await sendEmail({
      to: 'contractor@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    })
    expect(result).toEqual({ success: false, error: 'Network timeout' })
  })

  it('returns failure when RESEND_API_KEY is missing', async () => {
    delete process.env.RESEND_API_KEY
    const result = await sendEmail({
      to: 'contractor@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Resend credentials not configured')
  })

  it('returns failure when RESEND_FROM_ADDRESS is missing', async () => {
    delete process.env.RESEND_FROM_ADDRESS
    const result = await sendEmail({
      to: 'contractor@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Resend credentials not configured')
  })
})
```

### Test Coverage

Five test cases cover:
1. Successful send with messageId returned
2. Resend API error response (error object from Resend SDK)
3. Exception thrown during send (try-catch handling)
4. Missing RESEND_API_KEY (env var validation)
5. Missing RESEND_FROM_ADDRESS (env var validation)

All tests use `vi.mock('resend', ...)` — no network calls, no test API key, deterministic execution.

## TypeScript Type Updates

### NotificationChannel Extension

**File:** `src/types/database.ts`

**Current:**
```typescript
export type NotificationChannel = 'sms' | 'whatsapp' | 'telegram'
```

**After Phase 12:**
```typescript
export type NotificationChannel = 'sms' | 'whatsapp' | 'telegram' | 'email'
```

### AppNotification Interface Addition

Add new interface to `src/types/database.ts`:

```typescript
export interface AppNotification {
  id: string
  contractor_id: string
  event_type: 'lead' | 'emergency' | 'payment_failure' | 'system'
  title: string
  body: string
  is_read: boolean
  read_at: string | null
  created_at: string
}
```

### NotificationSettings Extension

**File:** `src/types/database.ts`

**Current fields:** (from Phase 1 and Phase 10)
```typescript
export interface NotificationSettings {
  id: string
  contractor_id: string
  sms_number: string | null
  whatsapp_number: string | null
  telegram_chat_id: string | null
  notify_on_lead: boolean
  notify_on_emergency: boolean
  notify_on_general_inquiry: boolean
  notify_sms_enabled: boolean
  notify_whatsapp_enabled: boolean
  notify_telegram_enabled: boolean
  whatsapp_opted_in_at: string | null
  created_at: string
  updated_at: string
}
```

**Add three new fields:**
```typescript
export interface NotificationSettings {
  // ... existing fields ...
  notify_email_enabled: boolean        // Phase 12 — email opt-in flag
  email_address: string | null         // Phase 12 — contractor-supplied send-to address
  notify_on_payment_failure: boolean   // Phase 12 — gating for payment failure emails
}
```

### TypeScript Verification

After schema changes and type updates are complete:

```bash
npm run typecheck
# or
tsc --noEmit
```

Must exit with code 0 (no type errors). This is a success criterion for the phase.

## Common Pitfalls

### Pitfall 1: Realtime Publication Registration Forgotten

**What goes wrong:** `app_notifications` table is created with RLS enabled, but `ALTER PUBLICATION supabase_realtime ADD TABLE app_notifications` is missing from the migration. Phase 14 subscribes to Realtime events, but no events fire. Badge does not update.

**Why it happens:** The publication step is easy to overlook — the table works fine for SELECT/INSERT/UPDATE/DELETE, so it appears to be working until you test Realtime subscriptions.

**How to avoid:** Include `ALTER PUBLICATION supabase_realtime ADD TABLE app_notifications` in the same migration file. Verify in Phase 14 by opening the browser DevTools Network tab and confirming Realtime events fire when a new notification is inserted.

**Warning signs:** Phase 14 pull request has a "badge doesn't update" comment.

### Pitfall 2: NotificationChannel Union Type Not Extended

**What goes wrong:** `email.ts` is written, Phase 13 compiles successfully (because Phase 13 is a separate task), but when Phase 13 calls `writeNotificationLog({ channel: 'email', ... })` in the email dispatch function, TypeScript raises a type error. The type is still `'sms' | 'whatsapp' | 'telegram'`.

**Why it happens:** Types are regenerated at the end of Phase 12, but the decision to extend NotificationChannel to include 'email' is sometimes deferred.

**How to avoid:** Update `src/types/database.ts` NotificationChannel in Phase 12, before marking the phase complete. Verify with `tsc --noEmit`.

**Warning signs:** Phase 13 plan starts and immediately hits a type error on writeNotificationLog.

### Pitfall 3: Resend sendEmail() Returns Type Mismatch in Inngest Consumption

**What goes wrong:** `sendEmail()` in Phase 12 returns `{ success: boolean; messageId?: string; error?: string }`, but Phase 13 expects a throwing function or a different return shape. Inngest code in Phase 13 cannot handle the return type.

**Why it happens:** Phase 13 decision about how to consume the sendEmail result is not coordinated with Phase 12 implementation.

**How to avoid:** Document the exact return type in sendEmail() and the non-throwing pattern in Phase 12 RESEARCH.md. Phase 13 research must reference this return type and design around it.

**Warning signs:** Phase 13 plan has "refactor sendEmail return type" task.

### Pitfall 4: Email Opt-In Gate Logic Missing from Phase 13

**What goes wrong:** Phase 13 Inngest function always calls `sendEmail()` regardless of `notify_email_enabled` or `email_address` values. Contractors who never opted in receive emails anyway.

**Why it happens:** The gate logic (`email_address IS NOT NULL AND notify_email_enabled = TRUE`) is defined in CONTEXT.md D-07 but not replicated in the Phase 13 plan template.

**How to avoid:** Document the two-part gate explicitly in Phase 12 RESEARCH.md. Phase 13 research must reference this gate and include it in the plan checklist.

**Warning signs:** Beta contractor receives email despite never enabling email notifications.

### Pitfall 5: notification_log Channel CHECK Constraint Not Updated

**What goes wrong:** `notification_log` table has CHECK constraint `channel IN ('sms', 'whatsapp', 'telegram')`. Phase 13 tries to insert a row with `channel: 'email'` and the constraint violation fails silently (or throws in Inngest).

**Why it happens:** The migration must include both:
1. Create `app_notifications` table
2. Add columns to `notification_settings`
3. **Extend notification_log CHECK constraint** to include 'email'

Missing step 3 breaks Phase 13.

**How to avoid:** Include the ALTER TABLE notification_log statement in the migration. Test by attempting to insert a row with `channel: 'email'` before Phase 13 starts.

**Warning signs:** Phase 13 fails to insert notification_log row with error "check constraint violation".

## Architecture Patterns

### System Architecture Diagram

```
Phase 12 Foundation:
┌──────────────────────────────────────────────────────────┐
│  Database (Supabase)                                     │
│                                                          │
│  ┌──────────────┐   ┌──────────────────────┐            │
│  │notification_ │   │app_notifications     │            │
│  │settings      │   │(with Realtime pub)   │            │
│  │(3 new cols)  │   │                      │            │
│  └──────────────┘   └──────────────────────┘            │
│       │                         ▲                        │
│       │                         │                        │
└───────┼─────────────────────────┼────────────────────────┘
        │                         │
        │ (Phase 13 writes)       │ (Phase 13 writes)
        │                         │
┌───────┼─────────────────────────┼────────────────────────┐
│  TypeScript Types (Phase 12)    │                        │
│                                 │                        │
│  NotificationChannel ───────────┼── 'email' added        │
│  AppNotification ───────────────┴── new interface        │
│  NotificationSettings ───────────── 3 new fields         │
└───────────────────────────────────────────────────────────┘
        │
        │ (Phase 13 + later phases)
        │
┌───────┼─────────────────────────────────────────────────┐
│  Email Transport Layer (src/lib/notifications/)         │
│                                                         │
│  sendEmail() ─── mocked in tests, real in production    │
│                                                         │
│  Non-throwing pattern:                                  │
│  { success: boolean; messageId?; error? }              │
└───────────────────────────────────────────────────────┘
        │
        │ (Phase 13 Inngest)
        │
┌───────┼────────────────────────────────────────────────┐
│  Phase 13: Email Dispatch (future)                     │
│                                                        │
│  retell-notify-dispatch (Inngest function) ──┐        │
│    → checks notification_settings gates       │        │
│    → calls sendEmail()                        │        │
│    → logs to notification_log                 │        │
│                                  ┌────────────┘        │
│                                  │                     │
│  sendEmail() returns ────────────┘                     │
│    result inspected by Inngest                         │
│    retry logic applied                                 │
└────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/lib/notifications/
├── email.ts              # Phase 12 NEW: sendEmail() function
├── sms.ts                # Phase 5: existing sendSms() pattern reference
├── whatsapp.ts           # Phase 5: existing sendWhatsApp() pattern reference
├── log.ts                # Phase 5: writeNotificationLog / updateNotificationLog (unchanged)
└── telegram.ts           # Phase 5: existing sendTelegram() pattern reference

supabase/migrations/
├── 20260XXX_phase12_notification_foundation.sql  # NEW: creates app_notifications, alters notification_settings + notification_log

src/types/
├── database.ts           # Phase 12 UPDATED: NotificationChannel | 'email', AppNotification interface, NotificationSettings 3 new fields

tests/notifications/
├── email.test.ts         # Phase 12 NEW: sendEmail() unit tests with vi.mock('resend')
├── sms.test.ts           # Phase 5: existing, pattern reference
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email sending | Custom SMTP client or raw nodemailer config | Resend SDK | Resend handles DKIM/DMARC/DKIM authentication, bounce handling, templating roadmap. Rolling SMTP with node requires DNS/TLS tuning, bounce parsing, rate limiting. |
| Notification log tracking | Custom status tracking outside notification_log | writeNotificationLog + updateNotificationLog (Phase 5 pattern) | Pattern is proven, handles idempotency, integrates with Inngest retry logic. Custom tracking leads to duplicate sends or missed failures. |
| Event type constraints | Application-level validation | Database CHECK constraint (Phase 12) | Database-level CHECK ensures no invalid event types can be written, even via raw SQL or service role. Application-level validation can be bypassed. |
| RLS for notifications | Simple `contractor_id = auth.uid()` | Contractor subquery: `contractor_id IN (SELECT id FROM contractors WHERE user_id = auth.uid())` | This pattern (used throughout Phase 1) prevents accidental cross-tenant access if contractor rows are queried directly. Direct comparison is less defensive. |

**Key insight:** Email transport and notification logging are commodities — vetted libraries and proven patterns are faster and more secure than custom solutions. Constraints belong in the database, not in application code.

## Code Examples

### sendEmail() Basic Usage (Phase 13 preview)

```typescript
// Source: Locked decision D-08 (sendEmail interface)
import { sendEmail } from '@/lib/notifications/email'

// In a Phase 13 Inngest function:
const result = await sendEmail({
  to: 'contractor@example.com',
  subject: 'New Lead — AC Repair',
  html: '<p>Caller: John Doe</p><p>Issue: AC not cooling</p>',
})

if (result.success) {
  await updateNotificationLog(logId, { status: 'sent', sentAt: new Date().toISOString() })
} else {
  await updateNotificationLog(logId, { status: 'failed', error: result.error })
  // Inngest inspects this and may retry
}
```

### writeNotificationLog with 'email' Channel (Phase 13 preview)

```typescript
// Source: Phase 5 pattern, extended for Phase 12
import { writeNotificationLog } from '@/lib/notifications/log'

const logId = await writeNotificationLog({
  contractorId: contractor.id,
  callId: call.id,
  channel: 'email',  // Phase 12 adds 'email' to NotificationChannel union type
  recipient: contractor.notification_settings.email_address!,
  message: `New lead from ${lead.caller_phone}`,
})
```

### Migration File Structure (Phase 12)

```sql
-- supabase/migrations/20260XXX_phase12_notification_foundation.sql
-- Phase 12: Notification Foundation — app_notifications table, notification_settings email columns, Realtime publication

-- 1. Create app_notifications table (bell-ready schema)
CREATE TABLE app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('lead', 'emergency', 'payment_failure', 'system')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_notifications ENABLE ROW LEVEL SECURITY;

-- 2. Add four RLS policies for app_notifications (contractor subquery pattern)
-- (See above section for policy definitions)

-- 3. Register app_notifications with Supabase Realtime (CRITICAL)
ALTER PUBLICATION supabase_realtime ADD TABLE app_notifications;

-- 4. Add index for Phase 14 queries
CREATE INDEX idx_app_notifications_contractor_id_created_at
  ON app_notifications(contractor_id, created_at DESC);

-- 5. Add three new columns to notification_settings
ALTER TABLE notification_settings
  ADD COLUMN IF NOT EXISTS notify_email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_address TEXT,
  ADD COLUMN IF NOT EXISTS notify_on_payment_failure BOOLEAN NOT NULL DEFAULT FALSE;

-- Comments on new columns
COMMENT ON COLUMN notification_settings.notify_email_enabled IS
  'D-06: Email opt-in flag. Default FALSE (opt-in model).';
COMMENT ON COLUMN notification_settings.email_address IS
  'D-06: Contractor-supplied send-to address. Email gates on email_address IS NOT NULL AND notify_email_enabled = TRUE.';
COMMENT ON COLUMN notification_settings.notify_on_payment_failure IS
  'D-06: Gating flag for payment failure emails (Phase 13).';

-- 6. Update notification_log CHECK constraint to include 'email'
ALTER TABLE notification_log
  DROP CONSTRAINT notification_log_channel_check,
  ADD CONSTRAINT notification_log_channel_check CHECK (channel IN ('sms', 'whatsapp', 'telegram', 'email'));
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.5 |
| Config file | vitest.config.ts (inherited from Phase 1) |
| Quick run command | `npm run test -- tests/notifications/email.test.ts` |
| Full suite command | `npm run test` (all tests) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EMAIL-01 | schema: notification_settings has notify_email_enabled, email_address columns | unit (migration) | migration verified by supabase db push | ✅ Phase 12 migration |
| EMAIL-05 | sendEmail() returns { success, messageId?, error? }; never throws | unit | `npm run test -- tests/notifications/email.test.ts` | ✅ email.test.ts Phase 12 NEW |
| BELL-04 | app_notifications table persists; RLS verified via unprivileged user test | integration | Manual: `supabase test` with anon key | ✅ Phase 12 migration |

### Sampling Rate
- **Per task commit:** `npm run test -- tests/notifications/email.test.ts` (email transport tests only)
- **Per wave merge:** `npm run test` (full suite includes all notification tests) + `tsc --noEmit` (type verification)
- **Phase gate:** Full suite green + `tsc --noEmit` exits 0 before marking phase complete

### Wave 0 Gaps
- [ ] `tests/notifications/email.test.ts` — covers EMAIL-01 / EMAIL-05 sendEmail() function and error handling
- [ ] TypeScript regeneration: `src/types/database.ts` — NotificationChannel | 'email' + AppNotification interface + NotificationSettings 3 new fields
- [ ] Email transport lib: `src/lib/notifications/email.ts` — sendEmail() function with `import 'server-only'`

*No gaps in Wave 0 if all three items above are completed.*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | RLS uses contractor subquery, verified at DB level |
| V3 Session Management | No | Not applicable to schema + library phase |
| V4 Access Control | Yes | RLS policies on app_notifications + notification_settings; contractor subquery pattern prevents cross-tenant access |
| V5 Input Validation | Yes | sendEmail() validates email address format indirectly (Resend API validates); CHECK constraint on event_type validates at DB level |
| V6 Cryptography | No | Email transport uses Resend (TLS in transit); no encryption of email content at rest (contractor email is plaintext, as intended) |
| V7 Error Handling | Yes | sendEmail() never throws — returns { success: false, error: string } so Inngest can inspect and log; no secrets in error messages |
| V8 Data Protection | Yes | `notification_settings.email_address` stored as plaintext (GDPR compliant — contractor-provided data); Phase 13 will log email send status in notification_log |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant notification access (reading another contractor's notifications) | Elevation of Privilege | RLS contractor subquery pattern on app_notifications (D-04); verified before Phase 14 ships |
| SQL injection via email address input | Tampering | Parameterized queries via Supabase client + zod validation in API route (Phase 14); sendEmail() does not construct SQL |
| Email header injection (attacker crafts "to" field with newlines) | Tampering | Resend SDK validates email addresses before send; application validates via zod in API route (Phase 14) |
| Unauthorized Inngest dispatch of email (Phase 13) | Elevation of Privilege | Inngest functions run on service role; must check notification_settings gates (email_address + notify_email_enabled) before calling sendEmail() |
| Accidental logging of sensitive data in sendEmail errors | Information Disclosure | sendEmail() error messages are technical (Resend API errors); Inngest logs are server-only; Phase 13 logs email address and recipient in notification_log (expected, not sensitive) |
| Email API key exposed in source | Information Disclosure | RESEND_API_KEY is server-only (import 'server-only' on email.ts); .env.example documents placeholder; never NEXT_PUBLIC_ prefixed |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Resend v6.12.3 is current and stable (verified 2026-05-24: npm registry shows version 6.12.3 exists) | Standard Stack | If version is yanked or deprecated, Phase 13 install fails. Mitigation: npm registry check before Phase 13 starts. |
| A2 | Supabase `ALTER PUBLICATION supabase_realtime ADD TABLE app_notifications` syntax is valid and fires Realtime events on INSERT | Database Schema | If syntax is wrong or Realtime does not fire, Phase 14 badge updates fail silently. Mitigation: test with Realtime subscription after migration is applied. |
| A3 | Contractor subquery RLS pattern from Phase 1 generalizes correctly to app_notifications table | Database Schema | If pattern is misapplied, cross-tenant access possible (CRITICAL). Mitigation: test as unprivileged user before Phase 14 ships. |

*All other claims in this research are [VERIFIED] via locked decisions from CONTEXT.md or direct inspection of codebase.*

## Open Questions

1. **Email Sending Domain Verification in Resend**
   - What we know: RESEND_FROM_ADDRESS must be configured in .env and must match a verified domain in the Resend dashboard.
   - What's unclear: Who configures the Resend dashboard (product manager, ops engineer, or developer in Phase 13)? Is domain verification required before Phase 12 completes, or deferred to Phase 13 setup?
   - Recommendation: Document in Phase 12 RESEARCH.md that RESEND_FROM_ADDRESS requires pre-configuration in Resend dashboard. Phase 13 research should include a setup checklist (verify domain, save API key, test send).

2. **Inngest Retry Logic for Email Failures**
   - What we know: Phase 13 will use Inngest's built-in retry behavior. sendEmail() non-throwing pattern returns `{ success: false, error: string }` for Inngest to inspect.
   - What's unclear: How does Inngest decide to retry? Is it based on exception thrown, or does the Phase 13 Inngest function need explicit retry logic (e.g., `if (!result.success) { throw ... }`)?
   - Recommendation: Phase 13 research must clarify Inngest retry mechanics for non-throwing transports and decide whether to throw on sendEmail failure or use Inngest's config.

3. **Email Template Format in Phase 13**
   - What we know: sendEmail() accepts `html: string`. Phase 13 will build email bodies as strings (no @react-email/components yet).
   - What's unclear: Will email templates be hardcoded HTML strings, or should Phase 13 use a lightweight templating library?
   - Recommendation: Phase 13 research should decide on email template approach (hardcoded HTML vs. template engine). If template engine, which one (Handlebars, ETA, etc.)?

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | email.ts (Resend SDK) | ✓ | 18+ inferred | — |
| npm | test infrastructure | ✓ | 9+ inferred | — |
| Vitest | email.test.ts | ✓ | 4.1.5 | — |
| TypeScript | tsc --noEmit verification | ✓ | 5.7.0+ | — |

**Resend API (external service):** Not required during Phase 12 (tests mock Resend via vi.mock). Required in Phase 13+ for actual email sends. Blocker: RESEND_API_KEY and RESEND_FROM_ADDRESS must be configured in Vercel environment before Phase 13 ships.

**Supabase (external service):** Required for migrations (`supabase db push`). Already configured and used throughout project.

## Sources

### Primary (HIGH confidence)
- 12-CONTEXT.md (D-01 through D-14) — All locked decisions for Phase 12 implementation
- Phase 1 RESEARCH.md — RLS contractor subquery pattern, migration structure reference
- Phase 5 RESEARCH.md — sendSms / sendWhatsApp / notification_log patterns
- Phase 10 RESEARCH.md — ALTER TABLE notification_settings pattern
- package.json — resend ^6.12.3 version verification

### Secondary (MEDIUM confidence)
- STATE.md § "Key Decisions Locked (v1.1)" — Resend version pinned, shouldSendEmail gating model
- Official Resend documentation (verified via npm view) — SDK v6.12.3 available
- Existing codebase (sms.ts, whatsapp.ts, log.ts, tests/notifications/sms.test.ts) — Proven patterns for replication

### Tertiary (LOW confidence)
- None — no assumptions or external sources needed beyond locked decisions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Resend v6.12.3 verified on npm; already in package.json
- Architecture: HIGH — Schema decisions locked in CONTEXT.md; RLS pattern proven in Phase 1
- Pitfalls: HIGH — Cross-checked against Phase 1 RLS patterns and Phase 5 notification patterns
- Implementation: HIGH — Code examples follow locked decisions and existing codebase patterns

**Research date:** 2026-05-24
**Valid until:** 2026-06-24 (30 days — stable infrastructure, low churn in email/notification domain)

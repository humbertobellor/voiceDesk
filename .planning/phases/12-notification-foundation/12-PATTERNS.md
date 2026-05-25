# Phase 12: Notification Foundation - Pattern Map

**Mapped:** 2026-05-24
**Files analyzed:** 4 new/modified files
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/20260XXX_phase12_notification_foundation.sql` | migration | schema | `supabase/migrations/20260523000015_phase10_notification_settings.sql` | exact |
| `src/lib/notifications/email.ts` | service | request-response | `src/lib/notifications/sms.ts` | exact |
| `tests/notifications/email.test.ts` | test | request-response | `tests/notifications/sms.test.ts` | exact |
| `src/types/database.ts` (update) | model/types | transform | existing file | exact |

## Pattern Assignments

### `supabase/migrations/20260XXX_phase12_notification_foundation.sql` (migration, schema)

**Analog:** `supabase/migrations/20260523000015_phase10_notification_settings.sql`

**Migration file header and column addition pattern** (lines 1-24):
```sql
-- 20260523000015_phase10_notification_settings.sql
-- Phase 10: Notification Settings Form — adds 3 boolean channel-enable columns to notification_settings.
-- D-02: Explicit opt-in/opt-out model per channel:
--   SMS default TRUE  → opt-out model (existing contractors keep notifications unless they disable)
--   WhatsApp default FALSE → opt-in model (no WA messages until contractor explicitly enables)
--   Telegram default FALSE → opt-in model (no Telegram messages until contractor explicitly enables)
-- RLS: existing notification_settings policies in 20260504000002_rls_policies.sql cover all four
--   operations (SELECT/INSERT/UPDATE/DELETE) by contractor_id.
--   New columns are automatically covered by existing policies — no new policy changes needed.

ALTER TABLE notification_settings
  ADD COLUMN IF NOT EXISTS notify_sms_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notify_telegram_enabled BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN notification_settings.notify_sms_enabled IS
  'D-02: Phase 10 gate for SMS dispatch. Default TRUE (opt-out model) — existing contractors keep SMS unless they explicitly disable it. computeChannels() checks this flag alongside sms_number != null.';
```

**RLS pattern source** (reference): `supabase/migrations/20260504000002_rls_policies.sql` lines 35-54 — contractor subquery pattern for RLS policies:
```sql
CREATE POLICY "contractor_settings_select_own"
  ON contractor_settings FOR SELECT
  TO authenticated
  USING (contractor_id IN (SELECT id FROM contractors WHERE user_id = (SELECT auth.uid())));
```

For Phase 12 `app_notifications` table, apply the same contractor subquery pattern for all four operations (SELECT, INSERT, UPDATE, DELETE).

---

### `src/lib/notifications/email.ts` (service, request-response)

**Analog:** `src/lib/notifications/sms.ts`

**Imports pattern** (lines 1-2):
```typescript
import 'server-only'
import twilio from 'twilio'
```

**Phase 12 equivalent:**
```typescript
import 'server-only'
import { Resend } from 'resend'
```

**Function signature and non-throwing pattern** (lines 4-14):
```typescript
export interface SendSmsParams {
  to: string       // E.164 format: +1XXXXXXXXXX
  body: string
  contractorId: string
  callId: string | null
}

export interface SendSmsResult {
  sid: string
  status: string
}
```

**Phase 12 equivalent (from 12-RESEARCH.md):**
```typescript
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
```

**Core pattern: environment variable validation** (lines 19-25):
```typescript
export async function sendSms(params: SendSmsParams): Promise<SendSmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_FROM_NUMBER

  if (!accountSid) throw new Error('[sendSms] TWILIO_ACCOUNT_SID is not set')
  if (!authToken) throw new Error('[sendSms] TWILIO_AUTH_TOKEN is not set')
  if (!fromNumber) throw new Error('[sendSms] TWILIO_FROM_NUMBER is not set')
```

**Phase 12 difference:** sendEmail() does NOT throw on missing credentials — it returns `{ success: false, error: string }` instead. See 12-RESEARCH.md lines 206-210:
```typescript
if (!apiKey || !fromAddress) {
  return {
    success: false,
    error: 'Resend credentials not configured (RESEND_API_KEY or RESEND_FROM_ADDRESS missing)',
  }
}
```

**SDK call pattern** (lines 27-34):
```typescript
  const client = twilio(accountSid, authToken)
  const message = await client.messages.create({
    to: params.to,
    from: fromNumber,
    body: params.body,
  })

  return { sid: message.sid, status: message.status }
```

**Phase 12 equivalent** (from 12-RESEARCH.md lines 213-226):
```typescript
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
```

---

### `tests/notifications/email.test.ts` (test, request-response)

**Analog:** `tests/notifications/sms.test.ts`

**Test setup and mock pattern** (lines 1-13):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

// Mock twilio default export
const mockMessagesCreate = vi.fn()
vi.mock('twilio', () => ({
  default: vi.fn(() => ({
    messages: { create: mockMessagesCreate },
  })),
}))

import { sendSms } from '@/lib/notifications/sms'
```

**Phase 12 equivalent** (from 12-RESEARCH.md lines 250-261):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const mockEmailsSend = vi.fn()
vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: { send: mockEmailsSend },
  })),
}))

import { sendEmail } from '@/lib/notifications/email'
```

**Test initialization pattern** (lines 15-20):
```typescript
beforeEach(() => {
  vi.clearAllMocks()
  process.env.TWILIO_ACCOUNT_SID = 'ACtest'
  process.env.TWILIO_AUTH_TOKEN = 'auth_test'
  process.env.TWILIO_FROM_NUMBER = '+15550000000'
})
```

**Phase 12 equivalent** (from 12-RESEARCH.md lines 263-267):
```typescript
beforeEach(() => {
  vi.clearAllMocks()
  process.env.RESEND_API_KEY = 're_test_key'
  process.env.RESEND_FROM_ADDRESS = 'noreply@voicedesk.app'
})
```

**Success test pattern** (lines 23-32):
```typescript
  it('calls Twilio messages.create with correct params', async () => {
    mockMessagesCreate.mockResolvedValue({ sid: 'SM123', status: 'queued' })
    const result = await sendSms({ to: '+15551234567', body: 'New call from +15559999999 — AC repair.', contractorId: 'c1', callId: 'call-1' })
    expect(result).toEqual({ sid: 'SM123', status: 'queued' })
    expect(mockMessagesCreate).toHaveBeenCalledWith({
      to: '+15551234567',
      from: '+15550000000',
      body: 'New call from +15559999999 — AC repair.',
    })
  })
```

**Phase 12 equivalent** (from 12-RESEARCH.md lines 270-284):
```typescript
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
```

**Environment variable missing tests** (lines 34-47):
```typescript
  it('throws when TWILIO_ACCOUNT_SID is missing', async () => {
    delete process.env.TWILIO_ACCOUNT_SID
    await expect(sendSms({ to: '+15551234567', body: 'test', contractorId: 'c1', callId: null })).rejects.toThrow('TWILIO_ACCOUNT_SID')
  })
```

**Phase 12 difference:** sendEmail() tests check for `result.success === false` instead of `rejects.toThrow()`. See 12-RESEARCH.md lines 309-318:
```typescript
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
```

---

### `src/types/database.ts` (model, transform)

**Existing file:** Update this file with three changes:

**Change 1: Extend NotificationChannel union type** (line 14, current):
```typescript
export type NotificationChannel = 'sms' | 'whatsapp' | 'telegram'
```

**To:**
```typescript
export type NotificationChannel = 'sms' | 'whatsapp' | 'telegram' | 'email'
```

**Change 2: Add AppNotification interface** (new, from 12-RESEARCH.md lines 365-375):
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

**Change 3: Extend NotificationSettings interface** (update existing, from 12-RESEARCH.md lines 401-408):
Add three new fields to existing `NotificationSettings` interface:
```typescript
  notify_email_enabled: boolean        // Phase 12 — email opt-in flag
  email_address: string | null         // Phase 12 — contractor-supplied send-to address
  notify_on_payment_failure: boolean   // Phase 12 — gating for payment failure emails
```

---

## Shared Patterns

### Migration Structure (All DB Changes)

**Source:** `supabase/migrations/20260523000015_phase10_notification_settings.sql` (lines 1-24) and `supabase/migrations/20260504000002_rls_policies.sql` (lines 1-54)

**Pattern:** 
1. File header with phase name, purpose, and decision references
2. ALTER TABLE or CREATE TABLE statements
3. COMMENT ON COLUMN statements documenting decision IDs and rationale
4. RLS policy creation (when applicable)
5. Index creation (when applicable)

**Apply to Phase 12 migration:**
- File should be named `supabase/migrations/20260XXX_phase12_notification_foundation.sql`
- Include descriptive header with D-01 through D-05 references
- Create app_notifications table with columns, CHECK constraint, and indexes
- Add four RLS policies using contractor subquery pattern
- ALTER notification_settings and notification_log in the same transaction
- Include COMMENT ON COLUMN for all new columns

### Non-Throwing Notification Transport Pattern

**Source:** `src/lib/notifications/sms.ts` (throwing variant) vs. Phase 12 sendEmail() (non-throwing variant)

**Key Difference in Phase 12:**
- SMS throws on missing credentials → Inngest retries on exception
- Email returns `{ success: false, error: string }` → Inngest inspects result and decides retry behavior

**Pattern:** 
- `server-only` import at top
- Environment variable validation (but non-throwing for email)
- SDK initialization
- Try-catch wrapping SDK call
- Return success/failure result with typed interface

**Apply to:** `src/lib/notifications/email.ts` — follow the sendEmail() exact signature from 12-RESEARCH.md lines 185-231

### Test Mock Pattern

**Source:** `tests/notifications/sms.test.ts` (lines 1-13, 15-20)

**Pattern:**
1. Import vitest functions
2. Mock `server-only` module (empty export)
3. Mock the external SDK (Twilio, Resend, etc.) with dependency injection pattern
4. Import the function to test AFTER mocks are set up
5. beforeEach hook sets environment variables and clears mocks
6. Test cases verify SDK calls and return values

**Apply to:** `tests/notifications/email.test.ts` — follow the exact mock structure from 12-RESEARCH.md lines 250-330

### Notification Channel Type Extension

**Source:** `src/types/database.ts` (current line 14)

**Pattern:** Union type `NotificationChannel = 'sms' | 'whatsapp' | 'telegram'` must be extended to include `'email'`

**Rationale:** Phase 13 Inngest functions call `writeNotificationLog({ channel: 'email', ... })` which requires type safety. `log.ts` imports `NotificationChannel` as shown in lines 3-8.

**Apply to:** Add `| 'email'` to NotificationChannel union in `src/types/database.ts` line 14

## RLS Pattern (app_notifications Table)

**Source:** `supabase/migrations/20260504000002_rls_policies.sql` (lines 35-54) — contractor subquery pattern

**Exact pattern to replicate for app_notifications:**

```sql
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
```

**Critical:** This pattern prevents cross-tenant access by checking `user_id` indirectly through the `contractors` table join. Do not simplify to `contractor_id = auth.uid()` — that is incorrect and less defensive.

## No Analog Found

All four files have strong analogs in the codebase:
- Migration structure → Phase 10 migration
- Email transport → SMS transport
- Email tests → SMS tests  
- Type updates → Existing database types file

**No new patterns needed from RESEARCH.md — all analogs are exact matches.**

## Metadata

**Analog search scope:** 
- `src/lib/notifications/*.ts` — 5 files searched
- `tests/notifications/*.test.ts` — 6 files searched
- `supabase/migrations/*.sql` — 5 files searched
- `src/types/database.ts` — 1 file (existing)

**Files scanned:** 17
**Pattern extraction date:** 2026-05-24
**Confidence:** HIGH — All analogs are from proven, production-ready patterns (Phase 1, Phase 5, Phase 10)

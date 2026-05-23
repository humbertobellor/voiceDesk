# Phase 10: Notification Settings Form — Research

**Researched:** 2026-05-23  
**Domain:** Form UI, phone number validation, React Query patterns, Supabase RLS  
**Confidence:** HIGH

## Summary

Phase 10 builds a full notification settings form replacing the current `EmptyState` at `settings/notifications`. The implementation pattern is well-established in the codebase: Server Component fetches current settings + RLS-enforced data, passes to a client form component using React Query mutations. Core work involves (1) extending NotificationSettings schema with 3 boolean enable columns, (2) adding phone number validation using `libphonenumber-js` (already installed), (3) implementing a standard form pattern matching BusinessInfoForm / BusinessHoursForm, and (4) updating computeChannels() in retell-notify-dispatch.ts to gate channels on the new enable flags.

**Primary recommendation:** Follow the established form pattern: Server Component → Client Component + useQuery/useMutation hooks in `src/lib/query/client.tsx`. Use `libphonenumber-js` with `'US'` region for E.164 normalization on save. Add three NOT NULL DEFAULT boolean columns to notification_settings via migration. No custom phone validation library needed — `libphonenumber-js` handles all formatting and edge cases.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Phone number input + validation | Frontend Client | API (normalize on save) | Inline validation improves UX; E.164 normalization happens server-side in PATCH handler |
| Channel enable/disable toggles | Frontend Client | Database (RLS enforces contractor isolation) | Checkbox state managed in form; updates persisted via PATCH |
| Telegram connection status | Frontend Client | Backend (queries telegram_chat_id) | Status determination based on non-null telegram_chat_id; unlink action calls POST /api endpoint |
| Notification dispatch filtering | Backend API | Inngest (retell-notify-dispatch) | computeChannels() checks enable flags before attempting send |
| Settings persistence | API Server | Database (RLS) | PATCH /api/notification-settings validates and persists; Supabase RLS ensures contractor isolation |

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Form scope — full channel management on one page (phone numbers, toggles, Telegram status)
- **D-02:** Channel enable/disable model — three boolean columns with explicit opt-out/opt-in defaults (SMS=TRUE, WhatsApp=FALSE, Telegram=FALSE)
- **D-03:** Phone number fields — independent sms_number and whatsapp_number inputs, no "use same for WhatsApp" checkbox
- **D-04:** Phone input UX — accept common US formats, normalize to E.164 on save using `libphonenumber-js`
- **D-05:** Save behavior — single Save button (no auto-save), all fields saved together
- **D-06:** Telegram section — show status ("Connected" / "Not connected"), unlink button when connected
- **D-07:** Dispatch function — computeChannels() adds enable flag checks alongside existing null checks
- **D-08:** WhatsApp Content SIDs — do NOT touch `HXplaceholder_*` values in this phase
- **D-09:** API pattern — REST route + React Query (established project pattern)

### Claude's Discretion

- API route path: `PATCH /api/notification-settings` (consistent with project naming)
- Form component name: `NotificationSettingsForm`
- Toggle UI: match existing checkbox/toggle convention (check agent config forms)
- Error handling: inline field errors for phone validation; toast or inline banner for save errors

### Deferred Ideas (OUT OF SCOPE)

- Email notifications — requires email provider integration, new DB column, new dispatch channel
- WhatsApp Content SID wiring — defer to when WABA is approved; real SIDs in Vercel env
- Country picker for phone input — US-only for v1; add when international contractors onboard
- Payment alert consistency — `stripe-payment-failure.ts` sends to `contractor.phone_number` instead of `sms_number`; tech debt item for Phase 11

## Phase Requirements

Phase 10 directly enables these requirements from REQUIREMENTS.md:

| Req ID | Description | Research Support |
|--------|-------------|------------------|
| NOTIF-01 | SMS notification within 60s of call end | Enabled by sms_number write field + notify_sms_enabled flag gating dispatch |
| NOTIF-02 | WhatsApp notification for leads/emergencies | Enabled by whatsapp_number write field + notify_whatsapp_enabled flag gating dispatch |
| NOTIF-03 | Telegram notification for leads/emergencies | Enabled by telegram_chat_id status display + notify_telegram_enabled flag gating dispatch |
| EMRG-03 | Emergency notifications reach all configured channels within 30s | Enabled by multi-channel dispatch with enable flags |
| PORTAL-04 | Contractor can configure the agent (notification channels part of config) | Achieved by notification settings form in portal |

## Standard Stack

### Core Libraries

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| React Query | `@tanstack/react-query` | Client state management for settings mutations | [VERIFIED: npm registry] — installed in project, used throughout (leads, calls, agent config) |
| Supabase (SSR) | `@supabase/ssr` | Server-side Supabase client for auth + data fetching | [VERIFIED: npm registry] — already installed, used in all settings pages |
| libphonenumber-js | `^1.11.20` | E.164 phone number parsing and formatting | [VERIFIED: npm registry] — already installed as production dependency per package.json |
| zod | `4.4.2` | Request/response schema validation | [VERIFIED: npm registry] — already installed, used in all API routes |
| Tailwind CSS | `^4.2.4` | Styling (form inputs, toggles, sections) | [VERIFIED: npm registry] — already installed, v4 with @import pattern |

### Supporting Tools

| Tool | Purpose | Availability |
|------|---------|--------------|
| TypeScript strict mode | Type safety for form component, hooks, API route | [VERIFIED] — enabled globally in tsconfig.json |
| Inngest | Background notification dispatch (no changes needed for Phase 10) | [VERIFIED] — already deployed and running |
| Supabase RLS | Row-level security on notification_settings table | [VERIFIED] — existing policies inherit for new columns |

### Patterns & Conventions Used

- **Form pattern:** Follows BusinessInfoForm / BusinessHoursForm / KeywordsForm (see src/components/agent/)
  - `useQuery` hook loads initial data
  - `useMutation` hook saves via PATCH endpoint
  - Single Save button with loading state
  - `useQueryClient.invalidateQueries()` on success for cache coherence
  - Form-level error state (toast or inline banner)

- **Server Component → Client Component:** Matches calendar/settings/phone pattern
  - Server Component: `createSupabaseServer()` auth + data fetch + RLS enforcement
  - Props passed to `'use client'` form component
  - Browser client (createBrowserClient) in React Query hooks

- **Phone number validation:** `libphonenumber-js` with `'US'` region
  - Parse user input using `parsePhoneNumber(input, 'US')`
  - Format to E.164 using `.formatInternational()` → `.replaceAll(' ', '')` or `.format('E.164')`
  - Store in DB as E.164 string (e.g., `+13055551234`)
  - Display to user as readable format (e.g., `+1 (305) 555-1234`)

- **Telegram section:** Uses existing pattern from dashboard/page.tsx
  - Query `telegram_chat_id` presence to determine connected/not-connected state
  - Unlink action: `POST /api/notification-settings/telegram/unlink` → `telegram_chat_id = NULL`
  - Show setup instructions / deep-link when not connected

## Database Schema Changes

### Migration Required

**File:** `supabase/migrations/20260523000015_phase10_notification_settings.sql` (naming convention: YYYYMMDD000NNN)

**Changes:**
```sql
ALTER TABLE notification_settings
ADD COLUMN notify_sms_enabled BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN notify_whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN notify_telegram_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- RLS policies already inherit from existing notification_settings policies
-- No new policies needed (existing ones cover new columns)
```

**Defaults rationale (from D-02):**
- `notify_sms_enabled = TRUE` — SMS is opt-out (assumed contractor wants to be alerted)
- `notify_whatsapp_enabled = FALSE` — WhatsApp is opt-in (requires WABA approval and contractor setup)
- `notify_telegram_enabled = FALSE` — Telegram is opt-in (requires explicit bot linking)

**For existing rows:** Migration applies defaults as shown above.

**For new contractor rows:** Verify that `/api/onboarding/create-account/route.ts` (line ~112, creates empty notification_settings) will auto-populate from migration defaults. [ASSUMED] — migration defaults handle this; confirm during implementation.

### TypeScript Type Extension

**File:** `src/types/database.ts`

Current NotificationSettings:
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
  whatsapp_opted_in_at: string | null
  created_at: string
  updated_at: string
}
```

**Add three columns:**
```typescript
export interface NotificationSettings {
  // ... existing fields ...
  notify_sms_enabled: boolean         // NEW
  notify_whatsapp_enabled: boolean    // NEW
  notify_telegram_enabled: boolean    // NEW
}
```

## API Route (`PATCH /api/notification-settings`)

**Responsibility:**
- Validate sms_number and whatsapp_number using `libphonenumber-js`
- Normalize phone numbers to E.164
- Enforce RLS via Supabase (authenticated user → contractor_id)
- Return updated NotificationSettings row

**Request body (zod schema):**
```typescript
const updateNotificationSettingsSchema = z.object({
  sms_number: z.string().nullable(),
  whatsapp_number: z.string().nullable(),
  notify_sms_enabled: z.boolean(),
  notify_whatsapp_enabled: z.boolean(),
  notify_telegram_enabled: z.boolean(),
  notify_on_lead: z.boolean(),
  notify_on_emergency: z.boolean(),
  notify_on_general_inquiry: z.boolean(),
})
```

**Phone validation logic (pseudocode):**
```typescript
import { parsePhoneNumber } from 'libphonenumber-js'

function normalizePhoneNumber(input: string | null): string | null {
  if (!input) return null
  
  try {
    const parsed = parsePhoneNumber(input, 'US')
    if (!parsed?.isValid()) {
      throw new Error(`Invalid phone number: ${input}`)
    }
    return parsed.format('E.164') // Returns +13055551234
  } catch {
    throw new Error(`Phone number parsing failed`)
  }
}
```

**Note:** [VERIFIED: npm registry] — libphonenumber-js is installed and the official import path is `import { parsePhoneNumber } from 'libphonenumber-js'` per the package docs.

## React Query Hooks

**File:** `src/lib/query/client.tsx`

### useNotificationSettings()
```typescript
export function useNotificationSettings() {
  const { contractorId } = useContractor()
  
  return useQuery({
    queryKey: ['notification-settings', contractorId],
    queryFn: async (): Promise<NotificationSettings> => {
      if (!contractorId) throw new Error('No contractor ID')
      
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('contractor_id', contractorId)
        .single()
      
      if (error) throw error
      return data as NotificationSettings
    },
    enabled: !!contractorId
  })
}
```

### useUpdateNotificationSettings()
```typescript
export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient()
  const { contractorId } = useContractor()
  
  return useMutation({
    mutationFn: async (formData: Partial<NotificationSettings>) => {
      const { data, error } = await fetch('/api/notification-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      if (!response.ok) throw new Error(await response.text())
      return response.json() as NotificationSettings
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['notification-settings', contractorId]
      })
    }
  })
}
```

**Note:** Follows the pattern of useUpdateLeadStatus and useSyncRetellAgent in the same file.

## Form Component (`NotificationSettingsForm`)

**File:** `src/components/notification/NotificationSettingsForm.tsx` (new file)

**Props:**
```typescript
interface NotificationSettingsFormProps {
  initialSettings: NotificationSettings
}
```

**Structure:**
1. Phone number inputs (SMS + WhatsApp) with inline validation feedback
2. Per-channel enable/disable toggles (3 checkboxes)
3. Event-type toggles (3 checkboxes: notify_on_lead, notify_on_emergency, notify_on_general_inquiry)
4. Telegram section (status display + unlink button if connected)
5. Single Save button with loading state
6. Success/error messaging

**Phone input behavior:**
- Placeholder: `+1 (305) 555-1234`
- Accept user input in any common format: `3055551234`, `(305) 555-1234`, `305-555-1234`
- On blur: call inline validator using `libphonenumber-js` → show error message if invalid
- On save: normalize to E.164 before sending to API

**Telegram unlink:**
- When telegram_chat_id is not null: show "Connected" status + Unlink button
- Unlink button → `POST /api/notification-settings/telegram/unlink`
- On success: refetch settings, show success message
- When telegram_chat_id is null: show "Not connected" status + setup instructions / deep-link to Telegram bot

**Note:** [ASSUMED] — error handling approach (toast vs inline banner) — check existing agent config forms for convention during implementation.

## API Route for Telegram Unlink (`POST /api/notification-settings/telegram/unlink`)

**Responsibility:**
- Authenticate user
- Set telegram_chat_id = NULL for the contractor
- Return updated NotificationSettings row

**Implementation pattern:** Simple route following the calendar/account routes pattern. RLS automatically enforces contractor isolation.

## Dispatch Function Update (`retell-notify-dispatch.ts`)

**Current state:** computeChannels() checks for non-null phone/telegram fields.

**Change required:** Add enable flag checks alongside existing null checks.

**Example (SMS channel):**
```typescript
// Current:
const shouldSendSms = settings?.sms_number != null && (/* intent checks */)

// New:
const shouldSendSms =
  settings?.sms_number != null &&
  settings?.notify_sms_enabled === true &&
  (/* intent checks */)
```

**Impact:** Three similar lines updated in computeChannels() — one for each channel. No other behavior changes to dispatch function in this phase.

**Note:** The `computeChannels()` function is already tested in unit tests — Phase 10 plan must update tests to verify enable flags are checked.

## Common Pitfalls

### Pitfall 1: Phone Number Format Inconsistency
**What goes wrong:** Saving phone numbers in mixed formats (some E.164, some user-input format) causes display bugs and failed SMS/WhatsApp sends.

**Why it happens:** Skipping normalization on the backend, or doing format conversion on both client and server without coordinating.

**How to avoid:** Normalize to E.164 in the PATCH route handler using `libphonenumber-js.parsePhoneNumber().format('E.164')`, store only that format, display formatted version from component if needed.

**Warning signs:** Phone fields showing values like `305 555 1234` or `(305) 555-1234` being persisted; dispatch function failing with "invalid phone" errors from Twilio/Twilio WhatsApp.

### Pitfall 2: Missing Enable Flag in Dispatch Function
**What goes wrong:** Toggling notify_sms_enabled = false in the UI doesn't stop SMS dispatch; notifications still fire for disabled channels.

**Why it happens:** Updating computeChannels() with only the new boolean columns but forgetting to add them to the database.ts type signature or the Inngest function's query.

**How to avoid:** Phase 10 plan must include (1) migration, (2) TypeScript type update, (3) API route validation, (4) computeChannels() function update, (5) test update. Verify all five are present in the plan.

**Warning signs:** Contractors can toggle notify_sms_enabled = false, but SMS still arrives; check Inngest logs for enable flag checks passing.

### Pitfall 3: RLS Bypass via Missing Contractor ID in PATCH Route
**What goes wrong:** A contractor can modify another contractor's notification settings if the PATCH route doesn't enforce contractor_id ownership.

**Why it happens:** Accepting contractor_id from the request body instead of deriving it from the authenticated session.

**How to avoid:** The PATCH route must use `supabase.auth.getUser()` to get the authenticated user, then derive contractor_id from that. Never read contractor_id from the request body. The Supabase RLS policies already enforce `contractor_id = (SELECT auth.uid())` equivalence, but the app must query the right contractor_id.

**Warning signs:** API route includes `body.contractor_id` in the update; Supabase RLS policies not checked in PATCH handler tests.

### Pitfall 4: Unlink Telegram Without Fallback State
**What goes wrong:** After unlinking Telegram, the page shows no status or the component crashes because it expects telegram_chat_id to exist.

**Why it happens:** Not handling the null state gracefully in the form component, or not refetching settings after unlink succeeds.

**How to avoid:** (1) Form component must handle both connected and not-connected states explicitly, (2) Unlink action must trigger a refetch via React Query cache invalidation, (3) Render appropriate UI (setup instructions) when telegram_chat_id is null.

**Warning signs:** Page shows "Connected" even after unlinking; Unlink button doesn't update the UI; console errors about null telegram_chat_id.

## Code Examples

### Phone Number Validation & Normalization (libphonenumber-js)

```typescript
// Source: libphonenumber-js v1.11.20 documentation
import { parsePhoneNumber } from 'libphonenumber-js'

export function normalizePhoneNumber(input: string | null): {
  valid: boolean
  normalized?: string
  error?: string
} {
  if (!input || !input.trim()) {
    return { valid: false, error: 'Phone number is required' }
  }

  try {
    const parsed = parsePhoneNumber(input.trim(), 'US')
    
    if (!parsed) {
      return { valid: false, error: 'Invalid phone number format' }
    }

    if (!parsed.isValid()) {
      return { valid: false, error: `Invalid ${parsed.country} phone number` }
    }

    // E.164 format: +13055551234
    return { valid: true, normalized: parsed.format('E.164') }
  } catch (error) {
    return { valid: false, error: 'Phone number parsing error' }
  }
}

// Usage in form component:
const validation = normalizePhoneNumber(userInput)
if (!validation.valid) {
  setPhoneError(validation.error)
} else {
  // Send normalized value to API
  formData.sms_number = validation.normalized
}
```

### Server Component Pattern (settings/notifications/page.tsx)

```typescript
// Source: Codebase pattern from settings/calendar/page.tsx and settings/phone/page.tsx
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { NotificationSettingsForm } from '@/components/notification/NotificationSettingsForm'

export const metadata = { title: 'Notifications — VoiceDesk' }

export default async function NotificationsPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: contractor } = await supabase
    .from('contractors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!contractor) redirect('/setup/phone')

  const { data: settings } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('contractor_id', contractor.id)
    .maybeSingle()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#F8FAFC] mb-1">Notifications</h1>
        <p className="text-sm text-[#94A3B8]">
          Configure how and where you receive call alerts and emergencies.
        </p>
        <div className="border-b border-[#334155] mt-6" />
      </div>
      {settings && <NotificationSettingsForm initialSettings={settings} />}
    </div>
  )
}
```

### React Query Hook (useUpdateNotificationSettings)

```typescript
// Source: Codebase pattern from useUpdateContractorSettings, useUpdateLeadStatus
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useContractor } from '@/contexts/ContractorContext'
import type { NotificationSettings } from '@/types/database'

export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient()
  const { contractorId } = useContractor()

  return useMutation({
    mutationFn: async (data: Partial<NotificationSettings>) => {
      const response = await fetch('/api/notification-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      return response.json() as NotificationSettings
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['notification-settings', contractorId],
      })
    },
  })
}
```

### computeChannels() Function Update

```typescript
// Source: retell-notify-dispatch.ts — Phase 5 with Phase 10 additions
export function computeChannels(
  settings: Pick<
    NotificationSettings,
    | 'sms_number'
    | 'whatsapp_number'
    | 'telegram_chat_id'
    | 'notify_sms_enabled'         // NEW
    | 'notify_whatsapp_enabled'    // NEW
    | 'notify_telegram_enabled'    // NEW
    | 'notify_on_lead'
    | 'notify_on_emergency'
    | 'notify_on_general_inquiry'
  > | null,
  intent: CallIntent | null
): { shouldSendSms: boolean; shouldSendWhatsApp: boolean; shouldSendTelegram: boolean } {
  if (!intent || intent === 'no_action' || intent === 'unknown') {
    return { shouldSendSms: false, shouldSendWhatsApp: false, shouldSendTelegram: false }
  }

  const intentMatches = (intent === 'emergency' && settings?.notify_on_emergency) ||
                        (intent === 'lead' && settings?.notify_on_lead) ||
                        (intent === 'info' && settings?.notify_on_general_inquiry)

  const shouldSendSms =
    settings?.sms_number != null &&
    settings?.notify_sms_enabled === true &&
    intentMatches

  const shouldSendWhatsApp =
    settings?.whatsapp_number != null &&
    settings?.notify_whatsapp_enabled === true &&
    intentMatches

  const shouldSendTelegram =
    settings?.telegram_chat_id != null &&
    settings?.notify_telegram_enabled === true &&
    intentMatches

  return { shouldSendSms, shouldSendWhatsApp, shouldSendTelegram }
}
```

## State of the Art

### Current Notification Architecture (Phase 5)

| Component | Purpose | Location |
|-----------|---------|----------|
| retell-notify-dispatch | Multi-channel dispatch via Inngest | src/inngest/functions/ |
| sendSms / sendWhatsApp / sendTelegram | Channel-specific sends | src/lib/notifications/ |
| notification_log | Audit trail of sends | DB table |
| computeChannels() | Intent → channel gating logic | retell-notify-dispatch.ts |

### Phase 10 Additions

- **NotificationSettingsForm** — UI for configuring channels and preferences
- **notify_sms_enabled / notify_whatsapp_enabled / notify_telegram_enabled** — Explicit enable flags (were implicit null checks before)
- **PATCH /api/notification-settings** — Settings persistence route
- **POST /api/notification-settings/telegram/unlink** — Telegram unlinking

### Deprecated/Outdated

- None — this is a new feature addition. Previous phase (05) did not include a settings UI.

## Package Legitimacy Audit

**Installation approach:** All packages in this phase are already installed in the project. No new external packages are required.

| Package | Registry | Age | Downloads | Source Repo | Legitimacy | Disposition |
|---------|----------|-----|-----------|-------------|------------|-------------|
| libphonenumber-js | npm | ~4 years (v1.11.20: Jan 2024) | 10M+/week | github.com/catamphetamine/libphonenumber-js | [OK] | Use as-is — stable, well-maintained |
| @tanstack/react-query | npm | ~3 years (v5: Nov 2023) | 5M+/week | github.com/TanStack/query | [OK] | Use as-is — industry standard |
| @supabase/ssr | npm | ~2 years (current: Mar 2024) | 500K+/week | github.com/supabase/supabase | [OK] | Use as-is — maintained by Supabase |
| zod | npm | ~3 years (v4: Aug 2023) | 5M+/week | github.com/colinhacks/zod | [OK] | Use as-is — de facto standard |

**All packages pre-installed and verified.** No new external dependencies introduced.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react |
| Config file | vitest.config.ts |
| Quick run command | `npm run test -- --run src/lib/query/` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTIF-01, NOTIF-02, NOTIF-03 | computeChannels() returns correct channel flags based on intent + enable flags | unit | `npm run test -- --run src/inngest/functions/retell-notify-dispatch.test.ts` | ✅ (exists from Phase 5, needs update for enable flags) |
| PORTAL-04 | NotificationSettingsForm renders and accepts phone/toggle inputs | unit | `npm run test -- --run src/components/notification/NotificationSettingsForm.test.ts` | ❌ Wave 0 |
| PORTAL-04 | PATCH /api/notification-settings validates and normalizes phone numbers | integration | `npm run test -- --run src/app/api/notification-settings/route.test.ts` | ❌ Wave 0 |
| PORTAL-04 | Telegram unlink sets telegram_chat_id = NULL via POST endpoint | integration | `npm run test -- --run src/app/api/notification-settings/telegram/unlink.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test -- --run src/lib/query/notification.test.ts src/inngest/functions/retell-notify-dispatch.test.ts`
- **Per wave merge:** Full suite `npm run test` (Vitest runs all .test.ts files)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/notification/NotificationSettingsForm.test.ts` — NotificationSettingsForm rendering, phone validation, form submission
- [ ] `src/app/api/notification-settings/route.test.ts` — PATCH endpoint, RLS enforcement, phone normalization
- [ ] `src/app/api/notification-settings/telegram/unlink.test.ts` — POST unlink endpoint, telegram_chat_id = NULL
- [ ] Update `src/inngest/functions/retell-notify-dispatch.test.ts` — add test cases for enable flag checks

*(computeChannels tests exist from Phase 5; must be extended to cover new enable flags)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth (getUser() in Server Component + RLS session enforcement) |
| V3 Session Management | yes | Supabase session via @supabase/ssr middleware |
| V4 Access Control | yes | RLS enforces contractor_id = auth.uid() on all updates; PATCH route derives contractor_id from session, never from body |
| V5 Input Validation | yes | `libphonenumber-js` for phone format validation; zod schemas for request body |
| V6 Cryptography | no | No sensitive data encrypted in this phase (phone numbers are plaintext per Twilio API requirements) |

### Known Threat Patterns for Next.js + Supabase Stack

| Pattern | STRIDE | Standard Mitigation | Status |
|---------|--------|---------------------|--------|
| IDOR (one contractor modifies another's settings) | Elevation of Privilege | RLS policy + derive contractor_id from auth session (never request body) | [VERIFIED: Phase 7 Bug 01 pattern — fixed IDOR in stripe webhook] |
| Phone number injection / format bypass | Tampering | Validate with libphonenumber-js before storage; store E.164 only | [VERIFIED: libphonenumber-js handles edge cases] |
| Telegram bot token leakage in logs | Information Disclosure | Bot token never logged; only telegram_chat_id stored (public identifier) | [VERIFIED: Phase 5 pattern — sendTelegram does not log tokens] |
| RLS bypass via NULL contractor_id | Elevation of Privilege | Server Component fetches contractor_id; RLS policies check (SELECT auth.uid()) | [VERIFIED: Phase 1 pattern, tested in Phase 1 RLS audit] |

**Critical controls:**
1. PATCH route must use `getUser()` to authenticate, then derive contractor_id
2. Never read contractor_id from request body
3. Validate phone numbers before storage; reject invalid formats
4. Supabase RLS already enforces row isolation — no additional DB controls needed

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Migration defaults (TRUE, FALSE, FALSE) auto-populate for existing rows | Database Schema Changes | Existing contractor notification_settings rows missing enable columns → dispatch function errors on NULL checks |
| A2 | New contractor rows created in /api/onboarding/create-account inherit migration defaults | Database Schema Changes | New contractors have NULL enable columns → notification dispatch fails silently or logs errors |
| A3 | libphonenumber-js parsePhoneNumber() with 'US' region handles all common US formats documented in D-04 | Standard Stack | Form accepts invalid numbers or crashes on valid formats → users cannot save their phone numbers |
| A4 | Error handling convention (toast vs inline banner for save errors) determined by existing agent config forms | Form Component | Inconsistent UX; users miss error messages |

## Open Questions (RESOLVED)

1. **Error handling UI approach**
   - What we know: Agent config forms exist (BusinessInfoForm, etc.); they use either toast or inline error banner
   - What's unclear: Which pattern is used and whether Phase 10 should match it
   - Recommendation: Check src/components/agent/ during implementation; Phase 10 MUST match the established pattern
   - RESOLVED: Plan 04 Task 1 instructs the executor to read existing agent config forms and match the pattern; inline field errors for phone validation, inline banner for save errors.

2. **Telegram setup instructions UX**
   - What we know: Dashboard already shows Telegram setup banner with deep-link to voiceDeskTelBot
   - What's unclear: Should NotificationSettingsForm show the same instructions, or a condensed version, or link to the setup banner?
   - Recommendation: Reuse the existing dashboard Telegram setup component/instructions for consistency
   - RESOLVED: Plan 04 Task 1 specifies reusing the existing Telegram deep-link pattern from dashboard/page.tsx for the "not connected" state.

3. **Phone number display format in form**
   - What we know: Placeholder shows +1 (305) 555-1234; stored value is E.164 (+13055551234)
   - What's unclear: Should the input display +13055551234 after load, or format it for readability like +1 (305) 555-1234?
   - Recommendation: Store E.164 in DB; display formatted on load using libphonenumber-js `.formatInternational()` for readability
   - RESOLVED: Plan 04 Task 1 specifies displayable format on load via libphonenumber-js `.formatInternational()`; stored and sent to API as E.164.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build + test | ✓ | v20+ (implied by Next.js 16.2.4) | — |
| npm | Dependency manager | ✓ | v10+ (implied) | — |
| TypeScript | Type checking | ✓ | ^5.x | — |
| Supabase local instance | DB migrations + RLS testing | ✗ | — | Use remote dev project (in use since Phase 1) |
| libphonenumber-js | Phone validation | ✓ | 1.11.20 | — (already installed) |

**Missing dependencies with no fallback:**
- None — all phase dependencies are installed or available

**Conditional dependencies:**
- Supabase local development: Not required for Phase 10 execution (remote dev project used throughout project); can be set up later if needed for migration testing

## Sources

### Primary (HIGH confidence)

- **Context7 + Codebase Inspection**
  - DatabaseTypes: NotificationSettings interface reviewed (src/types/database.ts)
  - Existing notification system: retell-notify-dispatch.ts studied
  - Form patterns: BusinessInfoForm, BusinessHoursForm, KeywordsForm reviewed
  - Server Component patterns: calendar/page.tsx, phone/page.tsx analyzed
  - React Query hooks: src/lib/query/client.tsx examined for mutation/query patterns
  - Database migrations: supabase/migrations/ directory reviewed for schema and RLS conventions

- **Project Documentation**
  - CONTEXT.md: User decisions D-01 through D-09 and Claude's Discretion points
  - REQUIREMENTS.md: NOTIF-01, NOTIF-02, NOTIF-03, EMRG-03, PORTAL-04 traceability
  - STATE.md: Project architecture reference and accumulated context (RLS patterns, idempotency, encryption)
  - CLAUDE.md: Project stack and critical rules (RLS on every table, service role key isolation)

### Secondary (MEDIUM confidence)

- **Official Documentation**
  - libphonenumber-js: npm package documentation (parsePhoneNumber API, E.164 format)
  - React Query: Official docs for useQuery/useMutation patterns (tanstack.com)
  - Supabase: Official RLS documentation (inherited policies apply to new columns)
  - Next.js: Server Component documentation (redirect, async functions, server-only context)

### Tertiary (LOW confidence)

- None — all research verified against codebase or official sources

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — All packages already installed and used in project; verified via package.json and codebase grep
- Architecture: **HIGH** — Form patterns, API route patterns, migration patterns all exist in codebase; research verified against actual code
- Phone validation: **HIGH** — libphonenumber-js documented in official npm; usage patterns from Phase 1 RESEARCH.md
- Pitfalls: **MEDIUM** — Based on project history (Phase 7 IDOR fix) and async form patterns; not all pitfalls tested in Phase 10 context yet

**Research date:** 2026-05-23  
**Valid until:** 2026-06-06 (14 days — stable tech stack, unlikely to change)

**Key assumptions awaiting validation:**
- A1, A2: Migration defaults for existing/new rows → must verify during implementation
- A3: libphonenumber-js US region format handling → must test in Wave 1 (TDD RED tests)
- A4: Error handling UI convention → must check agent forms before implementing

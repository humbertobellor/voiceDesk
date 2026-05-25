# Phase 10: Notification Settings Form — Pattern Map

**Mapped:** 2026-05-23  
**Files analyzed:** 9 files to create/modify  
**Analogs found:** 8/9 files with strong matches

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/20260523000015_phase10_notification_settings.sql` | migration | schema-change | `supabase/migrations/20260508000007_webhook_core.sql` | exact |
| `src/types/database.ts` | model | type-definition | `src/types/database.ts` (existing NotificationSettings) | exact |
| `src/app/api/notification-settings/route.ts` | controller | request-response | `src/app/api/contractor/status/route.ts` | role-match |
| `src/app/api/notification-settings/telegram/unlink.ts` | controller | request-response | `src/app/api/contractor/status/route.ts` | role-match |
| `src/lib/query/client.tsx` | hook | request-response | `src/lib/query/client.tsx` (useUpdateContractorSettings) | exact |
| `src/components/notification/NotificationSettingsForm.tsx` | component | request-response | `src/components/agent/BusinessInfoForm.tsx` | exact |
| `src/app/(dashboard)/settings/notifications/page.tsx` | page | request-response | `src/app/(dashboard)/settings/calendar/page.tsx` | exact |
| `src/inngest/functions/retell-notify-dispatch.ts` | function | event-driven | `src/inngest/functions/retell-notify-dispatch.ts` (existing computeChannels) | exact |

---

## Pattern Assignments

### Migration: `supabase/migrations/20260523000015_phase10_notification_settings.sql`

**Analog:** `supabase/migrations/20260508000007_webhook_core.sql` (Phase 3, adds columns to notification_settings)

**Pattern** (lines 20-24):
```sql
ALTER TABLE notification_settings
  ADD COLUMN IF NOT EXISTS notify_on_general_inquiry BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN notification_settings.notify_on_general_inquiry IS 'D-15: controls whether Phase 5 dispatches notifications for intent=info calls. Default false. Phase 6 portal adds checkbox.';
```

**For Phase 10, apply same pattern with three new enable columns:**
- Use `ADD COLUMN IF NOT EXISTS` for idempotency
- Set NOT NULL with appropriate DEFAULT values (TRUE for SMS, FALSE for WhatsApp/Telegram per D-02)
- Add COMMENT for each column explaining the default rationale
- No new RLS policies needed — existing notification_settings policies inherited automatically

**Key security point:** RLS policies from `20260504000002_rls_policies.sql` already cover all operations (SELECT, INSERT, UPDATE, DELETE) on notification_settings by contractor_id — new columns automatically covered.

---

### Type Definition: `src/types/database.ts`

**Analog:** Current NotificationSettings interface (lines 104-116 based on grep output)

**Current interface:**
```typescript
export interface NotificationSettings {
  id: string
  contractor_id: string
  sms_number: string | null
  whatsapp_number: string | null
  telegram_chat_id: string | null
  notify_on_lead: boolean
  notify_on_emergency: boolean
  notify_on_general_inquiry: boolean  // Phase 5
  whatsapp_opted_in_at: string | null
  created_at: string
  updated_at: string
}
```

**Add three boolean columns after existing notify_on_* fields:**
```typescript
export interface NotificationSettings {
  // ... existing fields ...
  notify_on_lead: boolean
  notify_on_emergency: boolean
  notify_on_general_inquiry: boolean
  notify_sms_enabled: boolean          // NEW: gate SMS dispatch
  notify_whatsapp_enabled: boolean     // NEW: gate WhatsApp dispatch
  notify_telegram_enabled: boolean     // NEW: gate Telegram dispatch
  // ... created_at, updated_at ...
}
```

---

### API Route: `src/app/api/notification-settings/route.ts` (PATCH handler)

**Analog:** `src/app/api/contractor/status/route.ts` (GET pattern) + `src/app/api/provisioning/update-agent/route.ts` (PATCH + auth pattern)

**Auth pattern** (from update-agent/route.ts lines 21-25):
```typescript
export async function PATCH(_req: Request) {
  // 1. Auth — getUser() validates JWT; never use getSession()
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = createServiceRoleClient()

  // 2. Load contractor by user_id from JWT (never accept contractor_id from body)
  const { data: contractor, error: loadErr } = await serviceClient
    .from('contractors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (loadErr || !contractor) {
    return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })
  }
```

**Validation pattern — use zod schema:**
```typescript
import { z } from 'zod'

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

**Phone normalization logic** — apply to sms_number and whatsapp_number before storage:
```typescript
import { parsePhoneNumber } from 'libphonenumber-js'

function normalizePhoneNumber(input: string | null): string | null {
  if (!input || !input.trim()) return null
  
  try {
    const parsed = parsePhoneNumber(input.trim(), 'US')
    if (!parsed || !parsed.isValid()) {
      throw new Error('Invalid phone number')
    }
    return parsed.format('E.164') // +13055551234
  } catch {
    throw new Error(`Invalid phone number: ${input}`)
  }
}
```

**Update pattern** (similar to update-agent, but this writes to notification_settings directly):
```typescript
const { data, error } = await supabase
  .from('notification_settings')
  .update({
    sms_number: normalizedSms,
    whatsapp_number: normalizedWhatsApp,
    notify_sms_enabled: req.notify_sms_enabled,
    notify_whatsapp_enabled: req.notify_whatsapp_enabled,
    notify_telegram_enabled: req.notify_telegram_enabled,
    notify_on_lead: req.notify_on_lead,
    notify_on_emergency: req.notify_on_emergency,
    notify_on_general_inquiry: req.notify_on_general_inquiry,
    updated_at: new Date().toISOString(),
  })
  .eq('contractor_id', contractor.id)
  .select()
  .single()

if (error) throw error
return NextResponse.json(data, { status: 200 })
```

**Critical security invariant (from update-agent comments):** contractor_id is NEVER read from request body. It is derived from `supabase.auth.getUser()` and used in the `.eq('contractor_id', contractor.id)` filter. RLS policies enforce the same constraint redundantly (defense-in-depth per useUpdateLeadStatus pattern).

---

### API Route: `src/app/api/notification-settings/telegram/unlink.ts` (POST handler)

**Analog:** `src/app/api/contractor/status/route.ts` (auth + Supabase pattern)

**Pattern** (simple unlink operation):
```typescript
import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Derive contractor_id from user session, never from request body
  const { data: contractor } = await supabase
    .from('contractors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!contractor) {
    return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })
  }

  // Set telegram_chat_id to NULL (unlink)
  const { data, error } = await supabase
    .from('notification_settings')
    .update({ telegram_chat_id: null })
    .eq('contractor_id', contractor.id)
    .select()
    .single()

  if (error) throw error
  return NextResponse.json(data, { status: 200 })
}
```

---

### React Query Hooks: `src/lib/query/client.tsx`

**Analog:** `useUpdateContractorSettings()` (lines 261-285) + `useUpdateLeadStatus()` (lines 192-219)

**useNotificationSettings() hook** (query):
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

**useUpdateNotificationSettings() hook** (mutation pattern from useUpdateContractorSettings lines 265-285):
```typescript
export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient()
  const { contractorId } = useContractor()

  return useMutation({
    mutationFn: async (updates: Partial<NotificationSettings>) => {
      const response = await fetch('/api/notification-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      return response.json() as NotificationSettings
    },
    onSuccess: () => {
      if (contractorId) {
        queryClient.invalidateQueries({
          queryKey: ['notification-settings', contractorId]
        })
      }
    }
  })
}
```

**useTelegramUnlink() hook** (simple POST mutation):
```typescript
export function useTelegramUnlink() {
  const queryClient = useQueryClient()
  const { contractorId } = useContractor()

  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/notification-settings/telegram/unlink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      return response.json() as NotificationSettings
    },
    onSuccess: () => {
      if (contractorId) {
        queryClient.invalidateQueries({
          queryKey: ['notification-settings', contractorId]
        })
      }
    }
  })
}
```

---

### Form Component: `src/components/notification/NotificationSettingsForm.tsx`

**Analog:** `src/components/agent/BusinessInfoForm.tsx` (lines 1-161)

**File structure** (from BusinessInfoForm):
```typescript
'use client'

import { useState, useEffect } from 'react'
import { useNotificationSettings, useUpdateNotificationSettings, useTelegramUnlink } from '@/lib/query/client'
import type { NotificationSettings } from '@/types/database'

interface NotificationSettingsFormProps {
  initialSettings: NotificationSettings
}

export function NotificationSettingsForm({ initialSettings }: NotificationSettingsFormProps) {
  const { data: settings, isLoading } = useNotificationSettings()
  const updateSettings = useUpdateNotificationSettings()
  const telegramUnlink = useTelegramUnlink()

  const [formData, setFormData] = useState<Partial<NotificationSettings>>({ ... })
  const [isSaving, setIsSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [phoneErrors, setPhoneErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (settings) {
      setFormData({
        sms_number: settings.sms_number || '',
        whatsapp_number: settings.whatsapp_number || '',
        notify_sms_enabled: settings.notify_sms_enabled,
        notify_whatsapp_enabled: settings.notify_whatsapp_enabled,
        notify_telegram_enabled: settings.notify_telegram_enabled,
        notify_on_lead: settings.notify_on_lead,
        notify_on_emergency: settings.notify_on_emergency,
        notify_on_general_inquiry: settings.notify_on_general_inquiry,
      })
    }
  }, [settings])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      await updateSettings.mutateAsync(formData)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3000)
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Phone number inputs */}
      {/* Toggle checkboxes */}
      {/* Telegram section */}
      {/* Submit button */}
    </form>
  )
}
```

**Phone input UI pattern** (from BusinessInfoForm lines 78-85):
```typescript
<div>
  <label className="block text-sm font-medium text-gray-300 mb-1">
    SMS Number
  </label>
  <input
    type="tel"
    value={formData.sms_number || ''}
    onChange={(e) => setFormData({ ...formData, sms_number: e.target.value })}
    onBlur={() => validatePhoneNumber('sms_number', formData.sms_number || '')}
    placeholder="+1 (305) 555-1234"
    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
  />
  {phoneErrors.sms_number && (
    <p className="mt-1 text-sm text-red-400">{phoneErrors.sms_number}</p>
  )}
</div>
```

**Checkbox UI pattern** (from BusinessInfoForm lines 120-137):
```typescript
<div>
  <label className="block text-sm font-medium text-gray-300 mb-2">
    Notification Channels
  </label>
  <div className="flex flex-col gap-3">
    {[
      { key: 'notify_sms_enabled', label: 'SMS Notifications' },
      { key: 'notify_whatsapp_enabled', label: 'WhatsApp Notifications' },
      { key: 'notify_telegram_enabled', label: 'Telegram Notifications' },
    ].map((channel) => (
      <label key={channel.key} className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={formData[channel.key as keyof typeof formData] as boolean}
          onChange={(e) =>
            setFormData({
              ...formData,
              [channel.key]: e.target.checked,
            })
          }
          className="w-4 h-4 rounded bg-gray-800 border-gray-600"
        />
        <span className="text-white">{channel.label}</span>
      </label>
    ))}
  </div>
</div>
```

**Telegram section pattern** (new; no direct analog, but follows dashboard Telegram pattern):
```typescript
<div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
  <h3 className="text-sm font-semibold text-white mb-2">Telegram</h3>
  {settings?.telegram_chat_id ? (
    <div>
      <p className="text-sm text-green-400 mb-2">Connected</p>
      <button
        type="button"
        onClick={async () => {
          await telegramUnlink.mutateAsync()
        }}
        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded"
      >
        Unlink
      </button>
    </div>
  ) : (
    <div>
      <p className="text-sm text-gray-400 mb-2">Not connected</p>
      <p className="text-xs text-gray-500">
        Message @voiceDeskTelBot on Telegram to set up alerts.
      </p>
    </div>
  )}
</div>
```

**Submit button pattern** (from BusinessInfoForm lines 152-161):
```typescript
<div className="flex items-center gap-4">
  <button
    type="submit"
    disabled={isSaving}
    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg font-medium transition-colors"
  >
    {isSaving ? 'Saving...' : 'Save Changes'}
  </button>
  {showSuccess && (
    <p className="text-sm text-green-400">Saved successfully.</p>
  )}
</div>
```

---

### Settings Page: `src/app/(dashboard)/settings/notifications/page.tsx`

**Analog:** `src/app/(dashboard)/settings/calendar/page.tsx` (lines 1-42)

**Server Component pattern** (lines 1-20):
```typescript
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'
import { NotificationSettingsForm } from '@/components/notification/NotificationSettingsForm'

export const metadata = { title: 'Notifications — VoiceDesk' }

export default async function NotificationsPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Load contractor via user_id (RLS enforces ownership automatically)
  const { data: contractor } = await supabase
    .from('contractors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!contractor) redirect('/setup/phone')

  // Load notification settings — RLS enforces contractor_id = auth.uid()
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

---

### Dispatch Function Update: `src/inngest/functions/retell-notify-dispatch.ts`

**Analog:** `src/inngest/functions/retell-notify-dispatch.ts` (existing computeChannels function, lines 30-78)

**Current computeChannels signature** (lines 30-40):
```typescript
export function computeChannels(
  settings: Pick<
    NotificationSettings,
    | 'sms_number'
    | 'whatsapp_number'
    | 'telegram_chat_id'
    | 'notify_on_lead'
    | 'notify_on_emergency'
    | 'notify_on_general_inquiry'
  > | null,
  intent: CallIntent | null
): { shouldSendSms: boolean; shouldSendWhatsApp: boolean; shouldSendTelegram: boolean } {
```

**Phase 10 update — add enable flags to the Pick type:**
```typescript
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
```

**Update the three channel checks** (current lines 53-75):
```typescript
// OLD:
const shouldSendSms =
  settings?.sms_number != null &&
  (
    (intent === 'emergency' && (settings.notify_on_emergency ?? true)) ||
    (intent === 'lead'      && (settings.notify_on_lead      ?? true)) ||
    (intent === 'info'      && (settings.notify_on_general_inquiry === true))
  )

// NEW:
const shouldSendSms =
  settings?.sms_number != null &&
  settings?.notify_sms_enabled === true &&
  (
    (intent === 'emergency' && (settings.notify_on_emergency ?? true)) ||
    (intent === 'lead'      && (settings.notify_on_lead      ?? true)) ||
    (intent === 'info'      && (settings.notify_on_general_inquiry === true))
  )
```

Apply the same pattern for `shouldSendWhatsApp` and `shouldSendTelegram` — add `settings?.notify_whatsapp_enabled === true` and `settings?.notify_telegram_enabled === true` checks respectively.

**Impact:** The Pick type changes, and the three boolean gates are added. The function signature and return type remain unchanged. Tests must be updated to verify that computeChannels respects the new enable flags.

---

## Shared Patterns

### Phone Number Validation & Normalization
**Source:** `libphonenumber-js` v1.11.20 (npm package, already installed)  
**Apply to:** All phone input fields (sms_number, whatsapp_number) in PATCH handler and form component

**Validation logic** (used in form onBlur; normalization in API route):
```typescript
import { parsePhoneNumber } from 'libphonenumber-js'

export function validatePhoneNumber(input: string): { valid: boolean; error?: string } {
  if (!input || !input.trim()) {
    return { valid: false, error: 'Phone number is required' }
  }

  try {
    const parsed = parsePhoneNumber(input.trim(), 'US')
    
    if (!parsed || !parsed.isValid()) {
      return { valid: false, error: 'Invalid phone number format' }
    }

    return { valid: true }
  } catch {
    return { valid: false, error: 'Phone number parsing error' }
  }
}

export function normalizePhoneNumber(input: string | null): string | null {
  if (!input || !input.trim()) return null
  
  try {
    const parsed = parsePhoneNumber(input.trim(), 'US')
    if (!parsed || !parsed.isValid()) {
      throw new Error(`Invalid phone number: ${input}`)
    }
    return parsed.format('E.164')
  } catch {
    throw new Error(`Invalid phone number: ${input}`)
  }
}
```

### RLS Enforcement Pattern
**Source:** All Supabase queries in the codebase (CRITICAL RULE per CLAUDE.md)  
**Apply to:** All database queries in Server Component, API routes, and React Query hooks

**Pattern:**
1. Server Component: Use `createSupabaseServer()` with authenticated user session; query contractor via user_id; pass contractor.id to child component
2. API Route: Use `getUser()` to authenticate; derive contractor_id from user session; never read contractor_id from request body
3. React Query hook: Use `.eq('contractor_id', contractorId)` filter; RLS policies enforce the same constraint redundantly

**No exceptions:** Every database query must enforce contractor isolation via one of these mechanisms.

### Authentication Pattern
**Source:** `src/app/api/contractor/status/route.ts` (lines 6-10) + `src/app/api/provisioning/update-agent/route.ts` (lines 21-25)  
**Apply to:** All API routes that modify notification_settings

**Pattern:**
```typescript
const supabase = await createSupabaseServer()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

### Error Handling Pattern
**Source:** `src/components/agent/BusinessInfoForm.tsx` (line 58) + `src/app/(dashboard)/settings/phone/page.tsx` (lines 165-166)  
**Apply to:** Form component error display, API route error responses

**Form-level errors:** Inline error message below submit button or toast notification (check agent forms for convention during implementation)

**Field-level errors:** Inline error message below the problematic input (phone number validation)

**API error responses:** Return JSON with `{ error: string }` structure and appropriate HTTP status code

---

## No Analog Found

None. All file types have clear analogs in the codebase.

---

## Metadata

**Analog search scope:** 
- `src/app/api/` — all route.ts files for API pattern analogs
- `src/components/agent/` — all form components for UI patterns
- `src/app/(dashboard)/settings/` — all settings pages for Server Component pattern
- `src/lib/query/` — all React Query hooks
- `supabase/migrations/` — schema change patterns
- `src/inngest/functions/` — dispatch function patterns
- `src/types/database.ts` — type definitions

**Files scanned:** 50+ files across these directories

**Pattern extraction date:** 2026-05-23

**Key findings:**
1. **Migration pattern:** Idempotent with IF NOT EXISTS; DEFAULT values; RLS inheritance automatic
2. **API route pattern:** Derive contractor_id from auth session, never from request body (IDOR prevention)
3. **Form pattern:** Single Save button, useEffect to load initial data, useState for form state, useQuery+useMutation with cache invalidation
4. **Phone validation:** libphonenumber-js with 'US' region; inline validation on blur; normalization on save to E.164
5. **RLS enforcement:** Three-layer defense-in-depth (Server Component auth, API session check, Supabase RLS policy)

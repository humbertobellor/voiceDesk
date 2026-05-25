# Phase 14: In-App Notification Bell - Pattern Map

**Mapped:** 2026-05-25
**Files analyzed:** 7 new/modified
**Analogs found:** 7 / 7 (100%)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/inngest/functions/retell-notify-dispatch.ts` | background job | streaming | same file (extend) | exact |
| `src/lib/realtime/notificationsSubscription.ts` | hook | event-driven | `src/lib/realtime/callsSubscription.ts` | exact |
| `src/lib/query/client.tsx` | hook | CRUD | same file (extend) | exact |
| `src/app/api/notifications/mark-all-read/route.ts` | API handler | request-response | `src/app/api/notification-settings/route.ts` | exact |
| `src/components/dashboard/Sidebar.tsx` | component | request-response | same file (modify) | exact |
| `src/components/dashboard/BottomTabBar.tsx` | component | request-response | same file (modify) | exact |
| `src/components/notification/NotificationSettingsForm.tsx` | component | CRUD | same file (modify) | exact |

---

## Pattern Assignments

### `src/inngest/functions/retell-notify-dispatch.ts` (background job, streaming)

**Analog:** Same file — extend with `computeBellNotification()` and new `step.run('write-bell-notification')` step

**Imports pattern** (lines 1-22):
```typescript
import 'server-only'
import { NonRetriableError } from 'inngest'
import { inngest } from '@/inngest/client'
import { createServiceRoleClient } from '@/lib/supabase/service'
// ... other service imports ...
import type { CallIntent, NotificationSettings } from '@/types/database'
```

**Existing computeChannels pattern** (lines 34-102):
```typescript
// Pure function that returns boolean flags for each channel
export function computeChannels(
  settings: Pick<NotificationSettings, ...> | null,
  intent: CallIntent | null
): { shouldSendSms: boolean; shouldSendWhatsApp: boolean; shouldSendTelegram: boolean; shouldSendEmail: boolean }
```

**NEW: computeBellNotification pattern** (add after computeChannels):
```typescript
// Pure formatter for bell notification title/body based on intent and call data
type BellEventType = 'lead' | 'emergency' | 'system'

interface BellNotification {
  event_type: BellEventType
  title: string
  body: string
}

export function computeBellNotification(
  intent: CallIntent | null,
  callerPhone: string,
  serviceType: string,
  appointmentStatus: string
): BellNotification {
  if (intent === 'emergency') {
    return {
      event_type: 'emergency',
      title: `EMERGENCY: New call from ${callerPhone}`,
      body: `${callerPhone} • ${serviceType}`,
    }
  }
  if (intent === 'lead') {
    return {
      event_type: 'lead',
      title: `New lead — ${serviceType}`,
      body: `${callerPhone} • ${appointmentStatus}`,
    }
  }
  // info, system, null → 'system'
  return {
    event_type: 'system',
    title: `General inquiry from ${callerPhone}`,
    body: `${callerPhone} • ${serviceType}`,
  }
}
```

**Step.run() pattern** (lines 200-230, 333-384 — SMS/Email templates):
```typescript
if (shouldSendEmail) {
  await step.run('send-email', async () => {
    let logId: string | null = null
    try {
      // ... build payload ...
      logId = await writeNotificationLog({ ... })
      const result = await sendEmail({ ... })
      if (!result.success) throw new Error(result.error || 'sendEmail failed')
      await updateNotificationLog(logId, { status: 'sent', sentAt: new Date().toISOString() })
    } catch (err: unknown) {
      if (logId) {
        await updateNotificationLog(logId, {
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        })
      }
      throw err  // Re-throw so Inngest retries this step
    }
  })
}
```

**NEW: write-bell-notification step** (add after send-email, before function end):
```typescript
// NEW step: unconditional bell write (no shouldWriteBell guard, but placed after intent check)
// Placement: after all channel dispatch steps, before function end (line 384)
await step.run('write-bell-notification', async () => {
  const db = createServiceRoleClient()
  const { title, body, event_type } = computeBellNotification(
    intent,
    callerPhone,
    serviceRequested,
    bookingStatus
  )
  const { error } = await db
    .from('app_notifications')
    .insert({
      contractor_id: contractorId,
      event_type,
      title,
      body,
      is_read: false,
    })
  if (error) throw error // Inngest retries this step on throw
})
```

**Early-return guard refactor** (lines 166-171):
```typescript
// CURRENT (Phase 13):
if (!shouldSendSms && !shouldSendWhatsApp && !shouldSendTelegram && !shouldSendEmail) {
  return
}

// NEW (Phase 14): Add intent check to allow bell write for valid intents
const hasValidIntent = intent && intent !== 'no_action' && intent !== 'unknown'
if (!hasValidIntent && !shouldSendSms && !shouldSendWhatsApp && !shouldSendTelegram && !shouldSendEmail) {
  return
}
// Bell step will run for lead/emergency/info/null regardless of channel flags
```

---

### `src/lib/realtime/notificationsSubscription.ts` (hook, event-driven)

**Analog:** `src/lib/realtime/callsSubscription.ts` (lines 1-62)

**Module-level Supabase client** (lines 1-10):
```typescript
'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

**Hook signature and setup** (lines 18-22):
```typescript
export function useCallsSubscription(contractorId: string, onNewCall?: CallCallback) {
  const queryClient = useQueryClient()
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
```

**Channel subscription pattern** (lines 25-39):
```typescript
const channel = supabase
  .channel(`calls-realtime-${contractorId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'calls',
      filter: `contractor_id=eq.${contractorId}`
    },
    (payload) => {
      // New call inserted - invalidate calls query to refetch
      queryClient.invalidateQueries({ queryKey: ['calls'] })
      onNewCall?.(payload.new.id)
    }
  )
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      setIsConnected(true)
      if (process.env.NODE_ENV === 'development') {
        console.log('[Realtime] Calls subscription connected')
      }
    } else {
      setIsConnected(false)
    }
  })
```

**Cleanup pattern** (lines 55-58):
```typescript
return () => {
  channel.unsubscribe()
  setIsConnected(false)
}
```

**NEW: notificationsSubscription.ts** (replicate for notifications):
```typescript
'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export function useNotificationsSubscription(
  contractorId: string,
  onInsert?: () => void
) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!contractorId) return

    const channel = supabase
      .channel(`notifications-realtime-${contractorId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'app_notifications',
          filter: `contractor_id=eq.${contractorId}`
        },
        () => {
          // Invalidate both the full feed and the unread count
          queryClient.invalidateQueries({ queryKey: ['notifications', contractorId] })
          queryClient.invalidateQueries({ queryKey: ['notifications-unread', contractorId] })
          onInsert?.()
        }
      )
      .subscribe()

    return () => { channel.unsubscribe() }
  }, [contractorId, queryClient, onInsert])
}
```

---

### `src/lib/query/client.tsx` (hook, CRUD)

**Analog:** Same file — extend with notification hooks (lines 1-9 module setup, 13-82 call hook patterns)

**Module-level Supabase client** (lines 1-9):
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createBrowserClient } from '@supabase/ssr'
import { useContractor } from '@/contexts/ContractorContext'
import type { Call, Lead, ContractorSettings, LeadStatus, TradeType, NotificationSettings } from '@/types/database'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

**useQuery pattern** (lines 13-44, useCallsCount pattern at 64-82):
```typescript
export function useCallsCount() {
  const { contractorId } = useContractor()

  return useQuery({
    queryKey: ['calls', 'count', contractorId],
    queryFn: async (): Promise<number> => {
      if (!contractorId) throw new Error('No contractor ID')
      const { count, error } = await supabase
        .from('calls')
        .select('*', { count: 'exact', head: true })
        .eq('contractor_id', contractorId)
      if (error) throw error
      return count ?? 0
    },
    enabled: !!contractorId
  })
}
```

**NEW: useNotifications hook** (add to file):
```typescript
export function useNotifications() {
  const { contractorId } = useContractor()
  return useQuery({
    queryKey: ['notifications', contractorId],
    queryFn: async () => {
      if (!contractorId) throw new Error('No contractor ID')
      const { data, error } = await supabase
        .from('app_notifications')
        .select('*')
        .eq('contractor_id', contractorId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data
    },
    enabled: !!contractorId,
  })
}
```

**NEW: useUnreadCount hook** (add to file):
```typescript
export function useUnreadCount() {
  const { contractorId } = useContractor()
  return useQuery({
    queryKey: ['notifications-unread', contractorId],
    queryFn: async () => {
      if (!contractorId) throw new Error('No contractor ID')
      const { count, error } = await supabase
        .from('app_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('contractor_id', contractorId)
        .eq('is_read', false)
      if (error) throw error
      return count ?? 0
    },
    enabled: !!contractorId,
  })
}
```

**useMutation pattern** (replicate from useUpdateNotificationSettings if available in same file, or from notification-settings route):
```typescript
export function useMarkAllRead() {
  const queryClient = useQueryClient()
  const { contractorId } = useContractor()
  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/notifications/mark-all-read', { method: 'PATCH' })
      if (!response.ok) throw new Error('Failed to mark all as read')
      return response.json()
    },
    onMutate: async () => {
      // Optimistic update: set unread count to 0 immediately
      queryClient.setQueryData(['notifications-unread', contractorId], 0)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', contractorId] })
      queryClient.invalidateQueries({ queryKey: ['notifications-unread', contractorId] })
    },
  })
}
```

---

### `src/app/api/notifications/mark-all-read/route.ts` (API handler, request-response)

**Analog:** `src/app/api/notification-settings/route.ts` (lines 59-146, PATCH handler)

**Auth pattern** (lines 59-78):
```typescript
export async function PATCH(req: Request) {
  // 1. Auth — getUser() validates JWT
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Contractor lookup — use service role to bypass RLS for the join
  const serviceClient = createServiceRoleClient()
  const { data: contractor, error: loadErr } = await serviceClient
    .from('contractors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (loadErr || !contractor) {
    if (loadErr) console.error('[notification-settings] contractor load failed:', loadErr.message)
    return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })
  }
```

**NEW: mark-all-read route handler** (replicate pattern):
```typescript
// src/app/api/notifications/mark-all-read/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

export async function PATCH(_req: Request) {
  // 1. Auth
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Contractor lookup
  const serviceClient = createServiceRoleClient()
  const { data: contractor, error: loadErr } = await serviceClient
    .from('contractors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (loadErr || !contractor) {
    if (loadErr) console.error('[mark-all-read] contractor load failed:', loadErr.message)
    return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })
  }

  // 3. Update all unread notifications to read
  const { error: updateErr } = await serviceClient
    .from('app_notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('contractor_id', contractor.id)
    .eq('is_read', false)

  if (updateErr) {
    console.error('[mark-all-read] update failed:', updateErr.message)
    return NextResponse.json({ error: 'Failed to mark notifications as read' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
```

---

### `src/components/dashboard/Sidebar.tsx` (component, request-response)

**Analog:** Same file — modify logo row (lines 47-51)

**Current logo row structure** (lines 47-51):
```typescript
{/* Logo area */}
<div className="h-16 flex items-center gap-2 px-6 border-b border-[#334155]">
  <Mic size={20} className="text-[#F97316]" />
  <span className="text-xl font-semibold text-[#F8FAFC]">VoiceDesk</span>
</div>
```

**NEW: modified logo row** (add NotificationBell with ml-auto):
```typescript
{/* Logo area — MODIFIED in Phase 14: add NotificationBell with ml-auto */}
<div className="h-16 flex items-center gap-2 px-6 border-b border-[#334155]">
  <Mic size={20} className="text-[#F97316]" />
  <span className="text-xl font-semibold text-[#F8FAFC]">VoiceDesk</span>
  <NotificationBell className="ml-auto" />
</div>
```

**Add import** (line 6, existing lucide imports):
```typescript
import { PhoneCall, Users, Settings, Bot, Bell, CreditCard, LogOut, Mic, Phone, Calendar, Radio } from 'lucide-react'
```

---

### `src/components/dashboard/BottomTabBar.tsx` (component, request-response)

**Analog:** Same file — extend tabs array (lines 10-14) and add Bell button

**Current tabs array structure** (lines 10-14):
```typescript
const tabs: { href: Route; icon: typeof PhoneCall; label: string }[] = [
  { href: '/calls', icon: PhoneCall, label: 'Calls' },
  { href: '/leads', icon: Users, label: 'Leads' },
  { href: '/settings/agent', icon: Settings, label: 'Settings' },
]
```

**Current tab render loop** (lines 23-41):
```typescript
{tabs.map(({ href, icon: Icon, label }) => {
  const isActive = ...
  return (
    <Link
      key={href}
      href={href}
      className={cn(
        'flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px]',
        isActive ? 'text-[#F97316]' : 'text-[#94A3B8]'
      )}
    >
      <Icon size={20} />
      <span className="text-xs">{label}</span>
    </Link>
  )
})}
```

**NEW: Bell tab button** (add to component after tabs.map(), before closing nav):
```typescript
// NEW: Bell tab — button, not Link (no /notifications route)
<button
  type="button"
  onClick={() => setBellOpen(true)}
  className={cn(
    'flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px]',
    bellOpen ? 'text-[#F97316]' : 'text-[#94A3B8]'
  )}
>
  <Bell size={20} />
  <span className="text-xs">Notifications</span>
</button>
```

**Add imports and state** (lines 1-6, top of component):
```typescript
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PhoneCall, Users, Settings, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Route } from 'next'
import { useState } from 'react'

// ... component start
const [bellOpen, setBellOpen] = useState(false)
```

---

### `src/components/notification/NotificationSettingsForm.tsx` (component, CRUD)

**Analog:** Same file — existing card structure (lines 218-219, 241-296)

**Existing cardClass CSS** (lines 218-226):
```typescript
const cardClass =
  'bg-[#1E293B] border border-[#334155] rounded-xl p-6 max-w-[480px] mb-4'

const inputClass =
  'w-full px-4 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-[#F8FAFC] text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent ' +
  'placeholder:text-[#64748B] disabled:opacity-50 disabled:cursor-not-allowed'

const checkboxClass = 'w-4 h-4 accent-[#F97316]'
```

**Existing SMS card structure** (lines 241-296):
```typescript
<div className={cardClass}>
  {/* Card header: icon + label + enable checkbox */}
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2">
      <MessageSquare className="w-4 h-4 text-[#64748B]" />
      <span className="text-sm font-semibold text-[#F8FAFC]">SMS</span>
    </div>
    <label className="flex items-center gap-2 cursor-pointer" htmlFor="notify_sms_enabled">
      <span className="text-sm text-[#94A3B8]">Send SMS notifications</span>
      <input
        id="notify_sms_enabled"
        type="checkbox"
        className={checkboxClass}
        checked={formData.notify_sms_enabled}
        onChange={(e) => handleFieldChange('notify_sms_enabled', e.target.checked)}
      />
    </label>
  </div>

  {/* Card body: phone number input */}
  <input
    type="tel"
    ref={smsInputRef}
    value={formData.sms_number}
    onChange={(e) => handleFieldChange('sms_number', e.target.value)}
    placeholder="(305) 555-1234"
    aria-label="SMS phone number"
    className={phoneErrors.sms_number ? `${inputClass} ring-2 ring-[#EF4444] border-transparent` : inputClass}
    disabled={!formData.notify_sms_enabled}
  />
  {phoneErrors.sms_number && (
    <p role="alert" className="mt-1 text-xs text-[#EF4444]">
      {phoneErrors.sms_number}
    </p>
  )}
</div>
```

**FormData interface extension** (lines 35-44):
```typescript
interface FormData {
  sms_number: string
  whatsapp_number: string
  notify_sms_enabled: boolean
  notify_whatsapp_enabled: boolean
  notify_telegram_enabled: boolean
  notify_on_lead: boolean
  notify_on_emergency: boolean
  notify_on_general_inquiry: boolean
  // ADD EMAIL FIELDS:
  email_address: string           // empty string → null on submit
  notify_email_enabled: boolean
}
```

**settingsToFormData extension** (lines 64-75):
```typescript
function settingsToFormData(s: NotificationSettings): FormData {
  return {
    sms_number: s.sms_number ?? '',
    whatsapp_number: s.whatsapp_number ?? '',
    notify_sms_enabled: s.notify_sms_enabled,
    notify_whatsapp_enabled: s.notify_whatsapp_enabled,
    notify_telegram_enabled: s.notify_telegram_enabled,
    notify_on_lead: s.notify_on_lead,
    notify_on_emergency: s.notify_on_emergency,
    notify_on_general_inquiry: s.notify_on_general_inquiry,
    // ADD:
    email_address: s.email_address ?? '',
    notify_email_enabled: s.notify_email_enabled,
  }
}
```

**handleSubmit payload extension** (lines 176-187):
```typescript
await updateSettings.mutateAsync({
  sms_number: smsE164,
  whatsapp_number: waE164,
  notify_sms_enabled: formData.notify_sms_enabled,
  notify_whatsapp_enabled: formData.notify_whatsapp_enabled,
  notify_telegram_enabled: formData.notify_telegram_enabled,
  notify_on_lead: formData.notify_on_lead,
  notify_on_emergency: formData.notify_on_emergency,
  notify_on_general_inquiry: formData.notify_on_general_inquiry,
  // ADD:
  email_address: formData.email_address.trim() || null,
  notify_email_enabled: formData.notify_email_enabled,
})
```

**NEW: Email card** (insert BEFORE SMS card, lines 232-240):
```typescript
{/* ── DELETE these lines (duplicate header) ──────────────────────────── */}
{/* Lines 232-239: entire page header block — remove it */}

{/* ── Section 0: Email (NEW, Phase 14) ──────────────────────────────── */}
<div className={cardClass}>
  {/* Card header: icon + label + enable checkbox */}
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2">
      <Mail className="w-4 h-4 text-[#64748B]" />
      <span className="text-sm font-semibold text-[#F8FAFC]">Email</span>
    </div>
    <label className="flex items-center gap-2 cursor-pointer" htmlFor="notify_email_enabled">
      <span className="text-sm text-[#94A3B8]">Enable email alerts</span>
      <input
        id="notify_email_enabled"
        type="checkbox"
        className={checkboxClass}
        checked={formData.notify_email_enabled}
        onChange={(e) => handleFieldChange('notify_email_enabled', e.target.checked)}
      />
    </label>
  </div>

  {/* Card body: email address input */}
  <input
    type="email"
    value={formData.email_address}
    onChange={(e) => handleFieldChange('email_address', e.target.value)}
    placeholder="you@example.com"
    aria-label="Email address"
    className={inputClass}
    disabled={!formData.notify_email_enabled}
  />
</div>
```

**Add Mail icon to imports** (line 17):
```typescript
import { MessageSquare, MessageCircle, Send, Loader2, Mail } from 'lucide-react'
```

**Zod schema extension in PATCH route** (src/app/api/notification-settings/route.ts, lines 20-30):
```typescript
const updateNotificationSettingsSchema = z.object({
  sms_number: z.string().nullable().optional(),
  whatsapp_number: z.string().nullable().optional(),
  notify_sms_enabled: z.boolean().optional(),
  notify_whatsapp_enabled: z.boolean().optional(),
  notify_telegram_enabled: z.boolean().optional(),
  notify_on_lead: z.boolean().optional(),
  notify_on_emergency: z.boolean().optional(),
  notify_on_general_inquiry: z.boolean().optional(),
  // ADD EMAIL FIELDS:
  email_address: z.string().email().nullable().optional(),
  notify_email_enabled: z.boolean().optional(),
})
```

**Update payload builder in PATCH route** (src/app/api/notification-settings/route.ts, after line 130):
```typescript
// ADD after existing fields (line 130):
if (updates.email_address !== undefined) updatePayload.email_address = updates.email_address
if (updates.notify_email_enabled !== undefined) updatePayload.notify_email_enabled = updates.notify_email_enabled
```

---

## Shared Patterns

### Inngest step.run() Pattern
**Source:** `src/inngest/functions/retell-notify-dispatch.ts` (lines 200-230, 333-384)
**Apply to:** `step.run('write-bell-notification')` in same file

All Inngest steps follow the same try/catch structure:
1. Declare `logId` for notification_log tracking (or skip for bell — no log entry)
2. Wrap in try/catch
3. Re-throw errors to trigger Inngest retry
4. Update log status (sent/failed) in catch block

```typescript
await step.run('step-name', async () => {
  let logId: string | null = null
  try {
    // Prepare payload
    logId = await writeNotificationLog({ ... })  // Optional; skip for bell
    // Execute action
    const result = await action({ ... })
    if (!result.success) throw new Error(...)
    // Mark success
    await updateNotificationLog(logId, { status: 'sent', sentAt: new Date().toISOString() })
  } catch (err: unknown) {
    if (logId) {
      await updateNotificationLog(logId, {
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      })
    }
    throw err  // Inngest retries
  }
})
```

### Supabase Realtime Subscription Pattern
**Source:** `src/lib/realtime/callsSubscription.ts` (lines 1-62)
**Apply to:** `notificationsSubscription.ts` (new file)

All Realtime subscriptions:
1. Create browser client at module scope
2. Define channel in useEffect with dependency on contractorId
3. Subscribe to postgres_changes with event, schema, table, filter
4. Invalidate query keys in callback
5. Cleanup subscription on unmount

```typescript
const supabase = createBrowserClient(...)

export function useSubscriptionName(contractorId: string, onEvent?: () => void) {
  const queryClient = useQueryClient()
  
  useEffect(() => {
    if (!contractorId) return
    
    const channel = supabase
      .channel(`subscription-name-${contractorId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'target_table',
        filter: `contractor_id=eq.${contractorId}`
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['query-key', contractorId] })
        onEvent?.()
      })
      .subscribe()
    
    return () => { channel.unsubscribe() }
  }, [contractorId, queryClient, onEvent])
}
```

### React Query Hook Pattern
**Source:** `src/lib/query/client.tsx` (lines 64-82, useCallsCount pattern)
**Apply to:** `useNotifications`, `useUnreadCount`, `useMarkAllRead`

All hooks:
1. Extract contractorId from useContractor()
2. useQuery with queryKey array including contractorId
3. Check `enabled: !!contractorId`
4. Handle errors with `if (error) throw error`

```typescript
export function useHookName() {
  const { contractorId } = useContractor()
  return useQuery({
    queryKey: ['key-name', contractorId],
    queryFn: async () => {
      if (!contractorId) throw new Error('No contractor ID')
      const { data, error } = await supabase
        .from('table_name')
        .select('*')
        .eq('contractor_id', contractorId)
      if (error) throw error
      return data
    },
    enabled: !!contractorId,
  })
}
```

### API PATCH Route Pattern
**Source:** `src/app/api/notification-settings/route.ts` (lines 59-146)
**Apply to:** `/api/notifications/mark-all-read`

All PATCH routes:
1. getUser() for auth → 401 if missing
2. Service role lookup of contractor by user_id → 404 if missing
3. Service role DB update with contractor_id filter (IDOR guard)
4. Return updated row or 200 success

```typescript
export async function PATCH(req: Request) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = createServiceRoleClient()
  const { data: contractor, error: loadErr } = await serviceClient
    .from('contractors').select('id').eq('user_id', user.id).maybeSingle()
  if (loadErr || !contractor) {
    if (loadErr) console.error('[route-name] contractor load failed:', loadErr.message)
    return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })
  }

  const { error: updateErr } = await serviceClient
    .from('table_name')
    .update({ field: value })
    .eq('contractor_id', contractor.id)
  
  if (updateErr) {
    console.error('[route-name] update failed:', updateErr.message)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
```

### Component Card Pattern
**Source:** `src/components/notification/NotificationSettingsForm.tsx` (lines 218-296, SMS card)
**Apply to:** Email card in same file

All notification setting cards:
1. Outer div with `cardClass` CSS
2. Header: icon + label + enable toggle (checkbox)
3. Body: input field(s) below, disabled when toggle is off
4. Error messages below input (for phone validation)
5. Match exact structure and CSS classes

```typescript
<div className={cardClass}>
  {/* Header */}
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2">
      <IconComponent className="w-4 h-4 text-[#64748B]" />
      <span className="text-sm font-semibold text-[#F8FAFC]">Label</span>
    </div>
    <label className="flex items-center gap-2 cursor-pointer" htmlFor="enable_field">
      <span className="text-sm text-[#94A3B8]">Enable label</span>
      <input
        id="enable_field"
        type="checkbox"
        className={checkboxClass}
        checked={formData.enable_field}
        onChange={(e) => handleFieldChange('enable_field', e.target.checked)}
      />
    </label>
  </div>

  {/* Body */}
  <input
    type="type"
    value={formData.field}
    onChange={(e) => handleFieldChange('field', e.target.value)}
    placeholder="..."
    className={inputClass}
    disabled={!formData.enable_field}
  />
  {errors.field && <p role="alert" className="mt-1 text-xs text-[#EF4444]">{errors.field}</p>}
</div>
```

---

## No Analog Found

None — all files have clear analogs in the existing codebase.

---

## Metadata

**Analog search scope:** 
- `src/inngest/` (background jobs)
- `src/lib/realtime/` (Realtime hooks)
- `src/lib/query/` (React Query hooks)
- `src/app/api/` (API routes)
- `src/components/` (UI components)

**Files scanned:** 12 primary + 2 extended patterns (notification-settings route)

**Pattern extraction date:** 2026-05-25

**Key findings:**
- All new code has exact analogs in the existing codebase
- Inngest, Realtime, React Query, and API patterns are well-established and consistent
- Component CSS and structure follow strict conventions (cardClass, inputClass, checkboxClass)
- Auth and IDOR protection patterns are uniform across API routes
- Email fields extend Phase 13 schema fields; no new Zod validation paradigms needed

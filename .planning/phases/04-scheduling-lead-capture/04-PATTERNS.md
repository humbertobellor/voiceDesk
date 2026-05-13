# Phase 4: Scheduling & Lead Capture - Pattern Map

**Mapped:** 2026-05-08
**Files analyzed:** 13 (new/modified)
**Analogs found:** 13 / 13

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/(dashboard)/connect-calendar/page.tsx` | component (Server Component + Client form) | request-response | `src/app/(dashboard)/settings/agent/page.tsx` + `LanguageSettingsForm.tsx` | exact |
| `src/app/api/auth/google/initiate/route.ts` | route (GET, redirect) | request-response | `src/app/(auth)/auth/callback/route.ts` | role-match |
| `src/app/api/auth/google/callback/route.ts` | route (GET, OAuth exchange + DB write) | request-response | `src/app/(auth)/auth/callback/route.ts` + `src/app/api/provisioning/create/route.ts` | exact |
| `src/lib/google/client.ts` | utility (singleton factory) | request-response | `src/lib/retell/client.ts` | role-match |
| `src/lib/google/auth.ts` | utility (refresh-on-use, DB read/write) | request-response | `src/lib/crypto/tokens.ts` + `src/lib/supabase/service.ts` | role-match |
| `src/lib/scheduling/slots.ts` | utility (pure function) | transform | `src/lib/after-hours/detect.ts` | exact |
| `src/lib/scheduling/inject-slots.ts` | utility (string transform) | transform | `src/lib/retell/system-prompt.ts` | exact |
| `src/inngest/functions/retell-call-classify.ts` | Inngest function (MODIFY — extend) | event-driven | itself (existing) | n/a — extending |
| `src/lib/classification/extract-trade.ts` | utility (MODIFY — extend schemas) | transform | itself (existing) | n/a — extending |
| `supabase/migrations/20260508000001_phase4_scheduling.sql` | migration | batch | `supabase/migrations/20260508000007_webhook_core.sql` | exact |
| `tests/lib/scheduling.test.ts` | test (unit, pure function) | transform | `tests/lib/system-prompt.test.ts` | exact |
| `tests/lib/booking.test.ts` | test (unit, DB mock) | CRUD | `tests/lib/classification.test.ts` | role-match |
| `tests/lib/leads.test.ts` | test (unit, DB mock) | CRUD | `tests/lib/classification.test.ts` | role-match |
| `tests/lib/oauth.test.ts` | test (unit, mock googleapis) | request-response | `tests/lib/crypto.test.ts` | role-match |

---

## Pattern Assignments

### `src/app/(dashboard)/connect-calendar/page.tsx` (Server Component + Client form)

**Analog (page shell):** `src/app/(dashboard)/settings/agent/page.tsx`
**Analog (client form):** `src/app/(dashboard)/settings/agent/_components/LanguageSettingsForm.tsx`

**Page shell pattern** (`src/app/(dashboard)/settings/agent/page.tsx` lines 1-45):
```typescript
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'

export const metadata = { title: 'Connect Calendar — VoiceDesk' }

export default async function ConnectCalendarPage() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: contractor } = await supabase
    .from('contractors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!contractor) redirect('/setup/phone')

  // Check whether calendar is already connected (read calendar_credentials)
  // Use user's own Supabase client — RLS enforces ownership, no service role needed for reads
  const { data: creds } = await supabase
    .from('calendar_credentials')
    .select('contractor_id')
    .eq('contractor_id', contractor.id)
    .maybeSingle()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#F8FAFC] mb-1">Connect Google Calendar</h1>
        <p className="text-sm text-[#94A3B8]">...</p>
        <div className="border-b border-[#334155] mt-6" />
      </div>
      <ConnectCalendarForm isConnected={!!creds} />
    </div>
  )
}
```

**Client form pattern** (`src/app/(dashboard)/settings/agent/_components/LanguageSettingsForm.tsx` lines 1-100):
```typescript
'use client'
import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ConnectCalendarForm({ isConnected }: { isConnected: boolean }) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  // Feedback state pattern: { kind: 'success' | 'error', message: string } | null
  // On success: setFeedback({ kind: 'success', message: 'Google Calendar connected.' })
  // On error: setFeedback({ kind: 'error', message: err })

  return (
    <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-6 max-w-[480px]">
      {feedback && (
        <div
          role="status"
          className={
            feedback.kind === 'success'
              ? 'bg-[#16A34A]/10 border border-[#16A34A]/30 text-[#16A34A] rounded-lg p-3 text-sm mb-4'
              : 'bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] rounded-lg p-3 text-sm mb-4'
          }
        >
          {feedback.message}
        </div>
      )}
      <Button
        disabled={isPending}
        className="bg-[#F97316] text-[#0F172A] hover:bg-[#F97316]/90 min-h-[44px] font-semibold"
        onClick={() => { window.location.href = '/api/auth/google/initiate' }}
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : isConnected ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
      </Button>
    </div>
  )
}
```

**Success banner (query param)** — D-03 redirects to `/dashboard?calendarConnected=1`. Read in `src/app/(dashboard)/dashboard/page.tsx` using `searchParams` prop (App Router) and display a temporary success banner. Pattern: check `searchParams.calendarConnected === '1'` in the Server Component.

---

### `src/app/api/auth/google/initiate/route.ts` (GET route — redirect)

**Analog:** `src/app/(auth)/auth/callback/route.ts`

**Imports pattern** (`src/app/(auth)/auth/callback/route.ts` lines 1-7):
```typescript
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
// Phase 4 adds:
import { randomBytes } from 'crypto'  // Node.js built-in — no install needed
import { createOAuth2Client } from '@/lib/google/client'
```

**Auth pattern:** No JWT auth check needed on initiate — any authenticated user reaching the dashboard can initiate. The callback route performs the auth check.

**Core GET handler pattern** (modeled on `src/app/(auth)/auth/callback/route.ts` lines 8-43 + RESEARCH.md):
```typescript
export async function GET() {
  const state = randomBytes(32).toString('hex')
  const oauth2Client = createOAuth2Client()

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',      // REQUIRED — gets refresh_token for server-side use
    prompt: 'consent',           // REQUIRED — ensures fresh refresh_token on re-auth
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state,
  })

  // await cookies() — Next.js 15+ async API (project is on 16.2.4)
  const cookieStore = await cookies()
  cookieStore.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',   // 'lax' not 'strict' — OAuth redirects are cross-site GET navigation
    maxAge: 600,       // 10 minutes TTL (D-02)
    path: '/',
  })

  return NextResponse.redirect(authUrl)
}
```

**Error handling:** No try/catch needed — if `createOAuth2Client()` throws (missing env vars), let it bubble to 500. Env vars are validated at startup.

---

### `src/app/api/auth/google/callback/route.ts` (GET route — code exchange + DB write)

**Analog:** `src/app/(auth)/auth/callback/route.ts` + `src/app/api/provisioning/create/route.ts`

**Imports pattern** (`src/app/api/provisioning/create/route.ts` lines 1-16 + `src/app/(auth)/auth/callback/route.ts` lines 1-7):
```typescript
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createOAuth2Client } from '@/lib/google/client'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { createSupabaseServer } from '@/lib/supabase/server'
import { encryptToken } from '@/lib/crypto/tokens'
```

**Auth pattern** (`src/app/api/provisioning/create/route.ts` lines 22-26 + 33-46):
```typescript
export async function GET(req: Request) {
  // 1. Verify state cookie FIRST — before any DB interaction
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const returnedState = url.searchParams.get('state')

  const cookieStore = await cookies()
  const expectedState = cookieStore.get('oauth_state')?.value
  if (!expectedState || returnedState !== expectedState) {
    return NextResponse.redirect(new URL('/dashboard?calendarError=state_mismatch', req.url))
  }
  cookieStore.delete('oauth_state')

  if (!code) {
    return NextResponse.redirect(new URL('/dashboard?calendarError=no_code', req.url))
  }

  // 2. Auth — getUser() validates JWT; never use getSession()
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/auth/login', req.url))

  // 3. Load contractor by user_id from JWT — NEVER accept contractor_id from URL params (STRIDE: EoP)
  const db = createServiceRoleClient()
  const { data: contractor } = await db
    .from('contractors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!contractor) return NextResponse.redirect(new URL('/dashboard?calendarError=no_contractor', req.url))
```

**Token exchange + encrypt + upsert pattern** (`src/lib/crypto/tokens.ts` functions + RESEARCH.md pattern):
```typescript
  // 4. Exchange code for tokens
  const oauth2Client = createOAuth2Client()
  const { tokens } = await oauth2Client.getToken(code)

  // tokens.expiry_date is milliseconds since epoch — convert to ISO string for Supabase TIMESTAMPTZ
  // CRITICAL: new Date(tokens.expiry_date!) NOT new Date(tokens.expiry_date! * 1000)
  await db.from('calendar_credentials').upsert({
    contractor_id: contractor.id,
    access_token: encryptToken(tokens.access_token!),     // encryptToken from src/lib/crypto/tokens.ts
    refresh_token: encryptToken(tokens.refresh_token!),
    token_expiry: new Date(tokens.expiry_date!).toISOString(),
    scope: tokens.scope ?? null,
  }, { onConflict: 'contractor_id' })

  // D-03: redirect to dashboard with success param
  return NextResponse.redirect(new URL('/dashboard?calendarConnected=1', req.url))
}
```

**Error handling pattern** (`src/app/api/provisioning/create/route.ts` lines 79-101):
```typescript
  try {
    const { tokens } = await oauth2Client.getToken(code)
    // ... upsert ...
  } catch (err) {
    console.error('[auth/google/callback] getToken failed:', err instanceof Error ? err.message : err)
    return NextResponse.redirect(new URL('/dashboard?calendarError=token_exchange_failed', req.url))
  }
```

---

### `src/lib/google/client.ts` (OAuth2Client singleton factory)

**Analog:** `src/lib/retell/client.ts` (singleton pattern with env var validation)

**Full pattern** (`src/lib/retell/client.ts` — read directly, apply same structure):
```typescript
import 'server-only'
// import 'server-only' is required in ALL lib modules (enforced since Phase 2)

import { google } from 'googleapis'

// Env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
// NEVER NEXT_PUBLIC_ prefix — these are server-only secrets
export function createOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Google OAuth env vars missing: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI'
    )
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}
```

**Key:** `createOAuth2Client()` returns a new instance each call — not a module-level singleton — because OAuth2Client holds per-request credentials (`setCredentials()`). Same pattern as `getRetellClient()` which also creates a fresh instance.

---

### `src/lib/google/auth.ts` (token refresh-on-use utility)

**Analog:** `src/lib/crypto/tokens.ts` (AES-256-GCM) + `src/lib/supabase/service.ts` (service role client) + `src/lib/after-hours/detect.ts` (`import 'server-only'` + pure pattern)

**Imports pattern**:
```typescript
import 'server-only'
import { google } from 'googleapis'
import { createOAuth2Client } from '@/lib/google/client'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { encryptToken, decryptToken } from '@/lib/crypto/tokens'
```

**Core refresh-on-use pattern** (from `src/lib/crypto/tokens.ts` decrypt pattern + RESEARCH.md getCalendarClient):
```typescript
const REFRESH_BUFFER_MS = 5 * 60 * 1000  // D-05: 5-minute buffer

export async function getCalendarClient(contractorId: string) {
  const db = createServiceRoleClient()
  const { data: creds } = await db
    .from('calendar_credentials')
    .select('access_token, refresh_token, token_expiry, calendar_id')
    .eq('contractor_id', contractorId)
    .maybeSingle()

  if (!creds) return null  // D-15: no calendar connected — caller must handle null gracefully

  const oauth2Client = createOAuth2Client()
  // token_expiry from Supabase is ISO string — convert to ms for comparison
  const expiryMs = new Date(creds.token_expiry).getTime()
  const needsRefresh = expiryMs - Date.now() < REFRESH_BUFFER_MS

  let accessToken = decryptToken(creds.access_token)

  if (needsRefresh) {
    oauth2Client.setCredentials({ refresh_token: decryptToken(creds.refresh_token) })
    const { credentials } = await oauth2Client.refreshAccessToken()
    accessToken = credentials.access_token!
    // Re-encrypt and write back — only update refresh_token if Google returned a new one
    await db.from('calendar_credentials').update({
      access_token: encryptToken(credentials.access_token!),
      ...(credentials.refresh_token && {
        refresh_token: encryptToken(credentials.refresh_token),
      }),
      token_expiry: new Date(credentials.expiry_date!).toISOString(),
    }).eq('contractor_id', contractorId)
  }

  oauth2Client.setCredentials({ access_token: accessToken })
  return google.calendar({ version: 'v3', auth: oauth2Client })
}
```

**Error handling:** Do not swallow errors from `refreshAccessToken()`. Let them throw — Inngest retries will call `getCalendarClient()` again with the now-refreshed token from the DB.

---

### `src/lib/scheduling/slots.ts` (pure slot computation)

**Analog:** `src/lib/after-hours/detect.ts` (pure function, `date-fns-tz`, `BusinessHours` type, `import 'server-only'`)

**Imports pattern** (`src/lib/after-hours/detect.ts` lines 1-12):
```typescript
import 'server-only'
import { toZonedTime } from 'date-fns-tz'  // v3 name: toZonedTime (NOT utcToZonedTime)
import { getDay, getHours, getMinutes } from 'date-fns'

// Re-use the existing BusinessHours type from detect.ts — do NOT redefine it
export type { BusinessHours } from '@/lib/after-hours/detect'
// OR import directly:
import type { BusinessHours } from '@/lib/after-hours/detect'
```

**date-fns-tz v3 API** (`src/lib/after-hours/detect.ts` line 7):
```typescript
// v3 function names (project is on 3.2.0):
import { toZonedTime, fromZonedTime, format } from 'date-fns-tz'
// NOT: zonedTimeToUtc (v2), utcToZonedTime (v2)
// fromZonedTime = local → UTC
// toZonedTime = UTC → local
// format with { timeZone } option for human-readable labels
```

**BusinessHours type** (`src/lib/after-hours/detect.ts` lines 11-15):
```typescript
export interface BusinessHours {
  [day: string]: { open: string; close: string; enabled: boolean }
}
// DAY_NAMES pattern — getDay() → string key:
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
```

**Function signature and exported interface**:
```typescript
export interface SlotWindow {
  startsAt: Date   // UTC Date for DB insert
  endsAt: Date     // UTC Date for DB insert
  label: string    // Human-readable: "Tuesday May 12 at 10:00 AM"
}

export function computeAvailableSlots(params: {
  businessHours: BusinessHours
  appointmentDurationMinutes: number
  existingStarts: Date[]      // From appointments.starts_at — already UTC
  timezone: string            // IANA, e.g., 'America/New_York'
  referenceDate?: Date        // Default: now (injectable for testing)
}): SlotWindow[]
```

**Pure function rule:** No DB calls, no external I/O. All inputs passed as parameters. Matches `detectAfterHours()` pattern exactly — pure TypeScript, injectable `referenceDate` for deterministic testing.

---

### `src/lib/scheduling/inject-slots.ts` (slot list injection into system prompt)

**Analog:** `src/lib/retell/system-prompt.ts`

**Full file pattern** (`src/lib/retell/system-prompt.ts` lines 1-42):
```typescript
// No 'server-only' needed — contains no secrets (same reasoning as system-prompt.ts line 7)
// Pure string transform — accepts SlotWindow[], returns a prompt section string

import type { SlotWindow } from './slots'

/**
 * Builds the scheduling section to append to the Retell system prompt.
 * Returns slot section when slots are provided; fallback section when empty (D-15).
 */
export function buildSlotSection(availableSlots: SlotWindow[]): string {
  if (availableSlots.length === 0) {
    return `\n\nScheduling:\nAppointment booking is not currently configured. If a caller requests scheduling, say: "I'll note your preferred timing and our team will call you back to confirm a time."`
  }

  const slotList = availableSlots.map(s => `- ${s.label}`).join('\n')
  return `\n\nScheduling:\nYou can book estimate appointments. Available slots for the next 5 business days:\n${slotList}\nWhen a caller wants to book, confirm the slot by saying: "I've booked you for [slot]. Our team will arrive at your address." Then ask for their service address to complete the booking.`
}
```

**Integration with `buildSystemPrompt`** — extend `src/lib/retell/system-prompt.ts` signature:
```typescript
// Extend existing function signature (src/lib/retell/system-prompt.ts lines 10-33)
import { buildSlotSection } from '@/lib/scheduling/inject-slots'
import type { SlotWindow } from '@/lib/scheduling/slots'

export function buildSystemPrompt(settings: ContractorSettings, availableSlots?: SlotWindow[]): string {
  // ... existing content unchanged ...
  const slotSection = buildSlotSection(availableSlots ?? [])
  return `${existingContent}${slotSection}`.trim()
}
```

---

### `src/inngest/functions/retell-call-classify.ts` (MODIFY — extend with 4 new steps)

**This is the file being extended, not a new file.** Read the existing file at `/Users/humbertobello/development/ai/claude-code/voiceDesk/src/inngest/functions/retell-call-classify.ts`.

**Existing structure to preserve** (lines 1-91):
- `import 'server-only'` — keep
- `NonRetriableError` import — keep
- `retries: 5` — keep
- `onFailure` handler — keep, extend to also handle new steps
- Steps 1-4 (check-hard-emergency, classify-intent, extract-trade-data, persist-classification) — keep unchanged

**New step pattern** (copy from `src/inngest/functions/retell-agent-sync.ts` lines 44-72):
```typescript
// Step 5: Create lead (conditional per D-12)
const lead = await step.run('create-lead', async () => {
  const shouldCreate =
    finalIntent === 'lead' ||
    finalIntent === 'emergency' ||
    (finalIntent === 'info' && (durationMs ?? 0) >= 15000)
  if (!shouldCreate) return null

  const db = createServiceRoleClient()
  const hasAppointment = !!tradeData?.confirmed_appointment_time
  const { data, error } = await db.from('leads').insert({
    contractor_id: contractorId,
    call_id: callId,
    caller_name: call.caller_name ?? null,   // load calls row early for caller_name/caller_phone
    caller_phone: call.caller_phone ?? '',
    service_requested: tradeData?.issue_description ?? tradeData?.repair_type ?? null,
    urgency: (tradeData as { urgency?: string })?.urgency ?? 'normal',
    status: hasAppointment ? 'booked' : 'new',
    notes: tradeData?.service_address ? `Service address: ${tradeData.service_address}` : null,
  }).select('id').maybeSingle()
  if (error) throw new Error(`leads insert failed: ${error.message}`)
  return data
})
```

**step.run error pattern** (`src/inngest/functions/retell-agent-sync.ts` lines 61-71):
```typescript
await step.run('set-synced-status', async () => {
  const db = createServiceRoleClient()
  const { error } = await db
    .from('contractors')
    .update({ agent_sync_status: 'synced' })
    .eq('id', contractorId)
  if (error) {
    console.error('[retell-agent-sync] set-synced-status failed:', error.message)
    throw new Error(error.message)  // re-throw → Inngest retries this step
  }
})
```

**step.sendEvent pattern** (`src/app/api/provisioning/update-agent/route.ts` lines 72-80 — same event shape):
```typescript
// Step 8: Trigger agent sync after appointment creation (D-08)
await step.sendEvent('trigger-agent-sync', {
  name: 'retell/agent.sync',
  data: {
    contractorId,
    llmId: contractor.retell_llm_id,    // loaded from contractors table in early step
    compiledPrompt: buildSystemPrompt(settings, updatedSlots),
    beginMessage: buildBeginMessage(settings),
  },
})
// step.sendEvent is memoized — safe to call in retry; event is not sent twice
```

**UNIQUE constraint conflict handling** (D-10, no analog — original pattern):
```typescript
// Step 6: Create appointment
const appointment = await step.run('create-appointment', async () => {
  if (!tradeData?.confirmed_appointment_time) return null
  // Parse extracted ISO datetime as contractor-local time, convert to UTC
  // (Risk 4: LLM may or may not include 'Z' — strip it, treat as local)
  const localStr = (tradeData.confirmed_appointment_time as string).replace(/Z$/, '')
  if (isNaN(Date.parse(localStr))) return null  // invalid datetime from LLM → skip

  const startsAt = fromZonedTime(new Date(localStr), contractor.timezone)
  const endsAt = addMinutes(startsAt, settings.appointment_duration_minutes)

  const db = createServiceRoleClient()
  const { data, error } = await db.from('appointments').insert({
    contractor_id: contractorId,
    lead_id: lead?.id ?? null,
    call_id: callId,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    service_address: (tradeData as { service_address?: string | null })?.service_address ?? null,
    google_sync_status: 'pending',
  }).select('id').maybeSingle()

  if (error?.code === '23505') {
    // D-10: UNIQUE(contractor_id, starts_at) violated — slot already taken
    // Mark the LEAD as booking_conflict = true (NOT appointments — UNIQUE prevents duplicate row)
    if (lead?.id) {
      await db.from('leads').update({ booking_conflict: true, status: 'new' }).eq('id', lead.id)
    }
    return null
  }
  if (error) throw new Error(`appointments insert failed: ${error.message}`)
  return data
})
```

**Loading contractor data early** (Risk 5 — new early step, no existing analog):
```typescript
// Add as first step or load inline before step 1
const contractor = await step.run('load-contractor', async () => {
  const db = createServiceRoleClient()
  const { data, error } = await db
    .from('contractors')
    .select('id, retell_llm_id, timezone, contractor_settings(*)')
    .eq('id', contractorId)
    .maybeSingle()
  if (error || !data) throw new NonRetriableError(`[retell-call-classify] contractor ${contractorId} not found`)
  return data
})
// contractor_settings is a one-to-one FK join — Supabase returns it as single object (not array)
// Pattern from src/app/api/provisioning/create/route.ts line 54:
const settings = contractor.contractor_settings as ContractorSettings | null
```

---

### `src/lib/classification/extract-trade.ts` (MODIFY — extend schemas)

**Existing schema pattern** (lines 14-36):
```typescript
// All optional fields use .nullish() — NOT .optional()
// OpenAI structured outputs requires nullable: fields cannot be absent (Risk note in line 13)
const HvacSchema = z.object({
  system_age: z.string().nullish(),
  issue_type: z.enum(['heating', 'cooling', 'other']),
  urgency: z.enum(['normal', 'urgent', 'emergency']),
})
```

**Extension pattern** — add two fields to ALL FOUR schemas with `.nullish()`:
```typescript
// New fields added to HvacSchema, PlumbingSchema, ElectricalSchema, GeneralSchema:
confirmed_appointment_time: z.string().nullish(),
// ISO datetime without TZ: "2026-05-12T10:00:00" (LLM instructed to omit TZ suffix)
// null if no appointment was booked

service_address: z.string().nullish(),
// Full address or intersection as spoken by caller
// null if not provided
```

**Extraction prompt extension** (lines 53-57 — `buildExtractionPrompt` function):
```typescript
function buildExtractionPrompt(trade?: string): string {
  return `Extract structured information from this ${trade ?? 'general'} contractor call transcript.
Fill in only what was explicitly stated by the caller. Use your best judgment for urgency.
Urgency guide: emergency = happening now + safety risk, urgent = active damage or no functionality, normal = maintenance or future repair.
If the agent confirmed an appointment time during the call, extract it as confirmed_appointment_time in ISO format (YYYY-MM-DDTHH:MM:SS) without timezone suffix, using the contractor's local time. If no appointment was confirmed, return null.
If the caller provided a service address, extract it as service_address. If not provided, return null.`
}
```

---

### `supabase/migrations/20260508000001_phase4_scheduling.sql` (migration)

**Analog:** `supabase/migrations/20260508000007_webhook_core.sql`

**Full migration SQL pattern** (`supabase/migrations/20260508000007_webhook_core.sql` lines 1-25):
```sql
-- Header comment: phase, description, decision references, RLS note
-- 20260508000007_webhook_core.sql pattern:

-- 1. ALTER TABLE with ADD COLUMN IF NOT EXISTS
ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS analysis_status TEXT
    CHECK (analysis_status IS NULL OR analysis_status IN ('pending', 'analyzing', 'complete', 'analysis_failed'))
    DEFAULT 'pending';

-- 2. COMMENT ON COLUMN with decision reference
COMMENT ON COLUMN calls.analysis_status IS 'D-03: ...lifecycle description...';
```

**Phase 4 migration structure**:
```sql
-- 20260508000001_phase4_scheduling.sql
-- Phase 4: Scheduling & Lead Capture — adds scheduling and lead capture columns.
-- D-06: appointment_duration_minutes → contractor_settings
-- D-14: google_sync_status → appointments
-- D-10: booking_conflict → leads (NOT appointments — UNIQUE(contractor_id, starts_at) prevents duplicate rows)
-- RLS: existing policies in 20260504000002_rls_policies.sql cover all three tables
--   with all four operations (SELECT/INSERT/UPDATE/DELETE) by contractor_id.
--   New columns on existing tables are automatically covered — no new policy changes needed.

-- 1. appointment_duration_minutes to contractor_settings (D-06)
ALTER TABLE contractor_settings
  ADD COLUMN IF NOT EXISTS appointment_duration_minutes INT NOT NULL DEFAULT 120;

COMMENT ON COLUMN contractor_settings.appointment_duration_minutes IS
  'D-06: default 2 hours. Phase 6 portal allows 60/90/120/180 min options.';

-- 2. google_sync_status to appointments (D-14)
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS google_sync_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (google_sync_status IN ('pending', 'synced', 'failed', 'skipped'));

COMMENT ON COLUMN appointments.google_sync_status IS
  'D-14: pending → synced (google_event_id written) → failed (retries exhausted) → skipped (no calendar).';

-- 3. booking_conflict to leads (D-10 — RESEARCH.md UNIQUE constraint analysis)
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS booking_conflict BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN leads.booking_conflict IS
  'D-10: true when requested appointment slot was already booked. Contractor calls back this lead. Phase 6 shows conflict leads.';
```

**RLS note:** No new policies needed. Existing policies in `20260504000002_rls_policies.sql` for `contractor_settings`, `appointments`, and `leads` cover all four operations with Pattern B (contractor_id FK subquery). New columns are automatically covered.

---

### `tests/lib/scheduling.test.ts` (unit test — pure function)

**Analog:** `tests/lib/system-prompt.test.ts` (pure function test, no mocks, deterministic fixture)

**Full test structure** (`tests/lib/system-prompt.test.ts` lines 1-61):
```typescript
// No vi.mock needed — pure function, no external I/O
import { describe, it, expect } from 'vitest'
import { computeAvailableSlots } from '@/lib/scheduling/slots'
import type { BusinessHours } from '@/lib/after-hours/detect'

// Use referenceDate injection for deterministic tests (no Date.now() non-determinism)
const baseBusinessHours: BusinessHours = {
  monday:    { open: '08:00', close: '18:00', enabled: true },
  tuesday:   { open: '08:00', close: '18:00', enabled: true },
  wednesday: { open: '08:00', close: '18:00', enabled: true },
  thursday:  { open: '08:00', close: '18:00', enabled: true },
  friday:    { open: '08:00', close: '17:00', enabled: true },
  saturday:  { open: '09:00', close: '13:00', enabled: false },
  sunday:    { open: '00:00', close: '00:00', enabled: false },
}

describe('computeAvailableSlots (SCHED-01, SCHED-02)', () => {
  it('returns slots for exactly 5 business days', () => { ... })
  it('skips disabled days (SCHED-02)', () => { ... })
  it('respects appointment_duration_minutes step size (SCHED-02)', () => { ... })
  it('excludes already-booked starts_at (SCHED-01)', () => { ... })
  it('injects referenceDate for deterministic output', () => { ... })
})
```

**Key:** Pass `referenceDate` to `computeAvailableSlots()` in all tests. Never rely on `Date.now()` in tests.

---

### `tests/lib/booking.test.ts` (unit test — DB mock)

**Analog:** `tests/lib/classification.test.ts` (vi.mock for external dependency, vi.hoisted, beforeEach pattern)

**Mock setup pattern** (`tests/lib/classification.test.ts` lines 1-22):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))  // Required for all lib modules with 'server-only'

// vi.hoisted: mock variables available inside vi.mock factory
const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({
    from: mockFrom,
  }),
}))
```

**Test structure for booking conflict** (D-10):
```typescript
describe('appointment creation (SCHED-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('google_sync_status=skipped when no calendar connected (D-15)', () => { ... })
  it('catches UNIQUE constraint violation (23505) and returns null appointment', () => {
    // Mock: first insert returns error.code === '23505'
    // Verify: lead.booking_conflict is set to true
  })
})
```

---

### `tests/lib/leads.test.ts` (unit test — lead creation rules)

**Analog:** `tests/lib/classification.test.ts` (same mock pattern)

**Test structure for lead creation rules** (D-12):
```typescript
describe('lead creation rules (SCHED-01)', () => {
  it('creates lead for intent=lead', () => { ... })
  it('creates lead for intent=emergency', () => { ... })
  it('creates lead for intent=info with duration >= 15s', () => { ... })
  it('does NOT create lead for intent=no_action', () => { ... })
  it('sets status=booked when confirmed_appointment_time non-null', () => { ... })
  it('sets status=new when confirmed_appointment_time null', () => { ... })
})
```

---

### `tests/lib/oauth.test.ts` (unit test — token refresh, mock googleapis)

**Analog:** `tests/lib/crypto.test.ts` (env var setup in beforeEach, encrypt/decrypt round-trip pattern)

**Mock and env setup pattern** (`tests/lib/crypto.test.ts` lines 1-10):
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('server-only', () => ({}))

// Mock googleapis — similar to how openai is mocked in classification.test.ts
const { mockRefreshAccessToken } = vi.hoisted(() => ({
  mockRefreshAccessToken: vi.fn(),
}))

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(() => ({
        setCredentials: vi.fn(),
        refreshAccessToken: mockRefreshAccessToken,
        generateAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth?...'),
        getToken: vi.fn(),
      })),
    },
    calendar: vi.fn(),
  },
}))
```

**Env setup pattern** (`tests/lib/crypto.test.ts` lines 5-9):
```typescript
beforeEach(() => {
  process.env.OAUTH_ENCRYPTION_KEY = 'a'.repeat(64)  // valid 64-char hex test key (from tests/setup.ts)
  process.env.GOOGLE_CLIENT_ID = 'test-client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'
  process.env.GOOGLE_REDIRECT_URI = 'https://localhost:3000/api/auth/google/callback'
})
```

---

## Shared Patterns

### `import 'server-only'`
**Source:** Every lib module (`src/lib/crypto/tokens.ts` line 3, `src/lib/after-hours/detect.ts` line 1, `src/lib/supabase/service.ts` line 1, etc.)
**Apply to:** `src/lib/google/client.ts`, `src/lib/google/auth.ts`, `src/lib/scheduling/slots.ts`
**Exception:** `src/lib/scheduling/inject-slots.ts` and `src/lib/retell/system-prompt.ts` do NOT use `import 'server-only'` because they contain no secrets and are pure string transforms.
```typescript
import 'server-only'
// First line of every server-side lib module
```

### Service Role Client Usage
**Source:** `src/lib/supabase/service.ts` lines 1-23
**Apply to:** `src/lib/google/auth.ts`, all new Inngest steps in `retell-call-classify.ts`
```typescript
import { createServiceRoleClient } from '@/lib/supabase/service'

// In async functions:
const db = createServiceRoleClient()
const { data, error } = await db.from('table_name').select('col').eq('id', id).maybeSingle()
// Always check error before using data
if (error) throw new Error(error.message)
```

### Auth Pattern in API Routes (JWT only, never session)
**Source:** `src/app/api/provisioning/create/route.ts` lines 22-26
**Apply to:** `src/app/api/auth/google/callback/route.ts`
```typescript
const supabase = await createSupabaseServer()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
// OR for redirect routes:
if (!user) return NextResponse.redirect(new URL('/auth/login', req.url))
```

### Contractor ID from JWT (Never from Request)
**Source:** `src/app/api/provisioning/create/route.ts` lines 34-46
**Apply to:** `src/app/api/auth/google/callback/route.ts`
```typescript
// STRIDE: Elevation of Privilege — NEVER accept contractor_id from URL params or body
const { data: contractor } = await serviceClient
  .from('contractors')
  .select('id')
  .eq('user_id', user.id)  // user.id comes from JWT (getUser()), not from request
  .maybeSingle()
```

### Inngest Step Pattern (step.run + error throw)
**Source:** `src/inngest/functions/retell-agent-sync.ts` lines 44-72
**Apply to:** All new steps in `retell-call-classify.ts`
```typescript
await step.run('step-name', async () => {
  // ... work ...
  if (error) {
    console.error('[function-id] step-name failed:', error.message)
    throw new Error(error.message)  // throw → Inngest retries this step with backoff
  }
})
// Result is memoized — on retry, completed steps are NOT re-executed
```

### NonRetriableError for Corrupt Event Data
**Source:** `src/inngest/functions/retell-call-classify.ts` lines 43-47, `src/inngest/functions/retell-agent-sync.ts` lines 37-40
**Apply to:** Any new Inngest functions
```typescript
if (!contractorId || !requiredField) {
  throw new NonRetriableError(
    `[function-id] invalid event data: missing contractorId or requiredField`
  )
}
```

### onFailure DB Status Update
**Source:** `src/inngest/functions/retell-call-classify.ts` lines 22-32, `src/inngest/functions/retell-agent-sync.ts` lines 17-26
**Apply to:** Extended `retell-call-classify.ts` onFailure (already handles analysis_failed — may need to also set google_sync_status='failed' on in-progress appointments)
```typescript
onFailure: async ({ event }) => {
  const { callId } = event.data.event.data as { callId: string }
  if (!callId) return
  const db = createServiceRoleClient()
  await db.from('calls').update({ analysis_status: 'analysis_failed' }).eq('id', callId)
  // Phase 4 extension: also set google_sync_status='failed' on any pending appointments for this callId
}
```

### Token Encryption (AES-256-GCM)
**Source:** `src/lib/crypto/tokens.ts` lines 34-76
**Apply to:** All OAuth token reads/writes in `src/app/api/auth/google/callback/route.ts` and `src/lib/google/auth.ts`
```typescript
import { encryptToken, decryptToken } from '@/lib/crypto/tokens'
// Output format: iv(hex):tag(hex):ciphertext(hex)
// Always encrypt before DB write; always decrypt before use
// Never log decrypted values
```

### Test Mock for `server-only`
**Source:** `tests/lib/classification.test.ts` line 6
**Apply to:** All test files that import from lib modules
```typescript
vi.mock('server-only', () => ({}))  // First mock in every test file that imports server-only libs
```

### Test Env Var Setup
**Source:** `tests/setup.ts` lines 1-5, `tests/lib/crypto.test.ts` lines 6-9
**Apply to:** `tests/lib/oauth.test.ts`
```typescript
// tests/setup.ts already sets OAUTH_ENCRYPTION_KEY='a'.repeat(64) globally
// Individual test files add per-test env vars in beforeEach:
beforeEach(() => {
  process.env.OPENAI_API_KEY = 'test-key'
  vi.clearAllMocks()
})
```

---

## No Analog Found

All files have analogs. No entries in this section.

---

## Architecture Constraints Captured from Codebase

These constraints are observed in existing code and MUST carry forward into Phase 4:

1. **One-to-one FK joins return single object, not array** (`src/app/api/provisioning/create/route.ts` line 54): `contractor.contractor_settings` from a `.select('contractor_settings(*)')` join is a single object, not an array. Cast with `as ContractorSettings | null`.

2. **`.maybeSingle()` over `.single()`**: Every query that might return zero rows uses `.maybeSingle()` (returns `null` data vs. throwing). Used consistently across all existing routes.

3. **`await cookies()` is async** (`src/lib/supabase/server.ts` line 8, `src/app/(auth)/auth/callback/route.ts` line 19): Next.js 16.x requires `await cookies()` — calling without await throws. Used in initiate route for setting state cookie.

4. **`retries: 5` on all Inngest functions** (`src/inngest/functions/retell-agent-sync.ts` line 15, `src/inngest/functions/retell-call-classify.ts` line 20): Project standard. All new Inngest functions use `retries: 5`.

5. **`console.error` prefix convention**: `[function-id] step-name failed:` format used throughout. Maintain for new steps: `[retell-call-classify] create-lead failed:`, `[retell-call-classify] create-appointment failed:`, etc.

6. **Supabase TIMESTAMPTZ storage**: Dates stored as ISO strings via `.toISOString()`. Reading back: `new Date(row.token_expiry)` for Date object, `.getTime()` for ms epoch. Never store raw ms numbers.

---

## Metadata

**Analog search scope:** `src/`, `tests/`, `supabase/migrations/`
**Files scanned:** 22 source files, 8 test files, 7 migrations
**Pattern extraction date:** 2026-05-08

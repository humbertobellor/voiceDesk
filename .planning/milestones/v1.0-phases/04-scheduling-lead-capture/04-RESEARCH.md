# Phase 4: Scheduling & Lead Capture — Research

**Researched:** 2026-05-08
**Domain:** Google Calendar OAuth2, slot computation, Inngest function extension, lead creation
**Confidence:** HIGH (all critical claims verified via Context7, official docs, npm registry, and codebase inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** OAuth entry page: minimal `/dashboard/connect-calendar` — button + success/error state only. Phase 6 replaces with proper Settings section.
- **D-02:** OAuth state management: state param + httpOnly cookie (`oauth_state`), verified on callback before proceeding.
- **D-03:** Post-OAuth redirect: success → `/dashboard?calendarConnected=1`.
- **D-04:** OAuth library: `googleapis` OAuth2Client directly. Already installed — no new dependencies.
- **D-05:** Token refresh strategy: refresh on use. Check expiry before every Calendar API call; if expired or within 5 minutes, call `oauth2Client.refreshAccessToken()`, re-encrypt, write back. Proceed with fresh token.
- **D-06:** `appointment_duration_minutes INT NOT NULL DEFAULT 120` added to `contractor_settings` (migration).
- **D-07:** Pre-compute available slots for next 5 business days from `business_hours` + `appointment_duration_minutes` minus existing `appointments.starts_at`. Inject as concrete time offers into Retell agent system prompt.
- **D-08:** After each appointment create/cancel, fire existing `retell/agent.sync` Inngest event to rebuild system prompt with updated slots. Same `retell-agent-sync` function — no new Inngest function.
- **D-09:** Booking conflict prevention via UNIQUE(contractor_id, starts_at) only. Pre-computed slots are always duration-aligned, so overlapping bookings are structurally impossible when slots are honored.
- **D-10:** Race condition: if second INSERT hits UNIQUE constraint, create appointment row anyway with `booking_conflict = true`. Contractor calls back second customer in portal (Phase 6).
- **D-11:** Extend all four Phase 3 extraction schemas to include `confirmed_appointment_time` (ISO datetime or null) and `service_address` (text or null). Same single GPT-4o call — no extra LLM round-trip.
- **D-12:** Lead creation rules: intent=lead → yes; intent=emergency → yes; intent=info AND duration_seconds >= 15 → yes; intent=no_action → no. Lead status='booked' if `raw_metadata.confirmed_appointment_time` non-null, else 'new'.
- **D-13:** Calendar event creation inside `retell-call-classify` Inngest function AFTER appointment row insert. Sequence: classify → extract → create lead → create appointment → create Google Calendar event → update `google_event_id` + `google_sync_status='synced'`.
- **D-14:** DB `appointments` row is authoritative. `google_sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (google_sync_status IN ('pending','synced','failed','skipped'))`. Inngest retries up to 5 times; all retries exhausted → `google_sync_status='failed'`.
- **D-15:** No calendar connected: still create `appointments` and `leads` rows. Set `google_sync_status='skipped'`. No error.

### Claude's Discretion

- Exact route paths: `/api/auth/google/initiate` and `/api/auth/google/callback`
- State cookie name (`oauth_state`) and TTL (10 minutes)
- Slot injection format in system prompt (exact phrasing)
- GPT-4o model for extraction (same as Phase 3 — `gpt-4o`, `zodResponseFormat`)
- `booking_conflict` column type and default (`BOOLEAN DEFAULT false`)

### Deferred Ideas (OUT OF SCOPE)

- Appointment rescheduling API (Phase 6)
- `freebusy.query()` mid-slot-computation (Phase 6)
- Notification on new booking (Phase 5)
- `notify_on_general_inquiry` UI checkbox (Phase 6)
- Proactive token refresh cron (Phase 7 hardening)

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCHED-01 | Agent books estimate appointments into contractor's Google Calendar during the call, using contractor-configured availability windows | D-07 slot computation algorithm + D-13 Calendar event creation sequence in Inngest |
| SCHED-02 | Contractor sets bookable time windows in portal; agent uses these windows — not live Calendar API — during calls | `contractor_settings.business_hours` JSONB structure confirmed in schema; `appointment_duration_minutes` migration adds duration config |
| SCHED-03 | Agent verbally confirms appointment date, time, and address with caller before ending the call | `confirmed_appointment_time` + `service_address` extraction fields added to GPT-4o schemas; extraction captures what agent confirmed |
| SCHED-04 | System prevents double-booking; if conflict detected, agent offers next open slot | UNIQUE(contractor_id, starts_at) prevents duplicate slots; `booking_conflict` flag captures race condition outcome for Phase 6 UI |

</phase_requirements>

---

## Summary

Phase 4 extends three existing systems (the Retell system prompt, the `retell-call-classify` Inngest function, and the Phase 3 GPT-4o extraction schemas) and adds two new code paths (Google OAuth initiation/callback routes and a token refresh utility). The slot computation algorithm is pure TypeScript — it reads `contractor_settings.business_hours` JSONB, generates slot boundaries using `appointment_duration_minutes`, subtracts existing `appointments.starts_at` timestamps, and returns the next five enabled business days of open slots. No external API call is made mid-call.

The `googleapis` package (v171.4.0, published 2026-02-05) is not yet installed in this project — it must be added in Wave 0. The OAuth2Client constructor, `generateAuthUrl()`, `getToken()`, and manual `refreshAccessToken()` are all verified against official documentation. The critical subtlety in token storage is that `googleapis` returns `expiry_date` as milliseconds-since-epoch (not a Date object and not ISO string) — conversion to TIMESTAMPTZ for Supabase requires `new Date(tokens.expiry_date)`.

**Primary recommendation:** Extend `retell-call-classify` with four new sequential steps (create-lead, create-appointment, create-calendar-event, set-google-sync-status) rather than chaining to a new function. All steps are idempotent via Inngest memoization. Migration adds three columns: `contractor_settings.appointment_duration_minutes`, `appointments.google_sync_status`, and `appointments.booking_conflict`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| OAuth initiation (state cookie, redirect) | API Route (`/api/auth/google/initiate`) | — | Generates state token, sets httpOnly cookie, builds Google auth URL, redirects. Server-only — no browser JS. |
| OAuth callback (code exchange, token encrypt/store) | API Route (`/api/auth/google/callback`) | — | Exchanges code, encrypts tokens with Phase 1 utility, writes to `calendar_credentials`. Server-only. |
| Google OAuth2Client singleton | Lib module (`src/lib/google/client.ts`) | — | Shared across initiate + callback + token refresh + Calendar API calls. |
| Token refresh-on-use | Lib module (`src/lib/google/refresh.ts` or inline) | — | Called in Inngest before every Calendar API call. Reads, refreshes if needed, re-encrypts, writes back. |
| Slot computation | Lib module (`src/lib/scheduling/slots.ts`) | — | Pure function: business_hours + duration + existing appointments → slot list. No external I/O. |
| System prompt injection (slot list) | Lib module (`src/lib/retell/system-prompt.ts`) | Inngest (`retell-agent-sync`) | `buildSystemPrompt()` extended to accept slot list parameter; Inngest fires rebuild after appointment create/cancel. |
| GPT-4o schema extension | Lib module (`src/lib/classification/extract-trade.ts`) | — | Four schema objects extended in-place. Same LLM call, new fields. |
| Lead creation | Inngest step in `retell-call-classify` | — | Post-classification, inside existing function. Database write via service role. |
| Appointment creation + conflict handling | Inngest step in `retell-call-classify` | — | DB INSERT; catches error code 23505 for UNIQUE violation, retries with `booking_conflict: true`. |
| Google Calendar event creation | Inngest step in `retell-call-classify` | — | After appointment row exists. Retries up to 5 times via Inngest default backoff. |
| Calendar connection UI | Next.js page (`/dashboard/connect-calendar`) | — | Client component with server action or API call. Minimal — button + status. |
| Database | Supabase (`appointments`, `leads`, `calendar_credentials`, `contractor_settings`) | — | Source of truth for all booking state. `appointments` table is authoritative; Google Calendar is a sync target. |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `googleapis` | 171.4.0 | Google Calendar API + OAuth2Client | Official Google Node.js client; used in Phase 1 planning; only supported client for Calendar API v3 |
| `next` | 16.2.4 | App Router, cookies(), Route Handlers | Already installed; `cookies()` API is async in Next.js 15+ |
| `inngest` | ^4.3.0 | Durable step execution, retry, event chaining | Already installed; all Phase 3 patterns apply |
| `zod` | 4.4.2 | Schema extension for extraction fields | Already installed; `zodResponseFormat` used in Phase 3 |
| `date-fns-tz` | ^3.2.0 | Timezone-aware slot boundary computation | Already installed for Phase 3 after-hours detection |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `crypto` (Node.js built-in) | — | State token generation (`randomBytes(32)`) | OAuth state cookie generation in initiate route |
| `src/lib/crypto/tokens.ts` | (project file) | `encryptToken()` / `decryptToken()` | Every token read/write in OAuth callback and token refresh |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual `refreshAccessToken()` | `oauth2Client.on('tokens', ...)` event listener | Event listener approach doesn't work cleanly in Inngest serverless steps — refresh-on-use with explicit write-back is cleaner and predictable |
| Extending `retell-call-classify` | New separate Inngest function | Separate function requires an additional `step.sendEvent()` call and a new event — adds latency and complexity for no benefit; Phase 4 steps are logically sequential |

**Installation (Wave 0):**
```bash
npm install googleapis
```

**Version verification:** [VERIFIED: npm registry 2026-05-08]
```
googleapis: 171.4.0 (published 2026-02-05)
```

---

## Google OAuth2 Flow

### Constructor and Auth URL Generation

[VERIFIED: googleapis.dev/nodejs/googleapis/latest + Google OAuth2 web server docs]

```typescript
// src/lib/google/client.ts
import 'server-only'
import { google } from 'googleapis'

// GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI never get NEXT_PUBLIC_ prefix
export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI  // e.g., https://yourapp.com/api/auth/google/callback
  )
}
```

```typescript
// src/app/api/auth/google/initiate/route.ts
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import { createOAuth2Client } from '@/lib/google/client'

export async function GET() {
  const state = randomBytes(32).toString('hex')
  const oauth2Client = createOAuth2Client()

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',      // Gets refresh_token (required for server-side use)
    prompt: 'consent',           // Forces consent screen — ensures fresh refresh_token on re-auth
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
    ],
    state,
  })

  // Set httpOnly state cookie before redirect (verified against Next.js 16.x docs)
  const cookieStore = await cookies()
  cookieStore.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,  // 10 minutes — D-02/Specifics
    path: '/',
  })

  return NextResponse.redirect(authUrl)
}
```

**Critical subtleties:**
- `prompt: 'consent'` is REQUIRED even when re-connecting. Without it, Google does NOT return a new `refresh_token` if the user previously granted access. Re-auth without `prompt: 'consent'` returns `refresh_token: null` from `getToken()`. [VERIFIED: Google OAuth2 docs]
- `access_type: 'offline'` is REQUIRED for server-side token usage (allows refreshing without user present). [VERIFIED: googleapis docs]
- `scope: ['https://www.googleapis.com/auth/calendar.events']` — this scope supports `events.insert`. The broader `calendar` scope is not needed for Phase 4. [VERIFIED: developers.google.com/workspace/calendar/api/auth]

**Scope security note — CRITICAL:** `calendar.events` is a **restricted scope** per Google's OAuth policy. Apps requesting this scope in production require a **third-party security assessment (CASA Tier 2)** before the app can leave "Testing" mode. This assessment can take **3-8 weeks**. Begin the Google Cloud Console verification process immediately when Phase 4 ships to beta, not when Phase 7 launches. [CITED: developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification]

### OAuth Callback (Code Exchange)

[VERIFIED: googleapis.dev + official docs]

```typescript
// src/app/api/auth/google/callback/route.ts
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createOAuth2Client } from '@/lib/google/client'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { createSupabaseServer } from '@/lib/supabase/server'
import { encryptToken } from '@/lib/crypto/tokens'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const returnedState = url.searchParams.get('state')

  // D-02: Verify state cookie
  const cookieStore = await cookies()
  const expectedState = cookieStore.get('oauth_state')?.value
  if (!expectedState || returnedState !== expectedState) {
    return NextResponse.redirect('/dashboard?calendarError=state_mismatch')
  }
  cookieStore.delete('oauth_state')

  if (!code) {
    return NextResponse.redirect('/dashboard?calendarError=no_code')
  }

  // Auth check
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect('/login')

  const oauth2Client = createOAuth2Client()
  const { tokens } = await oauth2Client.getToken(code)

  // tokens shape: { access_token, refresh_token, expiry_date (ms epoch), token_type, scope }
  // expiry_date is milliseconds since epoch — convert to Date for Supabase TIMESTAMPTZ

  const db = createServiceRoleClient()
  const { data: contractor } = await db
    .from('contractors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!contractor) return NextResponse.redirect('/dashboard?calendarError=no_contractor')

  await db.from('calendar_credentials').upsert({
    contractor_id: contractor.id,
    access_token: encryptToken(tokens.access_token!),
    refresh_token: encryptToken(tokens.refresh_token!),
    token_expiry: new Date(tokens.expiry_date!).toISOString(),
    scope: tokens.scope ?? null,
  }, { onConflict: 'contractor_id' })

  // D-03: Redirect to dashboard with success param
  return NextResponse.redirect('/dashboard?calendarConnected=1')
}
```

---

## Token Storage & Refresh Pattern

### Token Object Shape from googleapis

[VERIFIED: googleapis.dev/nodejs/google-auth-library + npm source inspection]

`getToken(code)` returns `{ tokens }` where:
```typescript
interface Credentials {
  access_token: string | null
  refresh_token: string | null        // Only present on first auth OR when prompt:'consent' used
  expiry_date: number | null          // Milliseconds since Unix epoch — NOT seconds, NOT ISO string
  token_type: string                  // Usually 'Bearer'
  scope: string                       // Space-separated scope string
}
```

**Key gotcha:** `expiry_date` is milliseconds (e.g., `1746750000000`). For Supabase TIMESTAMPTZ: `new Date(tokens.expiry_date).toISOString()`. When reading back from Supabase, `token_expiry` is an ISO string — convert with `new Date(row.token_expiry).getTime()` for ms comparison. [VERIFIED: google-auth-library source + Supabase TIMESTAMPTZ behavior]

### Refresh-on-Use Pattern

[VERIFIED: googleapis.dev OAuth2Client.refreshAccessToken method docs; isTokenExpiring confirmed protected method, cannot be called directly]

```typescript
// src/lib/google/refresh.ts
import 'server-only'
import { createOAuth2Client } from '@/lib/google/client'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { encryptToken, decryptToken } from '@/lib/crypto/tokens'
import { google } from 'googleapis'

const REFRESH_BUFFER_MS = 5 * 60 * 1000  // 5-minute buffer (D-05)

export async function getCalendarClient(contractorId: string) {
  const db = createServiceRoleClient()
  const { data: creds } = await db
    .from('calendar_credentials')
    .select('access_token, refresh_token, token_expiry, calendar_id')
    .eq('contractor_id', contractorId)
    .maybeSingle()

  if (!creds) return null  // D-15: no calendar connected

  const oauth2Client = createOAuth2Client()
  const expiryMs = new Date(creds.token_expiry).getTime()
  const nowMs = Date.now()
  const needsRefresh = expiryMs - nowMs < REFRESH_BUFFER_MS

  let accessToken = decryptToken(creds.access_token)

  if (needsRefresh) {
    // Set refresh token so client can refresh
    oauth2Client.setCredentials({
      refresh_token: decryptToken(creds.refresh_token),
    })
    // refreshAccessToken() returns { credentials } with new access_token and expiry_date
    const { credentials } = await oauth2Client.refreshAccessToken()
    accessToken = credentials.access_token!

    // Re-encrypt and write back (D-05)
    await db.from('calendar_credentials').update({
      access_token: encryptToken(credentials.access_token!),
      // refresh_token may rotate — only update if new one returned
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

**Race condition risk (LOW):** If two Inngest steps for the same contractor run concurrently and both detect token expiry, both call `refreshAccessToken()`. Google refresh tokens are single-use on rotation — one call will get a new token, the other may fail with `invalid_grant` if the refresh token was rotated. Mitigation: Inngest retry will succeed on the second attempt (the written token will be fresh). This risk is LOW for Phase 4 — concurrent calls for the same contractor within the same 5-minute window are unlikely. D-05 explicitly accepts refresh-on-use without a distributed lock. [ASSUMED — race condition probability; mitigation is confirmed by Inngest retry behavior]

---

## Available Slot Computation Algorithm

### Business Hours JSONB Structure (verified from schema)

[VERIFIED: `supabase/migrations/20260504000001_initial_schema.sql` + `src/types/database.ts`]

```typescript
// Confirmed schema — each day:
interface BusinessHoursDay {
  open: string    // "HH:MM" 24-hour format, e.g., "08:00"
  close: string   // "HH:MM" 24-hour format, e.g., "18:00"
  enabled: boolean
}

// Seven days keyed as: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday"
```

### Slot Computation Algorithm

[ASSUMED — algorithm design is original; date-fns-tz v3.2.0 API verified against npm docs]

The contractor timezone is `contractors.timezone` (default `'America/New_York'`). All slot boundaries must be computed in the contractor's timezone, then stored as UTC TIMESTAMPTZ in the `appointments` table.

```typescript
// src/lib/scheduling/slots.ts
import 'server-only'
import { toZonedTime, fromZonedTime, format } from 'date-fns-tz'
import { addMinutes, startOfDay, parseISO } from 'date-fns'

const DAYS_AHEAD = 5  // D-07: next 5 business days
const DAY_KEYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'] as const

export interface SlotWindow {
  startsAt: Date   // UTC Date for DB insert
  endsAt: Date     // UTC Date for DB insert
  label: string    // Human-readable: "Tuesday May 12 at 10:00 AM"
}

export function computeAvailableSlots(params: {
  businessHours: BusinessHours
  appointmentDurationMinutes: number
  existingStarts: Date[]          // From appointments.starts_at — already in UTC
  timezone: string                // IANA, e.g., 'America/New_York'
  referenceDate?: Date            // Default: now (for testing)
}): SlotWindow[] {
  const { businessHours, appointmentDurationMinutes, existingStarts, timezone, referenceDate } = params
  const now = referenceDate ?? new Date()

  // Convert existing appointment starts to Set of ISO strings (UTC) for fast lookup
  const bookedUtcSet = new Set(existingStarts.map(d => d.toISOString()))

  const slots: SlotWindow[] = []
  const nowInTz = toZonedTime(now, timezone)

  let businessDaysFound = 0
  let dayOffset = 0

  while (businessDaysFound < DAYS_AHEAD && dayOffset < 14) {
    const candidateInTz = addMinutes(startOfDay(nowInTz), dayOffset * 1440)
    const dayKey = DAY_KEYS[candidateInTz.getDay()]
    const dayConfig = businessHours[dayKey]

    if (dayConfig.enabled) {
      // Parse open/close times in contractor's timezone
      const [openH, openM] = dayConfig.open.split(':').map(Number)
      const [closeH, closeM] = dayConfig.close.split(':').map(Number)

      // Build slot start in contractor's local time
      let slotStartInTz = new Date(candidateInTz)
      slotStartInTz.setHours(openH, openM, 0, 0)
      const dayCloseInTz = new Date(candidateInTz)
      dayCloseInTz.setHours(closeH, closeM, 0, 0)

      // Skip past slots (don't offer slots that have already passed today)
      while (slotStartInTz < nowInTz) {
        slotStartInTz = addMinutes(slotStartInTz, appointmentDurationMinutes)
      }

      while (addMinutes(slotStartInTz, appointmentDurationMinutes) <= dayCloseInTz) {
        // Convert to UTC for DB comparison
        const slotStartUtc = fromZonedTime(slotStartInTz, timezone)
        const slotEndUtc = addMinutes(slotStartUtc, appointmentDurationMinutes)

        if (!bookedUtcSet.has(slotStartUtc.toISOString())) {
          slots.push({
            startsAt: slotStartUtc,
            endsAt: slotEndUtc,
            label: format(slotStartInTz, "EEEE MMMM d 'at' h:mm a", { timeZone: timezone }),
          })
        }
        slotStartInTz = addMinutes(slotStartInTz, appointmentDurationMinutes)
      }

      businessDaysFound++
    }
    dayOffset++
  }

  return slots
}
```

**Timezone correctness checklist:**
1. All slot boundaries generated in contractor's IANA timezone (`America/New_York` default)
2. Converted to UTC via `fromZonedTime()` before DB comparison and storage
3. `appointments.starts_at` stored as TIMESTAMPTZ (UTC) in Supabase
4. `format()` from date-fns-tz with explicit `timeZone` option for human-readable labels

**date-fns-tz v3 API note:** v3 changed `zonedTimeToUtc` → `fromZonedTime` and `utcToZonedTime` → `toZonedTime`. The project already has v3.2.0. The `format` function from `date-fns-tz` accepts a `timeZone` option for formatting in a specific timezone without needing conversion. [VERIFIED: npm registry — date-fns-tz@3.2.0]

---

## System Prompt Slot Injection

### Existing Prompt Structure (verified from codebase)

[VERIFIED: `src/lib/retell/system-prompt.ts` — read directly]

The existing `buildSystemPrompt(settings: ContractorSettings): string` function produces a multi-section prompt. Phase 4 extends this function's signature to accept an optional `availableSlots: string[]` parameter.

```typescript
// Extended signature for src/lib/retell/system-prompt.ts
export function buildSystemPrompt(
  settings: ContractorSettings,
  availableSlots?: string[]  // e.g., ["Tuesday May 12 at 10:00 AM", "Tuesday May 12 at 2:00 PM", ...]
): string {
  // ... existing content ...

  // Append slot section only when slots are provided (no calendar = prompt unchanged)
  const slotSection = availableSlots && availableSlots.length > 0
    ? `\n\nScheduling:\nYou can book estimate appointments. Available slots for the next 5 business days:\n${availableSlots.map(s => `- ${s}`).join('\n')}\nWhen a caller wants to book, confirm the slot by saying: "I've booked you for [slot]. Our team will arrive at your address." Then ask for their service address to complete the booking.`
    : `\n\nScheduling:\nAppointment booking is not currently configured. If a caller requests scheduling, say: "I'll note your preferred timing and our team will call you back to confirm a time."`

  return `${existingPromptContent}${slotSection}`.trim()
}
```

**Format recommendation (D-07 / Specifics):**

The CONTEXT.md Specifics section provides the intended format: `"Available appointment slots: Tuesday May 12 at 10:00 AM, Tuesday May 12 at 2:00 PM..."`. For Retell agent conversational flow, presenting slots as a bulleted list in the system prompt (not a comma list) is clearer for the LLM to recite naturally. The Retell LLM reads the system prompt and generates natural language — a bullet list helps it enumerate options clearly. [ASSUMED — based on Retell prompt engineering best practice; verify against Phase 2 system prompt patterns]

**System prompt rebuild trigger (D-08):**

After each appointment INSERT, emit `retell/agent.sync` event to trigger `retell-agent-sync`. This requires reading updated slot list before building the prompt. The `update-agent` route already does this for settings changes; for appointment changes, the Inngest function emits the sync event:

```typescript
// Inside retell-call-classify, after appointment step:
await step.sendEvent('trigger-agent-sync', {
  name: 'retell/agent.sync',
  data: {
    contractorId,
    llmId,           // Must be loaded at start of function
    compiledPrompt,  // Must recompute slots BEFORE sending this event
    beginMessage,
  },
})
```

**Important:** Computing the updated slot list and building the compiled prompt must happen INSIDE the same Inngest step before `step.sendEvent()` is called. This requires loading `contractor_settings`, computing slots (minus the newly booked one), and building the full prompt — all within the Inngest function after the appointment is created.

---

## GPT-4o Extraction Schema Extension

### Current Schema Structure (verified from codebase)

[VERIFIED: `src/lib/classification/extract-trade.ts` — read directly]

All four schemas (`HvacSchema`, `PlumbingSchema`, `ElectricalSchema`, `GeneralSchema`) use `z.object()` with `.nullish()` for optional fields. The `zodResponseFormat` from `openai/helpers/zod` is used with each schema.

### Extended Schemas (D-11)

```typescript
// Two new fields added to ALL four schemas:
const appointmentFields = {
  confirmed_appointment_time: z.string().nullish(),
  // ISO datetime string e.g. "2026-05-12T10:00:00" — what agent confirmed during call
  // null if no appointment was booked in this call

  service_address: z.string().nullish(),
  // Full address or intersection as spoken by caller
  // null if caller did not provide
}

// Extended HvacSchema example:
const HvacSchema = z.object({
  system_age: z.string().nullish(),
  issue_type: z.enum(['heating', 'cooling', 'other']),
  urgency: z.enum(['normal', 'urgent', 'emergency']),
  ...appointmentFields,
})
```

**Extraction prompt extension:**

The existing prompt instructs the LLM to fill in only what was explicitly stated. Two new instructions must be added:

```
If the agent confirmed an appointment time during the call, extract it as confirmed_appointment_time in ISO format (YYYY-MM-DDTHH:MM:SS) using the contractor's local time. If no appointment was confirmed, return null.

If the caller provided a service address, extract it as service_address. Include street number, street name, city if mentioned. If not provided, return null.
```

**OpenAI structured output constraint:** All fields in Zod schemas passed to `zodResponseFormat` must be either required or `.nullish()` (which maps to `nullable: true, required: true` in JSON Schema). Regular `.optional()` is not supported. Both new fields use `.nullish()` — consistent with existing pattern. [VERIFIED: Phase 3 extract-trade.ts code comment and OpenAI structured outputs docs]

**Datetime format risk:** The LLM produces `confirmed_appointment_time` as a string. The extraction prompt must specify ISO format. Validate the string before passing to `new Date()` — invalid datetime from LLM should result in no appointment creation, not a crash. Parse check: `!isNaN(Date.parse(time))`.

---

## Google Calendar Event Creation

### events.insert Payload (verified)

[VERIFIED: developers.google.com/calendar/api/v3/reference/events/insert]

```typescript
// Inside retell-call-classify Inngest step
const calendarClient = await getCalendarClient(contractorId)

if (calendarClient) {
  const response = await calendarClient.events.insert({
    calendarId: creds.calendar_id ?? 'primary',  // 'primary' for the user's default calendar
    sendUpdates: 'none',  // Do NOT email attendees (avoid spam for estimate bookings)
    requestBody: {
      summary: `${settings.business_name} — Estimate`,
      description: [
        `Caller: ${lead.caller_name ?? 'Unknown'} (${lead.caller_phone})`,
        `Service: ${lead.service_requested ?? 'General'}`,
        `Address: ${appointment.service_address ?? 'TBD'}`,
        `Booked via VoiceDesk`,
      ].filter(Boolean).join('\n'),
      start: {
        dateTime: appointment.starts_at,  // UTC ISO string, e.g., "2026-05-12T14:00:00Z"
        timeZone: contractor.timezone,     // IANA, e.g., "America/New_York"
      },
      end: {
        dateTime: appointment.ends_at,
        timeZone: contractor.timezone,
      },
    },
  })
  // response.data.id is the Google Calendar event ID
  googleEventId = response.data.id
}
```

**Required fields:** Only `start` and `end` are required. `summary` and `description` are optional but strongly recommended for contractor UX. [VERIFIED: Google Calendar API reference]

**`sendUpdates: 'none'`** — Critical. Without this, Google sends calendar invitation emails to any attendee. Since we don't add attendees, this is a defensive default. [ASSUMED based on Google Calendar API docs behavior — set explicitly to prevent accidental emails]

### Error Handling

[VERIFIED: developers.google.com/workspace/calendar/api/guides/errors]

| Error | Code | Retry Strategy | Phase 4 Action |
|-------|------|----------------|----------------|
| Invalid credentials (expired token) | 401 | Non-retriable per error | Inngest retry will call `getCalendarClient()` which refreshes token — effectively auto-resolves |
| User rate limit exceeded | 403 | Exponential backoff | Inngest default backoff handles this — let retries proceed |
| Rate limit exceeded | 429 | Exponential backoff | Same as 403 — Inngest backoff |
| Backend error | 500 | Exponential backoff | Inngest backoff |
| Conflict (event ID collision) | 409 | Partial retry | Not applicable — we don't provide event IDs; Google generates them |

**Google Calendar 409 context:** In the Calendar API, 409 Conflict applies to batch operations where two batched items conflict. For `events.insert` with a server-generated ID (no `id` in requestBody), 409 does not occur. The `sendUpdates:'none'` prevents attendee email conflicts. [VERIFIED: Google Calendar API errors guide]

**Error catch pattern:**
```typescript
try {
  const response = await calendarClient.events.insert({ ... })
  googleEventId = response.data.id ?? null
} catch (err: unknown) {
  const status = (err as { code?: number }).code
  if (status === 401) {
    // Token was invalid even after refresh attempt — will retry via Inngest
    throw err
  }
  if (status === 403 || status === 429) {
    // Rate limit — Inngest backoff will handle
    throw err
  }
  // All other errors — throw and let Inngest retry
  throw err
}
```

---

## UNIQUE Constraint Conflict Handling

### PostgreSQL Error Code in Supabase JS Client

[VERIFIED: multiple sources + PostgreSQL documentation]

When `appointments` INSERT violates UNIQUE(contractor_id, starts_at), the Supabase JS client returns:
```typescript
{
  data: null,
  error: {
    code: '23505',          // PostgreSQL UNIQUE violation error code
    message: 'duplicate key value violates unique constraint "appointments_contractor_id_starts_at_key"',
    details: 'Key (contractor_id, starts_at)=(...) already exists.',
    hint: null,
  }
}
```

**Detection and retry pattern (D-10):**

```typescript
// Inside retell-call-classify Inngest step
await step.run('create-appointment', async () => {
  const db = createServiceRoleClient()

  const { data, error } = await db.from('appointments').insert({
    contractor_id: contractorId,
    lead_id: lead.id,
    call_id: callId,
    starts_at: appointmentStartUtc,
    ends_at: appointmentEndUtc,
    service_address: tradeData.service_address ?? null,
    google_sync_status: 'pending',
    booking_conflict: false,
  }).select('id').maybeSingle()

  if (error) {
    if (error.code === '23505') {
      // D-10: UNIQUE violation — slot already taken. Create with booking_conflict = true.
      const { data: conflicted, error: conflictErr } = await db.from('appointments').insert({
        contractor_id: contractorId,
        lead_id: lead.id,
        call_id: callId,
        starts_at: appointmentStartUtc,
        // booking_conflict = true CANNOT reuse same starts_at due to UNIQUE constraint
        // IMPORTANT: The conflict row cannot share starts_at with the winner.
        // Solution: Store the requested starts_at in notes/metadata; DO NOT insert duplicate starts_at.
        // The second appointment is NOT created as a duplicate row — instead, mark the LEAD as conflicted.
        // See: Implementation Risk #3 below.
      })
      // ... see Implementation Risks for the correct approach
    }
    throw new Error(`appointments insert failed: ${error.message}`)
  }

  return data
})
```

**CRITICAL DESIGN ISSUE — D-10 cannot work as described:**

The CONTEXT.md D-10 states "create the appointment row anyway with `booking_conflict = true`". However, the `appointments` table has `UNIQUE(contractor_id, starts_at)`. You cannot insert two rows for the same contractor and `starts_at`, even if one has `booking_conflict = true`.

**Correct implementation of D-10:** When `error.code === '23505'`:
1. Do NOT attempt a second INSERT with the same `starts_at`
2. Instead: update the existing winning appointment's `notes` to add "conflict: second caller attempted this slot" (optional)
3. Set the LEAD record's status to `'new'` (not `'booked'`) and add a note in `leads.notes`: "Booking conflict — slot [time] already taken. Call back caller."
4. Set `google_sync_status = 'skipped'` on the lead (no appointment row for the conflicted caller)
5. The portal shows the lead as `'new'` with the conflict note — Phase 6 contractor sees it

Alternatively, add a `booking_conflict` column to the **`leads`** table instead of `appointments`. This is architecturally cleaner: the appointment table has the winner, the leads table records the conflict.

**Recommendation:** Add `booking_conflict BOOLEAN NOT NULL DEFAULT false` to `leads`, not `appointments`. The migration should be adjusted accordingly. The planner should resolve this architectural issue. [VERIFIED gap: UNIQUE constraint makes D-10's "create appointment with booking_conflict=true" impossible on the same starts_at]

---

## Inngest Function Extension Strategy

### Pattern: Extend vs. Chain

[VERIFIED: Inngest docs — step.run(), step.sendEvent(), multi-step functions]

**Decision: Extend `retell-call-classify` with four new sequential steps.**

Reasons:
1. Steps 5-8 (lead creation, appointment creation, Calendar event, agent sync) are causally dependent on steps 1-4 (classification and extraction). Chaining via event adds latency (new event dispatch, scheduling overhead).
2. Inngest `step.run()` is idempotent — each step is memoized. If the function fails on step 6 (Calendar event), steps 1-5 are not re-run on retry. This is exactly the right behavior.
3. `step.sendEvent()` for the agent sync (D-08) is the right pattern because `retell-agent-sync` is a separate function with its own retry budget.

### Extended Function Steps

```
Step 1: check-hard-emergency      (existing)
Step 2: classify-intent           (existing)
Step 3: extract-trade-data        (existing — extended schema)
Step 4: persist-classification    (existing)
Step 5: create-lead               (NEW — conditional per D-12)
Step 6: create-appointment        (NEW — conditional: only if confirmed_appointment_time non-null)
Step 7: create-calendar-event     (NEW — conditional: only if calendar connected)
Step 8: trigger-agent-sync        (NEW — step.sendEvent to retell/agent.sync)
```

### Step 5: Create Lead

```typescript
const lead = await step.run('create-lead', async () => {
  const shouldCreate =
    finalIntent === 'lead' ||
    finalIntent === 'emergency' ||
    (finalIntent === 'info' && (durationMs ?? 0) / 1000 >= 15)

  if (!shouldCreate) return null

  const db = createServiceRoleClient()
  const hasAppointment = !!tradeData?.confirmed_appointment_time
  const { data, error } = await db.from('leads').insert({
    contractor_id: contractorId,
    call_id: callId,
    caller_name: call.caller_name ?? null,  // loaded from calls row
    caller_phone: call.caller_phone ?? '',
    service_requested: tradeData?.issue_description ?? tradeData?.repair_type ?? null,
    urgency: tradeData?.urgency ?? 'normal',
    status: hasAppointment ? 'booked' : 'new',
    notes: tradeData?.service_address ? `Service address: ${tradeData.service_address}` : null,
  }).select('id').maybeSingle()

  if (error) throw new Error(`leads insert failed: ${error.message}`)
  return data
})
```

### Step 8: Trigger Agent Sync

```typescript
// After appointment is created, recompute slots and trigger system prompt rebuild
await step.sendEvent('trigger-agent-sync', {
  name: 'retell/agent.sync',
  data: {
    contractorId,
    llmId: contractor.retell_llm_id,
    compiledPrompt: buildSystemPrompt(settings, updatedSlotLabels),
    beginMessage: buildBeginMessage(settings),
  },
})
```

`step.sendEvent()` is memoized — on Inngest retry, the event is not sent twice. [VERIFIED: Inngest docs step.sendEvent memoization]

---

## Migration SQL

### Phase 4 Migration File

[VERIFIED: existing schema from `supabase/migrations/20260504000001_initial_schema.sql` + `20260508000007_webhook_core.sql` pattern]

```sql
-- Phase 4 migration: scheduling & lead capture additions
-- Adds: appointment_duration_minutes to contractor_settings
--       google_sync_status to appointments
--       booking_conflict to leads (NOT appointments — see UNIQUE constraint analysis)
-- RLS: new columns on existing tables are automatically covered by existing policies.
--      No new policies needed.

-- 1. Add appointment duration to contractor_settings (D-06)
ALTER TABLE contractor_settings
  ADD COLUMN IF NOT EXISTS appointment_duration_minutes INT NOT NULL DEFAULT 120;

COMMENT ON COLUMN contractor_settings.appointment_duration_minutes IS
  'D-06: default 2 hours. Configurable in Phase 6 portal (60/90/120/180 min options).';

-- 2. Add Google Calendar sync status to appointments (D-14)
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS google_sync_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (google_sync_status IN (''pending'',''synced'',''failed'',''skipped''));

COMMENT ON COLUMN appointments.google_sync_status IS
  'D-14: pending (created) → synced (google_event_id written) → failed (retries exhausted) → skipped (no calendar connected).';

-- 3. Add booking conflict flag to leads (D-10 — see UNIQUE constraint analysis in RESEARCH.md)
--    NOT added to appointments — UNIQUE(contractor_id, starts_at) prevents duplicate rows.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS booking_conflict BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN leads.booking_conflict IS
  'D-10: true when the requested appointment slot was already booked. Contractor calls back this lead. Phase 6 shows conflict leads prominently.';
```

**Note on D-10 column placement:** The CONTEXT.md says `booking_conflict` goes on `appointments`. Research has identified this is architecturally impossible with the UNIQUE constraint. The migration above places it on `leads`. The planner MUST resolve this discrepancy before writing plans — it requires either (a) keeping `booking_conflict` on `leads` as above, or (b) dropping the constraint on UNIQUE(contractor_id, starts_at) which would break D-09. Option (a) is correct. [VERIFIED gap — see UNIQUE Constraint section]

**ENV vars needed (add to .env.example):**
```
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_REDIRECT_URI=https://yourapp.com/api/auth/google/callback
```

---

## Security Considerations

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes — OAuth2 code flow | State param + httpOnly cookie (D-02); verify cookie on callback before any DB write |
| V3 Session Management | Partial — state cookie | `httpOnly: true, secure: true (production), sameSite: 'lax', maxAge: 600` |
| V4 Access Control | Yes | OAuth callback: verify `user.id` from JWT before writing to `calendar_credentials`; never accept `contractor_id` from URL params |
| V5 Input Validation | Yes | Validate `confirmed_appointment_time` from LLM with `Date.parse()` before use; validate `state` param is exact match before code exchange |
| V6 Cryptography | Yes — OAuth tokens | AES-256-GCM via `encryptToken()`/`decryptToken()` (Phase 1 utility); never store plaintext tokens |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CSRF on OAuth callback | Spoofing | State param + httpOnly cookie verification (D-02) |
| Plaintext OAuth token in DB | Information disclosure | AES-256-GCM encryption (Phase 1 utility — enforce on every write) |
| `contractor_id` from URL param | Elevation of privilege | Always derive from `user.id` JWT; never from request body or query string |
| LLM injection in `confirmed_appointment_time` | Tampering | Validate with `Date.parse()` + regex before use; reject if invalid |
| Token leak via logs | Information disclosure | Never log `access_token`, `refresh_token`, or decrypted values; log only `contractor_id` and operation name |
| Stale refresh token (testing mode expiry) | Auth failure | Google OAuth testing mode expires tokens after 7 days — MUST move to production mode before beta. See STATE.md blocker. |

### OAuth Cookie Security — Next.js 16.x

[VERIFIED: nextjs.org/docs/app/api-reference/functions/cookies — version 16.2.6 docs read directly]

In Next.js 15+, `cookies()` is **async** — must `await cookies()` before calling `.set()` or `.get()`. The project is on Next.js 16.2.4 — this is confirmed correct.

```typescript
// Correct pattern (Next.js 15+):
const cookieStore = await cookies()
cookieStore.set('oauth_state', state, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 600,
  path: '/',
})
```

**`sameSite: 'lax'`** (not `'strict'`) is correct for OAuth redirects. Google redirects back to the callback URL — if `sameSite: 'strict'`, the browser will NOT send the cookie on this cross-site redirect, breaking state verification. `'lax'` allows cookies on top-level navigation (redirects) while blocking cross-site POST. [VERIFIED: MDN SameSite cookie docs behavior]

---

## Implementation Risks & Landmines

### Risk 1: `prompt: 'consent'` Missing on Re-auth

**What goes wrong:** If a contractor's Google Calendar connection breaks (e.g., revoked by user) and they reconnect, `getToken()` returns `refresh_token: null` unless `prompt: 'consent'` is included in `generateAuthUrl()`. The `calendar_credentials.refresh_token` column is NOT NULL — the upsert will fail or store an encrypted empty string.

**Prevention:** Always include `prompt: 'consent'` in `generateAuthUrl()`. This is in the code example above. The planner must verify this is never omitted. [VERIFIED: Google OAuth2 docs behavior]

### Risk 2: `expiry_date` Unit Mismatch

**What goes wrong:** `tokens.expiry_date` from `getToken()` is milliseconds since epoch. Developers who expect seconds (matching Unix timestamps) will compute wrong expiry comparisons. E.g., `expiry_date = 1746750000000` ms = May 2025. `new Date(1746750000)` ms = Jan 1970.

**Prevention:** Always use `new Date(tokens.expiry_date).toISOString()` for storage. When reading back, use `new Date(row.token_expiry).getTime()` for ms comparison. Both conversions are in the code examples above. [VERIFIED: google-auth-library source + expiry_date definition]

### Risk 3: D-10 Architectural Conflict (BLOCKER)

**What goes wrong:** CONTEXT.md D-10 says "create the appointment row anyway with `booking_conflict = true`". The `appointments` table has `UNIQUE(contractor_id, starts_at)`. Inserting a second row with the same `starts_at` is impossible regardless of any other column value.

**Prevention:** The migration must place `booking_conflict` on `leads`, not `appointments`. The planner must acknowledge this deviation from CONTEXT.md and document it. The behavior is equivalent: the losing call's lead record is marked `booking_conflict = true`, the contractor calls back that person. [VERIFIED: schema inspection — UNIQUE constraint confirmed]

### Risk 4: LLM Datetime Timezone Ambiguity

**What goes wrong:** The GPT-4o extraction prompt asks for `confirmed_appointment_time` as an ISO datetime. The LLM may produce:
- `"2026-05-12T10:00:00"` — no timezone (ambiguous)
- `"2026-05-12T10:00:00-04:00"` — with offset (correct but must be handled)
- `"2026-05-12T10:00:00Z"` — UTC (likely wrong — the confirmed time is in contractor's local timezone)

**Prevention:** The extraction prompt must instruct: "Express confirmed_appointment_time in the contractor's local time without timezone offset (e.g., 2026-05-12T10:00:00). Do NOT include a timezone suffix." Then in code: treat the extracted string as contractor-local time and convert to UTC with `fromZonedTime(new Date(extracted), contractor.timezone)` before storing. [ASSUMED — extraction prompt instruction; LLM compliance not guaranteed; validate and reject if parse fails]

### Risk 5: `retell-agent-sync` requires `llmId`

**What goes wrong:** Triggering `retell/agent.sync` from inside `retell-call-classify` requires `contractor.retell_llm_id`. The current `retell-call-classify` function receives only `callId, contractorId, transcriptText, durationMs` in its event payload — it does NOT load the contractor's `retell_llm_id` or `contractor_settings`.

**Prevention:** Phase 4 extension must load the contractor record and settings at the start of the function (or in a new early step). Load `contractors` joined to `contractor_settings` by `contractorId` at step start. This load is needed for: building the updated system prompt (slot list), getting `retell_llm_id`, and getting `timezone` for slot computation. [VERIFIED: reviewing `retell-call-classify.ts` — no contractor load currently exists]

### Risk 6: `from()` Versus `fromZonedTime()` in date-fns-tz v3

**What goes wrong:** date-fns-tz v3 renamed core functions. Using v2 function names (`zonedTimeToUtc`, `utcToZonedTime`) causes import errors. The project has v3.2.0.

**Prevention:** Use v3 names: `fromZonedTime()` (local→UTC), `toZonedTime()` (UTC→local), and `format()` from `date-fns-tz` (not `date-fns`) with `{ timeZone }` option. [VERIFIED: npm view date-fns-tz — v3.2.0 confirmed in package.json]

### Risk 7: Google OAuth App in Testing Mode

**What goes wrong:** Google OAuth apps in "Testing" mode issue refresh tokens that expire after **7 days**. After 7 days, any API call returns `invalid_grant` and the contractor must reconnect. This is a silent failure in production — the contractor's calendar stops syncing with no obvious error.

**Prevention:** This is listed as a blocker in STATE.md. Before Phase 4 ships, the Google OAuth app must be moved to Production mode. This requires the restricted scope verification process (~3-8 weeks per CASA Tier 2 timeline). Begin this process immediately. [VERIFIED: STATE.md blocker + Google OAuth testing mode docs]

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run tests/lib/scheduling.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCHED-01 | `computeAvailableSlots()` returns correct slots for 5 business days | unit | `npx vitest run tests/lib/scheduling.test.ts` | Wave 0 |
| SCHED-01 | Slot computation excludes already-booked `starts_at` times | unit | `npx vitest run tests/lib/scheduling.test.ts` | Wave 0 |
| SCHED-02 | Slots respect `business_hours.enabled: false` days (weekend skip) | unit | `npx vitest run tests/lib/scheduling.test.ts` | Wave 0 |
| SCHED-02 | Slots respect `appointment_duration_minutes` step size | unit | `npx vitest run tests/lib/scheduling.test.ts` | Wave 0 |
| SCHED-03 | `extractTradeData()` with extended schema returns `confirmed_appointment_time` and `service_address` | unit | `npx vitest run tests/lib/classification.test.ts` | extends existing |
| SCHED-03 | Null `confirmed_appointment_time` → no appointment created | unit | `npx vitest run tests/lib/classification.test.ts` | Wave 0 |
| SCHED-04 | UNIQUE constraint violation (23505) is caught and leads to `booking_conflict: true` on lead | unit | `npx vitest run tests/lib/booking.test.ts` | Wave 0 |
| SCHED-01 | Lead is created for `intent='lead'` calls | unit | `npx vitest run tests/lib/leads.test.ts` | Wave 0 |
| SCHED-01 | Lead status is `'booked'` when `confirmed_appointment_time` non-null | unit | `npx vitest run tests/lib/leads.test.ts` | Wave 0 |
| SCHED-01 | `google_sync_status='skipped'` when no calendar connected | unit | `npx vitest run tests/lib/booking.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/lib/scheduling.test.ts tests/lib/classification.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/lib/scheduling.test.ts` — slot computation unit tests (pure function, no DB)
- [ ] `tests/lib/booking.test.ts` — appointment creation, conflict detection, `google_sync_status` states
- [ ] `tests/lib/leads.test.ts` — lead creation rules, status assignment
- [ ] `tests/lib/oauth.test.ts` — token refresh logic, expiry buffer detection (mock googleapis)

---

## Sources

### Primary (HIGH confidence)
- [googleapis.dev/nodejs/googleapis/latest](https://googleapis.dev/nodejs/googleapis/latest/index.html) — OAuth2 flow, generateAuthUrl, getToken, refreshAccessToken
- [developers.google.com/calendar/api/v3/reference/events/insert](https://developers.google.com/calendar/api/v3/reference/events/insert) — events.insert payload, required fields, scope requirements
- [developers.google.com/workspace/calendar/api/guides/errors](https://developers.google.com/workspace/calendar/api/guides/errors) — error codes 401, 403, 409, 429, 500
- [developers.google.com/workspace/calendar/api/auth](https://developers.google.com/workspace/calendar/api/auth) — scope definitions, restricted scope requirements
- [nextjs.org/docs/app/api-reference/functions/cookies](https://nextjs.org/docs/app/api-reference/functions/cookies) — cookies() async API, set options, sameSite
- [googleapis.dev/nodejs/google-auth-library/latest/classes/OAuth2Client.html](https://googleapis.dev/nodejs/google-auth-library/latest/classes/OAuth2Client.html) — refreshAccessToken signature, Credentials interface with expiry_date
- Codebase inspection: `src/lib/crypto/tokens.ts`, `src/lib/retell/system-prompt.ts`, `src/lib/classification/extract-trade.ts`, `src/inngest/functions/retell-call-classify.ts`, `supabase/migrations/20260504000001_initial_schema.sql`
- Context7: `/websites/googleapis_dev_nodejs_googleapis` — OAuth2 flow, Calendar client, step.sendEvent

### Secondary (MEDIUM confidence)
- [developers.google.com/identity/protocols/oauth2/web-server#node.js_3](https://developers.google.com/identity/protocols/oauth2/web-server#node.js_3) — prompt:'consent' for refresh token on re-auth
- PostgreSQL error code 23505 — UNIQUE violation code (multiple sources corroborate)
- Inngest docs — step.sendEvent memoization, multi-step function patterns

### Tertiary (LOW confidence / ASSUMED)
- Retell system prompt slot list format (bullet list vs. comma list effectiveness)
- Race condition risk level for concurrent token refresh (assessed as LOW based on usage patterns)
- LLM compliance with datetime format instructions in extraction prompt

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Refresh-on-use race condition probability is LOW (two concurrent calls for same contractor within 5-minute window is unlikely) | Token Storage & Refresh | If race occurs, second request gets `invalid_grant`; Inngest retry resolves it. Low impact. |
| A2 | Bullet list format in system prompt works better than comma list for Retell LLM slot enumeration | System Prompt Injection | Agent may recite slots awkwardly. Can be tuned post-Phase 4 without schema changes. |
| A3 | GPT-4o will comply with "no timezone suffix" instruction in datetime extraction | GPT-4o Schema Extension | LLM may add 'Z' or offset. Mitigation: strip trailing 'Z' and parse as local time. Code must handle both forms. |
| A4 | `sendUpdates: 'none'` on events.insert prevents accidental calendar emails | Calendar Event Creation | If wrong, attendees get invited. No attendees are added so this is moot — but defensive. |

---

## Open Questions (RESOLVED)

1. **D-10 Resolution Required** *(RESOLVED: booking_conflict placed on `leads` table)*
   - What we know: `appointments` UNIQUE(contractor_id, starts_at) prevents two rows with the same slot. `booking_conflict` on `appointments` is impossible.
   - Resolution: `booking_conflict BOOLEAN NOT NULL DEFAULT false` added to `leads` table in Phase 4 migration. On 23505 UNIQUE violation in `create-appointment` step, the losing caller's lead is updated with `booking_conflict=true, status='new'`. Appointment table unaffected. Plans 01 (migration) and 05 (Inngest step) implement this.

2. **Google OAuth app production mode timeline** *(RESOLVED: Phase 4 ships in testing mode; production mode initiated in parallel)*
   - What we know: Moving to production mode requires CASA Tier 2 security assessment (3-8 weeks per official docs)
   - Resolution: Phase 4 ships to internal/beta users in testing mode (accepting 7-day token expiry limitation). Production mode verification process must be initiated immediately when Phase 4 ships to beta. STATE.md blocker documents this constraint.

3. **`retell-call-classify` event payload extension for contractor data** *(RESOLVED: load-contractor step added as step 0)*
   - What we know: The current function receives only `callId, contractorId, transcriptText, durationMs`. Phase 4 needs `retell_llm_id`, `contractor.timezone`, and `contractor_settings` for slot computation and agent sync trigger.
   - Resolution: Plan 05 Task 1 adds a `step.run('load-contractor')` as the first step that loads `contractors` joined to `contractor_settings(*)` by `contractorId`. Result is available to all subsequent steps via closure. Event payload remains minimal.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `googleapis` npm package | OAuth2 + Calendar API | No — not installed | 171.4.0 (latest) | No fallback; must install in Wave 0 |
| `GOOGLE_CLIENT_ID` env var | OAuth initiation | Unknown | — | Must be added to `.env.example` and Vercel env |
| `GOOGLE_CLIENT_SECRET` env var | OAuth initiation | Unknown | — | Must be added |
| `GOOGLE_REDIRECT_URI` env var | OAuth callback | Unknown | — | Must be added |
| Supabase live DB | Migration push | Available (Phase 3 confirmed live) | — | — |
| Inngest | Background jobs | Available (installed, registered) | ^4.3.0 | — |
| `date-fns-tz` | Slot computation | Available | 3.2.0 | — |

**Missing dependencies with no fallback:**
- `googleapis` — must be `npm install googleapis` in Wave 0
- Three new env vars (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI) — must be configured before any OAuth route can function

**Missing dependencies with fallback:**
- None

---

## Metadata

**Confidence breakdown:**
- OAuth2 flow: HIGH — verified against official googleapis docs and Google OAuth2 web server guide
- Token storage pattern: HIGH — expiry_date unit and refreshAccessToken signature verified against google-auth-library docs
- Slot computation algorithm: MEDIUM — algorithm design is original; date-fns-tz v3 API verified; timezone correctness logic is sound
- Inngest extension strategy: HIGH — step.sendEvent memoization and multi-step patterns verified
- D-10 conflict resolution: HIGH — UNIQUE constraint verified in schema; architectural issue is definitive
- System prompt injection: MEDIUM — format recommendation is assumed; Retell LLM behavior with bullet lists not externally verified
- Migration SQL: HIGH — follows established Phase 3 migration pattern exactly

**Research date:** 2026-05-08
**Valid until:** 2026-06-08 (30 days — googleapis and Calendar API are stable; cookie API is stable in Next.js 16)

## RESEARCH COMPLETE

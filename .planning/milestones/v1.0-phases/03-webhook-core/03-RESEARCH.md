# Phase 3: Webhook Core — Research

**Researched:** 2026-05-08
**Domain:** Retell AI webhooks, OpenAI structured output, Vercel `after()`, Inngest scheduled jobs, after-hours detection
**Confidence:** HIGH (all critical paths verified against installed SDK types and live docs)

---

## Summary

Phase 3 wires the product engine: a single webhook route at `/api/webhooks/retell` receives `call_ended` and `call_analyzed` events from Retell AI, persists call data to Supabase with a two-stage enrichment lifecycle (`analyzing` → `complete`), and classifies intent using a two-call OpenAI pipeline. All confirmed from Retell SDK v5.18 type definitions and official Vercel/Inngest documentation.

The most critical implementation detail — confirmed from the installed `retell-sdk@5.18.0` type definitions — is that the webhook payload's call analysis field is named **`call_analysis`** (a nested object), not a flat `summary` field. Within that object the summary is **`call_summary`**. The transcript is returned as both a plain string (`transcript`) and a structured array (`transcript_object`). Duration is **`duration_ms`** (milliseconds), not seconds.

The project is on Next.js 16.2.4, which ships `after()` from `next/server`. Vercel docs explicitly recommend using `after()` over `@vercel/functions`'s `waitUntil()` for Next.js 15.1+. Since `@vercel/functions` is not installed and Next.js 16 includes `after()`, the webhook handler should use `import { after } from 'next/server'`. The OpenAI npm package is not yet installed — Wave 0 must add `openai` and `date-fns-tz` to package.json.

**Primary recommendation:** Implement the webhook handler using `after()` from `next/server`, verify signatures with the SDK's named export `verify` from `retell-sdk`, store `transcript_object` (structured array) in `calls.transcript`, and store `call_analysis.call_summary` in `calls.summary`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Single route `/api/webhooks/retell` dispatches by `event.event_type` (both `call_ended` and `call_analyzed`).
- **D-02:** `call_ended` creates skeleton row: caller phone, duration, timestamp, `analysis_status='analyzing'`, `status='completed'`.
- **D-03:** `analysis_status` column (new migration): `pending` (DB default) → `analyzing` (call_ended) → `complete` (call_analyzed) → `analysis_failed` (Inngest timeout).
- **D-04:** Inngest 30-minute scheduled job marks stale `analyzing` rows as `analysis_failed`.
- **D-05:** Idempotency via `UPSERT` on `calls.retell_call_id` (UNIQUE constraint). Not via `webhook_events` table.
- **D-06:** Hard-coded emergency keywords checked first (EN/ES), result cannot be overridden by LLM.
- **D-07:** LLM classifies after hard-code check across all three intent tiers.
- **D-08:** Two sequential LLM calls: GPT-4o-mini (classification) → GPT-4o (extraction).
- **D-09:** Retell `call_analysis.call_summary` stored in `calls.summary` as-is.
- **D-10:** Trade-specific extraction schemas per `contractor_settings.trade_type`.
- **D-11:** After-hours detection: pure timestamp comparison to `business_hours` JSONB in `call_ended` handler.
- **D-12:** Intent enum values match Phase 1 schema: `lead`, `emergency`, `info`, `no_action`, `unknown`.
- **D-13:** Short calls (< 15s) still run LLM with `is_short_call: true` context.
- **D-14:** `info` calls with duration ≥ 15s get leads row (Phase 4 deliverable — Phase 3 sets intent only).
- **D-15:** Migration adds `notification_settings.notify_on_general_inquiry BOOLEAN DEFAULT false`.
- **D-16:** `recording_url` stored directly from Retell payload. No download or re-upload.
- **D-17:** Recording proxy (`/api/recordings/:call_id`) is Phase 6.
- **D-18:** Supabase Realtime setup is Phase 6.
- **DeepSeek rejected:** Only OpenAI models are acceptable (PII concern — transcripts contain homeowner data).

### Claude's Discretion

- OpenAI failure handling: persist transcript/summary immediately, then queue Inngest retry for classification. Max 5 retries (exponential backoff). If exhausted, set `analysis_status='analysis_failed'`.
- Inngest classification retry job: same retry pattern as `retell-agent-sync` (5 retries, Inngest default backoff).
- Exact exponential backoff pattern: standard Inngest default (~1min, ~2min, ~4min, ~8min, ~16min).

### Deferred Ideas (OUT OF SCOPE)

- Recording proxy API `/api/recordings/:call_id` — Phase 6
- Supabase Realtime configuration — Phase 6
- Lead record creation — Phase 4
- Notification dispatch — Phase 5
- `notify_on_general_inquiry` UI checkbox — Phase 6

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CALL-01 | AI answers every inbound call within 3 rings using Retell voice AI | Retell webhook `call_ended` confirms call was answered; `in_voicemail` field in `call_analysis` object detects voicemail hits |
| CALL-02 | Agent classifies each call as lead, emergency, or general inquiry using keyword matching then LLM | D-06 hard-code check + D-07/D-08 GPT-4o-mini classification pipeline — both confirmed implementable |
| CALL-03 | Agent asks trade-specific qualification questions before capturing contact details | GPT-4o extraction call (D-08/D-10) uses trade-specific schema to extract qualification data from `transcript_object` |
| CALL-04 | Agent uses different script for after-hours calls | `is_after_hours` written in `call_ended` handler using `business_hours` JSONB comparison (D-11); Retell agent uses this flag via system prompt behavior already set in Phase 2 |
| EMRG-01 | Keyword matching + clarifying question before emergency classification | D-06/D-07: hard-code check fires first; LLM prompt instructs model to honor clarifying question result |
| EMRG-02 | Gas smell and CO alarm are hard-coded, non-overridable emergency triggers | D-06 TypeScript constants `HARD_EMERGENCY_KEYWORDS`; verified via grep scan before any LLM call |

</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

All directives are mandatory:

| Directive | Impact on Phase 3 |
|-----------|-------------------|
| RLS on every table | Phase 3 migration for `analysis_status` and `notify_on_general_inquiry` must enable RLS and add all four operation policies |
| Webhook handler returns 200 immediately | Use `after()` from `next/server`; response returns before any DB or OpenAI calls |
| Service role key never reaches browser | `createServiceRoleClient()` only in webhook route and Inngest functions |
| OAuth tokens encrypted at rest | Not applicable to Phase 3 (calendar credentials not touched) |
| Idempotency on all webhook handlers | `calls` UPSERT on `retell_call_id` UNIQUE (D-05) |
| `import 'server-only'` in all lib modules | Required in `src/lib/openai/`, `src/lib/classification/`, `src/lib/after-hours/` |
| `OPENAI_API_KEY` never has `NEXT_PUBLIC_` prefix | Enforce same pattern as `RETELL_API_KEY` |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Webhook signature verification | API route (edge of system) | — | Must happen before payload is trusted; all Retell SDK verification tooling is server-side |
| Call skeleton persistence | API route (via service client) | — | `call_ended` writes immediately to Supabase using service role; no auth session |
| Transcript + summary enrichment | Inngest (durable background job) | API route `after()` triggers it | LLM calls can take 5–15s; must not block webhook response |
| Intent classification (keyword + LLM) | Inngest step | — | Retriable on failure; LLM calls must be idempotent steps |
| After-hours detection | API route `call_ended` handler | — | Pure timestamp math; no LLM; synchronous within `after()` block |
| Analysis timeout guard | Inngest cron job | — | 30-min scheduled scan; no user session required |
| DB migration (`analysis_status`, `notify_on_general_inquiry`) | Supabase migration SQL | — | Schema changes before any handler code runs |

---

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `retell-sdk` | 5.18.0 (installed) | Webhook signature verification, call payload types | Official Retell SDK — `verify` named export handles HMAC |
| `inngest` | ^4.3.0 (installed) | Durable background jobs, analysis timeout cron | Already in use for `retell-agent-sync`; pattern established |
| `next` | 16.2.4 (installed) | `after()` for deferred processing after response | Built-in since Next.js 15.1; preferred over `@vercel/functions` per Vercel docs |
| `zod` | 4.4.2 (installed) | Webhook payload parsing, OpenAI schema definitions | Already project standard |
| `date-fns-tz` | ^3.2.0 (not installed) | Timezone conversion for after-hours detection | Explicit project dependency in CLAUDE.md stack |

### New — Must Install (Wave 0)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `openai` | ^6.1.0 (latest) | GPT-4o-mini classification + GPT-4o extraction | Only approved LLM provider (PII constraint); `zodResponseFormat` for structured output |
| `date-fns-tz` | ^3.2.0 (latest) | `toZonedTime()` for `America/New_York` business hours | Listed in CLAUDE.md stack; handles DST correctly |

**Installation (Wave 0):**
```bash
npm install openai date-fns-tz
```

**Version verification:**
```bash
npm view openai version    # 6.37.0 (verified 2026-05-08)
npm view date-fns-tz version  # 3.2.0 (verified 2026-05-08)
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `after()` from `next/server` | `waitUntil` from `@vercel/functions` | Vercel explicitly recommends `after()` for Next.js 15.1+; `@vercel/functions` not installed; `after()` confirmed available in Next.js 16.2.4 |
| OpenAI `zodResponseFormat` (structured output) | JSON mode (`response_format: { type: 'json_object' }`) | `zodResponseFormat` provides schema enforcement + type-safe `.parsed` field on response; more reliable than JSON mode for classification where field names matter |
| `date-fns-tz` `toZonedTime` | `Intl.DateTimeFormat` | `Intl` works for display; `toZonedTime` gives a manipulable Date object for arithmetic comparisons required by business hours logic |

---

## Architecture Patterns

### System Architecture Diagram

```
Retell AI Platform
       |
       | POST /api/webhooks/retell
       |   (x-retell-signature header)
       v
[webhook route]
  1. Verify signature (retell-sdk `verify`)
  2. Return HTTP 200 immediately
  3. after() {
       dispatch: call_ended  → write skeleton row + is_after_hours
       dispatch: call_analyzed → persist transcript + summary
                               → Inngest.send('retell/call.classify')
     }
       |
       +---> Supabase (calls table UPSERT)
       |
       +---> Inngest
              |
              +-- retell-call-classify (event-triggered)
              |     step 1: GPT-4o-mini classification
              |     step 2: GPT-4o trade extraction
              |     step 3: write intent + raw_metadata
              |     onFailure: set analysis_status='analysis_failed'
              |
              +-- retell-analysis-timeout (cron: every 5 min)
                    query: calls WHERE analysis_status='analyzing'
                            AND created_at < NOW() - INTERVAL '30 min'
                    update: analysis_status='analysis_failed'
```

### Recommended Project Structure

```
src/
├── app/api/webhooks/retell/
│   └── route.ts                   # POST handler — verify + after() + dispatch
├── lib/
│   ├── retell/
│   │   ├── client.ts              # (existing) getRetellClient()
│   │   └── webhook-types.ts       # Typed interfaces for call_ended / call_analyzed payloads
│   ├── openai/
│   │   └── client.ts              # OpenAI singleton (server-only, OPENAI_API_KEY guard)
│   ├── classification/
│   │   ├── emergency-keywords.ts  # HARD_EMERGENCY_KEYWORDS constants (EN/ES)
│   │   ├── classify-intent.ts     # GPT-4o-mini call → IntentResult
│   │   └── extract-trade.ts       # GPT-4o call → trade-specific extraction
│   └── after-hours/
│       └── detect.ts              # isAfterHours(callStartAt, businessHours, timezone)
├── inngest/functions/
│   ├── retell-agent-sync.ts       # (existing)
│   ├── retell-call-classify.ts    # Event-triggered: retell/call.classify
│   └── retell-analysis-timeout.ts # Cron-triggered: every 5 min
└── supabase/migrations/
    └── YYYYMMDD000007_webhook_core.sql  # analysis_status + notify_on_general_inquiry
```

### Pattern 1: Webhook Route — Verify + Return 200 + `after()`

```typescript
// Source: Retell SDK lib/webhook_auth.d.ts + Vercel docs (next/server after())
// src/app/api/webhooks/retell/route.ts
import 'server-only'
import { after } from 'next/server'
import { verify } from 'retell-sdk'
import { processCallEnded, processCallAnalyzed } from './handlers'

export async function POST(req: Request) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-retell-signature') ?? ''

  // Verify signature BEFORE reading payload
  const isValid = await verify(rawBody, process.env.RETELL_API_KEY!, signature)
  if (!isValid) {
    return new Response('Unauthorized', { status: 401 })
  }

  const event = JSON.parse(rawBody) as RetellWebhookEvent

  // Return 200 immediately — all downstream processing deferred
  after(async () => {
    if (event.event === 'call_ended') {
      await processCallEnded(event.call)
    } else if (event.event === 'call_analyzed') {
      await processCallAnalyzed(event.call)
    }
    // call_started, transcript_updated, transfer_* — no-op (not subscribed)
  })

  return new Response('OK', { status: 200 })
}
```

**Critical notes:**
- `verify` is a **named export** from `retell-sdk`, not a static method: `import { verify } from 'retell-sdk'`
- `verify` is **async** (returns `Promise<boolean>`) — must `await`
- `req.text()` must be called BEFORE parsing — `verify` needs the raw string
- `after()` is from `'next/server'` (not `@vercel/functions`) — available in Next.js 16.2.4

### Pattern 2: Retell Webhook Payload Types

Verified against `retell-sdk@5.18.0` type definitions in `node_modules/retell-sdk/resources/call.d.ts`:

```typescript
// src/lib/retell/webhook-types.ts
// Derived from PhoneCallResponse in retell-sdk/resources/call.d.ts

export interface RetellCallPayload {
  call_id: string
  agent_id: string
  from_number: string        // E.164 caller phone
  to_number: string          // VoiceDesk number
  direction: 'inbound' | 'outbound'
  call_status: string
  start_timestamp?: number   // milliseconds since epoch (call_ended + call_analyzed)
  end_timestamp?: number     // milliseconds since epoch (call_ended + call_analyzed)
  duration_ms?: number       // milliseconds — NOT seconds (call_ended + call_analyzed)
  recording_url?: string     // S3 URL (call_ended + call_analyzed)
  transcript?: string        // plain string, speaker-labeled (call_analyzed)
  transcript_object?: Array<{
    role: 'agent' | 'user' | 'transfer_target'
    content: string
    words: Array<{ word?: string; start?: number; end?: number }>
  }>                         // turn-by-turn structured array (call_analyzed)
  call_analysis?: {
    call_summary?: string    // HIGH LEVEL SUMMARY — stored in calls.summary
    call_successful?: boolean
    in_voicemail?: boolean
    user_sentiment?: 'Negative' | 'Positive' | 'Neutral' | 'Unknown'
    custom_analysis_data?: unknown
  }                          // ONLY populated in call_analyzed event
  disconnection_reason?: string
  metadata?: unknown
}

export interface RetellWebhookEvent {
  event: 'call_started' | 'call_ended' | 'call_analyzed' | 'transcript_updated' | string
  call: RetellCallPayload
}
```

**Key field mapping to `calls` table:**

| Retell Field | `calls` Column | Notes |
|---|---|---|
| `call_id` | `retell_call_id` | UNIQUE constraint — upsert key |
| `from_number` | `caller_phone` | E.164 format |
| `duration_ms / 1000` | `duration_seconds` | Convert ms → s for storage |
| `start_timestamp` | `started_at` | `new Date(start_timestamp)` — ms epoch |
| `end_timestamp` | `ended_at` | `new Date(end_timestamp)` |
| `recording_url` | `recording_url` | Store as-is (D-16) |
| `transcript_object` | `transcript` (JSONB) | Store structured array |
| `call_analysis.call_summary` | `summary` (TEXT) | D-09: stored as-is |

### Pattern 3: call_ended Skeleton Write

```typescript
// src/app/api/webhooks/retell/handlers.ts
// call_ended: create skeleton row with analysis_status='analyzing'
export async function processCallEnded(call: RetellCallPayload) {
  const db = createServiceRoleClient()

  // Look up contractor by retell_agent_id
  const { data: contractor } = await db
    .from('contractors')
    .select('id, contractor_settings(business_hours, timezone)')
    .eq('retell_agent_id', call.agent_id)
    .maybeSingle()

  if (!contractor) {
    console.error('[webhook/call_ended] no contractor for agent_id:', call.agent_id)
    return
  }

  const settings = contractor.contractor_settings as { business_hours: BusinessHours; timezone: string } | null
  const isAfterHours = settings
    ? detectAfterHours(
        new Date(call.start_timestamp!),
        settings.business_hours,
        settings.timezone ?? 'America/New_York'
      )
    : false

  // UPSERT on retell_call_id — idempotency (D-05)
  await db.from('calls').upsert({
    contractor_id: contractor.id,
    retell_call_id: call.call_id,
    caller_phone: call.from_number,
    twilio_number: call.to_number,
    status: 'completed',
    analysis_status: 'analyzing',
    started_at: call.start_timestamp ? new Date(call.start_timestamp).toISOString() : null,
    ended_at: call.end_timestamp ? new Date(call.end_timestamp).toISOString() : null,
    duration_seconds: call.duration_ms ? Math.round(call.duration_ms / 1000) : null,
    recording_url: call.recording_url ?? null,
    is_after_hours: isAfterHours,
  }, { onConflict: 'retell_call_id' })
}
```

### Pattern 4: call_analyzed Enrichment + Inngest Trigger

```typescript
// call_analyzed: enrich existing row, queue classification
export async function processCallAnalyzed(call: RetellCallPayload) {
  const db = createServiceRoleClient()

  // ALWAYS persist transcript + summary first (never lose the transcript)
  const { data: callRow } = await db.from('calls').upsert({
    retell_call_id: call.call_id,
    transcript: call.transcript_object ?? null,
    summary: call.call_analysis?.call_summary ?? null,
    recording_url: call.recording_url ?? null,
    // analysis_status stays 'analyzing' until classification completes
  }, { onConflict: 'retell_call_id' }).select('id, contractor_id').maybeSingle()

  if (!callRow) return

  // Fire classification Inngest job — handles retry on OpenAI failure
  await inngest.send({
    name: 'retell/call.classify',
    data: {
      callId: callRow.id,
      contractorId: callRow.contractor_id,
      transcriptObject: call.transcript_object,
      transcriptText: call.transcript,
    },
  })
}
```

### Pattern 5: OpenAI Structured Output with Zod

```typescript
// Source: openai/openai-node Context7 — zodResponseFormat + .parse()
// src/lib/classification/classify-intent.ts
import 'server-only'
import OpenAI from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'
import { z } from 'zod'

const ClassificationSchema = z.object({
  intent: z.enum(['lead', 'emergency', 'info', 'no_action']),
  detected_trade: z.enum(['hvac', 'plumbing', 'electrical', 'other']).optional(),
  confidence: z.enum(['high', 'medium', 'low']),
})

export async function classifyIntent(
  transcriptText: string,
  isShortCall: boolean
): Promise<z.infer<typeof ClassificationSchema>> {
  const client = getOpenAIClient()
  const completion = await client.chat.completions.parse({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: buildClassificationPrompt(isShortCall) },
      { role: 'user', content: transcriptText },
    ],
    response_format: zodResponseFormat(ClassificationSchema, 'classification'),
  })
  const result = completion.choices[0]?.message?.parsed
  if (!result) throw new Error('OpenAI classification returned no parsed result')
  return result
}
```

### Pattern 6: Hard-coded Emergency Keywords (D-06)

```typescript
// src/lib/classification/emergency-keywords.ts
// EMRG-02: These cannot be overridden by contractor configuration
export const HARD_EMERGENCY_KEYWORDS: Record<string, string[]> = {
  en: ['gas smell', 'gas leak', 'co alarm', 'carbon monoxide'],
  es: ['olor a gas', 'fuga de gas', 'alarma de co', 'monóxido de carbono'],
} as const

export function hasHardEmergencyKeyword(transcriptText: string): boolean {
  const lower = transcriptText.toLowerCase()
  return Object.values(HARD_EMERGENCY_KEYWORDS).flat().some(kw => lower.includes(kw))
}
```

### Pattern 7: After-Hours Detection (D-11)

```typescript
// Source: date-fns-tz docs (toZonedTime)
// src/lib/after-hours/detect.ts
import 'server-only'
import { toZonedTime } from 'date-fns-tz'
import { getDay, getHours, getMinutes } from 'date-fns'

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export interface BusinessHours {
  [day: string]: { open: string; close: string; enabled: boolean }
}

export function detectAfterHours(
  callStartAt: Date,
  businessHours: BusinessHours,
  timezone: string
): boolean {
  const zonedDate = toZonedTime(callStartAt, timezone)
  const dayName = DAY_NAMES[getDay(zonedDate)]
  const dayConfig = businessHours[dayName]

  if (!dayConfig?.enabled) return true  // Day disabled = always after-hours

  const [openH, openM] = dayConfig.open.split(':').map(Number)
  const [closeH, closeM] = dayConfig.close.split(':').map(Number)
  const currentMinutes = getHours(zonedDate) * 60 + getMinutes(zonedDate)
  const openMinutes = openH * 60 + openM
  const closeMinutes = closeH * 60 + closeM

  return currentMinutes < openMinutes || currentMinutes >= closeMinutes
}
```

### Pattern 8: Inngest Classification Retry Function

```typescript
// Source: retell-agent-sync.ts pattern (existing) + Inngest Context7 docs
// src/inngest/functions/retell-call-classify.ts
import 'server-only'
import { NonRetriableError } from 'inngest'
import { inngest } from '@/inngest/client'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { hasHardEmergencyKeyword } from '@/lib/classification/emergency-keywords'
import { classifyIntent } from '@/lib/classification/classify-intent'
import { extractTradeData } from '@/lib/classification/extract-trade'

export const retellCallClassify = inngest.createFunction(
  {
    id: 'retell-call-classify',
    retries: 5,
    triggers: [{ event: 'retell/call.classify' }],
    onFailure: async ({ event }) => {
      const { callId } = event.data.event.data as { callId: string }
      const db = createServiceRoleClient()
      await db.from('calls').update({ analysis_status: 'analysis_failed' }).eq('id', callId)
    },
  },
  async ({ event, step }) => {
    const { callId, contractorId, transcriptText, transcriptObject } = event.data

    if (!callId || !contractorId) throw new NonRetriableError('Missing callId or contractorId')

    // Step 1: Hard-code emergency check (D-06) — NonRetriable, no LLM
    const hardEmergency = await step.run('check-hard-emergency', async () => {
      return hasHardEmergencyKeyword(transcriptText ?? '')
    })

    // Step 2: LLM classification (D-07/D-08)
    const classification = await step.run('classify-intent', async () => {
      const durationMs = /* loaded from DB or event */ 0
      const isShortCall = durationMs < 15000
      return classifyIntent(transcriptText ?? '', isShortCall)
    })

    // Hard emergency overrides LLM (D-06 — cannot be overridden)
    const finalIntent = hardEmergency ? 'emergency' : classification.intent

    // Step 3: Trade-specific extraction (D-08/D-10)
    const tradeData = await step.run('extract-trade-data', async () => {
      if (finalIntent === 'no_action') return null
      return extractTradeData(transcriptText ?? '', classification.detected_trade)
    })

    // Step 4: Write final classification to DB
    await step.run('persist-classification', async () => {
      const db = createServiceRoleClient()
      await db.from('calls').update({
        intent: finalIntent,
        language: classification.detected_language ?? null,
        raw_metadata: tradeData,
        analysis_status: 'complete',
      }).eq('id', callId)
    })
  }
)
```

### Pattern 9: Inngest Analysis Timeout (Cron)

```typescript
// src/inngest/functions/retell-analysis-timeout.ts
// D-04: 30-minute stale analysis guard — cron every 5 minutes
export const retellAnalysisTimeout = inngest.createFunction(
  {
    id: 'retell-analysis-timeout',
    triggers: [{ cron: '*/5 * * * *' }],  // every 5 minutes
  },
  async ({ step }) => {
    await step.run('mark-stale-analyzing', async () => {
      const db = createServiceRoleClient()
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
      await db
        .from('calls')
        .update({ analysis_status: 'analysis_failed' })
        .eq('analysis_status', 'analyzing')
        .lt('created_at', thirtyMinutesAgo)
    })
  }
)
```

### Anti-Patterns to Avoid

- **Blocking the webhook response on LLM calls:** Never `await classifyIntent()` before returning HTTP 200. All OpenAI work goes inside `after()` and further deferred to Inngest.
- **Using JSON mode instead of structured output:** `response_format: { type: 'json_object' }` does not validate field names — LLM can hallucinate wrong keys. Use `zodResponseFormat` with `.parse()` which throws on schema mismatch.
- **Calling `req.json()` before verification:** `verify()` needs the raw string (`req.text()`). Parsing to JSON first loses the original bytes and breaks HMAC verification.
- **Storing `transcript` string in `calls.transcript` JSONB:** The `transcript` field is a plain string (speaker-labeled text). The `transcript_object` is the structured array. Store `transcript_object` in the JSONB column.
- **Using `duration_seconds` from Retell:** The field is `duration_ms` (milliseconds). Divide by 1000 to get seconds for `calls.duration_seconds`.
- **Using `call.analysis.summary`:** The field is `call_analysis.call_summary`, not `call.summary` or `call.analysis.summary`.
- **Importing `verify` as a static method:** `Retell.verify()` does not exist. Use the named export: `import { verify } from 'retell-sdk'`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Webhook signature verification | Custom HMAC logic | `verify` from `retell-sdk` | SDK handles algorithm details; tested by Retell; verified async API |
| OpenAI structured output parsing | Regex on LLM response | `zodResponseFormat` + `.parse()` | LLMs sometimes hallucinate JSON structure; Zod enforces schema |
| Timezone-aware time comparison | String parsing of HH:MM | `date-fns-tz` `toZonedTime` + `date-fns` `getHours/getMinutes` | DST transitions (EDT/EST in America/New_York) are handled correctly |
| Retry with exponential backoff | `setTimeout` loops | Inngest `retries: 5` config | Inngest backoff survives process restarts; serverless-safe |
| Duplicate webhook prevention | Custom `webhook_events` insertion | `UPSERT` on `calls.retell_call_id` | UNIQUE constraint + PostgreSQL UPSERT is atomic; single source of truth |

**Key insight:** The classification pipeline has 3 places where custom retry logic causes subtle bugs in serverless: LLM timeouts, DB write failures, and Inngest send failures. Inngest steps handle each independently with full observability in the Inngest dashboard.

---

## Common Pitfalls

### Pitfall 1: `call_analyzed` arrives before `call_ended` (race condition)

**What goes wrong:** Retell fires events sequentially but non-blocking — if `call_ended` processing is slow (DB write retry), `call_analyzed` can begin processing before the skeleton row exists.

**Why it happens:** `after()` in the `call_ended` handler is async; Retell has a 10s timeout and fires the next event independently.

**How to avoid:** Use `UPSERT` for both events on `retell_call_id`. The `call_analyzed` UPSERT will create the row if it doesn't exist yet (with `analysis_status='analyzing'` default from DB). The `call_ended` UPSERT will then update only the fields it owns. Both are idempotent.

**Warning signs:** `calls` rows with `caller_phone = NULL` and `intent` already set — means `call_analyzed` arrived and wrote first.

### Pitfall 2: `analysis_status` column missing — migration not applied

**What goes wrong:** Phase 3 migration adds `analysis_status TEXT` to `calls`. If the migration isn't pushed before the route goes live, every DB write fails with a column-not-found error.

**Why it happens:** Forgetting the `supabase db push` step before deploying the route.

**How to avoid:** Wave 0 plan step: write migration → `supabase db push` → verify column exists → then write handler code.

**Warning signs:** `PGRST204` or column-not-found errors in Supabase logs immediately after deploy.

### Pitfall 3: Verifying with wrong parameter order

**What goes wrong:** `verify(rawBody, signature, apiKey)` instead of `verify(rawBody, apiKey, signature)`.

**Why it happens:** Parameter order is non-obvious.

**How to avoid:** Signature per `webhook_auth.d.ts`: `verify(body: string, apiKey: string, signature: string): Promise<boolean>`. Always check the type definition.

**Warning signs:** All incoming webhooks return 401 even from Retell's test dashboard.

### Pitfall 4: `after()` timeout not extended

**What goes wrong:** The `after()` callback is cancelled if the function `maxDuration` is exceeded. OpenAI calls (especially GPT-4o) can take 10–20s; Inngest send adds more.

**Why it happens:** Default Vercel function timeout on Pro is 60s; `after()` shares the same timeout budget.

**How to avoid:** Add `export const maxDuration = 30` to the webhook route file (segment config). The `after()` block runs after response but within the max duration window.

**Warning signs:** Inngest events are never received because `after()` was cancelled.

### Pitfall 5: OpenAI package not installed — build fails silently

**What goes wrong:** `openai` is not in `package.json`. The build passes locally if a global `openai` exists but fails on Vercel.

**Why it happens:** `package.json` shows `openai` not listed (verified 2026-05-08).

**How to avoid:** Wave 0 installs `openai` as a tracked dependency before any classification code is written.

**Warning signs:** Vercel build error "Cannot find module 'openai'".

### Pitfall 6: `intent` value mismatch with DB CHECK constraint

**What goes wrong:** LLM returns `"general_inquiry"` or `"unknown"` but the DB CHECK constraint only allows `'lead','emergency','info','no_action','unknown'`.

**Why it happens:** Prompt uses a different label than the DB schema value.

**How to avoid:** The Zod schema for classification must use `z.enum(['lead', 'emergency', 'info', 'no_action'])` matching Phase 1 schema values exactly. `'unknown'` is a fallback that should never come from the LLM — set it only via DB default if classification fails entirely.

**Warning signs:** DB `check_violation` errors on intent column writes.

### Pitfall 7: Missing `notify_on_general_inquiry` in RLS policies

**What goes wrong:** Migration adds column but omits RLS policies for `notification_settings`. The Phase 5 notification dispatcher (which reads this column) will get empty results for authenticated users.

**Why it happens:** RLS policies are easy to forget when only adding a column to an existing table.

**How to avoid:** Phase 3 migration must update the existing `notification_settings` RLS policies to include the new column OR verify the existing policies already cover SELECT/INSERT/UPDATE/DELETE by `contractor_id`.

**Warning signs:** Phase 5 notification preferences always read as `false` even after contractor sets them.

---

## Code Examples

### Verified: Webhook Signature Verification

```typescript
// Source: retell-sdk node_modules/retell-sdk/lib/webhook_auth.d.ts (VERIFIED)
// Source: Retell community docs https://community.retellai.com/t/webhook-signature-verification/252

import { verify } from 'retell-sdk'  // named export — NOT Retell.verify()

const rawBody = await req.text()     // MUST use text(), not json()
const signature = req.headers.get('x-retell-signature') ?? ''

const isValid = await verify(rawBody, process.env.RETELL_API_KEY!, signature)
// Returns Promise<boolean>
```

### Verified: `call_analysis` Field Names

```typescript
// Source: retell-sdk node_modules/retell-sdk/resources/call.d.ts lines 298–321 (VERIFIED)
// PhoneCallResponse.CallAnalysis interface:
//   call_summary?: string       ← HIGH-LEVEL SUMMARY (not "summary")
//   call_successful?: boolean
//   in_voicemail?: boolean
//   user_sentiment?: 'Negative' | 'Positive' | 'Neutral' | 'Unknown'
//   custom_analysis_data?: unknown

const summary = call.call_analysis?.call_summary ?? null
```

### Verified: Duration Field

```typescript
// Source: retell-sdk node_modules/retell-sdk/resources/call.d.ts line 180 (VERIFIED)
// duration_ms?: number   ← milliseconds, NOT seconds

const durationSeconds = call.duration_ms ? Math.round(call.duration_ms / 1000) : null
```

### Verified: `after()` Import

```typescript
// Source: Vercel docs /docs/functions/functions-api-reference/vercel-functions-package (VERIFIED)
// Source: Next.js 16.2.4 includes after() — confirmed by node_modules/next/dist/server/after/after.d.ts

import { after } from 'next/server'
// after() is recommended over @vercel/functions waitUntil() for Next.js 15.1+
```

### Verified: OpenAI Structured Output

```typescript
// Source: Context7 /openai/openai-node "structured output zodResponseFormat" (VERIFIED)

import { zodResponseFormat } from 'openai/helpers/zod'

const completion = await client.chat.completions.parse({
  model: 'gpt-4o-mini',
  messages: [...],
  response_format: zodResponseFormat(MyZodSchema, 'schema_name'),
})
const parsed = completion.choices[0]?.message?.parsed  // type-safe, null if validation fails
```

### Verified: Inngest Cron Function

```typescript
// Source: Context7 /inngest/inngest-js "cron scheduled" (VERIFIED)

inngest.createFunction(
  { id: 'my-cron', triggers: [{ cron: '*/5 * * * *' }] },
  async ({ step }) => { ... }
)
```

### Verified: date-fns-tz Business Hours Pattern

```typescript
// Source: Context7 /marnusw/date-fns-tz "toZonedTime" (VERIFIED)
import { toZonedTime } from 'date-fns-tz'
import { getDay, getHours, getMinutes } from 'date-fns'

const zonedDate = toZonedTime(callStartAt, 'America/New_York')
// zonedDate is a Date object in the contractor's local time — DST handled automatically
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `waitUntil` from `@vercel/functions` | `after()` from `next/server` | Next.js 15.1 | `after()` is now the canonical way; no extra package needed |
| JSON mode (`response_format: { type: 'json_object' }`) | `zodResponseFormat` + `.parse()` | OpenAI SDK v4+ | Schema-enforced structured output; type-safe `.parsed` field |
| `Retell.verify()` static class method | `import { verify } from 'retell-sdk'` | SDK refactor | Named export; no class instantiation needed for verification |
| `duration_seconds` as a Retell field | `duration_ms` (convert on ingest) | Always been ms | Match field name from SDK types |

**Deprecated/outdated:**
- `@vercel/functions` `waitUntil`: Not wrong, but superseded by `next/server` `after()` for Next.js 15.1+; `@vercel/functions` is not installed in this project.
- Retell `call_analysis.summary` field name: Does not exist. The correct field is `call_analysis.call_summary`.

---

## Runtime State Inventory

Phase 3 is greenfield (new webhook route, new migration, new Inngest functions). No runtime state migration is required. There is no rename or refactor in scope.

Relevant existing runtime state that Phase 3 reads (but does not change):
- Supabase `contractors` table: `retell_agent_id` — used to look up which contractor owns a call.
- Supabase `contractor_settings` table: `business_hours` (JSONB), `trade_type`, `emergency_keywords`, `timezone` (from `contractors`).

**Nothing to migrate** — Phase 3 adds `analysis_status` column and `notify_on_general_inquiry` column via migration.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `openai` npm package | Classification pipeline | No | — (not in package.json) | None — must install in Wave 0 |
| `date-fns-tz` npm package | After-hours detection | No | — (not in package.json) | Could use `Intl.DateTimeFormat` for display but not arithmetic |
| `retell-sdk` | Webhook verification | Yes | 5.18.0 | — |
| `inngest` | Background jobs | Yes | ^4.3.0 | — |
| `next` | `after()` | Yes | 16.2.4 | — |
| `zod` | Schema validation | Yes | 4.4.2 | — |
| Supabase (live) | DB writes | Yes | — | — |
| `OPENAI_API_KEY` env var | OpenAI API calls | Unknown | — | Phase cannot ship without this |
| `RETELL_API_KEY` env var | Webhook verification | Yes (Phase 2 used it) | — | — |

**Missing dependencies that block execution:**
- `openai` package must be installed before any classification code runs (Wave 0).
- `date-fns-tz` must be installed before `detect.ts` can be tested (Wave 0).
- `OPENAI_API_KEY` must be set in `.env.local` and Vercel environment — confirm before Wave 1 ends.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run tests/api/webhook.test.ts tests/lib/classification.test.ts tests/lib/after-hours.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CALL-02 | Hard-coded emergency keywords detected before LLM | unit | `npx vitest run tests/lib/classification.test.ts` | No — Wave 0 |
| CALL-02 | LLM intent classification returns valid enum value | unit (mocked OpenAI) | `npx vitest run tests/lib/classification.test.ts` | No — Wave 0 |
| CALL-03 | Trade-specific extraction schema returns correct fields | unit (mocked OpenAI) | `npx vitest run tests/lib/classification.test.ts` | No — Wave 0 |
| CALL-04 | After-hours detection correct for Mon 08:00 and Sat/Sun | unit | `npx vitest run tests/lib/after-hours.test.ts` | No — Wave 0 |
| EMRG-01 | Non-hard-coded emergency keywords do not auto-classify | unit | `npx vitest run tests/lib/classification.test.ts` | No — Wave 0 |
| EMRG-02 | "gas smell" and "co alarm" always return intent=emergency | unit | `npx vitest run tests/lib/classification.test.ts` | No — Wave 0 |
| CALL-01 | Webhook returns 200 immediately (not blocked by LLM) | unit (mocked after) | `npx vitest run tests/api/webhook.test.ts` | No — Wave 0 |
| D-05 | Duplicate call_ended for same call_id creates exactly one row | unit (mocked supabase) | `npx vitest run tests/api/webhook.test.ts` | No — Wave 0 |
| D-02 | Webhook signature rejection returns 401 | unit | `npx vitest run tests/api/webhook.test.ts` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/lib/classification.test.ts tests/lib/after-hours.test.ts tests/api/webhook.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/api/webhook.test.ts` — covers D-02, D-05, CALL-01 (verify/reject/idempotency/200 response)
- [ ] `tests/lib/classification.test.ts` — covers CALL-02, CALL-03, EMRG-01, EMRG-02
- [ ] `tests/lib/after-hours.test.ts` — covers CALL-04 (business hours detection with DST)
- [ ] Package install: `npm install openai date-fns-tz` — required before any test stubs compile
- [ ] `tests/__mocks__/openai.ts` — mock OpenAI client (same pattern as existing `server-only` mock)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No — no user session in webhook | Webhook signature verification replaces auth |
| V3 Session Management | No | N/A |
| V4 Access Control | Yes — contractor lookup from agent_id | Use `agent_id` from payload (not caller-supplied); look up contractor server-side |
| V5 Input Validation | Yes | `zod` schema validation on webhook payload; `verify()` before any payload parsing |
| V6 Cryptography | No | Signature verification uses Retell SDK (not hand-rolled) |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged Retell webhook (attacker posts fake call data) | Spoofing | `verify()` before processing any payload — return 401 immediately if invalid |
| Elevation of privilege: attacker provides wrong `contractor_id` in spoofed payload | Elevation of Privilege | Never accept `contractor_id` from payload; always look up by `agent_id` server-side |
| Transcript PII exposure (homeowner name, address) | Information Disclosure | `OPENAI_API_KEY` server-only; never log raw transcripts; `import 'server-only'` in all classification libs |
| OpenAI prompt injection via malicious transcript | Tampering | LLM only classifies structured intent — no arbitrary actions. Classification result is validated by Zod enum, rejecting unexpected values |
| Replay attack: Retell resends old call_ended after issue resolved | Tampering | UPSERT idempotency — second write produces same result (analysis_status updates from `analyzing` back to `analyzing` — no harm) |

---

## Open Questions (RESOLVED)

1. **`maxDuration` for the webhook route**
   - What we know: Vercel Pro allows up to 300s maxDuration for Node.js functions; `after()` inherits the same budget.
   - What's unclear: Whether Vercel Hobby/Pro tier is in use — Pro allows longer durations.
   - Recommendation: Set `export const maxDuration = 30` in the webhook route. The `after()` block triggers Inngest (fast) and does one Supabase write — 30s is ample.

2. **OpenAI API key environment variable name**
   - What we know: CLAUDE.md states `OPENAI_API_KEY` — confirmed same pattern as `RETELL_API_KEY`.
   - What's unclear: Whether the key is already added to Vercel project environment.
   - Recommendation: Wave 0 plan step should include verifying `OPENAI_API_KEY` is in `.env.local` and Vercel dashboard before Wave 1 runs.

3. **Retell `call_analyzed` timing relative to `call_ended`**
   - What we know: ROADMAP.md notes "fires 1–3 min after call end." Retry policy: 10s timeout, up to 3 retries.
   - What's unclear: The exact lag — could be up to 5 min for complex calls.
   - Recommendation: The 30-minute Inngest timeout guard (D-04) provides adequate buffer. No change to design needed.

4. **`contractor_settings.timezone` column**
   - What we know: The `contractors` table has `timezone TEXT NOT NULL DEFAULT 'America/New_York'`. `contractor_settings` does not have its own timezone column.
   - What's unclear: The `detectAfterHours` function needs a timezone string. Should it read from `contractors.timezone` or `contractor_settings.business_hours`?
   - Recommendation: Read `contractors.timezone` (already exists). The `call_ended` handler query should `select('id, timezone, contractor_settings(business_hours)')` from `contractors`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `call_analyzed` is always preceded by `call_ended` for the same call_id | Architecture Patterns | If `call_analyzed` can arrive with no prior `call_ended`, the UPSERT fallback handles it — but `analysis_status` default would need to be set |
| A2 | Vercel Hobby/Pro allows `maxDuration = 30` for API routes | Environment Availability | If on Hobby tier, max is 10s — may need to reduce scope of `after()` block and rely entirely on Inngest |
| A3 | `OPENAI_API_KEY` will be added to environment before deployment | Environment Availability | Classification Inngest function will fail on every invocation until key is set |

**If this table were empty:** All critical claims were verified against SDK types or official docs. Three low-risk assumptions remain.

---

## Sources

### Primary (HIGH confidence — verified against installed SDK types or official docs)

- `node_modules/retell-sdk/resources/call.d.ts` (lines 140–321) — `PhoneCallResponse`, `CallAnalysis` interface, field names `call_summary`, `duration_ms`, `transcript_object`, `recording_url`
- `node_modules/retell-sdk/lib/webhook_auth.d.ts` — `verify(body, apiKey, signature): Promise<boolean>` signature
- `node_modules/retell-sdk/index.d.ts` — named exports including `verify`, event type strings
- `node_modules/next/dist/server/after/after.d.ts` — `after<T>(task: AfterTask<T>): void` available in Next.js 16.2.4
- `docs.retellai.com/features/webhook` — event names (`call_ended`, `call_analyzed`), header `x-retell-signature`, retry policy (10s timeout, 3 retries), IP allowlist
- `docs.retellai.com/api-references/get-call` — full call object schema confirmation
- `vercel.com/docs/functions/functions-api-reference/vercel-functions-package` — `after()` recommended for Next.js 15.1+; `waitUntil` docs
- Context7 `/marnusw/date-fns-tz` — `toZonedTime`, `fromZonedTime`, DST handling
- Context7 `/openai/openai-node` — `zodResponseFormat`, `.parse()` structured output
- Context7 `/inngest/inngest-js` — cron trigger syntax, `step.run`, `retries`, `onFailure`

### Secondary (MEDIUM confidence — community docs / cross-referenced)

- `community.retellai.com/t/webhook-signature-verification/252` — code example for `Retell.verify()` call (confirmed against SDK types)
- `n8n.io/workflows/3504-store-retell-transcripts` — community confirmation that `call_analyzed` is the event to listen for for full transcript

### Tertiary (LOW confidence — community observations)

- Retell `call_analyzed` timing "1–3 min after call end" (ROADMAP.md source, not independently verified in current docs session)

---

## Metadata

**Confidence breakdown:**
- Retell webhook payload schema: HIGH — verified against installed SDK type definitions
- Signature verification API: HIGH — verified against `webhook_auth.d.ts` and community docs
- `after()` availability: HIGH — verified against installed Next.js 16.2.4 dist files
- OpenAI structured output: HIGH — verified via Context7 official docs
- Inngest patterns: HIGH — verified via Context7 + existing codebase pattern
- After-hours detection: HIGH — verified via Context7 date-fns-tz docs
- `call_analyzed` timing: LOW — "1–3 min" from ROADMAP.md, not independently verified

**Research date:** 2026-05-08
**Valid until:** 2026-06-08 (stable SDK; check Retell changelog if any webhook breaking changes before planning)

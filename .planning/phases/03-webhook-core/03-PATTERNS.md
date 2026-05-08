# Phase 3: Webhook Core - Pattern Map

**Mapped:** 2026-05-08
**Files analyzed:** 10 new/modified files
**Analogs found:** 9 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/app/api/webhooks/retell/route.ts` | route | request-response | `src/app/api/provisioning/update-agent/route.ts` | role-match |
| `src/lib/retell/webhook-types.ts` | utility | transform | `src/lib/retell/client.ts` | partial |
| `src/lib/openai/client.ts` | utility | request-response | `src/lib/retell/client.ts` | exact |
| `src/lib/classification/emergency-keywords.ts` | utility | transform | `src/lib/retell/system-prompt.ts` | partial |
| `src/lib/classification/classify-intent.ts` | service | request-response | `src/lib/retell/client.ts` + provisioning routes | role-match |
| `src/lib/classification/extract-trade.ts` | service | request-response | `src/lib/classification/classify-intent.ts` (sibling) | exact |
| `src/lib/after-hours/detect.ts` | utility | transform | `src/lib/crypto/tokens.ts` | role-match |
| `src/inngest/functions/retell-call-classify.ts` | service | event-driven | `src/inngest/functions/retell-agent-sync.ts` | exact |
| `src/inngest/functions/retell-analysis-timeout.ts` | service | batch | `src/inngest/functions/retell-agent-sync.ts` | role-match |
| `supabase/migrations/[timestamp]_webhook_core.sql` | migration | CRUD | `supabase/migrations/20260506000004_agent_sync_status.sql` | exact |

---

## Pattern Assignments

### `src/app/api/webhooks/retell/route.ts` (route, request-response)

**Analog:** `src/app/api/provisioning/update-agent/route.ts`

This is the most critical file in Phase 3. The key divergence from prior routes: no user session auth — webhook auth is signature verification only. Uses `after()` from `next/server` (not `NextResponse`). Returns a raw `Response`, not `NextResponse.json()`.

**Imports pattern** (from `update-agent/route.ts` lines 14–19, adapted):
```typescript
import 'server-only'
import { after } from 'next/server'
import { verify } from 'retell-sdk'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { inngest } from '@/inngest/client'
import type { RetellWebhookEvent } from '@/lib/retell/webhook-types'
```

**Segment config** (no analog exists yet — new pattern for Phase 3):
```typescript
// Export at module level, before the handler function
export const maxDuration = 30
export const runtime = 'nodejs'
```

**Signature verification pattern** (from RESEARCH.md — verified against `retell-sdk/lib/webhook_auth.d.ts`):
```typescript
export async function POST(req: Request) {
  const rawBody = await req.text()  // MUST use text() not json() — verify() needs raw string
  const signature = req.headers.get('x-retell-signature') ?? ''

  const isValid = await verify(rawBody, process.env.RETELL_API_KEY!, signature)
  if (!isValid) {
    return new Response('Unauthorized', { status: 401 })
  }

  const event = JSON.parse(rawBody) as RetellWebhookEvent

  // Return 200 immediately — critical rule from CLAUDE.md
  after(async () => {
    if (event.event === 'call_ended') {
      await processCallEnded(event.call)
    } else if (event.event === 'call_analyzed') {
      await processCallAnalyzed(event.call)
    }
    // call_started, transcript_updated — no-op
  })

  return new Response('OK', { status: 200 })
}
```

**Error logging pattern** (from `provisioning/create/route.ts` lines 43–44):
```typescript
console.error('[webhook/retell] descriptive error context:', err instanceof Error ? err.message : err)
```

**Inngest send pattern** (from `update-agent/route.ts` lines 72–80):
```typescript
await inngest.send({
  name: 'retell/call.classify',
  data: {
    callId: callRow.id,
    contractorId: callRow.contractor_id,
    transcriptObject: call.transcript_object,
    transcriptText: call.transcript,
  },
})
```

**Supabase upsert / idempotency pattern** (from `create-account/route.ts` lines 52–57, adapted for `onConflict`):
```typescript
await db.from('calls').upsert(
  { retell_call_id: call.call_id, ...fields },
  { onConflict: 'retell_call_id' }
)
```

---

### `src/lib/retell/webhook-types.ts` (utility, transform)

**Analog:** `src/lib/retell/client.ts` (same directory — follow file header and `server-only` placement)

This file is type-only — no runtime logic. It derives types from the installed SDK (`retell-sdk/resources/call.d.ts`).

**File header pattern** (from `client.ts` lines 1–5):
```typescript
// src/lib/retell/webhook-types.ts
// Typed interfaces for Retell webhook payloads.
// Derived from PhoneCallResponse in retell-sdk/resources/call.d.ts (verified 2026-05-08).
// CRITICAL: call.call_analysis?.call_summary (NOT call.summary or call.analysis.summary)
// CRITICAL: call.duration_ms (milliseconds — divide by 1000 for duration_seconds)
import 'server-only'
```

**Key field mapping** (all field names verified against SDK `call.d.ts`):
```typescript
export interface RetellCallPayload {
  call_id: string
  agent_id: string
  from_number: string          // E.164 → calls.caller_phone
  to_number: string
  direction: 'inbound' | 'outbound'
  call_status: string
  start_timestamp?: number     // ms epoch → new Date(start_timestamp)
  end_timestamp?: number       // ms epoch
  duration_ms?: number         // ms → Math.round(duration_ms / 1000) for duration_seconds
  recording_url?: string
  transcript?: string          // plain speaker-labeled string — do NOT store in JSONB column
  transcript_object?: Array<{  // structured array → store in calls.transcript (JSONB)
    role: 'agent' | 'user' | 'transfer_target'
    content: string
    words: Array<{ word?: string; start?: number; end?: number }>
  }>
  call_analysis?: {
    call_summary?: string      // → calls.summary (NOT "summary", NOT "call_analysis.summary")
    call_successful?: boolean
    in_voicemail?: boolean
    user_sentiment?: 'Negative' | 'Positive' | 'Neutral' | 'Unknown'
    custom_analysis_data?: unknown
  }
  disconnection_reason?: string
  metadata?: unknown
}

export interface RetellWebhookEvent {
  event: 'call_started' | 'call_ended' | 'call_analyzed' | 'transcript_updated' | string
  call: RetellCallPayload
}
```

---

### `src/lib/openai/client.ts` (utility, request-response)

**Analog:** `src/lib/retell/client.ts` — exact structural match. Same singleton pattern, same `import 'server-only'`, same env var guard pattern.

**Full pattern to copy from `src/lib/retell/client.ts` lines 1–29, substituting OpenAI:**
```typescript
// src/lib/openai/client.ts
// OpenAI SDK singleton — server-only.
// CRITICAL: OPENAI_API_KEY must NEVER have NEXT_PUBLIC_ prefix (would expose to browser).
import 'server-only'
import OpenAI from 'openai'

let _client: OpenAI | null = null

export function getOpenAIClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set')
    _client = new OpenAI({ apiKey })
  }
  return _client
}
```

**Env var guard pattern** (from `client.ts` lines 23–25):
```typescript
const apiKey = process.env.RETELL_API_KEY
if (!apiKey) throw new Error('RETELL_API_KEY is not set')
```

---

### `src/lib/classification/emergency-keywords.ts` (utility, transform)

**Analog:** `src/lib/retell/system-prompt.ts` (constants + pure functions in a lib module)

No close role-match analog exists. This is a constants + pure-function file. The `import 'server-only'` and module header pattern come from the retell lib modules.

**File header pattern** (from `client.ts` lines 1–5):
```typescript
// src/lib/classification/emergency-keywords.ts
// EMRG-02: Hard-coded emergency triggers that CANNOT be overridden by contractor configuration.
// Checked before any LLM call in the classification pipeline.
// D-06: If matched, intent='emergency' is final — LLM cannot override.
import 'server-only'
```

**Constants pattern** (per CONTEXT.md D-06 and RESEARCH.md Pattern 6):
```typescript
export const HARD_EMERGENCY_KEYWORDS: Record<string, readonly string[]> = {
  en: ['gas smell', 'gas leak', 'co alarm', 'carbon monoxide'],
  es: ['olor a gas', 'fuga de gas', 'alarma de co', 'monóxido de carbono'],
} as const

export function hasHardEmergencyKeyword(transcriptText: string): boolean {
  const lower = transcriptText.toLowerCase()
  return Object.values(HARD_EMERGENCY_KEYWORDS).flat().some(kw => lower.includes(kw))
}
```

---

### `src/lib/classification/classify-intent.ts` (service, request-response)

**Analog:** `src/lib/retell/client.ts` (singleton import pattern) + `src/app/api/provisioning/create/route.ts` (Zod validation pattern). New pattern for OpenAI structured output — no direct codebase analog.

**Imports pattern** (hybrid of `client.ts` and new `openai` imports):
```typescript
// src/lib/classification/classify-intent.ts
// GPT-4o-mini intent classification with Zod-enforced structured output.
// D-07/D-08: called after hard-code emergency check; result can be overridden by D-06.
// D-12: Intent enum must match Phase 1 schema CHECK constraint exactly.
import 'server-only'
import { zodResponseFormat } from 'openai/helpers/zod'
import { z } from 'zod'
import { getOpenAIClient } from '@/lib/openai/client'
```

**Zod schema pattern** (aligns with `lib/validations/onboarding.ts` Zod style):
```typescript
// Must match Phase 1 schema CHECK constraint: 'lead','emergency','info','no_action','unknown'
// 'unknown' is never returned by LLM — it's the DB default for total failure only
const ClassificationSchema = z.object({
  intent: z.enum(['lead', 'emergency', 'info', 'no_action']),
  detected_trade: z.enum(['hvac', 'plumbing', 'electrical', 'other']).optional(),
  confidence: z.enum(['high', 'medium', 'low']),
})
```

**OpenAI structured output pattern** (verified from RESEARCH.md Pattern 5 — `zodResponseFormat`):
```typescript
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
  if (!result) throw new Error('[classify-intent] OpenAI returned no parsed result')
  return result
}
```

**Error throw pattern** (from `retell-agent-sync.ts` line 69):
```typescript
throw new Error(error.message)
// or for OpenAI:
throw new Error('[classify-intent] OpenAI returned no parsed result')
```

---

### `src/lib/classification/extract-trade.ts` (service, request-response)

**Analog:** `src/lib/classification/classify-intent.ts` (sibling file — exact same structure, different model + schema)

Copy the full structure of `classify-intent.ts`, substituting:
- Model: `'gpt-4o'` (not `'gpt-4o-mini'`)
- Schema: trade-specific per `contractor_settings.trade_type` (D-10)
- Schema name passed to `zodResponseFormat`: `'trade_extraction'`
- Function signature: `extractTradeData(transcriptText: string, detectedTrade?: string): Promise<TradeExtractionResult | null>`

**Trade schema pattern** (per CONTEXT.md D-10):
```typescript
// Per-trade Zod schemas — selected at runtime based on detectedTrade parameter
const HvacSchema = z.object({
  system_age: z.string().optional(),
  issue_type: z.enum(['heating', 'cooling', 'other']),
  urgency: z.enum(['normal', 'urgent', 'emergency']),
})

const PlumbingSchema = z.object({
  leak_type: z.enum(['active', 'slow', 'none']),
  repair_type: z.string().optional(),
  urgency: z.enum(['normal', 'urgent', 'emergency']),
})

const ElectricalSchema = z.object({
  safety_issue: z.boolean(),
  repair_type: z.string().optional(),
  urgency: z.enum(['normal', 'urgent', 'emergency']),
})
```

---

### `src/lib/after-hours/detect.ts` (utility, transform)

**Analog:** `src/lib/crypto/tokens.ts` — pure functions with env/input validation; no DB or external API calls; `import 'server-only'`; exported named functions with typed parameters.

**File header pattern** (from `tokens.ts` lines 1–4, adapted):
```typescript
// src/lib/after-hours/detect.ts
// Pure timestamp comparison for after-hours detection.
// D-11: no LLM — compare callStartAt against contractor business_hours JSONB.
// Uses date-fns-tz toZonedTime() for DST-safe arithmetic (America/New_York handles EDT/EST).
import 'server-only'
import { toZonedTime } from 'date-fns-tz'
import { getDay, getHours, getMinutes } from 'date-fns'
```

**Pure function pattern** (from `tokens.ts` lines 34–50 — named export, typed params, documented):
```typescript
export interface BusinessHours {
  [day: string]: { open: string; close: string; enabled: boolean }
}

// timezone: read from contractors.timezone (NOT contractor_settings) — default 'America/New_York'
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

---

### `src/inngest/functions/retell-call-classify.ts` (service, event-driven)

**Analog:** `src/inngest/functions/retell-agent-sync.ts` — exact structural match. Copy the entire file structure: `import 'server-only'`, `NonRetriableError`, `inngest.createFunction(...)` with `retries: 5`, `triggers`, `onFailure`, destructured event data with type cast, `step.run(...)` blocks, error logging.

**Imports pattern** (from `retell-agent-sync.ts` lines 1–10):
```typescript
// src/inngest/functions/retell-call-classify.ts
import 'server-only'
import { NonRetriableError } from 'inngest'
import { inngest } from '@/inngest/client'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { hasHardEmergencyKeyword } from '@/lib/classification/emergency-keywords'
import { classifyIntent } from '@/lib/classification/classify-intent'
import { extractTradeData } from '@/lib/classification/extract-trade'
```

**Function config pattern** (from `retell-agent-sync.ts` lines 12–27, adapted):
```typescript
export const retellCallClassify = inngest.createFunction(
  {
    id: 'retell-call-classify',
    retries: 5,  // D-12 pattern: max 5 retries; Inngest default exponential backoff
    triggers: [{ event: 'retell/call.classify' }],
    onFailure: async ({ event }) => {
      // onFailure: event.data.event is the original payload (FailureEventPayload shape)
      const { callId } = event.data.event.data as { callId: string }
      const db = createServiceRoleClient()
      await db.from('calls').update({ analysis_status: 'analysis_failed' }).eq('id', callId)
    },
  },
  async ({ event, step }) => { ... }
)
```

**NonRetriableError guard pattern** (from `retell-agent-sync.ts` lines 37–40):
```typescript
if (!contractorId || !callId) {
  throw new NonRetriableError(
    `[retell-call-classify] invalid event data: missing callId or contractorId`
  )
}
```

**step.run pattern** (from `retell-agent-sync.ts` lines 44–58):
```typescript
await step.run('check-hard-emergency', async () => {
  return hasHardEmergencyKeyword(transcriptText ?? '')
})

await step.run('classify-intent', async () => {
  const isShortCall = (durationMs ?? 0) < 15000  // D-13
  return classifyIntent(transcriptText ?? '', isShortCall)
})

await step.run('persist-classification', async () => {
  const db = createServiceRoleClient()
  const { error } = await db.from('calls').update({
    intent: finalIntent,
    raw_metadata: tradeData,
    analysis_status: 'complete',
  }).eq('id', callId)
  if (error) {
    console.error('[retell-call-classify] persist-classification failed:', error.message)
    throw new Error(error.message)
  }
})
```

**DB error throw pattern** (from `retell-agent-sync.ts` lines 65–70):
```typescript
if (error) {
  console.error('[retell-agent-sync] set-synced-status failed:', error.message)
  throw new Error(error.message)
}
```

---

### `src/inngest/functions/retell-analysis-timeout.ts` (service, batch)

**Analog:** `src/inngest/functions/retell-agent-sync.ts` — same outer structure but with a `cron` trigger instead of `event` trigger. No `onFailure` needed (cron is idempotent: next run will catch any remaining stale rows).

**Cron trigger pattern** (from RESEARCH.md Pattern 9 — verified via Context7 Inngest docs):
```typescript
export const retellAnalysisTimeout = inngest.createFunction(
  {
    id: 'retell-analysis-timeout',
    triggers: [{ cron: '*/5 * * * *' }],  // every 5 min; 30-min guard applied inside step
  },
  async ({ step }) => {
    await step.run('mark-stale-analyzing', async () => {
      const db = createServiceRoleClient()
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
      const { error } = await db
        .from('calls')
        .update({ analysis_status: 'analysis_failed' })
        .eq('analysis_status', 'analyzing')
        .lt('created_at', thirtyMinutesAgo)
      if (error) {
        console.error('[retell-analysis-timeout] mark-stale failed:', error.message)
        throw new Error(error.message)
      }
    })
  }
)
```

**Note:** After writing both new Inngest functions, update `src/app/api/inngest/route.ts` (lines 8 + 11) to add them to `serve()`:
```typescript
import { retellCallClassify } from '@/inngest/functions/retell-call-classify'
import { retellAnalysisTimeout } from '@/inngest/functions/retell-analysis-timeout'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [retellAgentSync, retellCallClassify, retellAnalysisTimeout],
})
```

---

### `supabase/migrations/[timestamp]_webhook_core.sql` (migration, CRUD)

**Analog:** `supabase/migrations/20260506000004_agent_sync_status.sql` — exact match. Adds columns to existing tables, updates CHECK constraints, no RLS table creation needed (tables already have RLS; existing policies cover all columns).

**File header pattern** (from `20260506000004_agent_sync_status.sql` lines 1–8):
```sql
-- [timestamp]_webhook_core.sql
-- Phase 3: Webhook Core — adds analysis_status to calls;
-- adds notify_on_general_inquiry to notification_settings.
-- D-03: analysis_status tracks the two-stage call enrichment lifecycle.
-- D-15: notify_on_general_inquiry controls Phase 5 notification dispatch for info calls.
-- RLS: existing policies on both tables already cover all four operations (no new policies needed).
```

**ADD COLUMN pattern** (from `20260506000004_agent_sync_status.sql` lines 10–13):
```sql
-- 1. Add analysis_status to calls
ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS analysis_status TEXT
    CHECK (analysis_status IS NULL OR analysis_status IN ('pending', 'analyzing', 'complete', 'analysis_failed'))
    DEFAULT 'pending';

-- 2. Add notify_on_general_inquiry to notification_settings
ALTER TABLE notification_settings
  ADD COLUMN IF NOT EXISTS notify_on_general_inquiry BOOLEAN NOT NULL DEFAULT FALSE;
```

**Existing RLS policy coverage verification comment** (required per CLAUDE.md critical rule 1):
```sql
-- RLS verification: existing policies in 20260504000002_rls_policies.sql cover
-- calls and notification_settings with all four operations (SELECT/INSERT/UPDATE/DELETE)
-- by contractor_id. New columns are automatically covered — no policy changes needed.
-- Verified: calls policies (lines 58–78), notification_settings policies (lines 179–198).
```

---

## Shared Patterns

### `import 'server-only'` in all lib modules
**Source:** `src/lib/retell/client.ts` line 5, `src/lib/supabase/service.ts` line 5, `src/inngest/client.ts` line 5, `src/inngest/functions/retell-agent-sync.ts` line 6
**Apply to:** ALL new files under `src/lib/` and `src/inngest/functions/`
```typescript
import 'server-only'  // First line of every lib and inngest file
```

### Service Role Client (webhook + Inngest only)
**Source:** `src/lib/supabase/service.ts` lines 8–23
**Apply to:** `src/app/api/webhooks/retell/route.ts`, both Inngest functions
```typescript
import { createServiceRoleClient } from '@/lib/supabase/service'
// ...
const db = createServiceRoleClient()
```
Never use `createSupabaseServer()` (user session) in webhook handlers or Inngest functions.

### Env var guard pattern
**Source:** `src/lib/retell/client.ts` lines 23–25
**Apply to:** `src/lib/openai/client.ts`
```typescript
const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) throw new Error('OPENAI_API_KEY is not set')
```

### Error logging with context prefix
**Source:** `src/app/api/provisioning/create/route.ts` lines 43, 79, 97, 113
**Apply to:** All new route and Inngest files
```typescript
console.error('[webhook/retell] descriptive message:', err instanceof Error ? err.message : err)
// Format: '[module/function] message:', errorValue
```

### Inngest function retries + onFailure
**Source:** `src/inngest/functions/retell-agent-sync.ts` lines 12–27
**Apply to:** `src/inngest/functions/retell-call-classify.ts`
```typescript
{
  id: 'retell-call-classify',
  retries: 5,
  triggers: [{ event: 'retell/call.classify' }],
  onFailure: async ({ event }) => {
    const { callId } = event.data.event.data as { callId: string }
    // set analysis_status = 'analysis_failed'
  },
}
```

### Supabase DB error → throw
**Source:** `src/inngest/functions/retell-agent-sync.ts` lines 65–70
**Apply to:** All `step.run()` blocks that write to Supabase in Inngest functions
```typescript
if (error) {
  console.error('[function-name] step-name failed:', error.message)
  throw new Error(error.message)
}
```

### Zod schema validation
**Source:** `src/app/api/provisioning/create/route.ts` lines 18–20
**Apply to:** `src/lib/classification/classify-intent.ts`, `src/lib/classification/extract-trade.ts`
```typescript
import { z } from 'zod'
// Define schema at module level; infer TypeScript type with z.infer<typeof Schema>
```

### Path alias imports
**Source:** `src/inngest/functions/retell-agent-sync.ts` lines 8–10
**Apply to:** All new files
```typescript
import { inngest } from '@/inngest/client'
import { createServiceRoleClient } from '@/lib/supabase/service'
// Always use @/ alias, never relative paths across directory boundaries
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/lib/retell/webhook-types.ts` (type-only) | utility | transform | Project has no existing type-only definition file; closest is the implicit types in `database.ts`. Pattern is trivial: `import 'server-only'` + exported interfaces. |

---

## Metadata

**Analog search scope:** `src/app/api/`, `src/lib/`, `src/inngest/`, `supabase/migrations/`
**Files scanned:** 14 source files, 6 migration files
**Pattern extraction date:** 2026-05-08

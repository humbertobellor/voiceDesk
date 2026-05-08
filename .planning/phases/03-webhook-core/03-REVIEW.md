---
phase: 03-webhook-core
reviewed: 2026-05-08T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - src/app/api/inngest/route.ts
  - src/app/api/webhooks/retell/handlers.ts
  - src/app/api/webhooks/retell/route.ts
  - src/inngest/functions/retell-analysis-timeout.ts
  - src/inngest/functions/retell-call-classify.ts
  - src/lib/after-hours/detect.ts
  - src/lib/classification/classify-intent.ts
  - src/lib/classification/emergency-keywords.ts
  - src/lib/classification/extract-trade.ts
  - src/lib/openai/client.ts
  - src/lib/retell/webhook-types.ts
  - tests/__mocks__/openai.ts
  - tests/api/webhook.test.ts
  - tests/lib/after-hours.test.ts
  - tests/lib/classification.test.ts
findings:
  critical: 4
  warning: 4
  info: 3
  total: 11
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-05-08T00:00:00Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Phase 3 implements the Retell webhook core: signature verification, call persistence, after-hours detection, and a two-step LLM classification pipeline via Inngest. The architecture is mostly sound — signature verification fires before payload access, `after()` returns 200 immediately, and contractor ID is correctly resolved server-side from `agent_id`. However, four blockers were found:

1. `processCallAnalyzed` upsert cannot INSERT a new row because `contractor_id NOT NULL` is enforced by the schema — the stated race-condition guard is silently broken and permanently loses transcript data.
2. Haitian Creole (`ht`) emergency keywords are entirely absent despite being a declared supported language (CLAUDE.md + schema both confirm `ht` support).
3. The `webhook_events` idempotency table (required by CLAUDE.md Rule 5) is never written to, so duplicate `call_analyzed` deliveries fire duplicate Inngest classification jobs.
4. `process.env.RETELL_API_KEY!` uses a TypeScript non-null assertion with no runtime guard — a missing env var causes `verify()` to throw and return HTTP 500 to Retell instead of a startup-time failure.

---

## Critical Issues

### CR-01: processCallAnalyzed race-condition guard is broken — transcript permanently lost

**File:** `src/app/api/webhooks/retell/handlers.ts:83-103`

**Issue:** The upsert in `processCallAnalyzed` only supplies `retell_call_id`, `summary`, `transcript`, and `recording_url` — it does NOT include `contractor_id`. The `calls` table defines `contractor_id UUID NOT NULL` (migration `20260504000001_initial_schema.sql` line 79). When `call_analyzed` arrives before `call_ended` (a documented race condition), the upsert attempts an INSERT with a NULL `contractor_id`, the DB rejects it with a constraint violation, `upsertError` is set, and the function returns early at line 102. Because the webhook already returned HTTP 200 (before `after()` ran), Retell will not retry the event. The transcript is permanently lost.

The comment `D-05: UPSERT handles race where call_analyzed arrives before call_ended` is incorrect — the constraint makes this impossible.

**Fix:** Either look up the `contractor_id` in `processCallAnalyzed` (same pattern as `processCallEnded`) before upserting, or relax `contractor_id` to nullable and backfill it when `call_ended` subsequently arrives:

```typescript
// Option A: Look up contractor_id in processCallAnalyzed as well
const { data: contractor } = await db
  .from('contractors')
  .select('id')
  .eq('retell_agent_id', call.agent_id)
  .maybeSingle()

const { data: callRow, error: upsertError } = await db
  .from('calls')
  .upsert(
    {
      contractor_id: contractor?.id ?? null, // nullable — safe if call_ended arrives later
      retell_call_id: call.call_id,
      summary: call.call_analysis?.call_summary ?? null,
      transcript: call.transcript_object ?? null,
      recording_url: call.recording_url ?? null,
    },
    { onConflict: 'retell_call_id' }
  )
  .select('id, contractor_id')
  .maybeSingle()
```

Note that Option A also requires making `contractor_id` nullable in the schema for the INSERT path. Option B (preferred) is to set `contractor_id` as nullable in the calls schema while keeping a DB trigger or application-level check to ensure it is filled in before any Phase 4/5 processing.

---

### CR-02: Haitian Creole emergency keywords missing — safety requirement violated

**File:** `src/lib/classification/emergency-keywords.ts:8-25`

**Issue:** `HARD_EMERGENCY_KEYWORDS` contains English (`en`) and Spanish (`es`) entries but has no Haitian Creole (`ht`) entry. CLAUDE.md declares Haitian Creole as a first-class supported language for the South Florida market. The database schema (`contractor_settings.supported_languages`) explicitly allows `'ht'` and even ships default emergency keywords for `ht` in the `emergency_keywords` JSONB default (including `'sant gaz'`, `'alàm CO'`). A caller saying "sant gaz" or "alàm CO" in Haitian Creole will not trigger the hard-coded emergency path (EMRG-02) and will instead be routed to the LLM — a safety regression.

**Fix:**
```typescript
export const HARD_EMERGENCY_KEYWORDS: Record<string, readonly string[]> = {
  en: [
    'gas smell',
    'gas leak',
    'co alarm',
    'carbon monoxide',
    'co detector',
    'carbon monoxide alarm',
  ],
  es: [
    'olor a gas',
    'fuga de gas',
    'alarma de co',
    'monóxido de carbono',
    'detector de co',
    'alarma de monóxido',
  ],
  ht: [
    'sant gaz',
    'koule gaz',
    'alàm co',
    'monoksid kabòn',
    'detektè co',
    'alàm monoksid',
  ],
} as const
```

A test covering `hasHardEmergencyKeyword('sant gaz nan kay la')` must also be added.

---

### CR-03: Duplicate call_analyzed deliveries fire duplicate Inngest classify jobs — idempotency gap

**File:** `src/app/api/webhooks/retell/handlers.ts:110-125`

**Issue:** `processCallAnalyzed` calls `inngest.send(...)` on every invocation with no idempotency key. The DB upsert is idempotent (same `retell_call_id` row is updated), but the Inngest dispatch is not guarded. If Retell retries `call_analyzed` delivery (its standard behavior on non-2xx, network timeouts, or during their retry window), two or more `retell/call.classify` jobs fire for the same call. Both jobs read the same transcript, make two OpenAI API calls each, and race to write `intent`/`raw_metadata`/`analysis_status` to the same row — a non-deterministic last-write-wins outcome.

CLAUDE.md Critical Rule 5 explicitly requires the `webhook_events` table for this purpose. That table is never written to anywhere in Phase 3.

**Fix:** Add an idempotency key to `inngest.send`, using the Retell `call_id` as the deduplication key:

```typescript
await inngest.send({
  name: 'retell/call.classify',
  id: `classify-${call.call_id}`,   // Inngest idempotency key — deduplicates within 24h window
  data: {
    callId: callRow.id,
    contractorId: callRow.contractor_id,
    transcriptText: call.transcript ?? null,
    durationMs: call.duration_ms ?? null,
  },
})
```

The `webhook_events` table insert (per CLAUDE.md Rule 5) should also be added for full idempotency tracking:

```typescript
await db.from('webhook_events').upsert(
  {
    source: 'retell',
    event_type: 'call_analyzed',
    external_id: call.call_id,
    payload: call as unknown as Record<string, unknown>,
    processed: true,
    processed_at: new Date().toISOString(),
  },
  { onConflict: 'source,event_type,external_id', ignoreDuplicates: true }
)
```

---

### CR-04: Missing runtime guard on RETELL_API_KEY — unhandled throw causes HTTP 500

**File:** `src/app/api/webhooks/retell/route.ts:24`

**Issue:** `process.env.RETELL_API_KEY!` uses a TypeScript non-null assertion. At runtime, if `RETELL_API_KEY` is not set (misconfiguration, env var omission, secrets not synced to Vercel), the `!` operator does not throw — it passes `undefined` to `verify()`. The `retell-sdk` `verify()` function internally calls Node.js `crypto.createHmac('sha256', undefined)`, which throws `TypeError: The "key" argument must be of type string`. This uncaught exception propagates out of the `POST` handler and results in an HTTP 500 returned to Retell. Retell will retry the webhook, generating more 500s. The error message in Vercel logs will reference internal crypto internals rather than a clear misconfiguration.

**Fix:**
```typescript
export async function POST(req: Request) {
  const apiKey = process.env.RETELL_API_KEY
  if (!apiKey) {
    console.error('[webhook/retell] RETELL_API_KEY is not configured')
    return new Response('Internal Server Error', { status: 500 })
  }

  const rawBody = await req.text()
  const signature = req.headers.get('x-retell-signature') ?? ''

  const isValid = await verify(rawBody, apiKey, signature)
  // ...
}
```

---

## Warnings

### WR-01: detectAfterHours returns false (in-hours) when business_hours time strings are malformed

**File:** `src/lib/after-hours/detect.ts:35-43`

**Issue:** Lines 35-36 parse `open` and `close` time strings with `Number()`. If the JSONB value is malformed (e.g., `""`, `"invalid"`, `"8:"`, or a missing key), `Number("invalid")` returns `NaN`. `NaN * 60 + NaN` is `NaN`. The boundary expression `currentMinutes < NaN || currentMinutes >= NaN` evaluates to `false || false = false` — the function incorrectly reports the call as within business hours. This means after-hours calls for contractors with corrupted `business_hours` data are silently treated as in-hours, which suppresses the `is_after_hours` flag and may suppress Phase 5 emergency notifications.

**Fix:**
```typescript
const [openH, openM] = dayConfig.open.split(':').map(Number)
const [closeH, closeM] = dayConfig.close.split(':').map(Number)

// Guard against malformed time strings
if (isNaN(openH) || isNaN(openM) || isNaN(closeH) || isNaN(closeM)) {
  console.error('[detectAfterHours] malformed business_hours time string for day:', dayName, dayConfig)
  return true  // Fail safe: treat as after-hours if data is corrupt
}
```

---

### WR-02: extractTradeData returns null on OpenAI failure instead of throwing — silently skips Inngest retry

**File:** `src/lib/classification/extract-trade.ts:82-86`

**Issue:** When `completion.choices[0]?.message?.parsed` is `null` or `undefined` (e.g., OpenAI structured output refusal, model error, or empty response), `extractTradeData` logs a `console.error` and returns `null` instead of throwing. In `retell-call-classify.ts` step `extract-trade-data`, the step resolves with `null` rather than throwing, so Inngest does not retry the step. The classification then proceeds to write `raw_metadata: null` and `analysis_status: 'complete'`, permanently losing the trade extraction data with no observable error state. Compare with `classifyIntent` (line 54) which correctly throws: `throw new Error('[classify-intent] OpenAI returned no parsed result')`.

**Fix:**
```typescript
const result = completion.choices[0]?.message?.parsed
if (!result) {
  // Throw to allow Inngest step retry — do not silently swallow the failure
  throw new Error(`[extract-trade] OpenAI returned no parsed result for trade: ${detectedTrade}`)
}
return result as TradeExtractionResult
```

---

### WR-03: processCallAnalyzed has no test coverage

**File:** `tests/api/webhook.test.ts`

**Issue:** The `webhook.test.ts` file imports and tests only `processCallEnded`. There is no test for `processCallAnalyzed` — the handler that persists the transcript, summary, and fires the Inngest classification job. The following behaviors are completely uncovered: transcript upsert with `call_analysis.call_summary` (D-09), `transcript_object` vs `transcript` selection (D-07), `inngest.send` event payload shape, Inngest send failure handling, and the `callRow.contractor_id` being passed to the event. The `call_analyzed` route dispatch path (route.ts line 39) is also untested.

**Fix:** Add a `describe('processCallAnalyzed', ...)` block covering at minimum:
- Happy path: upsert is called with `summary` from `call.call_analysis.call_summary`, `transcript` from `call.transcript_object`, and `inngest.send` is called with the correct payload.
- Inngest send failure: verify the function does not re-throw (transcript already persisted).
- Missing `call_id` / null `callRow`: verify early return without Inngest dispatch.

---

### WR-04: JSON.parse in webhook route is unguarded — malformed body causes unhandled 500

**File:** `src/app/api/webhooks/retell/route.ts:30`

**Issue:** After signature verification succeeds (meaning the request is authentic), `JSON.parse(rawBody)` is called without a try/catch. If Retell ever sends a valid-signature payload that is malformed JSON (e.g., during a Retell platform bug or a partial transmission), the parse throws a `SyntaxError` that propagates uncaught from the `POST` handler, returning HTTP 500. While this scenario is unlikely with a well-behaved upstream, the signature only guarantees authenticity, not JSON validity.

**Fix:**
```typescript
let event: RetellWebhookEvent
try {
  event = JSON.parse(rawBody) as RetellWebhookEvent
} catch {
  console.error('[webhook/retell] failed to parse JSON body after valid signature')
  return new Response('Bad Request', { status: 400 })
}
```

---

## Info

### IN-01: transcriptObject sent to Inngest but never consumed by classify function

**File:** `src/app/api/webhooks/retell/handlers.ts:117` / `src/inngest/functions/retell-call-classify.ts:35-40`

**Issue:** `processCallAnalyzed` sends `transcriptObject: call.transcript_object ?? null` in the Inngest event payload. The `retell-call-classify` function destructures only `{ callId, contractorId, transcriptText, durationMs }` — `transcriptObject` is never read. The structured transcript is already stored in the DB `calls.transcript` JSONB column, so the LLM pipeline correctly uses the plain `transcriptText` string. The `transcriptObject` in the event payload is dead weight, inflating Inngest event size for every call.

**Fix:** Remove `transcriptObject` from the `inngest.send` data payload in `handlers.ts`.

---

### IN-02: tests/__mocks__/openai.ts is dead code in Vitest context

**File:** `tests/__mocks__/openai.ts`

**Issue:** Vitest does not auto-apply `__mocks__/` directory mocks the way Jest does unless `automock: true` is configured (it is not) or the module is explicitly aliased in `vitest.config.ts` (it is not — only `server-only` is aliased). `tests/__mocks__/openai.ts` is never loaded by any test. The classification tests correctly use an inline `vi.mock('openai', ...)` factory. The dead mock file exports `mockParse` which is confused with the `vi.hoisted` `mockParse` in `classification.test.ts`.

**Fix:** Delete `tests/__mocks__/openai.ts` to avoid future confusion, or add a comment explaining it is not auto-applied. If auto-application is desired, add to `vitest.config.ts`:
```typescript
alias: {
  'openai': path.resolve(__dirname, './tests/__mocks__/openai.ts'),
}
```

---

### IN-03: Misleading comment in onFailure handler describes event shape incorrectly

**File:** `src/inngest/functions/retell-call-classify.ts:24`

**Issue:** The comment reads: `// event.data.event is the FailureEventPayload; .data is the original retell/call.classify payload`. This is backwards. Per the Inngest SDK `FailureEventArgs` type: `event` is the `FailureEventPayload`, `event.data` is `{ function_id, run_id, error, event: P }`, and `event.data.event` is `P` — the original `retell/call.classify` event (which has its own `.data` field containing `{ callId, ... }`). The actual access path `event.data.event.data` is correct, but the comment misdescribes what `event.data.event` is (it calls it "the FailureEventPayload" when it is actually the original trigger event).

**Fix:**
```typescript
// FailureEventArgs shape: { event: FailureEventPayload, error: Error }
// FailureEventPayload.data: { function_id, run_id, error, event: OriginalEvent }
// OriginalEvent: { name: 'retell/call.classify', data: { callId, contractorId, ... } }
// Therefore: event.data.event.data = { callId, contractorId, ... }
const { callId } = event.data.event.data as { callId: string }
```

---

_Reviewed: 2026-05-08T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

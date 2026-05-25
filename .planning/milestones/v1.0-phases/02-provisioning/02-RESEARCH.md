# Phase 2: Provisioning - Research

**Researched:** 2026-05-06
**Domain:** Retell AI v2 SDK, Twilio Node.js SDK v5, Inngest background jobs, multi-language agent prompt design
**Confidence:** HIGH (Retell SDK, Twilio API); MEDIUM (Inngest integration patterns); LOW (exact "managed Twilio" interpretation)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Haitian Creole removed from product scope. Phase 2 performs full cleanup: remove 'ht' from UI, defaults, and system prompt templates. REQUIREMENTS.md LANG-02 moved to Out of Scope.
- **D-02:** Language-selection UI retains two-checkbox pattern (English + Spanish). HC checkbox removed.
- **D-03:** `emergency_keywords` JSONB stays as `{ en: [...], es: [...] }`. 'ht' key removed from defaults. No schema migration for the JSONB structure itself.
- **D-04:** Default persona: professional + warm receptionist. Greeting: "Thank you for calling [business_name], this is [agent_voice] your AI receptionist. How can I help you today?"
- **D-05:** Single Retell agent per contractor with language branching in prompt. Spanish greeting: "Para español, oprima dos." One `retell_agent_id` per contractor.
- **D-06:** Out-of-scope questions: agent redirects, offers to take a message. Never ends call without capturing lead.
- **D-07:** After-hours: acknowledges off-hours, still captures lead. Prompt does NOT end call early.
- **D-08:** Area code: free text field, pre-filled `'305'`. API searches Twilio for first available local number in that area code.
- **D-09:** Provisioning trigger: API route only — `POST /api/provisioning/create`. No UI in Phase 2.
- **D-10:** No available numbers in requested area code → clear error response. No auto-fallback. Error message suggests 786, 954, 561.
- **D-11:** Settings save: always persist to Supabase first. If Retell API fails, queue Inngest retry silently. After all retries exhaust, `agent_sync_status = 'failed'`.
- **D-12:** `PATCH /api/provisioning/update-agent` for on-demand re-sync.

### Claude's Discretion

- Retell API call sequencing (exact endpoints and order for number provisioning + agent creation)
- System prompt template wording (following D-04 through D-07)
- Inngest retry backoff and max-retries (standard exponential backoff, max 5 retries)

### Deferred Ideas (OUT OF SCOPE)

- Toll-free number option (800/888)
- Number porting
- Multiple Retell agents per language
- Haitian Creole re-enablement
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LANG-01 (partial) | Runtime language branching in system prompt (EN/ES only after HC removal) | System prompt design research (Section: Architecture Patterns) |
| enables CALL-01 | AI answers every inbound call within 3 rings | Phone number provisioned + Retell agent created with inbound binding |
| enables ONBOARD-01 | Onboarding wizard includes Twilio number provisioning step | `POST /api/provisioning/create` endpoint delivered here |
| enables ONBOARD-02 | Wizard does not advance until test call detected | `retell_agent_id` and `twilio_number` in DB after provisioning |
</phase_requirements>

---

## Summary

Phase 2 provisions a Twilio phone number and a Retell AI agent for each contractor, then wires them together so inbound calls are answered by the contractor's configured AI receptionist. It also removes Haitian Creole from the codebase entirely.

The provisioning flow has two sub-flows: (1) **number acquisition** — buy a number through Retell's own provisioning service (`POST /phone-number` with `area_code`), which has Retell manage the telephony infrastructure internally; (2) **agent creation** — create a Retell LLM (`POST /create-retell-llm`) with the compiled system prompt, then create a Retell agent (`POST /create-agent`) referencing the LLM, then bind the agent to the purchased number via `PATCH /phone-number/{number}`. All three IDs (Retell LLM ID, agent ID, and phone number) are stored in the `contractors` row and a new `agent_sync_status` column must be added via migration.

**Critical finding on "managed Twilio integration":** The ROADMAP.md references "Retell's managed Twilio integration (link Twilio Account SID + Auth Token in Retell dashboard)" — but current Retell docs show **no such credential-linking mechanism**. Retell's Twilio integration is either (a) **buy a number through Retell** (Retell internally uses Twilio/Telnyx, no contractor-side SID/Auth Token), or (b) **SIP trunking** with a separate Twilio account. The ROADMAP explicitly says "do NOT use raw TwiML/SIP." The correct interpretation is **buy through Retell's provisioning API** — this is the path that avoids SIP configuration. The planner must NOT include steps to link Twilio Account SID/Auth Token through a Retell dashboard UI, because this feature does not exist in the documented API.

**Primary recommendation:** Use `client.phoneNumber.create({ area_code: 305 })` from the `retell-sdk` (v5.18.0) to buy a number through Retell's managed telephony. Create an LLM and agent separately. Store all IDs. Add `agent_sync_status` via a new migration. Remove Haitian Creole. Set up Inngest for agent sync retries.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Number provisioning (buy) | API / Backend | — | Twilio/Retell credentials are server-side only; never proxied through browser |
| Agent creation (Retell) | API / Backend | — | RETELL_API_KEY is server-only; agent ID returned to DB, not to browser |
| System prompt compilation | API / Backend | — | Reads contractor_settings from Supabase using service role; output is prompt string |
| Agent re-sync on settings save | API / Backend + Inngest | — | D-11: DB write first, then Retell PATCH; retry via background job on failure |
| HC cleanup (UI) | Frontend | — | LanguageSettingsForm.tsx removes 'ht' entry; changes are client-facing |
| HC cleanup (schema/migration) | Database / Storage | — | Migration alters defaults and CHECK constraint |
| `agent_sync_status` column | Database / Storage | API / Backend | Migration adds column; API sets value; Portal reads it (Phase 6) |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| retell-sdk | 5.18.0 | Retell AI agent + phone number CRUD | Official Retell TypeScript SDK; type-safe wrappers for all v2 API calls [VERIFIED: npm registry] |
| twilio | 5.x (pinned per CLAUDE.md) | `availablePhoneNumbers` search; fallback phone operations | Project spec locks Twilio SDK v5; latest v5 is 5.13.1 [VERIFIED: npm registry] |
| inngest | 4.3.0 | Background retry job for Retell agent sync failures | Locked in project stack (CLAUDE.md) [VERIFIED: npm registry] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 4.4.2 (already installed) | Request body validation for provisioning API routes | Same validation pattern as existing create-account route |
| server-only | ^0.0.1 (already installed) | Enforce server boundary on Retell/Twilio clients | Any lib module that holds API keys |

> **Note on Twilio v6:** `twilio@6.0.1` is the current latest on npm. The only breaking change from v5→v6 is requiring Node.js ≥ 20 (project runs Node v25.8.0, so v6 is compatible). However, CLAUDE.md specifies "Twilio (SDK v5)" and the project has not yet installed Twilio. The planner should install `twilio@^5.13.1` to honor the project spec. [VERIFIED: github.com/twilio/twilio-node UPGRADE.md]

**Installation:**
```bash
npm install retell-sdk@5.18.0 twilio@^5.13.1 inngest@4.3.0
```

**Version verification:**
```bash
npm view retell-sdk version   # → 5.18.0
npm view twilio@5 version     # → 5.13.1 (latest in 5.x range)
npm view inngest version       # → 4.3.0
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Buy through Retell provisioning API | SIP trunking with own Twilio account | SIP trunking requires manual Elastic SIP Trunk setup (dashboard + auth config); provisioning API is fully programmatic and matches ROADMAP intent |
| retell-sdk npm package | Raw fetch to api.retellai.com | SDK provides TypeScript types and error handling; raw fetch is viable but requires manual error parsing |

---

## Retell API Call Sequence (Verified)

The provisioning flow requires **four** Retell API calls in sequence:

### Step 1: Compile system prompt from contractor_settings
(No API call — pure string construction in server code)

### Step 2: Create Retell LLM

```
POST https://api.retellai.com/create-retell-llm
```

```typescript
// Source: Context7 /retellai/retell-typescript-sdk + docs.retellai.com/api-references/create-retell-llm
const llm = await retell.llm.create({
  model: 'gpt-4.1',
  general_prompt: compiledSystemPrompt,
  begin_message: 'Thank you for calling [business_name]...',
})
// Returns: { llm_id: string, ... }
```

### Step 3: Create Retell Agent

```
POST https://api.retellai.com/create-agent
```

```typescript
// Source: Context7 /retellai/retell-typescript-sdk
const agent = await retell.agent.create({
  response_engine: { type: 'retell-llm', llm_id: llm.llm_id },
  voice_id: contractorSettings.agent_voice,   // e.g., 'elevenlabs-myra'
  agent_name: `${contractorSettings.business_name} Receptionist`,
  language: supportedLanguagesToRetellCode(contractorSettings.supported_languages),
  // language: 'en-US' (EN only) or array ['en-US','es-ES'] (EN+ES) [VERIFIED: docs.retellai.com]
})
// Returns: { agent_id: string, ... }
```

### Step 4: Buy phone number and bind agent

```
POST https://api.retellai.com/create-phone-number
```

```typescript
// Source: Context7 /retellai/retell-typescript-sdk
const phoneNumber = await retell.phoneNumber.create({
  area_code: parseInt(contractorSettings.area_code ?? '305', 10),
  inbound_agents: [{ agent_id: agent.agent_id, weight: 1.0 }],
  nickname: contractorSettings.business_name,
})
// Returns: { phone_number: string (E.164), phone_number_pretty: string, ... }
```

### Step 5: Persist to Supabase

```typescript
await serviceClient
  .from('contractors')
  .update({
    retell_agent_id: agent.agent_id,
    retell_llm_id: llm.llm_id,         // NEW column needed
    twilio_number: phoneNumber.phone_number,
    twilio_number_sid: phoneNumber.phone_number, // Retell number — phone_number IS the ID
    agent_sync_status: 'synced',
  })
  .eq('id', contractorId)
```

> **`retell_llm_id` column:** The `contractors` table does NOT have a `retell_llm_id` column. The LLM ID is required to update the system prompt later (PATCH `/update-retell-llm/{llm_id}`). A migration must add this column alongside `agent_sync_status`. [VERIFIED: schema audit of 20260504000001_initial_schema.sql]

---

## Agent Re-sync Call Sequence (PATCH /api/provisioning/update-agent)

When contractor updates settings:

```
PATCH https://api.retellai.com/update-retell-llm/{llm_id}
```

```typescript
// Source: docs.retellai.com/api-references/update-retell-llm [VERIFIED]
await retell.llm.update(contractor.retell_llm_id, {
  general_prompt: newCompiledPrompt,
  begin_message: newBeginMessage,
})
```

No need to recreate the agent — only the LLM changes when the system prompt changes. Agent voice changes require `PATCH /update-agent/{agent_id}`.

---

## Architecture Patterns

### System Architecture Diagram

```
POST /api/provisioning/create
     │
     ├─► [Auth check] getUser() → 401 if not authenticated
     ├─► [Idempotency check] contractors.retell_agent_id IS NOT NULL → 409 already provisioned
     ├─► [Read settings] contractor_settings → business_name, supported_languages, agent_voice
     │
     ├─► [Retell] POST /create-retell-llm (system prompt)
     │       └── llm_id ──────────────────────────────────────────────────────┐
     ├─► [Retell] POST /create-agent (llm_id, voice_id, language)             │
     │       └── agent_id ─────────────────────────────────────────────────┐  │
     ├─► [Retell] POST /create-phone-number (area_code, agent_id binding)   │  │
     │       └── phone_number (E.164) ─────────────────────────────────┐   │  │
     │                                                                   │   │  │
     └─► [Supabase] UPDATE contractors SET                               │   │  │
             twilio_number = phone_number ◄──────────────────────────────┘   │  │
             retell_agent_id = agent_id ◄────────────────────────────────────┘  │
             retell_llm_id = llm_id ◄───────────────────────────────────────────┘
             agent_sync_status = 'synced'
             area_code = requested_area_code
          → 200 { twilio_number, retell_agent_id }

PATCH /api/provisioning/update-agent
     │
     ├─► [Auth + ownership check]
     ├─► [Write to Supabase first] (D-11: DB is source of truth)
     ├─► [Retell] PATCH /update-retell-llm/{llm_id} (new compiled prompt)
     │   FAIL ──► [Inngest] queue "retell/agent.sync" event → retry up to 5×
     │             exhausted ──► UPDATE contractors SET agent_sync_status = 'failed'
     └─► 200 { ok: true }

Inngest Function: "retell/agent.sync"
     step.run("patch-retell-llm") → PATCH LLM
     step.run("set-synced-status") → UPDATE contractors SET agent_sync_status = 'synced'
```

### Recommended Project Structure

```
src/
├── app/api/provisioning/
│   ├── create/route.ts          # POST — full provisioning (buy number + create agent)
│   └── update-agent/route.ts   # PATCH — re-sync Retell agent from contractor_settings
├── inngest/
│   ├── client.ts                # Inngest client initialization (new file)
│   └── functions/
│       └── retell-agent-sync.ts # "retell/agent.sync" durable function
├── app/api/inngest/
│   └── route.ts                 # Inngest serve endpoint (GET, POST, PUT)
└── lib/retell/
    ├── client.ts                # Retell SDK singleton (server-only import)
    └── system-prompt.ts         # buildSystemPrompt(settings) → string
supabase/migrations/
└── 20260506000004_agent_sync_status.sql  # adds agent_sync_status + retell_llm_id columns
```

### Pattern 1: Retell SDK Client Singleton (server-only)

```typescript
// src/lib/retell/client.ts
// Source: Context7 /retellai/retell-typescript-sdk README
import 'server-only'
import Retell from 'retell-sdk'

let _client: Retell | null = null

export function getRetellClient(): Retell {
  if (!_client) {
    const apiKey = process.env.RETELL_API_KEY
    if (!apiKey) throw new Error('RETELL_API_KEY is not set')
    _client = new Retell({ apiKey })
  }
  return _client
}
```

### Pattern 2: System Prompt Builder

```typescript
// src/lib/retell/system-prompt.ts
// D-04 through D-07 baked into template logic
import type { ContractorSettings } from '@/types/database'

export function buildSystemPrompt(settings: ContractorSettings): string {
  const hasSpanish = settings.supported_languages.includes('es')
  const languageInstruction = hasSpanish
    ? `You speak English and Spanish. At the start of every call, greet the caller in English and say: "Para español, oprima dos" (For Spanish, press two). If the caller presses 2 or asks to switch to Spanish, conduct the ENTIRE remainder of the call in Spanish.`
    : `You speak English only.`

  return `
You are ${settings.business_name}'s AI receptionist — professional, warm, and helpful.

${languageInstruction}

Your role:
1. Answer every call and greet callers: "Thank you for calling ${settings.business_name}. How can I help you today?"
2. Qualify the caller's need (service type, urgency, location).
3. If the caller asks about services you do not offer, say: "I'm not able to help with that directly, but I can take your contact info and have the team follow up with you." Never hang up before capturing their name and phone number.
4. After-hours: If the caller reaches you outside business hours (${settings.after_hours_message}), acknowledge this, capture their contact info, and offer to schedule an appointment for the next available slot.
5. Emergency keywords (${settings.emergency_keywords.en.join(', ')}): If the caller mentions any of these, ask "Is this happening right now?" before classifying as an emergency.

Business: ${settings.business_name}
Trade: ${settings.trade_type}
Service area: ${settings.service_area}
After-hours message: "${settings.after_hours_message}"
`.trim()
}

export function buildBeginMessage(settings: ContractorSettings): string {
  const hasSpanish = settings.supported_languages.includes('es')
  if (hasSpanish) {
    return `Thank you for calling ${settings.business_name}. For English, stay on the line. Para español, oprima dos.`
  }
  return `Thank you for calling ${settings.business_name}, this is your AI receptionist. How can I help you today?`
}
```

### Pattern 3: Language Code Mapping

Retell uses locale codes (e.g., `en-US`, `es-ES`), not ISO-639-1 codes (`en`, `es`). [VERIFIED: docs.retellai.com/api-references/create-agent.md]

```typescript
// Source: Retell docs — supported language codes [VERIFIED: docs.retellai.com]
const RETELL_LANGUAGE_MAP: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
}

export function toRetellLanguage(langs: string[]): string | string[] {
  const codes = langs.map(l => RETELL_LANGUAGE_MAP[l]).filter(Boolean)
  // Single language: pass as string. Multiple: pass as array.
  return codes.length === 1 ? codes[0] : codes
}
```

### Pattern 4: Inngest Client + Function Setup

```typescript
// src/inngest/client.ts
// Source: Context7 /inngest/inngest-js — Next.js App Router setup [VERIFIED]
import { Inngest } from 'inngest'

export const inngest = new Inngest({ id: 'voicedesk' })
```

```typescript
// src/inngest/functions/retell-agent-sync.ts
// Source: Context7 /inngest/inngest-js — retry with NonRetriableError [VERIFIED]
import { inngest } from '@/inngest/client'
import { NonRetriableError } from 'inngest'
import { getRetellClient } from '@/lib/retell/client'
import { createServiceRoleClient } from '@/lib/supabase/service'

export const retellAgentSync = inngest.createFunction(
  {
    id: 'retell-agent-sync',
    retries: 5,  // D-12: max 5 retries with exponential backoff (Inngest default)
  },
  { event: 'retell/agent.sync' },
  async ({ event, step }) => {
    const { contractorId, llmId, compiledPrompt, beginMessage } = event.data

    await step.run('patch-retell-llm', async () => {
      const retell = getRetellClient()
      await retell.llm.update(llmId, {
        general_prompt: compiledPrompt,
        begin_message: beginMessage,
      })
    })

    await step.run('set-synced-status', async () => {
      const db = createServiceRoleClient()
      await db
        .from('contractors')
        .update({ agent_sync_status: 'synced' })
        .eq('id', contractorId)
    })
  }
)
```

```typescript
// src/app/api/inngest/route.ts
// Source: Context7 /inngest/inngest-js — Next.js App Router adapter [VERIFIED]
import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { retellAgentSync } from '@/inngest/functions/retell-agent-sync'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [retellAgentSync],
})
```

### Pattern 5: Provisioning Route (skeleton)

```typescript
// src/app/api/provisioning/create/route.ts
// Follows same pattern as src/app/api/onboarding/create-account/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { getRetellClient } from '@/lib/retell/client'
import { buildSystemPrompt, buildBeginMessage } from '@/lib/retell/system-prompt'
import { toRetellLanguage } from '@/lib/retell/client'
import { z } from 'zod'

const provisionSchema = z.object({
  area_code: z.string().regex(/^\d{3}$/, 'Area code must be 3 digits'),
})

export async function POST(req: Request) {
  // 1. Auth
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Validate
  const body = provisionSchema.safeParse(await req.json())
  if (!body.success) {
    return NextResponse.json({ error: body.error.issues[0]?.message }, { status: 400 })
  }

  const serviceClient = createServiceRoleClient()

  // 3. Load contractor + settings
  const { data: contractor } = await serviceClient
    .from('contractors')
    .select('id, retell_agent_id, contractor_settings(*)')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!contractor) return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })

  // 4. Idempotency — already provisioned
  if (contractor.retell_agent_id) {
    return NextResponse.json({ error: 'Already provisioned' }, { status: 409 })
  }

  const settings = contractor.contractor_settings[0]
  const retell = getRetellClient()

  // 5. Create Retell LLM
  const llm = await retell.llm.create({
    model: 'gpt-4.1',
    general_prompt: buildSystemPrompt(settings),
    begin_message: buildBeginMessage(settings),
  })

  // 6. Create Retell Agent
  const agent = await retell.agent.create({
    response_engine: { type: 'retell-llm', llm_id: llm.llm_id },
    voice_id: settings.agent_voice,
    agent_name: `${settings.business_name} Receptionist`,
    language: toRetellLanguage(settings.supported_languages) as string,
  })

  // 7. Buy phone number and bind agent
  const phone = await retell.phoneNumber.create({
    area_code: parseInt(body.data.area_code, 10),
    inbound_agents: [{ agent_id: agent.agent_id, weight: 1.0 }],
    nickname: settings.business_name,
  })

  // 8. Persist
  await serviceClient
    .from('contractors')
    .update({
      retell_agent_id: agent.agent_id,
      retell_llm_id: llm.llm_id,
      twilio_number: phone.phone_number,
      twilio_number_sid: phone.phone_number, // Retell's number reference — E.164; not a true Twilio SID (RESOLVED: Open Question 2)
      agent_sync_status: 'synced',
      area_code: body.data.area_code,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contractor.id)

  return NextResponse.json({
    twilio_number: phone.phone_number,
    retell_agent_id: agent.agent_id,
  })
}
```

### Anti-Patterns to Avoid

- **Calling Retell before writing to Supabase:** D-11 requires DB write first. If Retell call fails, Supabase state is clean. Reversed order creates orphaned Retell resources not tracked in DB.
- **Storing `retell_llm_id` only in memory:** The LLM ID is needed for every future system prompt update. Must be persisted in the `contractors` table.
- **Using `language: 'ht'`:** Retell does not support Haitian Creole. The `toRetellLanguage()` mapper filters unknown codes. [VERIFIED: docs.retellai.com/api-references/create-agent.md]
- **Blocking the `update-agent` route on Retell:** Always return 200 after DB write, then process Retell in background (Inngest). Matches Critical Rule #2 pattern.
- **Creating a new Retell LLM on every update:** Only create LLM once at provisioning. On settings updates, PATCH the existing LLM via `retell.llm.update(llmId, ...)`.
- **Sharing a single area_code across the whole API call:** The provisioning API reads `area_code` from the request body, not from contractor_settings, so the D-08 default (305) is a UI concern (Phase 7 wizard), not a server default.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Background retries | Custom setTimeout/cron retry loop | Inngest createFunction with `retries: 5` | Inngest persists retry state across Vercel cold starts; setTimeout is lost on function timeout |
| Retell API error parsing | Manual fetch + JSON.parse + error handling | `retell-sdk` npm package | SDK throws typed errors with HTTP status; handles auth automatically |
| Phone number purchase | Direct Twilio API calls (`incomingPhoneNumbers.create`) | Retell `phoneNumber.create()` | Retell's provisioning is the architecture choice — buying through Retell avoids SIP trunk configuration |
| Language detection | Passive accent detection | Explicit greeting prompt ("Para español, oprima dos") | Retell docs + REQUIREMENTS.md Out of Scope: passive accent detection not reliable enough |

---

## Schema Changes Required

### New Migration: `20260506000004_agent_sync_status.sql`

Two columns must be added to the `contractors` table:

```sql
-- 20260506000004_agent_sync_status.sql
-- Phase 2: Provisioning — add agent_sync_status and retell_llm_id to contractors.
-- D-12: agent_sync_status tracks Retell sync state; shown as banner in Phase 6 portal.
-- retell_llm_id: needed for PATCH /update-retell-llm/{llm_id} on settings changes.

ALTER TABLE contractors
  ADD COLUMN IF NOT EXISTS agent_sync_status TEXT
    CHECK (agent_sync_status IS NULL OR agent_sync_status IN ('synced', 'failed', 'pending')),
  ADD COLUMN IF NOT EXISTS retell_llm_id TEXT;
```

No RLS policy changes needed — `contractors` table policies from Phase 1 already cover new columns (SELECT, UPDATE policies apply at row level, not column level in Supabase).

**Naming convention:** Existing migrations use `YYYYMMDD000NNN` sequential numbering with `000001`, `000002`, `000003` already used. Next is `000004`. [VERIFIED: supabase/migrations/ directory audit]

### HC Cleanup Migration: update `20260506000004_agent_sync_status.sql`

The same migration removes 'ht' from:
1. `emergency_keywords` DEFAULT in `contractor_settings` (migration 1 + 3 both set this — both are immutable history; the new migration changes the DEFAULT going forward)
2. `supported_languages` CHECK constraint (currently allows 'ht'; must be narrowed to `{en, es}`)
3. `language` column CHECK in `calls` table (currently allows 'ht')

```sql
-- Remove 'ht' from supported_languages CHECK constraint
ALTER TABLE contractor_settings
  DROP CONSTRAINT contractor_settings_supported_languages_valid;

ALTER TABLE contractor_settings
  ADD CONSTRAINT contractor_settings_supported_languages_valid
    CHECK (
      supported_languages <@ ARRAY['en','es']::TEXT[]
      AND array_length(supported_languages, 1) >= 1
    );

-- Update default to remove 'ht' key from emergency_keywords JSONB
ALTER TABLE contractor_settings
  ALTER COLUMN emergency_keywords
  SET DEFAULT '{
    "en": ["gas smell", "no heat", "burst pipe", "flooding", "no power", "CO alarm", "burning smell", "sparking"],
    "es": ["olor a gas", "sin calefacción", "tubería reventada", "inundación", "sin electricidad", "alarma de CO", "olor a quemado"]
  }'::JSONB;

-- Remove 'ht' from calls.language CHECK
ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_language_check;
ALTER TABLE calls
  ADD CONSTRAINT calls_language_check
    CHECK (language IS NULL OR language IN ('en', 'es'));

COMMENT ON CONSTRAINT contractor_settings_supported_languages_valid
  ON contractor_settings
  IS 'D-01 Phase 2: supported_languages must be a non-empty subset of {en, es} — HC removed';
```

**Data migration for existing rows:** Any `contractor_settings` rows with `"ht"` in `supported_languages` must be cleaned before the CHECK constraint is applied. Any `emergency_keywords` JSONB with `"ht"` key should have it removed. Include in migration:

```sql
-- Remove 'ht' from any existing supported_languages arrays
UPDATE contractor_settings
  SET supported_languages = array_remove(supported_languages, 'ht')
  WHERE 'ht' = ANY(supported_languages);

-- Ensure no empty arrays result (fallback to ['en'])
UPDATE contractor_settings
  SET supported_languages = ARRAY['en']::TEXT[]
  WHERE array_length(supported_languages, 1) = 0 OR supported_languages IS NULL;

-- Remove 'ht' key from emergency_keywords JSONB
UPDATE contractor_settings
  SET emergency_keywords = emergency_keywords - 'ht'
  WHERE emergency_keywords ? 'ht';
```

### Env Vars to Add (`.env.example` update)

```bash
# Retell AI
RETELL_API_KEY=your-retell-api-key-here
```

No Twilio credentials needed at the server level for Phase 2 (numbers are bought through Retell's API, not directly through Twilio). Twilio credentials remain optional for Phase 2.

---

## HC Cleanup Scope

**All files requiring 'ht' removal — complete inventory:**

| File | Change | Type |
|------|--------|------|
| `src/types/database.ts` | `Language = 'en' \| 'es'` (remove `'ht'`) | Code edit |
| `src/types/database.ts` | `EmergencyKeywords` interface: remove `ht: string[]` field | Code edit |
| `src/app/actions/settings.ts` | Comment referencing LANG-02 floor `['en'\|'es'\|'ht']` → update to `['en'\|'es']` | Comment update |
| `src/app/(dashboard)/settings/agent/_components/LanguageSettingsForm.tsx` | Remove `{ code: 'ht', label: 'Haitian Creole' }` from `ALL_LANGUAGES` array | Code edit |
| `src/lib/validations/onboarding.ts` | `z.enum(['en', 'es', 'ht'])` → `z.enum(['en', 'es'])` | Code edit |
| `supabase/migrations/20260504000001_initial_schema.sql` | Already committed — do NOT modify history. New migration handles DB change. | None |
| `supabase/migrations/20260504000003_contractor_defaults.sql` | Already committed — do NOT modify history. New migration overrides default. | None |
| `supabase/migrations/20260506000004_agent_sync_status.sql` | Removes 'ht' from CHECK constraints, defaults, and existing data | New migration |
| `.planning/REQUIREMENTS.md` | LANG-02 traceability row — update status to "Out of Scope (D-01 Phase 2)" | Docs update |

[VERIFIED: grep audit of all project source files]

---

## Common Pitfalls

### Pitfall 1: "Managed Twilio Integration" Does Not Exist as Described

**What goes wrong:** Plan includes a step "link Twilio Account SID + Auth Token in Retell dashboard" — this UI/API does not exist in documented Retell features.
**Why it happens:** ROADMAP.md describes a feature that doesn't match current Retell docs.
**How to avoid:** Use Retell's provisioning API (`POST /phone-number`) to buy a number. Retell internally manages the telephony (uses Twilio/Telnyx as its provider). No credential linking step.
**Warning signs:** Any plan step referencing "Retell dashboard UI" for credential management — verify against live docs. [VERIFIED: docs.retellai.com/deploy/twilio.md — only SIP trunking documented]

### Pitfall 2: Missing `retell_llm_id` Storage

**What goes wrong:** `llm_id` is created at provisioning but not stored. When contractor updates settings in Phase 6, there's no LLM ID to PATCH.
**Why it happens:** Initial focus on `retell_agent_id` for call routing; LLM ID for prompt updates is easy to overlook.
**How to avoid:** Always persist `retell_llm_id` alongside `retell_agent_id`. New `retell_llm_id` column is required in migration.

### Pitfall 3: Retell Language Code Mismatch

**What goes wrong:** Passing `'en'` or `'es'` to Retell's `language` field causes API error or falls back to default language silently.
**Why it happens:** Project uses ISO-639-1 codes (`en`, `es`); Retell uses locale codes (`en-US`, `es-ES`).
**How to avoid:** Use the `toRetellLanguage()` mapper before all Retell agent create/update calls. [VERIFIED: docs.retellai.com/api-references/create-agent.md]
**Warning signs:** Retell API 400 responses on agent create/update with language field.

### Pitfall 4: HC in Zod Schema After Migration

**What goes wrong:** DB CHECK constraint prevents 'ht' but zod schema still accepts it, causing inconsistent validation.
**Why it happens:** Code and DB changes happen in separate tasks.
**How to avoid:** Update `z.enum(['en','es','ht'])` → `z.enum(['en','es'])` in `src/lib/validations/onboarding.ts` in the same plan as the migration. [VERIFIED: grep audit]

### Pitfall 5: No-Numbers-Available Error Handling

**What goes wrong:** `retell.phoneNumber.create({ area_code: 999 })` throws; provisioning route crashes with 500.
**Why it happens:** Retell returns error when no numbers are available in the requested area code.
**How to avoid:** Wrap Retell `phoneNumber.create()` in try/catch. If error indicates no availability, return `{ error: 'No numbers available in area code 305. Try: 786, 954, or 561.' }` with 422 status.

### Pitfall 6: `contractor_settings` join in provisioning route

**What goes wrong:** `contractors` table does not have `contractor_settings` columns inline — they are in a separate 1:1 table.
**Why it happens:** Treating them as the same entity.
**How to avoid:** Use `.select('id, retell_agent_id, contractor_settings(*)')` in the Supabase query to join. Service role bypasses RLS so the join works server-side. [VERIFIED: schema audit]

### Pitfall 7: Inngest Not Installed / Not Wired

**What goes wrong:** `retellAgentSync` function is written but Inngest has no API route to receive events; `inngest.send()` calls fail silently.
**Why it happens:** Inngest requires three things: `npm install inngest`, the client, and a serve route at `/api/inngest`. All three must be in Wave 0 / Plan 1.
**How to avoid:** Wave 0 must include Inngest installation + `/api/inngest/route.ts` + local dev command (`npx inngest-cli@latest dev`).

---

## Runtime State Inventory

This is not a rename/refactor phase — no runtime state audit needed. Haitian Creole cleanup is limited to code + DB migration; no stored user data uses 'ht' in a way that breaks functionality (existing `supported_languages: ['ht']` data is cleaned by the migration's UPDATE statements before CHECK constraint is applied).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | retell-sdk, twilio, inngest | ✓ | v25.8.0 | — |
| npm | Package installation | ✓ | 11.11.0 | — |
| supabase CLI | Migration push | ✓ | 2.98.1 | — |
| retell-sdk | All Retell API calls | ✗ (not installed) | — | Install: `npm install retell-sdk@5.18.0` |
| twilio | Number search fallback (not primary path) | ✗ (not installed) | — | Not needed for primary Retell provisioning path |
| inngest | Agent sync retry | ✗ (not installed) | — | Install: `npm install inngest@4.3.0` |
| RETELL_API_KEY | All provisioning | ✗ (not in .env.example) | — | Must be added; blocks all Retell calls |
| inngest-cli (dev) | Local Inngest dev server | ✗ | — | `npx inngest-cli@latest dev` — dev only |

**Missing dependencies with no fallback:**
- `RETELL_API_KEY` env var — no fallback; blocks all provisioning

**Missing dependencies with install path:**
- `retell-sdk@5.18.0` — `npm install retell-sdk@5.18.0`
- `inngest@4.3.0` — `npm install inngest@4.3.0`

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.5 |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npx vitest run tests/provisioning/ --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LANG-01 (partial) | `buildSystemPrompt()` includes Spanish greeting when 'es' in supported_languages | unit | `npx vitest run tests/lib/system-prompt.test.ts -x` | ❌ Wave 0 |
| LANG-01 (partial) | `buildSystemPrompt()` excludes Spanish when only 'en' in supported_languages | unit | `npx vitest run tests/lib/system-prompt.test.ts -x` | ❌ Wave 0 |
| LANG-01 (partial) | `toRetellLanguage(['en'])` returns `'en-US'`; `toRetellLanguage(['en','es'])` returns `['en-US','es-ES']` | unit | `npx vitest run tests/lib/retell-language-mapper.test.ts -x` | ❌ Wave 0 |
| D-01 (HC cleanup) | `Language` type does not include 'ht' | unit (type-check) | `npx tsc --noEmit` | — |
| D-01 (HC cleanup) | `languageSchema.safeParse({ supported_languages: ['ht'] })` returns error | unit | `npx vitest run tests/lib/validations.test.ts -x` | ❌ Wave 0 |
| D-11 (sync status) | `agent_sync_status` column exists in contractors table | integration | `npx vitest run tests/db/provisioning.test.ts -x` | ❌ Wave 0 |
| D-12 (idempotency) | `POST /api/provisioning/create` returns 409 if already provisioned | unit (mocked) | `npx vitest run tests/api/provisioning.test.ts -x` | ❌ Wave 0 |
| D-10 (no numbers) | Returns 422 with area code suggestions when no numbers available | unit (mocked) | `npx vitest run tests/api/provisioning.test.ts -x` | ❌ Wave 0 |

> Integration tests against live Retell/Supabase APIs are manual-only for this phase. Unit tests mock the Retell SDK client.

### Sampling Rate

- **Per task commit:** `npx vitest run tests/lib/ --reporter=verbose` (unit tests only — fast)
- **Per wave merge:** `npx vitest run --reporter=verbose` (full suite)
- **Phase gate:** Full suite green + `npx tsc --noEmit` + `npx supabase db push` succeeds before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/lib/system-prompt.test.ts` — covers LANG-01 prompt builder logic
- [ ] `tests/lib/retell-language-mapper.test.ts` — covers locale code mapping
- [ ] `tests/lib/validations.test.ts` — HC removal from zod schema
- [ ] `tests/api/provisioning.test.ts` — API route unit tests (mocked Retell client)
- [ ] `tests/db/provisioning.test.ts` — `agent_sync_status` column existence (live Supabase)
- [ ] Package installs: `npm install retell-sdk@5.18.0 inngest@4.3.0`
- [ ] `src/app/api/inngest/route.ts` — Inngest serve endpoint (required before any inngest.send() works)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `supabase.auth.getUser()` on every API route — never `getSession()` |
| V3 Session Management | no | Session managed by Supabase Auth; provisioning routes are stateless |
| V4 Access Control | yes | Contractor can only provision/update their own agent — verify `user_id` match before any Retell call |
| V5 Input Validation | yes | zod schema on `area_code`; validate before any external API call |
| V6 Cryptography | no | No new secrets stored in DB. RETELL_API_KEY is env-var only (never written to DB or logs) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Contractor A provisions for Contractor B | Elevation of Privilege | Load contractor via `user_id` from JWT; never accept `contractor_id` from request body |
| Retell API key exposed in client bundle | Information Disclosure | `import 'server-only'` in `src/lib/retell/client.ts`; verify key never prefixed `NEXT_PUBLIC_` |
| Duplicate provisioning (race condition) | Tampering | Idempotency check: `retell_agent_id IS NOT NULL` → 409 before any Retell calls |
| Area code injection | Tampering | zod `z.string().regex(/^\d{3}$/)` — 3-digit integer only, no free text |
| RETELL_API_KEY in server logs | Information Disclosure | Never log the API key or raw request/response bodies containing it |

**Critical Rule compliance:**
- Rule #1 (RLS on every table): New migration columns (`agent_sync_status`, `retell_llm_id`) on `contractors` — existing RLS policies cover all columns, no new policies needed
- Rule #3 (service role key never to browser): `createServiceRoleClient()` called only in API routes; same pattern as existing `create-account` route
- Rule #5 (idempotency): Provisioning checks `retell_agent_id IS NOT NULL` before calling Retell API

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Retell `language: 'multi'` (legacy scalar) | Explicit locale array `['en-US','es-ES']` | Current Retell docs | Use array form; `'multi'` is deprecated per docs |
| Build agent with system prompt inline | Separate LLM entity + Agent reference | Retell v2 architecture | Two-step creation: `llm.create()` then `agent.create(llm_id)` |
| Twilio Node.js SDK v4 (CJS-only) | Twilio SDK v5 (ESM + CJS) | v5 release | ESM import `import twilio from 'twilio'` is now idiomatic |

**Deprecated/outdated:**
- `language: 'multi'` on Retell agent: use locale array instead per current docs
- Creating a Retell agent with `prompt` field directly: v2 requires a separate LLM entity; prompt lives on the LLM, not the agent

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Buy number through Retell" (Option A) is the intended interpretation of ROADMAP's "managed Twilio integration" | Standard Stack, Architecture | If project intended a real Twilio account with SIP trunking, the provisioning flow changes significantly. The ROADMAP explicitly says "do NOT use raw TwiML/SIP" — this supports Option A. |
| A2 | `retell.phoneNumber.create()` returns a Retell-managed number (under Retell's Twilio account) with no separate `twilio_number_sid` from the contractor's Twilio account | Architecture Patterns | If contractors need a number in their own Twilio account for call recording ownership or number porting later, this choice creates migration complexity |
| A3 | `gpt-4.1` is an appropriate model choice for Retell LLM in this use case | Code Examples | Other models (claude-4.5-sonnet, gpt-4.1-mini) may have better latency or cost tradeoffs; A3 should be validated during Phase 3 testing |
| A4 | `twilio` npm package is not needed in Phase 2 (all provisioning goes through Retell) | Standard Stack | If any feature needs direct Twilio API access in Phase 2, install `twilio@^5.13.1` |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

---

## Open Questions (RESOLVED)

1. **"Managed Twilio integration" clarification** — RESOLVED
   - Decision: Proceed with Option A — buy via `retell.phoneNumber.create()`. The no-SIP constraint in the ROADMAP confirms this path. No Twilio Account SID / Auth Token linking step exists in Retell's API.
   - Rationale: ROADMAP explicitly says "do NOT use raw TwiML/SIP"; Retell docs confirm only SIP trunking OR buy-via-Retell are supported; buy-via-Retell is the correct path.

2. **`twilio_number_sid` semantics when buying via Retell** — RESOLVED
   - Decision: Store the E.164 `phone_number` from Retell in `twilio_number_sid`. This is the correct identifier for Retell's number management API. Not a true Twilio SID format (e.g., `PN...`), but serves the same lookup purpose for all Phase 2–6 operations.
   - Note in code: `twilio_number_sid: phone.phone_number  // E.164 phone number — Retell's internal reference; not a Twilio SID`

3. **Agent voice ID format** — RESOLVED (deferred to manual verification)
   - Decision: Use `'elevenlabs-myra'` as-is in the plan. The executor MUST verify this voice ID against the Retell voice catalog before executing Plan 04 (check Retell dashboard or voice list API). If `'elevenlabs-myra'` is not a valid voice ID, substitute with `'elevenlabs-harriet'` or the nearest available female English voice.
   - VALIDATION.md already lists this as a manual-only check.

---

## Sources

### Primary (HIGH confidence)
- Context7 `/retellai/retell-typescript-sdk` — LLM create, agent create, phoneNumber create, update-llm patterns
- `docs.retellai.com/api-references/create-agent.md` — language codes, Haitian Creole absence confirmed
- `docs.retellai.com/deploy/purchase-number.md` — Retell number provisioning flow, $2/month pricing
- `docs.retellai.com/deploy/twilio.md` — Twilio integration is SIP trunking only (no Account SID linking)
- `docs.retellai.com/api-references/create-retell-llm` — LLM creation, general_prompt field
- `docs.retellai.com/api-references/update-retell-llm` — PATCH for system prompt updates
- Context7 `/inngest/inngest-js` — createFunction, retries, NonRetriableError, Next.js App Router serve
- `npm registry` — retell-sdk@5.18.0, inngest@4.3.0, twilio@5.13.1 versions verified
- `supabase/migrations/20260504000001_initial_schema.sql` — contractors table schema verified; agent_sync_status absent; retell_llm_id absent [VERIFIED: codebase]
- `src/` directory grep — HC ('ht') references in 4 files identified [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- `www.twilio.com/docs/phone-numbers/api/availablephonenumberlocal-resource` — `availablePhoneNumbers("US").local.list({ areaCode })` API shape
- Context7 `/websites/twilio` — `incomingPhoneNumbers.create()` pattern
- `github.com/twilio/twilio-node UPGRADE.md` — v5→v6 breaking change (Node.js ≥ 20 only)

### Tertiary (LOW confidence)
- WebSearch result confirming Retell+Twilio integration is SIP trunking — corroborated by official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry; SDK docs verified via Context7 and official docs
- Architecture: HIGH — Retell API call sequence verified against Context7 and official docs; schema verified against codebase
- Pitfalls: MEDIUM — based on API behavior documented; some edge cases (voice ID validity, exact error shapes) require live API testing
- HC cleanup: HIGH — all 'ht' references grep-verified in codebase

**Research date:** 2026-05-06
**Valid until:** 2026-06-05 (Retell and Inngest APIs move fast; re-verify agent creation fields and language codes if planning is delayed)

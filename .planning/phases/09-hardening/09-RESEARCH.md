# Phase 9: Hardening & UX Polish — Research

**Researched:** 2026-05-20
**Domain:** Next.js App Router client components, Inngest onFailure handlers, string replacement
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Telegram bot name**
- The correct bot name is `voiceDeskTelBot` — replace ALL occurrences of `VoiceDeskBot` in source
- Files affected: `src/app/api/webhooks/telegram/route.ts` (2 occurrences), `src/app/(dashboard)/dashboard/page.tsx` (2 occurrences), `src/lib/notifications/telegram.ts` (1 occurrence)
- The TELEGRAM_BOT_TOKEN env var is unchanged — only display names and deep-link URLs

**D-02: Error observability scope**
- No Sentry, no third-party SDK — Vercel captures `console.error` in runtime logs
- Structured format: `console.error('[voicedesk]', JSON.stringify({ event, contractor_id, call_id?, error: err.message, stack: err.stack }))`
- Target locations: catch blocks in `after()` handler in `/api/webhooks/retell/route.ts`, and `onFailure` handlers in Inngest functions (`retell-call-classify`, `retell-notify-dispatch`, `stripe-payment-failure`, `retell-agent-sync`)
- Do NOT add logging to non-error paths — only failures

**D-03: Phone provisioning UI**
- `settings/phone` shows two states: (a) not provisioned — area code input + provision button, (b) provisioned — number display + forwarding instructions (current content)
- Area code input: 3-digit numeric input, validates with zod (same schema as provisioning API)
- Button calls `POST /api/provisioning/create` with `{ area_code }` — same endpoint used by Phase 7 `/setup/phone` flow
- On success: call `router.refresh()` (Next.js App Router) to trigger layout re-fetch, which will surface the new number in both the settings/phone page and the Sidebar
- On error: show inline error (area code unavailable → suggest Miami area codes 786, 954, 561; already provisioned → link to settings/phone; other → generic message)
- Loading state during provisioning: disable button, show spinner

**D-04: Sidebar phone number display**
- Already implemented — `Sidebar.tsx` has `phoneNumber` prop and displays it when truthy
- Layout already passes `contractor.twilio_number` as `phoneNumber`
- This task is verification-only: confirm the Sidebar shows the number after `router.refresh()` from settings/phone, and that the display looks correct (format: E.164 as stored)
- If the Sidebar doesn't show until hard reload, ensure `router.refresh()` is called after successful provisioning in settings/phone

**D-05: Emergency keywords — no change needed**
- `contractor_settings.emergency_keywords` is already editable via `KeywordsForm.tsx` in `settings/agent`
- No new work needed

### Claude's Discretion
- Number formatting: show twilio_number as stored (E.164) — no reformatting needed for v1
- Provisioning form can live inline in settings/phone (no modal needed)
- Error log format can be a single `console.error` line per failure point

### Deferred Ideas (OUT OF SCOPE)
- Full Sentry integration — deferred to v2 when logs become hard to search
- Rate limiting on webhook endpoints — deferred, not in Phase 9 scope
- In-flight emergency deduplication — deferred
- Secondary escalation contact — deferred
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ONBOARD-01 | Settings/phone page must allow provisioning (area code input + button) for contractors who did not complete onboarding | Provisioning API fully implemented; settings/phone currently read-only — needs two-state UI |
| NOTIF-03 | Telegram notification must use the correct bot name in all user-facing links | 5 string occurrences of `VoiceDeskBot` confirmed in codebase; pure find-and-replace, no logic change |
</phase_requirements>

---

## Summary

Phase 9 is four discrete, non-overlapping hardening tasks. No new dependencies are required. No schema migrations are needed. The most complex task is the provisioning form — a client component that adds a two-state gate (provisioned vs. not) to an existing read-only page, reusing the exact API contract already consumed by `PhoneCaptureForm`.

All Telegram bot name occurrences are confirmed at five locations across three files. Two are in comments/display strings (no functional change), two are in the live deep-link URL rendered to the contractor (`dashboard/page.tsx` line 79 and 84), and one is in a comment in `telegram.ts`. No bot logic changes are required — only string literals change.

The error observability task adds structured `console.error` calls to four Inngest `onFailure` handlers and the `after()` catch block in the Retell webhook. The `after()` catch block at `route.ts:56–58` already emits a `console.error` — it needs only reformatting to the structured JSON pattern. Three of the four Inngest `onFailure` handlers already have a `console.error` call (`retell-call-classify` line 43, `retell-notify-dispatch` line 26, `stripe-payment-failure` line 24) — they need reformatting only. The `retell-agent-sync` `onFailure` has no console.error — that one needs a new line added.

The Sidebar display task is verification-only. The layout already selects `twilio_number` and passes it as `phoneNumber` prop. The Sidebar already renders it when truthy. The only gap is that `settings/phone/page.tsx` currently does not call `router.refresh()` after provisioning because the provisioning form does not yet exist.

**Primary recommendation:** Build the provisioning form inline in `settings/phone/page.tsx` using the `PhoneCaptureForm` pattern — same zod schema, same fetch-to-API pattern, same inline error display. Add `router.refresh()` on success. All other tasks are string replacements or one-liner console.error additions.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Bot name string replacement | Frontend Server (SSR) + Server files | — | All occurrences in server components, API routes, and lib files |
| Structured error logging (after + Inngest) | API / Backend | — | `after()` is Next.js server context; Inngest runs server-side |
| Phone provisioning form UI | Browser / Client | API / Backend | Client component calls existing server API |
| Layout re-fetch after provisioning | Frontend Server (SSR) | Browser / Client | `router.refresh()` from client triggers Server Component re-render in layout |
| Sidebar phone display | Browser / Client | Frontend Server (SSR) | Client component receiving prop from server layout |

---

## Standard Stack

No new packages are required for this phase. All tools are already installed.

### Already Installed — Used in This Phase

| Library | Version | Purpose | Used By |
|---------|---------|---------|---------|
| `next` | 16.2.4 | `useRouter`, `router.refresh()`, `after()` | Provisioning form, layout refresh |
| `react` | ^19.0.0 | `useState`, `useEffect` | Provisioning form state |
| `zod` | installed | Area code validation | Provisioning form — reuse `z.string().regex(/^\d{3}$/)` |
| `lucide-react` | installed | `Loader2`, `AlertCircle`, `Phone` icons | Provisioning form spinner and error display |

**[VERIFIED: codebase grep]** — All packages confirmed present in `package.json`.

### Installation

No new packages to install. This phase has no new external dependencies.

---

## Package Legitimacy Audit

No new packages are introduced in this phase. All existing packages were verified in prior phases.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
settings/phone page (Client Component)
    │
    ├── twilioNumber === null?
    │       │
    │       └── ProvisioningForm (inline)
    │               │   [area code input + "Provision My Number" button]
    │               │
    │               ├── POST /api/provisioning/create ──► Retell SDK (LLM + Agent + Phone)
    │               │           │                               │
    │               │           └── Supabase UPDATE             │
    │               │                 contractors.twilio_number ◄─┘
    │               │
    │               ├── success → router.refresh()
    │               │       │
    │               │       └── DashboardLayout (Server Component) re-fetches
    │               │               contractors.twilio_number
    │               │                       │
    │               │                       └── Sidebar receives phoneNumber prop
    │               │
    │               └── error → inline error with area code suggestions
    │
    └── twilioNumber !== null?
            └── Existing read-only display + carrier forwarding instructions
```

### Recommended Project Structure

No new files or directories required. All changes are in-place edits:

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── dashboard/page.tsx          [edit: 2 string replacements]
│   │   └── settings/phone/page.tsx     [edit: add provisioning form state]
│   └── api/
│       └── webhooks/
│           └── retell/route.ts         [edit: reformat after() catch console.error]
├── components/dashboard/Sidebar.tsx    [verify only — no changes expected]
├── lib/notifications/telegram.ts       [edit: 1 comment string replacement]
└── inngest/functions/
    ├── retell-call-classify.ts         [edit: reformat onFailure console.error]
    ├── retell-notify-dispatch.ts       [edit: reformat onFailure console.error]
    ├── retell-agent-sync.ts            [edit: ADD console.error to onFailure]
    └── stripe-payment-failure.ts       [edit: reformat onFailure console.error]
```

### Pattern 1: Two-State Page Guard

**What:** A client component renders one of two states based on whether `twilioNumber` is null.
**When to use:** When a settings page must handle both "setup needed" and "already configured" states.

```typescript
// Source: Observed pattern in settings/phone/page.tsx + PhoneCaptureForm.tsx
// The page already fetches twilioNumber in a useEffect.
// Add a state branch: !twilioNumber → show form; twilioNumber → show existing display.

export default function PhoneSettingsPage() {
  const { contractorId } = useContractor()
  const [twilioNumber, setTwilioNumber] = useState<string | null>(null)
  const [areaCode, setAreaCode] = useState('')
  const [provisioning, setProvisioning] = useState(false)
  const [provisionError, setProvisionError] = useState<string | null>(null)
  const router = useRouter()  // from 'next/navigation'

  // ... existing fetchNumber useEffect unchanged ...

  const handleProvision = async () => {
    // validate areaCode with inline zod (same pattern as PhoneCaptureForm)
    // POST /api/provisioning/create with { area_code: areaCode }
    // on success: router.refresh() — triggers layout re-fetch
    // on error: parse status 409 / 422 / 5xx for inline message
  }

  if (!twilioNumber) {
    return <ProvisioningSection ... />
  }
  return <ExistingDisplay ... />  // current content
}
```

**[ASSUMED]** — Pattern is inferred from existing `PhoneCaptureForm.tsx` structure and the two-state requirement in CONTEXT.md. No external authority required for this internal pattern.

### Pattern 2: router.refresh() for Layout Re-fetch

**What:** After a client-side mutation that changes server-fetched layout data, call `router.refresh()` to re-run Server Components without a full navigation.
**When to use:** When a client component modifies data that the parent Server Component layout selects and passes as props.

```typescript
// Source: [CITED: https://nextjs.org/docs/app/api-reference/functions/use-router#routerrefresh]
// Next.js App Router — router.refresh() re-renders Server Components in the current route segment.
// The layout re-runs its Supabase query and passes the new twilio_number to Sidebar.

import { useRouter } from 'next/navigation'

const router = useRouter()

// After successful provisioning:
router.refresh()
// No redirect needed — layout re-fetches contractor.twilio_number in place.
// Sidebar will receive updated phoneNumber prop after the re-render.
```

**[CITED: https://nextjs.org/docs/app/api-reference/functions/use-router]** — `router.refresh()` is the canonical Next.js App Router mechanism for invalidating Server Component cache from a Client Component. [VERIFIED: codebase] — Next.js 16.2.4 is the installed version, which includes this API.

### Pattern 3: Structured Error Log Format (D-02)

**What:** Uniform JSON `console.error` format for all failure paths, enabling Vercel log drain parsing.
**When to use:** At every catch/onFailure path in server-side Inngest functions and webhook handlers.

```typescript
// Source: D-02 decision in 09-CONTEXT.md
// Target format:
console.error('[voicedesk]', JSON.stringify({
  event: 'retell/call.classify.failure',
  contractor_id: contractorId,
  call_id: callId ?? null,
  error: err instanceof Error ? err.message : String(err),
  stack: err instanceof Error ? err.stack : undefined,
}))
```

**Existing vs. required format — gap analysis:**

| Location | Current | Required Change |
|----------|---------|-----------------|
| `route.ts` after() catch (line 56–58) | `console.error('[webhook/retell] after() processing error:', err.message)` | Reformat to JSON with `event`, `call_id` fields |
| `retell-call-classify` onFailure (line 43) | `console.error('[retell-call-classify] onFailure: all retries exhausted — callId=', callId)` | Reformat to JSON |
| `retell-notify-dispatch` onFailure (line 26) | `console.error('[retell-notify-dispatch] all retries exhausted for callId=${callId}')` | Reformat to JSON |
| `stripe-payment-failure` onFailure (line 24) | `console.error('[stripe-payment-failure] all retries exhausted for contractor ...')` | Reformat to JSON |
| `retell-agent-sync` onFailure | **MISSING** — no console.error | Add new structured console.error |

### Pattern 4: Inline Zod Resolver (existing pattern — reuse)

The project already uses an inline Zod v4 resolver in `PhoneCaptureForm.tsx` that avoids `@hookform/resolvers/zod` (incompatible with Zod v4's `.issues` API). The provisioning form in settings/phone must reuse the same inline resolver pattern.

```typescript
// Source: src/components/auth/PhoneCaptureForm.tsx lines 18–33
// Inline resolver — do NOT use @hookform/resolvers/zod (Zod v4 incompatibility)
resolver: async (values) => {
  const result = areaCodeSchema.safeParse(values)
  if (result.success) return { values: result.data, errors: {} }
  const fieldErrors: Record<string, { type: string; message: string }> = {}
  for (const issue of result.error.issues) {
    const path = issue.path.join('.')
    if (!fieldErrors[path]) {
      fieldErrors[path] = { type: issue.code, message: issue.message }
    }
  }
  return { values: {}, errors: fieldErrors }
}
```

**[VERIFIED: codebase]** — This exact pattern exists at `PhoneCaptureForm.tsx` lines 18–33.

### Anti-Patterns to Avoid

- **Do not use `useForm` + `react-hook-form` for the provisioning form** if the form is just one field. The settings page already uses direct `useState` for `twilioNumber`. A minimal `useState`-based approach with inline zod `safeParse` is simpler and consistent with the page's existing state management. Only use `useForm` if copying the `PhoneCaptureForm` pattern verbatim.
- **Do not call `window.location.reload()`** after provisioning. `router.refresh()` is the correct App Router mechanism — it preserves navigation state and does not cause a full page reload.
- **Do not wrap `router.refresh()` in a `setTimeout`** — it is not async-dependent on DOM state. Call it immediately after the successful API response.
- **Do not add `console.error` to success paths** — D-02 explicitly limits logging to failure paths only.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Area code validation in settings/phone | Custom regex check | Reuse `z.string().regex(/^\d{3}$/)` from provisionSchema | Already exists in API route — keep validation consistent |
| Layout data refresh after client mutation | Manual Supabase re-fetch or window.location.reload() | `router.refresh()` from `next/navigation` | Triggers Server Component re-render in layout without full navigation |
| Structured error fields | Custom error serializer | Inline `JSON.stringify({ event, contractor_id, error: err.message, stack: err.stack })` | Vercel log drain handles JSON; simpler than a helper function |
| Provisioning API | New endpoint | `POST /api/provisioning/create` (already implemented) | Handles LLM creation, agent creation, phone number purchase, DB write, idempotency, all error cases |

**Key insight:** This phase deliberately avoids building anything new. Every capability already exists — the work is wiring existing pieces together and reformatting existing log statements.

---

## Runtime State Inventory

This is not a rename/refactor/migration phase. The Telegram bot name change is a string replacement in source code only. The Telegram bot itself (`voiceDeskTelBot`) is not renamed — only the string literals in source files that reference the bot's display name and deep-link URL.

**Live Telegram bot state:** The Telegram bot is registered with BotFather under the name `voiceDeskTelBot`. The current source code incorrectly references `VoiceDeskBot`. After this fix, source code will match the actual registered bot name. **No BotFather changes required.** [ASSUMED — relies on CONTEXT.md D-01 claim that voiceDeskTelBot is the registered name]

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — telegram_chat_id values in `notification_settings` are numeric chat IDs, not bot names | No migration |
| Live service config | Telegram deep links already in contractor browsers are stale (reference VoiceDeskBot) — but that URL pattern will work again once bot name is correct | No action |
| OS-registered state | None | None |
| Secrets/env vars | `TELEGRAM_BOT_TOKEN` — unchanged. Token is not derived from bot name. | None |
| Build artifacts | None | None |

---

## Common Pitfalls

### Pitfall 1: router.refresh() Not Triggering Layout Re-fetch

**What goes wrong:** The Sidebar still shows no phone number after provisioning even though `router.refresh()` was called.
**Why it happens:** `router.refresh()` only re-renders Server Components in the **current route segment tree**. If the layout is cached by Next.js full-route cache, `router.refresh()` may not invalidate it on older Next.js versions.
**How to avoid:** Next.js 16.2.4 is installed (current stable). `router.refresh()` reliably invalidates the layout on this version. Ensure the call happens in the same component that rendered, not in a `.then()` callback detached from the render cycle.
**Warning signs:** If `router.refresh()` doesn't work, add `revalidatePath('/settings/phone')` in the API route (server action alternative), but do not do this preemptively — `router.refresh()` is the correct mechanism per CONTEXT.md D-03. [ASSUMED — based on general Next.js App Router behavior; confirmed intent by CONTEXT.md]

### Pitfall 2: 409 Error Shown to Already-Provisioned Contractor

**What goes wrong:** A provisioned contractor somehow reaches the form and submits — they see an unhelpful error.
**Why it happens:** The page checks `twilioNumber` from Supabase to toggle state, but if that fetch is stale, the form may render even when provisioned.
**How to avoid:** Show the provisioning form only when `twilioNumber === null`. On 409 response, show error "Number already provisioned" with a link to `/settings/phone` (which will show the number on next render). [VERIFIED: codebase] — The API returns `{ error: 'Already provisioned.' }` with status 409.

### Pitfall 3: area_code Validation Mismatch Between UI and API

**What goes wrong:** The form allows submission of an area code that the API rejects, or the form rejects an area code the API would accept.
**Why it happens:** Custom frontend validation diverges from the API's zod schema.
**How to avoid:** The API's `provisionSchema` uses `z.string().regex(/^\d{3}$/, 'Area code must be exactly 3 digits.')`. The settings/phone form must use the identical regex. Do not use a `number` type input — keep it as `string` to preserve leading zeros (e.g., area code `001` is edge case but valid format). [VERIFIED: codebase] — `provisionSchema` in `route.ts` line 19.

### Pitfall 4: onFailure Handler Missing contractorId/callId

**What goes wrong:** The structured log emits `undefined` for `contractor_id` or `call_id`.
**Why it happens:** The `onFailure` event shape is `event.data.event.data` (FailureEventPayload wraps the original event), not `event.data` directly.
**How to avoid:** For Inngest `onFailure`, always destructure from `event.data.event.data`:
```typescript
// CORRECT
const { callId, contractorId } = event.data.event.data as { callId: string; contractorId: string }
// WRONG
const { callId } = event.data as { callId: string }
```
[VERIFIED: codebase] — `retell-call-classify.ts` line 31 already uses `event.data.event.data`. All four Inngest functions use this pattern.

### Pitfall 5: Telegram Bot Name Casing

**What goes wrong:** Bot name is written as `voiceDeskTelBot` in some places and `VoiceDeskTelBot` or `voicedesktelbot` in others.
**Why it happens:** Case inconsistency during find-and-replace.
**How to avoid:** The canonical name per CONTEXT.md specifics section is `voiceDeskTelBot` (lowercase `v`, uppercase `D`, uppercase `T`, uppercase `B`). The deep-link URL is `https://t.me/voiceDeskTelBot?start=<contractor_uuid>`. The display text is `@voiceDeskTelBot`. Verify all 5 occurrences use this exact casing. [ASSUMED — relies on CONTEXT.md authoritative source for bot name casing]

---

## Code Examples

### Provisioning Form — Minimal Pattern (settings/phone/page.tsx)

```typescript
// Source: PhoneCaptureForm.tsx pattern adapted for inline settings page usage
// [VERIFIED: codebase] — pattern confirmed at src/components/auth/PhoneCaptureForm.tsx

'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle, Phone } from 'lucide-react'
import { z } from 'zod'
import { useContractor } from '@/contexts/ContractorContext'
import { createBrowserClient } from '@supabase/ssr'

const areaCodeSchema = z.object({
  area_code: z.string().regex(/^\d{3}$/, 'Area code must be exactly 3 digits.'),
})

export default function PhoneSettingsPage() {
  const { contractorId } = useContractor()
  const router = useRouter()
  const [twilioNumber, setTwilioNumber] = useState<string | null>(null)
  const [areaCode, setAreaCode] = useState('')
  const [areaCodeError, setAreaCodeError] = useState<string | null>(null)
  const [provisionError, setProvisionError] = useState<string | null>(null)
  const [provisioning, setProvisioning] = useState(false)

  // ... existing fetchNumber useEffect ...

  const handleProvision = async () => {
    setAreaCodeError(null)
    setProvisionError(null)
    const validation = areaCodeSchema.safeParse({ area_code: areaCode })
    if (!validation.success) {
      setAreaCodeError(validation.error.issues[0]?.message ?? 'Invalid area code.')
      return
    }
    setProvisioning(true)
    try {
      const res = await fetch('/api/provisioning/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area_code: areaCode }),
      })
      if (res.ok) {
        router.refresh()  // triggers layout re-fetch → Sidebar gets new twilio_number
        return
      }
      const body = await res.json().catch(() => ({}))
      if (res.status === 409) {
        setProvisionError('Number already provisioned. Refresh to see it.')
      } else if (res.status === 422) {
        setProvisionError(body.error ?? 'No numbers in that area code. Try: 786, 954, or 561.')
      } else {
        setProvisionError(body.error ?? 'Provisioning failed. Please try again.')
      }
    } catch {
      setProvisionError('Network error. Please check your connection.')
    } finally {
      setProvisioning(false)
    }
  }

  if (!twilioNumber) {
    return (
      // area code input + "Provision My Number" button
      // show provisionError if set
    )
  }
  // existing read-only display + carrier instructions
}
```

### Structured Console.error (D-02 format)

```typescript
// Source: CONTEXT.md D-02 decision
// Apply at each catch/onFailure location:

// retell webhook after() catch:
catch (err) {
  console.error('[voicedesk]', JSON.stringify({
    event: 'retell.webhook.after.failure',
    contractor_id: null,  // not available at this scope
    call_id: null,        // not available at this scope
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  }))
}

// Inngest onFailure (retell-call-classify):
onFailure: async ({ event }) => {
  const { callId, contractorId } = event.data.event.data as { callId: string; contractorId: string }
  // ... existing DB update ...
  console.error('[voicedesk]', JSON.stringify({
    event: 'retell/call.classify.failure',
    contractor_id: contractorId ?? null,
    call_id: callId ?? null,
    error: 'all retries exhausted',
    stack: undefined,
  }))
}
```

### Telegram Deep-link URL (corrected)

```typescript
// Source: CONTEXT.md specifics section
// [ASSUMED — bot name voiceDeskTelBot per CONTEXT.md; cannot verify BotFather registration from code]

// Replace in dashboard/page.tsx line 79:
href={`https://t.me/voiceDeskTelBot?start=${contractorId ?? ''}`}

// Replace in dashboard/page.tsx line 84 (display text):
Connect @voiceDeskTelBot

// Replace in telegram/route.ts line 2 (comment):
// Telegram bot webhook handler for @voiceDeskTelBot.

// Replace in telegram/route.ts line 21 (comment):
// Deep link format: https://t.me/voiceDeskTelBot?start=<contractor_uuid>

// Replace in telegram.ts line 15 (comment):
// D-18: Single @voiceDeskTelBot for the entire platform. One TELEGRAM_BOT_TOKEN env var.
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `waitUntil()` from `@vercel/functions` | `after()` from `next/server` | Next.js 15.1+ | Already used in this project — no change |
| `@hookform/resolvers/zod` | Inline zod resolver | Zod v4 broke `.errors` API | Already pattern in `PhoneCaptureForm.tsx` — reuse |
| `router.push()` to force layout reload | `router.refresh()` | Next.js App Router (v13+) | Correct mechanism for Server Component re-renders |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The Telegram bot is actually registered as `voiceDeskTelBot` in BotFather (not `VoiceDeskBot`) | Code Examples — Telegram deep-link | If `VoiceDeskBot` is the real registered name, the fix makes the link broken. Low risk: CONTEXT.md explicitly states `voiceDeskTelBot` is correct. |
| A2 | `router.refresh()` reliably invalidates the layout Server Component in Next.js 16.2.4 without additional cache configuration | Code Examples — router.refresh() | If layout is aggressively cached, Sidebar may not update until hard reload. Mitigation: verify in manual test after implementation. |
| A3 | The provisioning form in settings/phone should remain a single-file edit (no new component file) | Architecture Patterns | If the form grows complex, a separate component file may be preferred. Low risk for this phase. |

---

## Open Questions

1. **`call_id` and `contractor_id` availability in `after()` catch block**
   - What we know: The `after()` callback receives no arguments — it is a closure over the parsed `event` variable.
   - What's unclear: At the point the catch fires, `event.call.agent_id` is available in the closure but `contractor_id` is not (it's looked up inside `processCallEnded`/`processCallAnalyzed`).
   - Recommendation: Log `call_id: event.call?.call_id ?? null` and `contractor_id: null` in the after() catch. This is acceptable per D-02 "log at every uncaught path" — the call_id is available from the payload.

2. **Whether to show the provisioning form if `contractorId` is null**
   - What we know: `useContractor()` returns `contractorId` which can be null briefly on mount.
   - What's unclear: Should the form render as disabled/loading while `contractorId` is null?
   - Recommendation: Show a loading skeleton or null while `contractorId` is null (same pattern as the existing `fetchNumber` useEffect guard).

---

## Environment Availability

No new external tools, services, or CLIs are required. All dependencies are already installed and operational.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `next` (useRouter, router.refresh) | Provisioning form re-fetch | ✓ | 16.2.4 | — |
| `zod` | Area code validation | ✓ | installed | — |
| `lucide-react` | Spinner and error icons | ✓ | installed | — |
| Retell API | `POST /api/provisioning/create` | ✓ (existing) | — | — |
| Supabase | Layout data refresh | ✓ (existing) | — | — |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest + jsdom |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/` |
| Full suite command | `npx vitest run tests/ --coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTIF-03 | Telegram deep-link URL contains `voiceDeskTelBot` | unit | `npx vitest run tests/notifications/telegram.test.ts` | ✅ (existing) |
| NOTIF-03 | `sendTelegram` function comment does not reference old name (static) | manual | — | N/A |
| ONBOARD-01 | Provisioning form renders when `twilio_number` is null | unit | `npx vitest run tests/ui/phone-settings.test.tsx` | ❌ Wave 0 |
| ONBOARD-01 | Provisioning form calls `POST /api/provisioning/create` with `area_code` | unit | `npx vitest run tests/ui/phone-settings.test.tsx` | ❌ Wave 0 |
| ONBOARD-01 | Provisioning form shows error on 422 with area code suggestions | unit | `npx vitest run tests/ui/phone-settings.test.tsx` | ❌ Wave 0 |
| D-02 | Structured log emitted on after() catch (format verification) | manual | inspect Vercel logs | manual-only |
| D-02 | onFailure handlers emit structured log (format verification) | manual | inspect Inngest dashboard | manual-only |

**Note:** The error observability changes (D-02) cannot be meaningfully unit-tested without a test that spies on `console.error` and verifies the JSON structure. This is acceptable as a manual verification step — the Vercel log format is not a business-critical contract that requires automated regression.

### Sampling Rate

- **Per task commit:** `npx vitest run tests/notifications/telegram.test.ts tests/api/provisioning.test.ts`
- **Per wave merge:** `npx vitest run tests/`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/ui/phone-settings.test.tsx` — covers ONBOARD-01 provisioning form behavior (render, submit, error states)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `supabase.auth.getUser()` — already in provisioning API |
| V3 Session Management | no | No session changes |
| V4 Access Control | yes | Contractor ID derived from JWT, not request body — already enforced in `/api/provisioning/create` |
| V5 Input Validation | yes | `z.string().regex(/^\d{3}$/)` — area code validated same as API |
| V6 Cryptography | no | No new crypto operations |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client-supplied contractor_id in provisioning | Elevation of Privilege | API already ignores any contractor_id from body; uses JWT user_id lookup |
| Double-provisioning via rapid form re-submission | Tampering | API returns 409 on duplicate; UI disables button during pending request |
| XSS in inline error display | Tampering | React renders all string state as text nodes — no `dangerouslySetInnerHTML` |

**Security verdict:** No new security surface is introduced. The provisioning API already has correct auth and idempotency controls. The form is a thin client wrapper.

---

## Sources

### Primary (HIGH confidence)

- [VERIFIED: codebase] — All file contents read directly from source
- [CITED: https://nextjs.org/docs/app/api-reference/functions/use-router] — `router.refresh()` App Router API

### Secondary (MEDIUM confidence)

- CONTEXT.md `09-CONTEXT.md` — All decisions (D-01 through D-05) treated as authoritative user decisions

### Tertiary (LOW confidence)

- A1–A3 assumptions in Assumptions Log above

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all verified by codebase grep
- Architecture: HIGH — all patterns confirmed in existing code; `router.refresh()` cited from Next.js official docs
- Pitfalls: HIGH — all pitfalls derived from actual codebase content (existing error shapes, existing API contracts)
- Telegram bot name: MEDIUM — depends on CONTEXT.md being correct about registered bot name

**Research date:** 2026-05-20
**Valid until:** 2026-06-20 (stable domain — Next.js App Router APIs do not change in patch releases)

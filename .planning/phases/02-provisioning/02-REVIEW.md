---
phase: 02-provisioning
reviewed: 2026-05-06T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - src/types/database.ts
  - src/lib/validations/onboarding.ts
  - src/app/actions/settings.ts
  - src/app/(dashboard)/settings/agent/_components/LanguageSettingsForm.tsx
  - src/lib/retell/client.ts
  - src/lib/retell/system-prompt.ts
  - src/inngest/client.ts
  - src/inngest/functions/retell-agent-sync.ts
  - src/app/api/inngest/route.ts
  - src/app/api/provisioning/create/route.ts
  - src/app/api/provisioning/update-agent/route.ts
  - tests/api/provisioning.test.ts
  - tests/lib/retell-language-mapper.test.ts
  - tests/lib/system-prompt.test.ts
findings:
  critical: 4
  warning: 6
  info: 3
  total: 13
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-06T00:00:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Phase 2 implements contractor provisioning: a Retell LLM + agent + phone number are created in sequence and persisted to Supabase, with a durable Inngest retry loop for subsequent syncs. The overall approach is sound — JWT-based auth is used correctly (`getUser` not `getSession`), `contractor_id` is never taken from the request body, and the server-only boundary is enforced with `import 'server-only'` where it matters.

Four critical defects were found. Two are data-correctness/logic bugs: the `onFailure` handler in the Inngest function silently swallows DB errors and can leave `agent_sync_status` permanently stuck as `pending`; and the `update-agent` route does not await the `pending` status write, creating a race condition where the Retell call completes before the DB is updated. A third critical issue is that the provisioning `create` route leaks orphaned Retell resources (LLM + agent) when phone number purchase fails — there is a comment acknowledging this but no compensating cleanup. The fourth is that `toRetellLanguage` returns an empty array when called with an empty language list; that empty array is then passed directly to the Retell `language` field and cast via `as any`, which will produce an invalid API call if `supported_languages` is somehow empty.

Six warnings and three informational items are documented below.

---

## Critical Issues

### CR-01: `onFailure` handler swallows DB errors — `agent_sync_status` can be stuck as `pending` forever

**File:** `src/inngest/functions/retell-agent-sync.ts:17-25`

**Issue:** The `onFailure` callback calls `db.from('contractors').update(...)` but never awaits the result and never checks for an error. If the Supabase write fails (network timeout, RLS policy gap, wrong `id`), the failure is silently discarded. The contractor's `agent_sync_status` stays `pending` indefinitely — no alert fires and no retry covers this path, because `onFailure` itself is not retried by Inngest.

```ts
// current — error is lost
onFailure: async ({ event }) => {
  const contractorId = (event.data.event.data as { contractorId: string }).contractorId
  const db = createServiceRoleClient()
  await db                         // ← result is awaited, but...
    .from('contractors')
    .update({ agent_sync_status: 'failed' })
    .eq('id', contractorId)        // ← { error } is never checked
},
```

**Fix:** Destructure and log the error. Also validate `contractorId` is non-empty before issuing the DB call (a corrupt payload yields `.eq('id', undefined)` which silently matches zero rows).

```ts
onFailure: async ({ event }) => {
  const contractorId = (event.data.event.data as { contractorId: string }).contractorId
  if (!contractorId) {
    console.error('[retell-agent-sync] onFailure: missing contractorId in event payload')
    return
  }
  const db = createServiceRoleClient()
  const { error } = await db
    .from('contractors')
    .update({ agent_sync_status: 'failed' })
    .eq('id', contractorId)
  if (error) {
    console.error('[retell-agent-sync] onFailure: failed to set agent_sync_status=failed:', error.message)
  }
},
```

---

### CR-02: `pending` status write is not awaited in `update-agent` — race condition with Retell call

**File:** `src/app/api/provisioning/update-agent/route.ts:44-48`

**Issue:** The comment at line 44 says "Set agent_sync_status to 'pending' BEFORE Retell call", but the `await` only covers the outer `serviceClient.from(...).update(...)` call through the chain — the `.eq()` terminator is the step that actually fires the query, and the current code structure is:

```ts
await serviceClient
  .from('contractors')
  .update({ agent_sync_status: 'pending' })
  .eq('id', contractor.id)          // ← this await is correct IF the Supabase JS client
                                    //   returns a thenable from .eq(). Verify below.
```

Looking at the `mockSupabaseChain` in the test (line 69-71), the mock makes `update()` return `{ eq: vi.fn().mockResolvedValue(...) }` — meaning `.eq()` returns the promise. The production client behaves identically. So the await IS correct mechanically.

However, **the error from the `pending` write is never checked**. If that write fails (e.g. the row was deleted between the select and this update), execution silently continues, Retell is called, and the `synced` or Inngest path runs against a non-existent row. The subsequent `agent_sync_status: 'synced'` update also silently succeeds (0 rows affected) and the data is permanently inconsistent.

**Fix:** Check the error from the pending write before proceeding.

```ts
const { error: pendingErr } = await serviceClient
  .from('contractors')
  .update({ agent_sync_status: 'pending' })
  .eq('id', contractor.id)
if (pendingErr) {
  console.error('[provisioning/update-agent] failed to set pending status:', pendingErr.message)
  return NextResponse.json({ error: 'Internal error.' }, { status: 500 })
}
```

---

### CR-03: Orphaned Retell resources on `phoneNumber.create` failure — no cleanup

**File:** `src/app/api/provisioning/create/route.ts:96-108`

**Issue:** When `retell.phoneNumber.create` throws, the route returns 422 and logs the orphaned LLM and agent IDs (line 131, which is unreachable from this path — the log is actually in the DB-error handler, not here). At the time of phone number failure, `llm_id` and `agent_id` have already been allocated in Retell but are **never deleted**. There is no compensating call to `retell.llm.delete(llm.llm_id)` or `retell.agent.delete(agent.agent_id)`. Each failed provisioning attempt leaks one LLM and one agent in Retell's system, accumulating billing and quota cost.

The comment in the code (lines 130-131) logs orphans only on the DB-write failure path (step 8), not on the phone creation failure path (step 7). The phone-failure catch block at line 103-108 returns immediately without any cleanup log either.

**Fix:** Add compensating deletes in the phone number catch block, with best-effort semantics (log but do not throw if cleanup itself fails):

```ts
} catch (err) {
  console.error('[provisioning/create] phoneNumber.create failed:', err instanceof Error ? err.message : err)
  // Best-effort cleanup of already-created Retell resources
  try {
    await retell.agent.delete(agent.agent_id)
    await retell.llm.delete(llm.llm_id)
  } catch (cleanupErr) {
    console.error('[provisioning/create] ORPHANED Retell resources — agent_id:', agent.agent_id, 'llm_id:', llm.llm_id, '— manual cleanup required')
  }
  return NextResponse.json(
    { error: `No numbers available in area code ${body.data.area_code}. Try: 786, 954, or 561.` },
    { status: 422 }
  )
}
```

---

### CR-04: `toRetellLanguage([])` returns `[]`, which passes an invalid `language` field to Retell agent creation

**File:** `src/lib/retell/client.ts:14-18` / `src/app/api/provisioning/create/route.ts:88`

**Issue:** `toRetellLanguage` returns `codes` directly when `codes.length !== 1`:

```ts
return codes.length === 1 ? codes[0] : codes
// When langs=[] → codes=[] → returns []
```

An empty array is then cast `as any` and passed as `language` to `retell.agent.create`. The Retell API will reject this with an error that propagates as a generic 500 to the caller. The `languageSchema` requires `min(1)` at the validation layer, but `contractor_settings.supported_languages` is typed as `Language[]` with no database-level minimum enforcement visible in `database.ts`. If a bad row exists in the DB (e.g. from a migration or direct SQL edit), provisioning fails with a confusing error.

More concretely, the test in `retell-language-mapper.test.ts:18` documents that `toRetellLanguage([])` returns `[]` as expected behavior — but the create route has no guard against this case before passing the result to Retell.

**Fix:** Add a guard in `toRetellLanguage` and/or in the create route:

```ts
// In client.ts
export function toRetellLanguage(langs: string[]): string | string[] {
  const codes = langs.map((l) => RETELL_LANGUAGE_MAP[l]).filter(Boolean)
  if (codes.length === 0) throw new Error('toRetellLanguage: no valid language codes provided')
  return codes.length === 1 ? codes[0] : codes
}
```

And update the empty-array test case in `retell-language-mapper.test.ts` to assert that an error is thrown.

---

## Warnings

### WR-01: `settings` cast via `unknown[]` is an unsafe double cast that hides type errors

**File:** `src/app/api/provisioning/create/route.ts:53-61` and `src/app/api/provisioning/update-agent/route.ts:42`

**Issue:** The Supabase join result is cast as `(contractor.contractor_settings as unknown[])[0] as { ... }`. This bypasses TypeScript entirely. If the join returns `null` (settings row not yet created for this contractor), `[0]` is `undefined`, and every subsequent property access on `settings` (`settings.business_name`, `settings.supported_languages`, etc.) throws `TypeError: Cannot read properties of undefined`. This crashes the route with an unhandled exception rather than a clean 4xx response.

The `maybeSingle()` guard at line 43 only covers the case where the contractor row itself is missing — it does not verify that `contractor_settings` is non-empty.

**Fix:** Validate that settings exists before proceeding:

```ts
const settingsRaw = (contractor.contractor_settings as unknown[])
if (!settingsRaw || settingsRaw.length === 0) {
  return NextResponse.json({ error: 'Contractor settings not found.' }, { status: 422 })
}
const settings = settingsRaw[0] as Parameters<typeof buildSystemPrompt>[0]
```

---

### WR-02: `buildSystemPrompt` can throw on `emergency_keywords.en.join()` if the field is null or missing

**File:** `src/lib/retell/system-prompt.ts:16`

**Issue:** `settings.emergency_keywords.en.join(', ')` will throw `TypeError: Cannot read properties of null/undefined` if `emergency_keywords` is null, if `emergency_keywords.en` is null, or if the field is omitted from the DB row. The type `EmergencyKeywords` declares `en: string[]`, but the DB column is JSONB and schema migrations can produce rows where this field is absent. There is no null guard here, and the system-prompt tests only pass a well-formed fixture.

**Fix:**
```ts
const emergencyKeywords = (settings.emergency_keywords?.en ?? []).join(', ')
```

---

### WR-03: `updateLanguages` server action does not trigger an Inngest agent re-sync after settings update

**File:** `src/app/actions/settings.ts:31-39`

**Issue:** `updateLanguages` writes `supported_languages` to `contractor_settings` but never calls `PATCH /api/provisioning/update-agent` or fires an `inngest.send('retell/agent.sync', ...)` event. The language change is saved to the DB but the live Retell agent keeps its old system prompt and `language` field indefinitely. This is a correctness gap: the UI shows "Languages updated." (success) but the AI agent continues operating with stale configuration.

The design comment in `update-agent/route.ts` (lines 6-11) says the Phase 6 caller is responsible for triggering the re-sync, but the Phase 2 language settings action is already wired to a form that saves language changes — it should chain the sync or at least document that it intentionally defers to Phase 6.

**Fix (Phase 2 scope):** Add an `inngest.send` after the successful DB update, or add an explicit comment with a TODO referencing the Phase 6 task that will wire this up:

```ts
// TODO(Phase 6): After successful update, call inngest.send({ name: 'retell/agent.sync', ... })
// Until then, language changes are saved to DB but not propagated to the live Retell agent.
```

---

### WR-04: Retell agent creation uses multi-language array that Retell may not support

**File:** `src/lib/retell/client.ts:14-18` / `src/app/api/provisioning/create/route.ts:86-89`

**Issue:** `toRetellLanguage(['en', 'es'])` returns `['en-US', 'es-ES']` (an array). The code comment says "Multiple: pass as array. (Retell API requirement)" but the Retell v2 `agent.create` API docs describe `language` as a single locale string union, not an array. Passing an array and hiding it with `as any` means this will silently reach the Retell API and may be silently ignored or cause a 422. The `retell-language-mapper.test.ts` test verifies the local mapping logic but does not prove the Retell API accepts an array.

**Fix:** Verify the Retell API contract for multi-language agents. If the API does not accept an array, the correct implementation is to use a single primary language and encode multi-language behavior entirely in the system prompt (which `buildSystemPrompt` already does via the `hasSpanish` branch). In that case, `toRetellLanguage` should always return a string:

```ts
export function toRetellLanguage(langs: string[]): string {
  // Always use primary language as the Retell agent locale.
  // Multi-language support is handled via system prompt (LANG-01).
  const primary = langs[0]
  return RETELL_LANGUAGE_MAP[primary] ?? 'en-US'
}
```

---

### WR-05: `agent.create` failure does not clean up the already-created LLM

**File:** `src/app/api/provisioning/create/route.ts:78-93`

**Issue:** If `retell.agent.create` fails (step 6), the catch block returns a 500 without deleting the LLM created in step 5. Like CR-03, this leaks a Retell resource on every failed provisioning attempt that gets past step 5. This is separate from CR-03 (which covers phone number failure); this covers agent creation failure.

**Fix:** Add compensating cleanup in the agent.create catch block:

```ts
} catch (err) {
  console.error('[provisioning/create] agent.create failed:', err instanceof Error ? err.message : err)
  try { await retell.llm.delete(llm.llm_id) } catch (cleanupErr) {
    console.error('[provisioning/create] ORPHANED LLM — llm_id:', llm.llm_id, '— manual cleanup required')
  }
  return NextResponse.json({ error: 'Failed to create AI agent. Please try again.' }, { status: 500 })
}
```

---

### WR-06: `toRetellLanguage` return type is `string | string[]` but the test for empty input documents returning `[]`

**File:** `src/lib/retell/client.ts:14-18` / `tests/lib/retell-language-mapper.test.ts:18`

**Issue:** The function's declared return type is `string | string[]`. The test asserts `toRetellLanguage([]) toEqual([])` — an empty array. An empty array is technically `string[]`, but it is an invalid value for any Retell API field. The return type does not communicate that empty input is a caller error. This overlaps with CR-04 but is a separate concern: the type contract itself is too permissive and the test is asserting invalid behavior as correct.

**Fix:** Either throw on empty input (see CR-04 fix) or return a fallback default locale with a warning log. Update the test to match.

---

## Info

### IN-01: `database.ts` — `Language` type does not include `'ht'` but comments reference Haitian Creole removal

**File:** `src/types/database.ts:5`

**Issue:** The `Language` type is `'en' | 'es'`. `CLAUDE.md` notes Haitian Creole (`ht`) was planned for the South Florida market and is referenced as a future concern. The `languageSchema` comment (line 29 of `onboarding.ts`) says "D-01 Phase 2: HC removed." This is correct as implemented, but there is no `// ht intentionally excluded` comment in `database.ts` itself. A future developer may add `'ht'` to the type without realizing the Retell language map, system prompt logic, and schema validation all need coordinated updates.

**Fix:** Add a brief comment in `database.ts`:
```ts
// 'ht' (Haitian Creole) excluded in v1 — add after verifying Retell native HC support (CLAUDE.md Week-1 items)
export type Language = 'en' | 'es'
```

---

### IN-02: System prompt includes a DTMF instruction ("press 2") that a voice AI cannot honor

**File:** `src/lib/retell/system-prompt.ts:13`

**Issue:** The bilingual system prompt instructs callers to "press 2" (`Para español, oprima dos`), and `buildBeginMessage` repeats this at line 38. A Retell AI voice agent is not a traditional IVR and does not handle DTMF tones unless explicitly configured with a phone keypad step. The agent will speak the instruction but be unable to act on a keypress — callers pressing 2 will get no response or an unexpected reaction. This is a UX/correctness issue for Spanish-speaking callers.

**Fix:** Replace with a verbal trigger: "Para español, diga 'español'" or restructure to detect spoken language preference via LLM intent rather than DTMF.

---

### IN-03: `call-order` test in `provisioning.test.ts` does not verify that `agent_sync_status=pending` is written before the pending update mock tracks it correctly

**File:** `tests/api/provisioning.test.ts:197-250`

**Issue:** The call-order test (lines 197-250) uses `updateCallCount` to differentiate the first `update()` call (pending) from the second (synced). However, the `mockPendingUpdate` function pushes `'pending'` to `callOrder` when `update()` is invoked — not when the returned `.eq()` promise resolves. The route `await`s the `.eq()` terminator, but the mock's `callOrder.push('pending')` fires when `update()` is called (synchronously), before the `await`. The `retell` mock pushes `'retell'` asynchronously (inside `async () => { callOrder.push('retell') }`). The test passes, but it is testing mock invocation order rather than actual promise resolution order. If the production implementation were changed to fire the Retell call before awaiting the pending write, the test would still pass.

**Fix:** Push to `callOrder` inside the `.eq()` mock's resolved value (i.e., after the await resolves) to accurately test promise-resolution ordering:
```ts
eq: vi.fn().mockImplementation(async () => {
  callOrder.push('pending')
  return { error: null }
})
```

---

_Reviewed: 2026-05-06T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

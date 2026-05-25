# Phase 9: Hardening & UX Polish — Context

**Gathered:** 2026-05-20
**Status:** Ready for planning
**Source:** User conversation + codebase inspection

<domain>
## Phase Boundary

Four discrete tasks, each small and non-overlapping:

1. **Telegram bot name fix** — Replace `VoiceDeskBot` with `voiceDeskTelBot` in all source/UI references. Pure string replacement, no logic change.

2. **Error observability** — Add structured `console.error` logging (JSON format) for uncaught failures inside `after()` webhook processing and Inngest functions. Vercel captures `console.error` in its runtime logs. No Sentry/third-party required — Vercel log drain is the target sink. Light-touch: log `{ contractor_id, call_id, error, phase }` at every uncaught path.

3. **Phone provisioning from settings/phone** — `settings/phone` is currently read-only. Add an area-code input + "Provision My Number" button that calls the existing `POST /api/provisioning/create`. The API already handles everything (Retell agent creation, DB write, idempotency). Settings/phone just needs a form for unprovisionned contractors and a success display for provisioned ones. Once provisioned, redirect or refresh so the number appears.

4. **Provisioned number in Sidebar** — The Sidebar already has `phoneNumber` prop and displays it between business name and email (`src/components/dashboard/Sidebar.tsx` lines 111–117). The dashboard layout already queries and passes `contractor.twilio_number`. This task is to verify it renders correctly and ensure provisioning from settings/phone triggers a layout re-fetch (router.refresh() after successful provisioning call).

</domain>

<decisions>
## Implementation Decisions

### D-01: Telegram bot name
- The correct bot name is `voiceDeskTelBot` — replace ALL occurrences of `VoiceDeskBot` in source
- Files affected: `src/app/api/webhooks/telegram/route.ts` (2 occurrences), `src/app/(dashboard)/dashboard/page.tsx` (2 occurrences), `src/lib/notifications/telegram.ts` (1 occurrence)
- The TELEGRAM_BOT_TOKEN env var is unchanged — only display names and deep-link URLs

### D-02: Error observability scope
- No Sentry, no third-party SDK — Vercel captures `console.error` in runtime logs
- Structured format: `console.error('[voicedesk]', JSON.stringify({ event, contractor_id, call_id?, error: err.message, stack: err.stack }))`
- Target locations: catch blocks in `after()` handler in `/api/webhooks/retell/route.ts`, and `onFailure` handlers in Inngest functions (`retell-call-classify`, `retell-notify-dispatch`, `stripe-payment-failure`, `retell-agent-sync`)
- Do NOT add logging to non-error paths — only failures

### D-03: Phone provisioning UI
- `settings/phone` shows two states: (a) not provisioned — area code input + provision button, (b) provisioned — number display + forwarding instructions (current content)
- Area code input: 3-digit numeric input, validates with zod (same schema as provisioning API)
- Button calls `POST /api/provisioning/create` with `{ area_code }` — same endpoint used by Phase 7 `/setup/phone` flow
- On success: call `router.refresh()` (Next.js App Router) to trigger layout re-fetch, which will surface the new number in both the settings/phone page and the Sidebar
- On error: show inline error (area code unavailable → suggest Miami area codes 786, 954, 561; already provisioned → link to settings/phone; other → generic message)
- Loading state during provisioning: disable button, show spinner

### D-04: Sidebar phone number display
- Already implemented — `Sidebar.tsx` has `phoneNumber` prop and displays it when truthy
- Layout already passes `contractor.twilio_number` as `phoneNumber`
- This task is verification-only: confirm the Sidebar shows the number after `router.refresh()` from settings/phone, and that the display looks correct (format: `(305) 555-1234` or E.164 as stored)
- If the Sidebar doesn't show until hard reload, ensure `router.refresh()` is called after successful provisioning in settings/phone

### D-05: Emergency keywords — no change needed
- `contractor_settings.emergency_keywords` is already editable via `KeywordsForm.tsx` in `settings/agent`
- The Retell system prompt already uses `settings.emergency_keywords.en` (from `src/lib/retell/system-prompt.ts`)
- Hard-coded gas/CO alarm keywords in `src/lib/classification/emergency-keywords.ts` are intentional and stay non-configurable
- Review concern is already addressed by the existing KeywordsForm UI — no new work needed

### Claude's Discretion
- Number formatting: show twilio_number as stored (E.164) — no reformatting needed for v1
- Provisioning form can live inline in settings/phone (no modal needed)
- Error log format can be a single `console.error` line per failure point

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Telegram
- `src/app/api/webhooks/telegram/route.ts` — all bot name references
- `src/app/(dashboard)/dashboard/page.tsx` — Telegram connect link (lines 79, 84)
- `src/lib/notifications/telegram.ts` — bot name comment (line 15)

### Phone Provisioning
- `src/app/api/provisioning/create/route.ts` — existing API (area_code validation, idempotency, 409 on already-provisioned)
- `src/app/(dashboard)/settings/phone/page.tsx` — current read-only implementation
- `src/app/setup/phone/page.tsx` — analog: the setup/phone page uses the same API; reuse pattern

### Sidebar
- `src/components/dashboard/Sidebar.tsx` — phoneNumber prop + display logic (lines 107–117)
- `src/app/(dashboard)/layout.tsx` — already selects `twilio_number` and passes to Sidebar (line 20, 30)

### Error Observability
- `src/app/api/webhooks/retell/route.ts` — after() handler
- `src/inngest/functions/retell-call-classify.ts`
- `src/inngest/functions/retell-notify-dispatch.ts`
- `src/inngest/functions/stripe-payment-failure.ts`
- `src/inngest/functions/retell-agent-sync.ts`

</canonical_refs>

<specifics>
## Specific Requirements

1. Bot name: `voiceDeskTelBot` (camelCase, lowercase v, capital T, B)
2. Deep link URL pattern: `https://t.me/voiceDeskTelBot?start=<contractor_uuid>`
3. Display text in dashboard: `Connect @voiceDeskTelBot`
4. Settings/phone provisioning button label: "Provision My Number"
5. Area code suggestions on failure: 786, 954, 561 (Miami area — matches existing API)
6. After successful provisioning: `router.refresh()` to reload layout

</specifics>

<deferred>
## Deferred Ideas

- Full Sentry integration — deferred to v2 when logs become hard to search
- Rate limiting on webhook endpoints — deferred, not in Phase 9 scope
- In-flight emergency deduplication — deferred
- Secondary escalation contact — deferred

</deferred>

---

*Phase: 09-hardening*
*Context gathered: 2026-05-20*

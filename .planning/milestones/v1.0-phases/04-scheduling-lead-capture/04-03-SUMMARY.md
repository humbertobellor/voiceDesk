---
plan: 04-03
phase: 04-scheduling-lead-capture
status: complete
completed: "2026-05-08"
duration: "~7 min"
requirements:
  - SCHED-01
  - SCHED-02
key-files:
  created:
    - src/lib/scheduling/slots.ts
    - src/lib/scheduling/inject-slots.ts
  modified:
    - src/lib/retell/system-prompt.ts
self-check: PASSED
---

# Plan 04-03 Summary — Slot Computation + Prompt Injection

## What Was Built

Two new modules delivering the slot-computation and prompt-injection pipeline for SCHED-01/SCHED-02.

### `src/lib/scheduling/slots.ts`

`computeAvailableSlots()` pure function (no DB calls, no I/O). Takes `businessHours`, `appointmentDurationMinutes`, `existingStarts` (UTC Dates), `timezone` (IANA), and optional `referenceDate` (injectable for tests). Returns `SlotWindow[]` — each window has `startsAt` (UTC Date), `endsAt` (UTC Date), `label` (human-readable in contractor timezone). Implements D-07: exactly the next 5 enabled business days. Disabled days (`enabled: false`) produce zero slots. Existing `starts_at` values are excluded. All slot boundaries computed in contractor IANA timezone via `date-fns-tz` `toZonedTime`/`fromZonedTime`, stored back as UTC Dates for DB insert.

### `src/lib/scheduling/inject-slots.ts`

`buildSlotSection(availableSlots: SlotWindow[])` — pure string transform (no `server-only` needed). Returns formatted scheduling section for the Retell system prompt (D-07). When `availableSlots.length === 0`, returns D-15 fallback "not currently configured" so the prompt is always valid even with no calendar connected.

### `src/lib/retell/system-prompt.ts` (extended)

`buildSystemPrompt()` now accepts an optional second argument `availableSlots?: SlotWindow[]`. Calls `buildSlotSection(availableSlots ?? [])` and appends the result. Backward-compatible — existing callers that omit the second argument get the D-15 fallback automatically.

## Commits

- `afa5682` — feat(04-03): implement computeAvailableSlots() pure function
- `981368a` — feat(04-03): add buildSlotSection() and extend buildSystemPrompt()

## Self-Check

- [x] `computeAvailableSlots()` returns `SlotWindow[]` for exactly next 5 enabled business days
- [x] Disabled days (`enabled: false`) produce no slots
- [x] Existing `starts_at` values excluded from returned slot list
- [x] All slot boundaries computed in contractor IANA timezone, stored as UTC Dates
- [x] `buildSlotSection()` returns formatted scheduling section string
- [x] `buildSlotSection([])` returns D-15 fallback
- [x] `import 'server-only'` absent (not needed — no secrets)
- [x] `buildSystemPrompt()` now injects slot section via `availableSlots` param

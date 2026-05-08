---
plan: 04-04
phase: 04-scheduling-lead-capture
status: complete
completed: "2026-05-08"
duration: "~3 min"
requirements:
  - SCHED-03
key-files:
  created: []
  modified:
    - src/lib/classification/extract-trade.ts
    - tests/lib/classification.test.ts
decisions:
  - "appointmentFields shared object used to spread new fields into all four schemas — avoids duplication and ensures schema parity"
  - "confirmed_appointment_time and service_address both use .nullish() NOT .optional() per OpenAI structured outputs requirement"
  - "Extraction prompt updated with explicit ISO format instruction (YYYY-MM-DDTHH:MM:SS without timezone suffix) and null-return instructions"
self-check: PASSED
---

# Phase 4 Plan 04: GPT-4o Schema Extension (D-11) Summary

**One-liner:** All four Phase 3 extraction schemas extended with confirmed_appointment_time and service_address .nullish() fields; extraction prompt updated with ISO format and null-return instructions per D-11.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for D-11 schema extension | 56d31ea | tests/lib/classification.test.ts |
| 1 (GREEN) | Extend all four schemas + update prompt | b5916f8 | src/lib/classification/extract-trade.ts |

---

## What Was Built

### `src/lib/classification/extract-trade.ts` (extended)

Added a shared `appointmentFields` object with two new fields, then spread it into all four Zod schemas:

```typescript
const appointmentFields = {
  confirmed_appointment_time: z.string().nullish(),
  service_address: z.string().nullish(),
}
```

All four schemas (HvacSchema, PlumbingSchema, ElectricalSchema, GeneralSchema) now include both fields via `...appointmentFields`. This ensures the `TradeExtractionResult` union type automatically picks up both new fields via `z.infer<>` — no manual type changes needed.

`buildExtractionPrompt()` updated with explicit LLM instructions:
- Extract `confirmed_appointment_time` in ISO format `YYYY-MM-DDTHH:MM:SS` without timezone suffix
- Return `null` for `confirmed_appointment_time` if no appointment was confirmed
- Extract `service_address` if provided; return `null` if not

### `tests/lib/classification.test.ts` (extended)

Six new tests added in the `extractTradeData D-11 schema extension` describe block:
1. hvac schema returns confirmed_appointment_time when LLM provides it
2. hvac schema returns null for confirmed_appointment_time when not present
3. plumbing schema includes both new fields
4. electrical schema includes both new fields
5. general schema includes both new fields
6. buildExtractionPrompt includes ISO format instructions (the failing RED test that drove implementation)

All 18 classification tests pass (12 existing + 6 new).

---

## Verification Results

| Check | Result |
|-------|--------|
| `grep -c "confirmed_appointment_time" extract-trade.ts` | 2 (appointmentFields def + prompt) |
| `grep -c "service_address" extract-trade.ts` | 2 (appointmentFields def + prompt) |
| `.optional()` used for new fields | 0 (only in comments) |
| prompt contains "ISO format (YYYY-MM-DDTHH:MM:SS) without timezone suffix" | PASS |
| prompt contains "return null for confirmed_appointment_time" | PASS |
| prompt contains "service_address" | PASS |
| `npx tsc --noEmit` | Exit 0 |
| `npx vitest run tests/lib/classification.test.ts` | 18/18 pass |

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Threat Model Compliance

| Threat ID | Status |
|-----------|--------|
| T-04-04-01 — confirmed_appointment_time from LLM (Tampering) | Accepted: Plan 05 will validate with Date.parse() before use; comment in appointmentFields warns future implementer |
| T-04-04-02 — service_address from LLM (Tampering) | Accepted: plain text stored in leads.notes, no code execution path |
| T-04-04-03 — extraction schemas in OpenAI call (Info Disclosure) | Accepted: transcripts already sent to OpenAI in Phase 3; no additional PII exposure |

---

## Known Stubs

None — the schema extension is complete. The `TradeExtractionResult` type now includes `confirmed_appointment_time` and `service_address` in all four variants.

Plan 05 (Inngest steps) will:
1. Access `tradeData.confirmed_appointment_time` and `tradeData.service_address` from this extended type
2. Validate `confirmed_appointment_time` with `Date.parse()` before appointment creation (T-04-04-01 mitigation)

---

## Self-Check

Checking created files exist and commits are recorded:

- src/lib/classification/extract-trade.ts: FOUND
- tests/lib/classification.test.ts (extended): FOUND
- Commit 56d31ea: RED test phase
- Commit b5916f8: GREEN implementation phase

## Self-Check: PASSED

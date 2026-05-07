---
status: partial
phase: 02-provisioning
source: [02-VERIFICATION.md]
started: 2026-05-07T07:15:00Z
updated: 2026-05-07T07:15:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live test call — Retell agent answers within 3 rings

**Test:** Complete provisioning by calling `POST /api/provisioning/create` with a valid `RETELL_API_KEY` in environment, an existing contractor row in Supabase, and body `{ "area_code": "305" }`. Dial the returned `twilio_number` from a mobile phone.
expected: The call is answered by the Retell AI voice agent (not voicemail, not a busy signal) within 3 rings. The call does not route to the contractor's personal phone — it is handled by Retell's infrastructure.
result: [pending]

### 2. Agent greeting uses configured business name

**Test:** On the same call placed in test #1, listen to the agent's opening message.
expected: The greeting matches the contractor's `business_name` from `contractor_settings` — e.g., "Thank you for calling [business_name]." The service list (trade type and service area) should be available in the prompt.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

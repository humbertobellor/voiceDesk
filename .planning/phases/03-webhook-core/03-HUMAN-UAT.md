---
status: partial
phase: 03-webhook-core
source: [03-VERIFICATION.md]
started: 2026-05-08T07:30:00.000Z
updated: 2026-05-08T07:30:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. supabase db push — live DB migration
expected: `calls.analysis_status` and `notification_settings.notify_on_general_inquiry` columns exist in live Supabase database after running `supabase db push`
result: [pending]

### 2. EMRG-01 clarifying question — caller says "no"
expected: A caller who says "no" to "Is this happening right now?" is classified as `intent='lead'`, not `intent='emergency'`
result: [pending]

### 3. After-hours script branch on live call
expected: A test call made outside configured business hours produces a `calls` row with `is_after_hours=true` and uses the after-hours script branch
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

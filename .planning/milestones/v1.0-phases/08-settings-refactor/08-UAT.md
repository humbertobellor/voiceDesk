---
status: complete
phase: 08-settings-refactor
source: 08-01-SUMMARY.md, 08-02-SUMMARY.md, 08-03-SUMMARY.md
started: 2026-05-20T23:30:00Z
updated: 2026-05-20T23:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Dashboard loads without wizard modal or setup banner
expected: Log in and navigate to /dashboard. No onboarding wizard modal appears, no setup banner is shown. The dashboard is clean with just sidebar and content area.
result: pass

### 2. Settings sidebar has 6 sub-nav tabs
expected: In the sidebar, the Settings section expands to show 6 tabs: Agent Config · Calendar · Phone · Go Live · Account & Billing · Notifications.
result: pass

### 3. settings/calendar — connect/disconnect Google Calendar
expected: Navigate to /settings/calendar. The page shows Google Calendar connection status. If not connected, a "Connect Google Calendar" button is visible. If already connected, it shows "connected" state with option to reconnect.
result: pass

### 4. settings/phone — provisioned number and forwarding instructions
expected: Navigate to /settings/phone. The page shows your provisioned VoiceDesk number (or "Not yet provisioned" if no number assigned). Below it, carrier forwarding instructions are shown for AT&T, Verizon, T-Mobile, and Other with the correct codes.
result: pass

### 5. settings/go-live — test call detection flow
expected: Navigate to /settings/go-live. The page shows your VoiceDesk number and a button "I've Called — Detect Test Call". Clicking it starts detection. A "Cancel and try again" button is also visible. If already live, a green confirmation card is shown instead.
result: pass

### 6. /setup/phone still works for new signups
expected: Navigate to /setup/phone (the provisioning flow after Stripe checkout). The phone capture form still loads and works — it has NOT been affected by the settings refactor.
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]

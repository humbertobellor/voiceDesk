# Phase 4: Scheduling & Lead Capture - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 4-Scheduling & Lead Capture
**Areas discussed:** OAuth connection flow, Appointment slot strategy, Appointment details extraction, Calendar event creation & failure

---

## OAuth Connection Flow

### OAuth entry point

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal redirect page | /dashboard/connect-calendar with button + success/error state; Phase 6 replaces with full portal | ✓ |
| API routes only | Just initiate/callback routes, no UI at all | |
| Reuse Supabase auth flow | Extend existing auth callback to include Calendar OAuth | |

**User's choice:** Minimal redirect page

---

### OAuth state management

| Option | Description | Selected |
|--------|-------------|----------|
| State param + cookie | Short-lived state token in httpOnly cookie, verified on callback | ✓ |
| Supabase session cookie only | Read auth.uid() from server-side client on callback | |

**User's choice:** State param + cookie

---

### Post-OAuth redirect

| Option | Description | Selected |
|--------|-------------|----------|
| /dashboard | Existing dashboard shell with success banner via query param | ✓ |
| /dashboard/connect-calendar?success=true | Stay on connection page showing success state | |
| /dashboard/settings | Settings page (doesn't exist until Phase 6) | |

**User's choice:** /dashboard

---

### OAuth library

| Option | Description | Selected |
|--------|-------------|----------|
| googleapis OAuth2Client directly | google.auth.OAuth2 — already installed | ✓ |
| google-auth-library separately | Same underlying lib, slightly more explicit | |

**User's choice:** googleapis OAuth2Client directly

---

### Token refresh strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Refresh on use, update DB | Check expiry before every API call; re-encrypt and write new tokens | ✓ |
| Proactive Inngest cron | Hourly cron refreshes tokens expiring within 15 min | |
| Let googleapis auto-refresh | Built-in auto-refresh but doesn't update DB — tokens become stale | |

**User's choice:** Refresh on use, update DB

---

## Appointment Slot Strategy

### Appointment duration

| Option | Description | Selected |
|--------|-------------|----------|
| Configurable per contractor | appointment_duration_minutes INT in contractor_settings (default 120) | ✓ |
| Fixed at 2 hours | Hardcode 120 min — simpler, no new column | |
| Let agent decide | Agent negotiates duration with caller — flexible but breaks booking lock | |

**User's choice:** Configurable per contractor

---

### Slot injection strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-compute slots, inject into system prompt | Available slots for next 5 business days computed and listed in system prompt | ✓ |
| Rules only in system prompt | business_hours rules in prompt; agent reasons about slots itself | |
| Retell custom function call | Agent calls function during call (contradicts locked "no live Calendar mid-call" decision) | |

**User's choice:** Pre-compute slots, inject into system prompt

---

### System prompt refresh trigger

| Option | Description | Selected |
|--------|-------------|----------|
| After each new appointment is booked | Trigger retell-agent-sync Inngest event on appointment create/cancel | ✓ |
| Nightly Inngest cron | Rebuild system prompts for all contractors nightly at 2am | |
| Both: after booking + nightly | Near-real-time + safety net | |

**User's choice:** After each new appointment is booked

---

### Slot horizon

| Option | Description | Selected |
|--------|-------------|----------|
| 5 business days | ~10-15 slots for typical contractor; compact for system prompt | ✓ |
| 7 calendar days | Includes weekends if configured | |
| 14 days | Two weeks — useful for busy schedules | |

**User's choice:** 5 business days

---

### Booking conflict / overlap prevention

| Option | Description | Selected |
|--------|-------------|----------|
| Slot-boundary locking only | UNIQUE(contractor_id, starts_at) sufficient given pre-computed aligned slots | ✓ |
| tsrange EXCLUDE constraint | PostgreSQL range overlap constraint — more robust but more complex | |
| Application-level check | SELECT FOR UPDATE + app code — flexible but relies on correct app logic | |

**User's choice:** Slot-boundary locking only

---

### Race condition handling

| Option | Description | Selected |
|--------|-------------|----------|
| Book it anyway — contractor resolves | Create appointment with booking_conflict flag; contractor calls back second customer | ✓ |
| Offer next open slot post-call | Auto-reassign to next slot on UNIQUE violation | |
| Mark lead as unbooked, notify contractor | Don't create appointment; fire notification for manual callback | |

**Notes:** User acknowledged this relaxes SCHED-04's "second caller is offered the next open slot" to a contractor-callback resolution.

**User's choice:** Book it anyway — contractor resolves

---

## Appointment Details Extraction

### How to extract confirmed time and address

| Option | Description | Selected |
|--------|-------------|----------|
| Extend Phase 3 extraction schemas | Add confirmed_appointment_time + service_address to existing GPT-4o schemas | ✓ |
| Separate Phase 4 extraction pass | New Inngest step with dedicated GPT-4o call for appointment details | |
| Parse from transcript directly | Regex/string matching — brittle and error-prone | |

**User's choice:** Extend Phase 3 extraction schemas

---

### Lead creation timing and status

| Option | Description | Selected |
|--------|-------------|----------|
| Lead in call_analyzed handler, status 'booked' if appointment extracted | Single code path; status reflects booking immediately | ✓ |
| Lead created first, appointment updates it | Two writes; appointments and leads decoupled | |
| Lead only if no appointment | Skip leads for booked calls — contradicts Phase 3 D-14 | |

**User's choice:** Lead created in call_analyzed handler, status 'booked' if appointment extracted

---

## Calendar Event Creation & Failure

### When Calendar event is created

| Option | Description | Selected |
|--------|-------------|----------|
| From call_analyzed Inngest function, after appointment row inserted | Extends existing retell-call-classify function | ✓ |
| Separate calendar-event-create Inngest function | New function with own retry policy — more modular | |
| Synchronous in call_analyzed webhook handler | In critical path of 30s maxDuration limit | |

**User's choice:** From call_analyzed Inngest function, after appointment row inserted

---

### Source of truth + failure handling

| Option | Description | Selected |
|--------|-------------|----------|
| DB is source of truth; Calendar is best-effort | google_sync_status column; Inngest retries x5; 'failed' status if exhausted | ✓ |
| Roll back DB row if Calendar fails | Appointment never existed — loses caller booking | |
| Calendar is authoritative | Only create DB row after Calendar event created — fails when calendar not connected | |

**User's choice:** DB is source of truth; Calendar is best-effort

---

### No calendar connected

| Option | Description | Selected |
|--------|-------------|----------|
| Book in DB only, skip Calendar write | Create appointments + leads; google_sync_status = 'skipped' | ✓ |
| Reject the booking | Don't create appointment if no calendar | |
| Fail loudly — alert contractor | Create row + notify contractor to connect calendar | |

**User's choice:** Book in DB only, skip Calendar write

---

## Claude's Discretion

- OAuth route naming: `/api/auth/google/initiate` and `/api/auth/google/callback`
- State cookie name (`oauth_state`) and TTL (10 minutes)
- Slot list format in system prompt (researcher to verify best format against Retell prompt patterns from Phase 2)
- GPT-4o model for extraction (same as Phase 3)
- `booking_conflict` column type (BOOLEAN DEFAULT false)

## Deferred Ideas

- Appointment rescheduling API — Phase 6
- freebusy.query() for cross-checking Google Calendar events during slot computation — deferred, DB appointments table is source of truth for Phase 4
- Notification on new booking — Phase 5
- Proactive token refresh cron — rejected in favor of refresh-on-use; could revisit at scale

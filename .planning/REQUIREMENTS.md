# VoiceDesk — v1 Requirements

**Project:** VoiceDesk  
**Milestone:** v1.0 — Revenue-generating MVP  
**Target:** 90-day soft launch to 20–30 contractors  
**Last updated:** 2026-05-03 after roadmap creation

---

## v1 Requirements

### Call Handling

- [ ] **CALL-01**: AI answers every inbound call within 3 rings using Retell voice AI with no fallback to voicemail
- [ ] **CALL-02**: Agent classifies each call as lead, emergency, or general inquiry using keyword matching followed by LLM confirmation
- [ ] **CALL-03**: Agent asks trade-specific qualification questions (HVAC: system age, heating vs. cooling; Plumbing: active leak vs. repair; Electrical: safety vs. repair) before capturing contact details
- [ ] **CALL-04**: Agent uses a different script for after-hours calls (acknowledges off-hours, still captures lead and offers scheduling for next available slot)

### Scheduling

- [ ] **SCHED-01**: Agent books estimate appointments into the contractor's Google Calendar during the call, using contractor-configured availability windows to determine open slots
- [ ] **SCHED-02**: Contractor sets bookable time windows (days of week, start/end times) in the portal; agent uses these windows — not live Calendar API — to determine availability during calls
- [ ] **SCHED-03**: Agent verbally confirms appointment date, time, and address with the caller before ending the call
- [ ] **SCHED-04**: System prevents double-booking by checking existing Calendar events before creating a new appointment; if conflict detected, agent offers the next open slot

### Notifications

- [ ] **NOTIF-01**: System sends an SMS notification to the contractor within 60 seconds of every call end, including caller name, phone number, issue summary, and whether an appointment was booked
- [ ] **NOTIF-02**: System sends a WhatsApp notification for every new lead and emergency using pre-approved message templates; falls back to SMS automatically if WhatsApp delivery fails
- [ ] **NOTIF-03**: System sends a Telegram notification to the contractor's linked Telegram account for every new lead and emergency; contractor links Telegram account during onboarding via bot start link

### Emergency Escalation

- [ ] **EMRG-01**: System detects potential emergencies via keyword matching (gas smell, no heat, burst pipe, flooding, burning smell, CO alarm, no power, sparking) and asks the caller a clarifying question ("Is this happening right now?") before classifying as emergency
- [ ] **EMRG-02**: Gas smell and CO alarm triggers are hard-coded and non-configurable; they always escalate to emergency regardless of contractor's keyword settings
- [ ] **EMRG-03**: Emergency notifications reach the contractor via all configured channels (SMS, WhatsApp, Telegram) within 30 seconds of call end, with the word EMERGENCY prominently in the message and caller's callback number

### Admin Portal

- [ ] **PORTAL-01**: Contractor can view a paginated call log showing date, caller name, phone, call duration, intent classification, and AI-generated summary for every call
- [ ] **PORTAL-02**: Contractor can play back call recordings and read full transcripts from the call log; recordings are served via time-limited signed URLs (60-second TTL)
- [ ] **PORTAL-03**: Contractor can view a lead list with contact details, issue description, appointment status, and manually mark leads as Won, Lost, or Pending
- [ ] **PORTAL-04**: Contractor can configure the agent: business name, services offered, service area, emergency keywords, after-hours message, and agent voice selection
- [ ] **PORTAL-05**: Portal dashboard updates in real time when a new call comes in or completes, without requiring a page refresh

### Billing & Onboarding

- [ ] **BILL-01**: New contractors sign up via Stripe Checkout with a credit card and start a free trial (14 days) before being charged $299–$799/month based on selected plan
- [ ] **BILL-02**: Stripe Customer Portal is accessible from the contractor's account settings, allowing self-serve plan changes, payment method updates, and cancellation
- [ ] **BILL-03**: A failing payment deactivates the contractor's Retell agent within 72 hours of the final failed retry and sends a WhatsApp/SMS alert before deactivation
- [ ] **ONBOARD-01**: Guided onboarding wizard walks contractor through: agent configuration → Google Calendar connection → Twilio number provisioning → call forwarding instructions (with carrier-specific codes for AT&T, Verizon, T-Mobile)
- [ ] **ONBOARD-02**: Onboarding wizard does not advance to "go live" status until an inbound test call is detected and logged for the contractor's VoiceDesk number; portal polls and auto-advances on detection

---

## v2 Requirements (Deferred)

Features explicitly deferred to post-PMF validation:

- **ServiceTitan integration** — Complex field-management API; relevant only after 30%+ of customers request it
- **Housecall Pro integration** — Same rationale as ServiceTitan
- **Spanish language support** — High-priority v2; significant Retell prompt engineering and testing required
- **iOS/Android mobile app** — Web portal sufficient for v1; mobile is a retention feature not a launch requirement
- **Outbound call campaigns** — TCPA compliance complexity; not core to product identity
- **Advanced analytics dashboard** — Call volume trends, lead conversion rates, revenue attribution; nice-to-have after retention is proven
- **Multi-location contractor support** — Single phone number per account in v1; multi-number management deferred

---

## Out of Scope

Explicit exclusions — not deferred, not planned:

- **Custom voice cloning** — Retell stock voices sufficient; cloning adds cost and complexity without clear contractor demand
- **CRM functionality** — VoiceDesk is not a CRM; lead status tracking is a thin convenience layer only
- **AI price quoting** — Liability risk; contractors explicitly do not want AI quoting jobs
- **Live call transfer on emergency** — Mid-call transfer requires active call patching (different Twilio product), complex to implement reliably; real-time notification within 30s covers the safety need
- **Web chat widget** — Out of scope for v1; phone is the channel this product lives in
- **Multi-language support** — English-only for v1

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| CALL-01 | Phase 3 — Webhook Core | Pending |
| CALL-02 | Phase 3 — Webhook Core | Pending |
| CALL-03 | Phase 3 — Webhook Core | Pending |
| CALL-04 | Phase 3 — Webhook Core | Pending |
| SCHED-01 | Phase 4 — Scheduling & Lead Capture | Pending |
| SCHED-02 | Phase 4 — Scheduling & Lead Capture | Pending |
| SCHED-03 | Phase 4 — Scheduling & Lead Capture | Pending |
| SCHED-04 | Phase 4 — Scheduling & Lead Capture | Pending |
| NOTIF-01 | Phase 5 — Notifications | Pending |
| NOTIF-02 | Phase 5 — Notifications | Pending |
| NOTIF-03 | Phase 5 — Notifications | Pending |
| EMRG-01 | Phase 3 — Webhook Core | Pending |
| EMRG-02 | Phase 3 — Webhook Core | Pending |
| EMRG-03 | Phase 5 — Notifications | Pending |
| PORTAL-01 | Phase 6 — Portal UI | Pending |
| PORTAL-02 | Phase 6 — Portal UI | Pending |
| PORTAL-03 | Phase 6 — Portal UI | Pending |
| PORTAL-04 | Phase 6 — Portal UI | Pending |
| PORTAL-05 | Phase 6 — Portal UI | Pending |
| BILL-01 | Phase 7 — Billing & Onboarding | Pending |
| BILL-02 | Phase 7 — Billing & Onboarding | Pending |
| BILL-03 | Phase 7 — Billing & Onboarding | Pending |
| ONBOARD-01 | Phase 7 — Billing & Onboarding | Pending |
| ONBOARD-02 | Phase 7 — Billing & Onboarding | Pending |

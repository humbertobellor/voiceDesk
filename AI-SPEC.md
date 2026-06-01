# AI-SPEC: Koolable v1.2

**Project:** Koolable - AI Phone Receptionist for Field Service Contractors  
**Milestone:** v1.2 - In-App Notifications & Brand Consistency  
**Date:** 2026-06-01

---

## 1. System Overview

### 1a. System Type & Core Function

**System Type:** Hybrid (Conversational Voice AI + Autonomous Classification + Appointment Scheduling Agent)

**Core Function:** Koolable answers missed calls to field service contractors (HVAC, plumbing, electrical) with a voice AI receptionist that:
1. Qualifies the caller's issue (routine maintenance vs. emergency)
2. Captures lead information (name, phone, address, service type)
3. Books appointments into the contractor's Google Calendar (if requested)
4. Routes emergencies (gas smell, CO alarm) to human dispatch via SMS/WhatsApp/Telegram within 30 seconds
5. Logs all interactions for contractor review and lead follow-up

**Business Model:** SaaS subscription, $X/month, charged on Stripe. Contractors receive the service as a 24/7 answering service replacement.

---

## 1b. Domain Context

**Industry Vertical:** Residential Field Services (HVAC, Plumbing, Electrical) - South Florida market focus

**User Population:** 
- Primary: Owner/dispatch manager of small- to mid-size trade contracting businesses (1–20 employees)
- Secondary: Office staff responsible for call intake and appointment scheduling
- Tertiary: Field technicians who receive routed emergency alerts

**Stakes Level:** CRITICAL

**Output Consequence:** Every AI decision directly triggers downstream action:
- Misclassified routine call → lost lead (economic loss)
- Misclassified emergency (gas/CO) → delayed emergency response (safety risk, liability)
- Scheduling error (double-booking or wrong slot) → customer frustration, contractor reputation damage
- Emergency delay (>30 seconds) → potential injury or property damage escalation

---

### What Domain Experts Evaluate Against

Domain experts in field service dispatch, emergency response, and lead operations assess Koolable against five core dimensions:

#### Dimension 1: Emergency Classification Accuracy
**Good (domain expert would accept):**
- Gas smell or CO alarm keywords trigger emergency classification consistently, with zero false negatives
- Unclear emergency cases (e.g., "It's freezing in my house") are handled via clarifying question: "Is this happening right now?" and only classified as emergency if caller confirms present-tense urgency
- Historical test: 100% of intentional gas/CO triggers classify as emergency; 95%+ of routine calls stay routine even if they contain casual language like "this is urgent to me"

**Bad (domain expert would flag):**
- Gas smell mentioned but classified as routine maintenance (false negative = safety hazard)
- Vague urgency language ("I need service ASAP") triggers emergency without clarification (false positive = dispatch team burnout on non-emergency "emergencies")
- After-hours calls flagged as emergency when contractor has no after-hours response capacity (wasted alert capacity)

**Stakes:** CRITICAL  
**Source:** HVAC/plumbing field practices; Koolable design (D-01: hard-coded gas/CO triggers; E-02: clarification gate)

---

#### Dimension 2: Lead Data Completeness & Accuracy
**Good (domain expert would accept):**
- Every lead record includes: caller name, phone number, service address, issue description, appointment status
- Phone numbers are validated (E.164 format, real-time check for North American area codes during South Florida market phase)
- Service descriptions map to contractor's configured service categories (air conditioning, plumbing, electrical) with ≥85% accuracy
- Address is parseable as a real location (city/ZIP validation) for dispatch routing

**Bad (domain expert would flag):**
- Missing caller phone number (cannot call back, lead is worthless)
- "Unknown caller" or invalid phone (repeated >10% of leads, suggests AI cannot extract basic info from callers)
- Service description vague ("something is wrong") with no category mapping (dispatch must call back to clarify, defeats purpose)
- Duplicate leads from same caller within same day (suggests no deduplication logic, leads table bloat)

**Stakes:** HIGH  
**Source:** Field operations best practice; lead quality metrics in home services industry (lead-to-booking conversion depends on data completeness)

---

#### Dimension 3: Appointment Booking Reliability
**Good (domain expert would accept):**
- Contractor-provided availability windows (e.g., "Mon–Fri 8am–5pm, Sat 8am–12pm") are respected: no bookings outside these windows
- Double-booking prevention works: two simultaneous calls cannot both book the same time slot
- Appointment details match what caller heard: if AI said "Tuesday 2 PM," that's what appears in Google Calendar
- Timezone handling is correct for South Florida (Eastern Time, DST transitions respected)
- Cancellation/rescheduling in Calendar is reflected in Koolable records within 5 minutes

**Bad (domain expert would flag):**
- Appointments booked outside contractor's working hours
- Duplicate appointments in Calendar for same caller/slot (race condition on busy days)
- Caller confirmation during call doesn't match Calendar event details
- Timezone drift after DST transition causes scheduling chaos (e.g., 2 PM EST becomes 1 PM EDT in Calendar)
- Lead record shows "appointment booked" but Calendar is empty (system desync)

**Stakes:** HIGH  
**Source:** Appointment scheduling failure modes (lead qualification, calendar integration issues); Koolable architecture (D-10: UNIQUE constraint on leads table)

---

#### Dimension 4: Notification Delivery Speed & Reliability
**Good (domain expert would accept):**
- Emergency notifications (gas/CO) arrive within 30 seconds of call end via SMS, with WhatsApp fallback if SMS unavailable
- Lead notifications arrive within 60 seconds via contractor's preferred channel (SMS default, WhatsApp, Telegram, email)
- Notification includes: caller name, phone number, issue summary, appointment status (booked/not booked)
- "Delivery failure" is visible in contractor's account → retried automatically by system within 15 minutes
- Contractor can configure which notification channels are active (SMS always on, WhatsApp/Telegram opt-in per their settings)

**Bad (domain expert would flag):**
- Emergency alert arrives 90+ seconds after call ends (field tech may have already left, safety window closed)
- SMS or WhatsApp fails silently — contractor doesn't realize they missed a call
- Notification spam: same caller's leads arrive as 3+ separate notifications (should deduplicate by caller + time window)
- Notification contains missing or incorrect caller info (contractor can't call back or misroutes the dispatch)
- "Notifications enabled" is turned on but never fires (trust destruction)

**Stakes:** CRITICAL  
**Source:** Field operations — missed notifications = missed revenue + safety risk

---

#### Dimension 5: Language & Terminology Handling
**Good (domain expert would accept):**
- AI understands contractor jargon: "AC unit won't kick on," "furnace is throwing an error," "main line is backing up"
- Regional variations recognized: "A/C" vs. "air conditioning," "water heater" vs. "hot water tank"
- Caller speech variations handled: accents, background noise, speaking quickly, interruptions don't derail the conversation
- Spanish speakers reach AI agent configured for Spanish; Haitian Creole speakers (South Florida market) are supported (or explicitly escalated if not yet live)
- Extracted service type matches contractor's service catalog (e.g., caller says "my pipes are frozen" → maps to "plumbing emergency," not "general inquiry")

**Bad (domain expert would flag):**
- AI misinterprets "broken AC" as a completely different service type
- Dialect/accent causes garbling in transcription ("A/C" becomes "AC/DC," phonetic mismatches)
- Non-English callers are routed to English-only agent (frustration, lead lost)
- Extraction returns generic "other" category for 30%+ of calls (useless for dispatch routing)

**Stakes:** HIGH  
**Source:** Contractor market diversity; Koolable design (LANG-01, LANG-02: multi-language support)

---

### Known Failure Modes in This Domain

1. **Emergency Over-Triggering:** Vague urgency language ("This needs to be fixed today") in routine calls triggers emergency classification without clarification, exhausting dispatch attention and desensitizing teams to actual emergencies.

2. **Silent Notification Failures:** SMS or WhatsApp delivery fails due to network issues or carrier filtering, but contractor is unaware because the system shows "sent" without confirmation. By the time contractor notices, the lead is 2+ hours old and converted by a competitor.

3. **Duplicate & Stale Leads:** Same caller phones back 5 minutes later because they didn't hear the appointment confirmation in the AI call. System records two separate leads with conflicting appointment data, confusing dispatch and causing double scheduling.

4. **Timezone Mismatches on Calendar:** Contractor in Eastern Time configures availability as "8 AM–5 PM." AI books a call at "2 PM ET" correctly, but Google Calendar API returns UTC times. DST transitions or timezone translation bugs cause Calendar to show wrong times, leading to no-shows.

5. **Service Category Ambiguity:** Caller reports "my heater isn't working." AI extracts "heating system repair" but contractor is a plumber, not HVAC. Lead is routed to wrong dispatch queue and is either ignored or causes customer confusion about service scope.

---

### Regulatory / Compliance Context

**Directly Applicable:**
- **Telemarketing Compliance (TCPA, USA):** Koolable receives **inbound** calls only (not outbound), so TCPA rules are minimal. However, WhatsApp and SMS follow-up notifications must honor opt-out requests.
- **Emergency Response Duty (varies by state):** When AI classifies a call as emergency (gas smell, CO alarm), there is implicit duty to ensure human dispatch responds within SLA. Missed emergency alerts create liability exposure.
- **Consumer Recording Consent (state-specific):** Call recordings stored in Supabase must comply with two-party consent states (CA, PA, IL, NY, etc.). South Florida (FL) is one-party consent, so recording is legal, but contractors must be aware when operating across state lines.
- **Accessibility (ADA):** AI must not discriminate against callers with hearing, speech, or cognitive disabilities. Timeouts, rapid-fire questions, or unclear confirmation can violate ADA expectations for accessible service.

**Not Directly Applicable (out-of-scope for v1.x):**
- HIPAA (not healthcare)
- GDPR (not serving EU customers in v1.1)
- PCI-DSS (contractor payment method stored with Stripe, not in Koolable)

**Recommended Action:** Before public beta, document recording consent disclosure and obtain contractor sign-off that they will inform callers of recording (or use an automated "calls may be recorded" message).

---

### Domain Expert Roles for Evaluation

| Role | Responsibility in Eval |
|------|----------------------|
| **Field Service Ops Manager** | Lead dataset labeling (50–100 real calls), rubric calibration for lead quality, emergency classification edge cases, priority signals for prod sampling |
| **Dispatch Coordinator / Tech Scheduler** | Appointment booking accuracy validation, notification SLA testing, calendar integration verification, duplicate lead detection rules |
| **Contractor/Business Owner** | Subjective quality assessment (ease of use, trust in AI routing), feedback on language/terminology mismatches, emergency response SLA acceptance |
| **Compliance / Legal** | Recording consent procedures, telemarketing opt-out enforcement, state-specific liability exposure |
| **Data Engineer (Koolable)** | Metrics instrumentation, reference dataset versioning, production sampling strategy, alert calibration for guardrails |

---

### Research Sources

- [How an AI Answering Service Can Transform Your HVAC Business in 2025](https://www.myaifrontdesk.com/blogs/how-an-ai-answering-service-can-transform-your-hvac-business-in-2025-0d13b)
- [Best Voice AI Solutions for Home Service Contractors in 2026 | Retell AI](https://www.retellai.com/blog/best-voice-ai-solutions-for-home-service-contractors)
- [Voice AI Evaluation: How to Test Voice Agents Before Production (2026)](https://futureagi.com/blogs/voice-ai-evaluation-infrastructure-developers-guide)
- [Voice AI Checklist: How to Evaluate Vendors Beyond Flashy Demos](https://quiq.com/blog/voice-ai-checklist-to-evaluate-vendors/)
- [AI Appointment Setter: Scalable Lead Qualification & Setting](https://synthflow.ai/ai-appointment-setter/)
- [AI Lead Qualification for Home Services | Hexnut](https://hexnut.ai/features/lead-qualification)
- [Lead Qualification for HVAC Using AI Phone Calls](https://convin.ai/blog/lead-qualification-hvac)
- [How to Reduce False Alarms in Gas Alarm Systems: AI-Driven Solutions Explained](https://www.geweedetector.com/how-to-reduce-false-alarms-in-gas-alarm-systems-ai-driven-solutions-explained/)
- [False Alarm Filtering: Everything You Need to Know in 2026](https://www.pelco.com/blog/false-alarm-filtering)
- [Voice Agent Evaluation Metrics: Definitions, Formulas & Benchmarks | Hamming AI Resources](https://hamming.ai/resources/voice-agent-evaluation-metrics-guide/)
- [Top 6 AI Call Metrics for Customer Service AI Voice Agents | Retell AI](https://www.retellai.com/blog/top-6-ai-voice-agent-customer-service-metrics)

---

## Next Steps

- **Section 1c (Evaluation Strategy):** Define code-based metrics, LLM judge rubrics, and human review sampling for each dimension above.
- **Section 2 (Reference Dataset):** Build initial 15–20 real calls covering: routine leads, emergencies, edge cases (unclear urgency, multiple issues), timezone boundary conditions.
- **Section 3 (Production Guardrails):** Online guardrails for emergency classification (100% hard-code check for gas/CO), notification delivery timeout alerts, duplicate lead detection.
- **Section 4 (Monitoring):** Offline flywheel sampling weighted toward failed emergency detections, notification delays >30s, appointment conflicts.


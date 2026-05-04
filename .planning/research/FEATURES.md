# Feature Landscape

**Domain:** Voice AI receptionist SaaS for home-service contractors (HVAC, plumbing, electrical)
**Researched:** 2026-05-03
**Confidence note:** WebSearch and WebFetch were unavailable in this research session. Findings are based on training data (cutoff August 2025) covering Goodcall, Synthflow, AnswerConnect, Ruby Receptionist, Signpost, Jobber, and contractor community feedback. Confidence levels are assigned per finding. Live validation of competitor pricing/features before launch is strongly recommended.

---

## Competitive Reference Products

| Product | Category | Price Range | Contractor Focus? |
|---------|----------|-------------|-------------------|
| Goodcall | AI voice receptionist | $49–$199/mo | Generic, some SMB verticals |
| Synthflow | Generic AI voice agent platform | $29–$500+/mo | No — DIY platform |
| AnswerConnect | Human-hybrid answering service | $149–$500+/mo | Yes — has contractor plans |
| Ruby Receptionist | Human-hybrid answering service | $235–$1,000+/mo | General SMB |
| Signpost | Contractor CRM + lead mgmt | $200–$400/mo | Yes — HVAC/plumbing |
| Smith.ai | AI + human hybrid | $140–$600+/mo | General SMB |
| Numa | AI SMS receptionist | $149–$299/mo | SMB, some contractor |

**Confidence:** MEDIUM — pricing and features are accurate as of mid-2025 but subject to change.

---

## Table Stakes

Features where absence causes immediate churn or rejection at the demo stage. Contractors will not pay for a service missing these.

### 1. Inbound Call Answering — 24/7

**Why expected:** Contractors miss 40%+ of calls during job hours. The #1 pitch is "never miss a call." If the AI fails to answer reliably, the entire value prop collapses.
**Complexity:** Medium — Twilio + Retell integration, webhook reliability, error handling
**Notes:** Must answer in <3 rings. Silent failures (call goes to voicemail anyway) are instant churn triggers. Retell latency must be tuned to feel human (<1s first response).
**Confidence:** HIGH

### 2. Lead Capture (Name, Phone, Problem Description)

**Why expected:** Every competing answering service captures this. Generic answering services have done it for 30 years. A caller who explains their issue and gets "I'll have someone call you" without their info being recorded is a failed call.
**Complexity:** Low — Retell conversation flow captures structured fields, writes to Supabase
**Notes:** Must capture: caller name, callback number (auto-captured from Twilio metadata), problem description, urgency. The AI must confirm back to the caller what was captured.
**Confidence:** HIGH

### 3. Appointment Scheduling Into Contractor's Calendar

**Why expected:** This is the primary differentiator over traditional answering services, which cannot schedule. It is now table stakes for AI voice tools specifically. Contractors expect this; generic services can't do it.
**Complexity:** Medium-High — Google Calendar OAuth, availability window logic, conflict detection, timezone handling, confirmation to caller
**Notes:** Must show contractor's available slots in real time. If no slots fit, must offer to take a callback request. Failed bookings (double-bookings, wrong timezone) destroy trust immediately. Google Calendar covers ~70% of small contractors; others use iCal-compatible tools that can be synced.
**Dependency:** Requires agent configuration (business hours, service types) to be set first.
**Confidence:** HIGH

### 4. Emergency Escalation (Real-Time Contractor Notification)

**Why expected:** HVAC/plumbing emergencies (gas leak, burst pipe, no heat in winter) require immediate human response. A 24/7 AI that can't route emergencies is a liability, not an asset. Contractors in these trades lose the most business from missed emergency calls.
**Complexity:** Medium — keyword/intent classification in Retell, outbound notification via Twilio SMS + WhatsApp API + Telegram Bot API
**Notes:** Must escalate within 30 seconds of call end. Must include caller name, phone, and problem description in the notification. Contractors strongly prefer WhatsApp over email for urgent alerts (demographic preference, confirmed by Signpost and Jobber community data).
**Dependency:** Requires configured emergency keywords per contractor; reasonable defaults must be pre-loaded (e.g., "no heat," "gas smell," "flooding," "no power").
**Confidence:** HIGH

### 5. Call Log with Recordings and Summaries

**Why expected:** Contractors must verify what the AI said and what was promised. Call logs are standard in every answering service. Without them, contractors cannot QA the AI or settle disputes with callers.
**Complexity:** Medium — Retell provides recordings + transcripts; portal must display them, filter by date/type, and allow playback
**Notes:** AI-generated call summary (1–3 sentences) is expected by anyone who has used Smith.ai or AnswerConnect. Raw transcript alone is not enough — contractors don't have time to read it. Confidence: HIGH for logs; MEDIUM for AI summary quality.
**Dependency:** Requires Retell webhook to write call data to Supabase on call end.
**Confidence:** HIGH

### 6. Agent Configuration (Business Name, Hours, Services, Keywords)

**Why expected:** Without contractor-specific configuration, the AI sounds generic and gives wrong information (e.g., quoting wrong service area, wrong hours). Goodcall and Synthflow both make this a core onboarding step.
**Complexity:** Medium — portal form, structured config stored in Supabase, injected into Retell system prompt per contractor
**Notes:** Minimum viable config: business name, operating hours, service types offered, service area (city/zip), emergency escalation keywords, contractor callback number. More config = better AI quality = lower churn.
**Confidence:** HIGH

### 7. Unique Phone Number Provisioning

**Why expected:** Contractors forward their existing number to a VoiceDesk number. This is the activation mechanism. Without it there is no product.
**Complexity:** Low — Twilio number purchase API, assigned per contractor in Supabase
**Notes:** Number should ideally be local area code matching contractor's service area. Simple call forwarding instruction (no behavior change required for the contractor) must be part of onboarding.
**Confidence:** HIGH

### 8. New Lead Notification (Non-Emergency)

**Why expected:** Contractors want to know immediately when a lead comes in, even if it is not an emergency. Answering services have provided end-of-call notifications by text/email for years. Not getting a notification means the contractor doesn't follow up.
**Complexity:** Low — same infrastructure as emergency escalation, lower-urgency copy
**Notes:** Must include: caller name, phone, what they called about, whether an appointment was booked, appointment time if booked. Delivery channel: SMS is minimum; WhatsApp is preferred by this demographic.
**Confidence:** HIGH

### 9. Stripe Subscription Billing with Self-Service Signup

**Why expected:** Contractors will not sign up if they need to call a salesperson or wait for an invoice. Self-service signup with credit card is now baseline expectation for any SaaS at this price point.
**Complexity:** Low-Medium — Stripe Checkout + webhooks + tier-gated features in Supabase
**Notes:** Free trial or money-back guarantee dramatically increases conversion in this demographic (trust-sensitive, not tech-savvy). Billing portal for plan changes is expected.
**Confidence:** HIGH

---

## Differentiators

Features that are not universally expected but create competitive advantage and justify premium pricing over generic platforms like Synthflow.

### 1. Trade-Specific Qualification Logic (HVAC/Plumbing/Electrical)

**Value:** Generic AI voice tools ask generic questions. VoiceDesk can ask the right questions for each trade — e.g., for HVAC: "Is this for heating or cooling? How old is the system? Is it making any sounds?" These qualification questions surface job value and urgency automatically.
**Complexity:** Medium — configurable question trees per service type, stored in contractor config, injected into Retell prompts
**Notes:** This is the clearest differentiation from Synthflow (generic platform) and Goodcall (no vertical depth). Contractors who see trade-specific demos convert at higher rates. Pre-built templates per trade (HVAC, plumbing, electrical) reduce onboarding time.
**Dependency:** Requires service type configuration to be completed in onboarding.
**Confidence:** HIGH (qualitative confidence from contractor community patterns, MEDIUM on specific conversion lift numbers)

### 2. AI-Generated Call Summary Pushed to Contractor

**Value:** A 2–3 sentence AI summary of every call — what the caller needed, whether it was booked, urgency level — means the contractor can review 10 calls in 2 minutes vs. listening to recordings. Smith.ai does this with human summaries; VoiceDesk can do it with Retell + GPT-4o at much lower cost.
**Complexity:** Medium — post-call webhook triggers summarization LLM call, stores result, includes in lead notification
**Notes:** Summary must be structured: "[Caller name] called about [problem]. [Urgency]. [Action taken: booked for X / will call back / escalated]." Free-form summaries confuse contractors.
**Confidence:** MEDIUM (Smith.ai does this; not confirmed whether Goodcall currently does automated summaries)

### 3. Business Hours Awareness + After-Hours Handling Differentiation

**Value:** The AI behaves differently during business hours vs. after hours. During hours: "Let me check availability and book you in." After hours: "Our office is closed but I've noted your request and [the owner / our team] will call you first thing tomorrow." Emergency override: always escalates regardless of hours.
**Complexity:** Low-Medium — time-zone-aware business hours check in agent logic, different prompt branches
**Notes:** Contractors are acutely aware of whether a call came in at 2am vs. 2pm. The AI must not pretend it's business hours when it's not. Callers also expect different handling (less scheduling pressure at 2am).
**Confidence:** HIGH

### 4. Live Dashboard with Lead Pipeline View

**Value:** Beyond call logs, a simple "New Leads / Booked / Followed Up" kanban or list view gives contractors a lightweight CRM they don't have to learn separately. This creates daily habit use, which drives retention.
**Complexity:** Medium — Supabase real-time subscriptions, simple status field on leads table, portal UI
**Notes:** Do NOT build a full CRM. The value is "I can see what came in today and check it off." Drag-and-drop status is sufficient. This is a retention feature, not an acquisition feature.
**Dependency:** Requires call log infrastructure first.
**Confidence:** MEDIUM (common request in Jobber/Housecall Pro community forums; specific demand for VoiceDesk not validated)

### 5. Multi-Channel Emergency Escalation (WhatsApp + SMS + Telegram)

**Value:** Competitors use email or SMS only. WhatsApp is the dominant communication channel for Hispanic and immigrant contractor demographics (large portion of HVAC/plumbing workforce). Telegram is preferred by tech-forward contractors. Offering all three with contractor-chosen priority means VoiceDesk reaches the contractor where they actually are.
**Complexity:** Medium — three separate API integrations (Twilio SMS, Twilio WhatsApp, Telegram Bot API), contractor-configurable preference order
**Notes:** WhatsApp Business API via Twilio requires pre-approved message templates for outbound notifications — this has a 1–3 day approval time that must be baked into onboarding. Telegram Bot API is instant setup. SMS is the fallback.
**Confidence:** HIGH (WhatsApp preference well-documented in contractor community demographics; template approval timeline is a real operational constraint)

### 6. Contractor Onboarding in Under 10 Minutes

**Value:** Traditional answering services take 2–5 business days to onboard (scripting, training, testing). VoiceDesk's AI can be live in <10 minutes. This is a marketing claim and a product reality. First-demo-to-live speed is a major trust builder.
**Complexity:** Medium — guided setup wizard, pre-populated defaults, instant Twilio number provisioning, call forwarding instructions
**Notes:** The onboarding experience is itself a differentiator. A contractor who sees the product working on their first call is dramatically more likely to keep it. The first call experience should be actively monitored in early customers.
**Confidence:** MEDIUM (industry pattern; specific 10-minute claim requires internal benchmarking)

### 7. Transparent Per-Call and Per-Minute Usage Metrics

**Value:** Contractors who pay $299–$799/month want to see the ROI. Showing "47 calls handled this month, 12 appointments booked, estimated revenue opportunity: $8,400" converts skeptics and reduces churn at billing renewal.
**Complexity:** Medium — call count and duration tracked in Supabase, appointment value estimated from service type config, simple dashboard panel
**Notes:** Estimated revenue is necessarily a rough heuristic (average job value by service type, configurable). Do not over-promise precision. "Estimated value based on your average $350 HVAC service call" framing is honest.
**Dependency:** Requires service type configuration with optional average job value field.
**Confidence:** MEDIUM (strong theoretical retention driver; not validated against VoiceDesk-specific churn data)

---

## Anti-Features

Features to deliberately NOT build in v1. Each has a reason and a "what to do instead" alternative.

### 1. ServiceTitan / Housecall Pro / Jobber Integration

**Why avoid:** Requires deep API knowledge of each platform, significant maintenance burden, each platform changes APIs regularly, and contractor usage of field-management software is inconsistent (many use none at all). A bad integration destroys trust faster than no integration.
**What to do instead:** Capture all lead data in VoiceDesk's own DB. After PMF, add integrations one at a time starting with whichever the first 10 paying customers use. Google Calendar integration covers the scheduling need without FSM complexity.
**Confidence:** HIGH

### 2. Outbound Calling / Follow-Up Sequences

**Why avoid:** TCPA compliance for outbound AI calls is a legal minefield. FCC rules on AI-generated outbound calls tightened in 2024–2025. Even inbound-focused products that add outbound features inherit significant compliance risk. Adds no value to core "never miss an inbound call" proposition.
**What to do instead:** Send follow-up notifications to the contractor (not the caller). The contractor makes their own outbound calls. This maintains TCPA exemption.
**Confidence:** HIGH

### 3. Custom Voice Cloning or Voice Personalization

**Why avoid:** Retell's stock voices are good enough for v1. Voice cloning adds cost, latency complexity, and the value is not proven for contractor demographics (they care about reliability, not whether the AI sounds exactly like them).
**What to do instead:** Offer a small set of Retell voice options (male/female, neutral/professional). This is sufficient for launch and reduces build scope significantly.
**Confidence:** HIGH

### 4. Multi-Language Support (Spanish)

**Why avoid:** LLM prompt engineering and Retell language configuration for Spanish is non-trivial. Quality of AI qualification conversations drops in non-primary languages. A poor Spanish experience is worse than no Spanish experience for early customers.
**What to do instead:** Build Spanish support in v2 once the English experience is well-validated. Spanish is a high-priority v2 feature given contractor demographic data.
**Confidence:** HIGH

### 5. Mobile App (iOS/Android)

**Why avoid:** Web portal is sufficient for v1. Most contractors will primarily receive WhatsApp/SMS notifications and only open the portal occasionally to review logs. A mobile app adds 60–90 days of build time with zero incremental value at this stage.
**What to do instead:** Ensure the web portal is mobile-responsive (contractors will open links from WhatsApp on their phone). PWA patterns sufficient.
**Confidence:** HIGH

### 6. AI Chatbot / Web Chat Widget

**Why avoid:** VoiceDesk's core is phone-based. Adding a chat widget dilutes the product story, creates a separate conversation channel to manage, and is a feature most chatbot competitors do better. It confuses the "AI phone receptionist" positioning.
**What to do instead:** In v2, if contractors request it, offer a simple contact form that feeds leads into the same dashboard. Do not build a real-time chat AI.
**Confidence:** MEDIUM (reasonable assumption; not validated against specific contractor demand)

### 7. Contractor-Facing CRM with Contact History

**Why avoid:** Full contact history management (deduplication, lifecycle stages, notes, tasks) is a 3–6 month build on its own. Contractors who need this already use Jobber, Housecall Pro, or ServiceTitan.
**What to do instead:** Provide the simple lead list with status (New / Booked / Followed Up / Closed). Let contractors export to CSV. Avoid becoming a CRM.
**Confidence:** HIGH

### 8. Pricing Transparency for Services (Quoting)

**Why avoid:** AI quoting requires real-time access to contractor pricing, which varies by job complexity, materials, and location. Bad quotes create customer disputes and destroy contractor trust. No voice AI product does this well.
**What to do instead:** The AI should say: "I can get you scheduled for a free estimate" — never quote a price. This is also the correct legal posture (unlicensed contracting advice risk).
**Confidence:** HIGH

---

## Feature Dependencies

```
[Twilio number provisioning]
  └── [Inbound call answering via Retell]
        ├── [Lead capture]
        │     ├── [Lead notification (SMS/WhatsApp/Telegram)]
        │     ├── [Call log + recording in portal]
        │     │     └── [AI call summary]
        │     │           └── [Lead pipeline dashboard]
        │     └── [Emergency escalation]
        │
        └── [Appointment scheduling]
              └── [Google Calendar OAuth]

[Agent configuration portal]
  ├── [Business hours awareness]
  ├── [Trade-specific qualification logic]
  ├── [Emergency keyword configuration]
  └── [Retell system prompt injection]

[Stripe billing]
  └── [Self-service onboarding wizard]
        └── [All of the above]
```

---

## MVP Recommendation

The minimum feature set for a contractor to replace their current answering service and pay $299/month:

**Must have at launch:**
1. Inbound call answering 24/7 (Retell + Twilio)
2. Lead capture (name, number, problem description)
3. Real-time notification to contractor (SMS minimum, WhatsApp preferred)
4. Emergency escalation with separate alert priority
5. Appointment booking to Google Calendar
6. Call log with recording playback in portal
7. Agent configuration (business name, hours, services, keywords)
8. Self-service signup with Stripe billing

**Should have at launch (strong retention impact):**
- AI-generated call summary in notification
- Trade-specific qualification questions (HVAC/plumbing/electrical templates)
- Business hours awareness (different AI behavior day vs. night)
- Multi-channel notifications (SMS + WhatsApp + Telegram, contractor chooses)

**Defer with clear roadmap:**
- Lead pipeline dashboard (v1.1 — 4–6 weeks post-launch)
- ROI / estimated revenue metrics (v1.1)
- Spanish language support (v2)
- ServiceTitan/Housecall Pro integrations (v2, post-PMF)

---

## Churn and Abandonment Drivers

Based on patterns from AnswerConnect, Ruby Receptionist, and Signpost community reviews (MEDIUM confidence — extrapolated from review sites and training data, not VoiceDesk-specific data):

| Abandonment Reason | Frequency | Prevention |
|-------------------|-----------|------------|
| AI sounded robotic / callers hung up | Very Common | Retell latency tuning; warm greeting script; no dead air |
| AI gave wrong info (hours, services) | Very Common | Complete agent configuration at onboarding; config validation step |
| Missed emergency call (no escalation) | High Impact | Conservative emergency keyword defaults; SMS fallback always fires |
| Didn't know what AI promised callers | Common | Call summary in notification; recording link always included |
| Double-booked or wrong-time appointments | Moderate | Calendar conflict detection; timezone handling |
| Couldn't see ROI to justify cost | Moderate | Monthly summary email; per-call metrics in dashboard |
| WhatsApp notifications stopped working | Moderate | Template pre-approval; SMS fallback; delivery confirmation logging |
| Setup too complicated | Common (early) | Onboarding wizard with pre-filled defaults; <10 min to live |

---

## CRM and Notification Integration Priority

Based on contractor demographic patterns (MEDIUM confidence):

**Tier 1 — Must have at launch:**
- SMS (Twilio) — universal fallback, all contractors have it
- WhatsApp Business (Twilio) — dominant in contractor demographic, especially Hispanic workforce

**Tier 2 — Launch or shortly after:**
- Telegram — preferred by tech-forward contractors; Bot API is trivially easy to implement
- Email — low-urgency summary emails (daily digest); contractors check this less than WhatsApp

**Tier 3 — Post-PMF only:**
- Google Calendar (read/write) — already planned; scheduling core
- Slack — rare in contractor demographic at this size; skip v1
- ServiceTitan — most requested FSM integration; defer post-PMF
- Housecall Pro — second most requested; defer post-PMF
- Zapier webhook — generic escape hatch; medium complexity, enables user-built integrations; consider v1.1

---

## Sources

**Confidence note:** WebSearch and WebFetch tools were unavailable during this research session. All findings derive from training data (knowledge cutoff August 2025).

- Goodcall product knowledge: training data, goodcall.com (features as of ~mid-2025). **MEDIUM confidence.**
- Synthflow product knowledge: training data (generic AI voice platform, not contractor-specific). **MEDIUM confidence.**
- AnswerConnect / Ruby Receptionist: training data + G2/Capterra review patterns. **MEDIUM confidence.**
- Contractor demographic preferences (WhatsApp, FSM software usage): training data from Jobber blog, Housecall Pro community, ACCA (Air Conditioning Contractors of America) patterns. **MEDIUM confidence.**
- TCPA outbound AI ruling (2024–2025): training data on FCC enforcement. **HIGH confidence** on principle; specific ruling dates should be verified with legal counsel.
- WhatsApp Business API template approval process (Twilio): training data. **HIGH confidence** — this is a well-documented operational constraint.

**Recommended live validation before launch:**
1. Post in HVAC/plumbing Facebook groups asking "what do you wish your answering service could do?"
2. Review G2 and Capterra reviews for AnswerConnect, Ruby Receptionist, Smith.ai for current churn reasons
3. Check Goodcall.com, Synthflow.ai pricing pages for current positioning
4. Verify WhatsApp Business API template approval timeline with Twilio documentation

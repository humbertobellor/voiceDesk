# VoiceDesk

## What This Is

VoiceDesk is a 24/7 AI phone receptionist for independent and small-fleet home-service contractors (HVAC, plumbing, electrical). It answers missed calls in real time, qualifies leads, books estimate slots into Google Calendar, and escalates genuine emergencies via WhatsApp/Telegram/SMS. Contractors forward their existing phone number — no behavior change required.

## Core Value

Every missed call is lost revenue — VoiceDesk ensures contractors never lose a booked job to voicemail again.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] AI voice agent answers inbound calls using Retell in English, Spanish, or Haitian Creole (caller's language detected or prompted at call start)
- [ ] Intent classification: lead qualification, estimate scheduling, or emergency escalation
- [ ] Book estimate appointments into Google Calendar via OAuth
- [ ] Emergency dispatch: SMS, WhatsApp, and Telegram alerts to contractor for high-urgency calls
- [ ] Twilio phone number provisioning — contractor forwards existing number to VoiceDesk number
- [ ] Contractor admin portal: view call logs, lead details, recordings, and agent configuration
- [ ] Agent configuration in portal: business name, hours, services offered, emergency keywords
- [ ] Real-time notifications to contractor via WhatsApp, Telegram, and SMS for every new lead
- [ ] Stripe subscription billing ($299–$799/month tiers)
- [ ] Onboarding flow: sign up → configure agent → get phone number → go live

### Out of Scope

- ServiceTitan / Housecall Pro / field-management integrations — complexity too high for v1; add after PMF validation
- Outbound calling — TCPA risk, not core to the product
- Additional languages beyond English/Spanish/Haitian Creole — Portuguese, French, etc. are post-PMF
- iOS/Android mobile app — web portal sufficient for v1
- Custom voice cloning — Retell stock voices cover v1
- Automated follow-up sequences — out of scope; inbound-only focus

## Context

- **Market size**: ~1.2M plumbing/HVAC/electrical businesses in the US, majority owner-operated
- **Pain**: Contractors miss 40%+ of inbound calls while on job sites
- **Current solutions**: Generic answering services at $1–$2/call that can't qualify or schedule
- **Pricing**: $299–$799/month replaces answering service + delivers immediate ROI
- **Go-to-market**: Soft launch to 20–30 contractors via HVAC/plumbing Facebook groups and trade associations
- **Crowdfunding angle**: Wefunder/Republic equity raise; "never miss a service call" pitch with live demo
- **Regulatory**: Low risk — inbound-only, no HIPAA, standard TCPA compliance (inbound exempt)
- **Competition**: Synthflow ($29/mo generic bots), Goodcall (emerging) — neither specializes in trade-contractor workflows

## Constraints

- **Budget**: $2,800–$3,800 total build cost including incorporation (Stripe Atlas ~$500)
- **Timeline**: Revenue-generating within 90 days of start
- **Tech stack**: Retell (voice), Supabase (backend/auth), Vercel (frontend), Stripe (billing), Twilio (telephony)
- **Infra cost**: Retell ~$0.05–$0.10/min, Supabase free tier, Vercel $0–$20/mo, Twilio $1/mo/number
- **Solo/small team build**: Architecture must stay simple — no microservices, no custom ML
- **Latency**: Voice AI latency must be tuned; Retell chosen specifically for lower latency than Vapi

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Retell over Vapi | Lower latency, simpler API — critical for voice UX | — Pending |
| Google Calendar only (v1) | Fastest to ship; covers most small contractors who don't use field-management software | — Pending |
| Full admin portal + notifications | Contractors need visibility into leads; WhatsApp/Telegram preferred over email in this demographic | — Pending |
| Inbound-only | Avoids TCPA compliance complexity entirely | ✓ Good |
| Supabase for auth + DB | Free tier, built-in auth, real-time subscriptions for portal | — Pending |
| Vercel for hosting | Zero-ops deployment, free tier covers v1 traffic | — Pending |

---

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-03 after initialization*

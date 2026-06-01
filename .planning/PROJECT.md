# Koolable

**Current State:** v1.1 SHIPPED 2026-06-01 — Notifications & UI Brand complete. Production deployed and verified. v1.2 planning underway.

## Milestone v1.2 — In-App Notifications & Brand Polish (In Progress)

**Goal:** Complete the in-app notification bell UI (BELL-01, BELL-02, BELL-03), implement per-notification mark-as-read and batch mark-all-read actions, integrate the company logo across all pages and dashboard, and resolve any planned-but-unshipped work from v1.1.

**Target ship:** 2026-06-14

**Deferred from v1.1, now active:**
- In-app bell UI component (BELL-01, BELL-02, BELL-03) — scaffolded and ready for implementation
- Per-notification mark-as-read action — design approved, ready to build
- Mark-all-read functionality — companion to mark-as-read
- Logo integration on all pages (auth, dashboard, settings, email templates)

## What This Is

Koolable is a 24/7 AI phone receptionist for independent and small-fleet home-service contractors (HVAC, plumbing, electrical). It answers missed calls in real time, qualifies leads, books estimate slots into Google Calendar, and escalates genuine emergencies via WhatsApp/Telegram/SMS. Contractors forward their existing phone number — no behavior change required.

## Core Value

Every missed call is lost revenue — Koolable ensures contractors never lose a booked job to voicemail again.

## Requirements

### Validated (v1.0)

- [x] AI voice agent answers inbound calls using Retell in English and Spanish (Haitian Creole removed — not supported by Retell native ASR/TTS)
- [x] Intent classification: lead qualification, estimate scheduling, or emergency escalation
- [x] Book estimate appointments into Google Calendar via OAuth
- [x] Emergency dispatch: SMS, WhatsApp, and Telegram alerts to contractor for high-urgency calls
- [x] Twilio phone number provisioning — contractor provisions number from settings/phone
- [x] Contractor admin portal: view call logs, lead details, recordings, and agent configuration
- [x] Agent configuration in portal: business name, hours, services offered, emergency keywords
- [x] Notification settings: configure SMS number, WhatsApp number, Telegram channel, per-event toggles
- [x] Stripe subscription billing — 14-day trial + $299–$799/month tiers
- [x] Onboarding flow: sign up → configure agent → provision number → go live (via settings tabs)
- [x] Account page: subscription status, trialing badge, deactivated state with Update Payment CTA
- [x] is_active deactivation on payment failure; auto-reactivation on payment recovery

### Validated (v1.1)

- [x] Email notifications via Resend — call/lead/emergency alerts to contractor + payment failure billing alerts
- [x] In-app notification persistence — `app_notifications` table with Supabase Realtime subscription ready
- [x] Notification preferences per event — contractor toggles via settings form (SMS, WhatsApp, email)
- [x] Telegram webhook status display and one-click activation — platform-level bot integration
- [x] Wolknitive Design System applied — 14/14 CSS token replacements, zero hardcoded hex values in components

### Active (v1.2)

- [ ] **BELL-01**: A bell icon in the dashboard header displays an unread badge count that updates in real-time (via Supabase Realtime) without a page refresh
- [ ] **BELL-02**: Clicking the bell opens a panel listing the 50 most recent notifications, each showing event type, title, body excerpt, and relative time
- [ ] **BELL-03**: Contractor can mark all notifications as read with one action, clearing the unread badge
- [ ] **BELL-05**: Per-notification mark-as-read action — individual notifications can be marked read one at a time; UI shows read/unread state
- [ ] **LOGO-01**: Company logo appears on all authentication pages (login, signup)
- [ ] **LOGO-02**: Company logo appears in the dashboard header (alongside/in place of text branding)
- [ ] **LOGO-03**: Company logo appears in the Sidebar (top or bottom section)
- [ ] **LOGO-04**: Company logo is included in email notification templates (new lead, emergency, payment failure)
- [ ] **LOGO-05**: Logo sizing, placement, and contrast all pass accessibility and readability standards across mobile and desktop

### Partial / Operational Dependencies

- [ ] WhatsApp notifications (WABA approval pending — placeholder Content SIDs in code)
- [ ] Telegram bot registration with @BotFather + setWebhook (operational step, not automated)
- [ ] Retell agent deactivation on payment failure (SDK limitation — is_active flag gates calls but does not stop Retell)

### Out of Scope

- ServiceTitan / Housecall Pro / field-management integrations — complexity too high for v1; add after PMF validation
- Outbound calling — TCPA risk, not core to the product
- Haitian Creole — removed in Phase 2; Retell does not support it natively
- Additional languages beyond English/Spanish — Portuguese, French, etc. are post-PMF
- iOS/Android mobile app — web portal sufficient for v1
- Custom voice cloning — Retell stock voices cover v1
- Automated follow-up sequences — out of scope; inbound-only focus
- Dark mode toggle (dark palette is fixed theme in v1.x)
- Landing / marketing page (app UI only for v1.x)

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
- **Tech stack**: Retell (voice), Supabase (backend/auth), Next.js 16 (App Router), Vercel (frontend), Stripe (billing), Twilio (telephony), Inngest (background jobs), Resend (email)
- **Infra cost**: Retell ~$0.05–$0.10/min, Supabase free tier, Vercel $0–$20/mo, Twilio $1/mo/number
- **Solo/small team build**: Architecture must stay simple — no microservices, no custom ML
- **Latency**: Voice AI latency must be tuned; Retell chosen specifically for lower latency than Vapi

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Retell over Vapi | Lower latency, simpler API — critical for voice UX | ✓ Good |
| Google Calendar only (v1) | Fastest to ship; covers most small contractors who don't use field-management software | ✓ Good |
| Full admin portal + notifications | Contractors need visibility into leads; WhatsApp/Telegram preferred over email in this demographic | ✓ Good |
| Inbound-only | Avoids TCPA compliance complexity entirely | ✓ Good |
| Supabase for auth + DB | Free tier, built-in auth, real-time subscriptions for portal | ✓ Good |
| Vercel for hosting | Zero-ops deployment, free tier covers v1 traffic | ✓ Good |
| Haitian Creole removed | Retell does not support it natively; removed in Phase 2 (D-01) | ✓ Resolved |
| Settings tabs over wizard modal | Wizard too linear; settings tabs accessible anytime — refactored in Phase 8 | ✓ Good |
| is_active boolean for deactivation | Replaces agent_sync_status hack; proper deactivation state machine | ✓ Good |
| Wolknitive Design System | CSS-only token architecture, no new packages, full component sweep | ✓ Good |
| Logo in all pages | Brand consistency across user touchpoints (auth, dashboard, email) | — In Progress |

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
*Last updated: 2026-06-01 — v1.1 SHIPPED. 16 phases, 55 plans, 311 commits. v1.2 planning in progress.*

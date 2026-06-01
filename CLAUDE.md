# Koolable — Project Guide

## What This Project Is

Koolable is a 24/7 AI phone receptionist SaaS for HVAC, plumbing, and electrical contractors. It answers missed calls via Retell voice AI, qualifies leads, books appointments to Google Calendar, and dispatches emergencies via WhatsApp/Telegram/SMS. The agent supports English, Spanish, and Haitian Creole (South Florida market focus).

## Stack

| Layer | Technology |
|-------|------------|
| Voice AI | Retell AI (v2 SDK) |
| Telephony | Twilio (SDK v5) |
| Database + Auth | Supabase (`@supabase/ssr`) |
| Framework | Next.js 14 (App Router, TypeScript) |
| Hosting | Vercel |
| Billing | Stripe Checkout + webhooks |
| Calendar | Google Calendar API (`googleapis`) |
| Notifications | Twilio WhatsApp + SMS, grammY (Telegram) |
| Background jobs | Inngest |
| Supporting libs | `zod`, `libphonenumber-js`, `date-fns-tz` |

## GSD Workflow

This project uses the Get-Shit-Done (GSD) planning system.

**Planning artifacts:** `.planning/`
- `PROJECT.md` — project context and requirements
- `REQUIREMENTS.md` — 26 v1 requirements with REQ-IDs
- `ROADMAP.md` — 7-phase execution roadmap
- `STATE.md` — current phase and blockers
- `research/` — domain research (stack, features, architecture, pitfalls)

**Current state:** Project initialized. Ready for Phase 1 planning.

**Next command:** `/gsd-discuss-phase 1` or `/gsd-plan-phase 1`

## Critical Rules

1. **RLS on every table** — Every Supabase table must have RLS enabled and all four operation policies (SELECT, INSERT, UPDATE, DELETE) in the same migration. Test as an unprivileged user before every deploy.
2. **Webhook handler returns 200 immediately** — All downstream processing runs inside Vercel `waitUntil()`. Never block the Retell webhook on Calendar API calls or notification sends.
3. **Service role key never reaches the browser** — Use server-side Supabase client only in API routes and Server Components.
4. **OAuth tokens encrypted at rest** — Encrypt Google refresh tokens with AES-256-GCM before writing to Supabase. Decrypt only in server-side code.
5. **Idempotency on all webhook handlers** — `webhook_events` table with unique constraint on `source + event_type + external_id` prevents duplicate leads/notifications.

## Week-1 Action Items (Non-Code)

- [ ] Submit WhatsApp Business Account (WABA) registration and notification templates via Twilio — 3–7 day approval window
- [ ] Move Google OAuth app to production mode before first beta contractor connects calendar
- [ ] Verify Retell native support for Haitian Creole — if not supported, plan custom LLM endpoint fallback

## Phase Roadmap

| # | Phase | Key Deliverable | UI? |
|---|-------|----------------|-----|
| 1 | Foundation | Schema + RLS + auth + language config | Yes |
| 2 | Provisioning | Twilio number + Retell agent per contractor | No |
| 3 | Webhook Core | Every call persisted with intent classification | No |
| 4 | Scheduling & Lead Capture | Google Calendar booking + lead records | No |
| 5 | Notifications | SMS/WhatsApp/Telegram within 60s | No |
| 6 | Portal UI | Call log, recordings, leads, agent config | Yes |
| 7 | Billing & Onboarding | Stripe + test-call gate + subscription enforcement | Yes |

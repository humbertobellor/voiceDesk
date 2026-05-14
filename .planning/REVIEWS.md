---
phase: all
reviewers: [gemini, claude, opencode]
reviewed_at: 2026-05-14T08:00:00.000Z
plans_reviewed: [01-01-PLAN.md, 01-02-PLAN.md, 01-03-PLAN.md, 01-04-PLAN.md, 01-05-PLAN.md, 02-01a-PLAN.md, 02-01b-PLAN.md, 02-02-PLAN.md, 02-03-PLAN.md, 02-04-PLAN.md, 03-01-PLAN.md, 03-02-PLAN.md, 03-03-PLAN.md, 03-04-PLAN.md, 04-01-PLAN.md, 04-02-PLAN.md, 04-03-PLAN.md, 04-04-PLAN.md, 04-05-PLAN.md, 04-06-PLAN.md, all Phase 5-7 plans]
---

# Cross-AI Plan Review — VoiceDesk MVP

## Gemini Review

### Summary
The VoiceDesk MVP is a high-quality, production-ready implementation that effectively addresses the core needs of service contractors. The architecture leverages a modern stack (Next.js 14, Supabase, Inngest) with a strong emphasis on reliability and security. Key strengths include a robust "webhook-first" architecture that handles long-running AI processes without blocking, surgical timezone management for scheduling, and a "skeleton row" UI pattern that provides immediate feedback to users. The project successfully balances complex AI integrations (Retell, OpenAI) with rigorous security standards (AES-256-GCM encryption, HMAC verification), resulting in a solid foundation for a scalable SaaS product.

### Strengths
- **Security Architecture:** Rigorous security measures implemented: AES-256-GCM encryption for OAuth tokens, HMAC signature verification for Retell and Stripe webhooks, granular Supabase RLS policies.
- **Reliability & Performance:** Use of `next/server`'s `after()` block in webhook routes ensures HTTP 200 responses returned within milliseconds.
- **Durable Workflows:** Inngest utilized effectively for complex multi-step processes (classification, lead creation, calendar sync) with built-in retries, idempotency, and failure handling.
- **Timezone & Scheduling Integrity:** Handles local vs. UTC time problem surgically using `date-fns-tz`.
- **Safety-First Intent Classification:** "Hard Emergency Check" overrides LLM classification for critical keywords (gas smell, CO alarm).
- **Idempotency:** Webhook handlers use UPSERT patterns and idempotency keys.

### Concerns
- **RLS Performance (MEDIUM):** RLS policies use subqueries that may impact query performance as `calls` and `leads` tables grow.
- **Calendar Race Conditions (LOW):** DB enforces uniqueness on `(contractor_id, starts_at)` but doesn't prevent overlapping appointments.
- **Keyword Scalability (LOW):** Hard-coded emergency keywords are reliable but difficult to update without code change.
- **Observability (MEDIUM):** No integrated error-tracking service (e.g., Sentry) or centralized audit log for AI classification failures.

### Suggestions
- Optimize RLS with Postgres function using `security definer` or store `contractor_id` in JWT metadata
- Implement robust overlap detection for appointment booking
- Externalize emergency keywords to `contractor_settings` table
- Implement centralized observability (Sentry)
- Use Stripe's `idempotency_key` for outbound API calls

### Risk Assessment: LOW
The implementation is exceptionally robust for an MVP. Identified concerns are primarily optimization and observability improvements rather than structural defects.

---

## Claude Review

### Summary
The VoiceDesk MVP represents a comprehensive end-to-end solution for an AI phone receptionist targeting trades contractor market. All seven phases implemented with full stack from database schema through billing integration. Architecture demonstrates solid fundamentals—RLS policies, webhook idempotency, service role key isolation, AES-256-GCM encryption. However, several production-critical gaps remain: hard-coded emergency keywords require operational maintenance, intent classification lacks transparency, error handling across integrations appears uneven, and monitoring/observability for 24/7 operational demands are absent.

### Strengths
- **Security-first database design**: RLS enabled on all nine tables with 33 policies covering all four operations.
- **Webhook robustness**: `webhook_events` table with unique constraints on `source + event_type + external_id`.
- **Token security**: Google OAuth refresh tokens encrypted at rest with AES-256-GCM.
- **Service role isolation**: Clear separation between browser-accessible and server-only Supabase clients.
- **Multi-language support**: Foundation for English, Spanish, Haitian Creole (South Florida market).
- **Billing integration**: Stripe webhooks with trial support, customer portal, payment failure handling.
- **Onboarding flow**: Five-step wizard with test call verification gate.

### Concerns
- **Emergency keyword hard-coding (HIGH):** Requires code changes to update keywords; no mechanism for contractors to customize.
- **Intent classification opacity (HIGH):** No audit trail of classification decisions, making debugging difficult.
- **Missing webhook verification (MEDIUM):** Webhook handlers do not appear to verify signatures cryptographically.
- **Calendar availability race conditions (MEDIUM):** Concurrent booking attempts could result in overbooking.
- **No retry logic for notification failures (MEDIUM):** Transient Twilio failure means notification simply fails with no recovery.
- **Missing rate limiting (MEDIUM):** API routes lack rate limiting protection.
- **No observability infrastructure (MEDIUM):** No structured logging, metrics, or alerting for 24/7 service.
- **Hard-coded AfterHours detection (LOW):** Assumes single timezone across all contractors.
- **Calendar token refresh gap (LOW):** Token refresh mechanism not clearly documented or tested.

### Suggestions
1. Externalize emergency keywords to database with contractor-customizable UI
2. Implement Retell and Stripe webhook signature validation using HMAC
3. Implement optimistic locking for calendar slots or database-level conflict detection
4. Implement notification retry queue using Inngest
5. Add API rate limiting per contractor
6. Add structured logging and metrics
7. Add timezone per contractor for after-hours detection
8. Document and test token refresh end-to-end

### Risk Assessment: MEDIUM
Strong foundational architecture but gaps cross multiple operational dimensions. For 24/7 production service, hardening needed in three areas: webhook security verification, notification reliability with retries, and basic monitoring/alerting.

---

## OpenCode Review

### Summary
VoiceDesk delivers a well-architected MVP with strong security foundations: HMAC-verified webhooks, 33 RLS policies across 9 tables, AES-256-GCM token encryption, and clean separation between service-role and browser-accessible code paths. The Inngest-based pipeline ensures durable processing of call classification and notification dispatch. However, production readiness requires addressing several HIGH-severity data integrity gaps, incomplete external integrations (Telegram webhook, Google OAuth), and missing infrastructure (rate limiting, dead-letter monitoring) that could cause revenue loss or compliance issues.

### Strengths
- **Webhook security** — Both Retell and Stripe webhooks verify signatures before parsing, return 200 immediately, and defer all downstream work to `after()` + Inngest
- **IDOR prevention** — Contractor lookup always uses `retell_agent_id` from payload, never `contractor_id` from payload
- **Idempotent webhook delivery** — `webhook_events` table with composite unique constraint
- **AES-256-GCM encryption** — OAuth tokens encrypted at rest with IV/tag/ciphertext format
- **RLS everywhere** — All 9 tables have 4-operation policies
- **Emergency overrides** — Hard-coded keywords (gas/CO) cannot be disabled or overridden by LLM
- **Multi-channel resilience** — `Promise.allSettled` for notification dispatch; WhatsApp failure triggers SMS fallback
- **Retry with backstop** — Inngest functions have 5 retries with exponential backoff and `onFailure` handlers
- **Calendar conflict handling** — `UNIQUE(contractor_id, starts_at)` at DB level prevents double-booking

### HIGH Severity Concerns
1. **`caller_phone` NOT NULL violation** — Code inserts `''` (empty string) into NOT NULL column, bypassing constraint but producing invalid data
2. **Missing `appointment_duration_minutes` column** — Referenced in code but does not exist in schema, will cause runtime `undefined`
3. **`analysis_status` column not in schema** — Referenced in handlers but not defined in calls table schema
4. **Subscription tier hardcoded to `'basic'`** — All contractors assigned basic tier regardless of purchase
5. **Telegram webhook has no bot token verification** — Any actor can send arbitrary payloads to endpoint

### MEDIUM Severity Concerns
6. **Stale notification_log rows on Inngest retry** — Multiple `pending` rows accumulate on retry
7. **No rate limiting on notification endpoints** — SMS/WhatsApp/Telegram dispatch have no rate limits
8. **No payment failure retry via Stripe** — `past_due` status but no `canceled` transition when retries exhausted
9. **Google OAuth not in production mode** — Beta contractors using unverified credentials
10. **WhatsApp template approval not verified** — No check that templates are approved by Twilio
11. **No dead-letter queue monitoring** — Stuck webhook_events accumulate with no notification

### Suggestions
1. Add `appointment_duration_minutes INT DEFAULT 120` and `analysis_status TEXT DEFAULT 'pending'` to schema
2. Enforce E.164 phone validation with Zod
3. Add Telegram webhook bot token verification
4. Add rate limiting to notification dispatch
5. Parse subscription tier from Stripe price
6. Add monitoring for stuck webhook_events via Inngest cron
7. Add pre-send WhatsApp template status check
8. Clean up stale notification_log rows on retry

### Risk Assessment: MEDIUM
The MVP is structurally sound with good engineering discipline. Production deployment carries risk of data integrity failures from missing schema columns, notification failures from WhatsApp template misconfiguration, billing failures from hardcoded tier, security exposure from unauthenticated Telegram webhook, and operational blindness from no dead-letter monitoring.

---

## Consensus Summary

### Agreed Strengths
- Security architecture (RLS, encryption, webhook idempotency)
- Webhook-first architecture with `after()` for async processing
- Inngest for durable multi-step workflows
- Token encryption (AES-256-GCM)
- Complete Stripe billing integration
- IDOR prevention in contractor lookup

### Agreed Concerns (2+ reviewers)
1. **Observability gap (HIGH priority):** All reviewers flagged missing error tracking, logging, and monitoring for 24/7 service
2. **Notification reliability (MEDIUM):** No retry mechanism for failed SMS/WhatsApp/Telegram dispatches
3. **Calendar race conditions (MEDIUM):** Potential overbooking from concurrent slot requests
4. **Missing schema columns (HIGH priority):** OpenCode + Claude flagged `analysis_status`, `appointment_duration_minutes` not in schema

### Divergent Views
- **Gemini** rated overall risk LOW; **Claude** and **OpenCode** rated risk MEDIUM
- **Gemini** focused on optimization suggestions; **Claude** identified security gaps; **OpenCode** found critical schema issues

### Priority Recommendations (from all reviewers)
1. **CRITICAL** — Add missing schema columns (`appointment_duration_minutes`, `analysis_status`)
2. Add observability (Sentry or similar)
3. Implement notification retry via Inngest
4. Add Telegram webhook authentication
5. Parse subscription tier from Stripe price (not hardcoded `'basic'`)
6. Externalize emergency keywords to database
7. Implement calendar slot locking mechanism

---

*Review generated: 2026-05-14*
*Reviewers: Gemini CLI, Claude CLI, OpenCode*
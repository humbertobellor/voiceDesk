---
phase: all
reviewers: [gemini, claude, opencode]
reviewed_at: 2026-05-14T08:00:00.000Z
milestone_review: 2026-05-20T23:45:00Z
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

---

---

# Milestone Review — VoiceDesk v1.0 (Pre-Archive)

**Reviewed:** 2026-05-20 · **Scope:** Full milestone (all 8 phases, 41 plans deployed to production)
**Reviewers:** Gemini · OpenCode (deepseek-v4-flash-free) — Codex exec failed, Claude skipped (self)

---

## Gemini Review

### Summary
VoiceDesk v1.0 is **technically robust but operationally pending**. The architectural foundations—multi-tenant RLS, idempotent webhook processing, encrypted credential management—are enterprise-grade and exceed typical MVP standards. The product is in "Pre-Flight" state rather than "Production Ready." External verifications (Google OAuth Production Mode, WhatsApp WABA) create a hard ceiling on reliability for the first 20-30 beta users. **Recommendation:** Proceed to Private Beta only after Google OAuth verification is submitted, using the first 5 users to verify Retell webhook schemas in a live environment.

### Strengths
- **Multi-Tenant Integrity:** RLS policies across all 9 tables provide a strong security boundary.
- **Resilient Webhook Architecture:** "Return 200 + Process via `after()`" with `webhook_events` idempotency prevents duplicate notifications on Retell retries.
- **Performance-First Scheduling:** Pre-computing availability windows instead of querying Calendar API mid-call reduces LLM latency and prevents call drops.
- **Security Maturity:** AES-256-GCM encryption for OAuth tokens and strict "no service-role key in browser."
- **Graceful Fallbacks:** WhatsApp → SMS fallback ensures high-priority notifications reach contractor.

### Concerns

**HIGH:**
- **Google OAuth testing mode** — Tokens expire every 7 days, requiring re-authentication. Breaks the "24/7" promise within one week of signup.
- **Unverified webhook schemas** — If Retell payload structure differs even slightly, the entire business logic fails silently.
- **No observability** — If booking fails (e.g., expired Google token), contractor has no way to see why the appointment didn't appear.

**MEDIUM:**
- **Retell concurrency limits** — No handling for simultaneous call limits.
- **Hard-coded emergency keywords** — Regional terminology varies ("boiler lockout", "sewage backup"). No way to append custom keywords.
- **`after()` lacks retries** — Unlike Inngest, `after()` doesn't retry if DB is under load or OpenAI classification fails.

### Missing Edge Cases
- Timezone anchoring — contractor local vs. server time for availability windows?
- Google Calendar primary vs. work calendar — conflict check must cover all "busy" events
- Contractor deletes Google Calendar appointment — does VoiceDesk detect and free the slot?
- Twilio number reclamation on deactivation — losing a number printed on 500 trucks is business-ending

### Go-to-Market Readiness
**Pre-Beta (do immediately):**
1. Submit Google OAuth for Verification
2. Live webhook smoke test against real Retell call
3. Add beta users to Twilio WhatsApp Sandbox while WABA is pending

### Risk Assessment: **MEDIUM**
Architecture is sound. Risk is MEDIUM because of external dependencies. Once Google OAuth is verified and the first real call is successfully parsed and booked, this moves to LOW.

---

## OpenCode Review (deepseek-v4-flash-free)

### Summary
VoiceDesk has been thoroughly built — the architecture is sound, security decisions are correct, and the team demonstrated the ability to fix production bugs. However, the product is **not ready to onboard paying contractors**. Two hard external blockers (WABA approval, Google OAuth production mode) would cause immediate failures on day 1, and a third (unverified Retell webhook payloads) could silently break call processing. Operational maturity gaps (monitoring, error visibility, runbooks) and architectural gaps (static emergency keywords) create unacceptable risk for a 24/7 emergency dispatch product.

### Strengths
- **Security-first architecture** — IDOR prevention, AES-256-GCM, service role isolated to server-side, every table has full RLS
- **Async webhook pattern done right** — `after()` with `webhook_events` idempotency. Correct pattern for a voice AI pipeline
- **Smart Stripe guardrail** — The trialing-default fix (checking `stripe_subscription_id IS NOT NULL`) shows operational maturity
- **WhatsApp fallback** — `Promise.allSettled` with SMS fallback is the right pattern
- **Phase 8 code review discipline** — 7 findings, 0 left unfixed. Go-live state falsification bug would have been catastrophic
- **Architecture acknowledges its limits** — Dropping Haitian Creole (D-01) rather than shipping half-baked multilingual support

### Concerns

**HIGH:**
- **WABA not approved** — WhatsApp hard-fails at transport layer. Twilio returns 400-level error, not timeout. Industry average approval: 2-4 weeks.
- **Google OAuth in testing mode** — Refresh token expires in 7 days. Calendar scheduling silently degrades for every contractor who onboarded. Ticking time bomb.
- **Retell webhook event names unverified** — Handler returns 200 (by design), so errors disappear into `after()`. Every call fails silently if field names differ.
- **Emergency keywords hardcoded, non-configurable** — A `contractor_emergency_keywords` table is a 2-hour migration. Product is un-sellable without it to contractors with different emergency types.

**MEDIUM:**
- **Stale availability pre-computation** — Contractor blocks time while call in progress; LLM sees stale availability, creates false lead. Recurring issue with 20-30 contractors making ad-hoc changes.
- **No monitoring, alerting, or observability** — Zero mention of Sentry or error dashboards. Blind to failures in a 24/7 product.
- **`booking_conflict` split across two layers** — UNIQUE constraint at DB, `booking_conflict` flag at application layer. Future dev adds second booking path → flag becomes stale.
- **No rate limiting on webhook endpoints** — Retell or Stripe burst could exhaust `after()` timeouts.
- **Subscription guard race window** — Between Stripe webhook arrival and redirect back to app, user could get blocked. Happens at most critical moment (first payment).

**LOW:**
- 60s TTL on recording signed URLs — extend to 5-15 minutes
- No mention of transcription storage for lead analysis

### Missing Edge Cases
- Contractor's Twilio number ported away or suspended — no "number health" check
- Retell outage — fail open (forward to cell) or fail closed (calls unanswered)? Unspecified.
- Contractor signs up but never configures availability — all bookings fall through
- Simultaneous CO alarm calls — two dispatches, contractor arrives at two locations, no deduplication
- Stripe webhook replay — contractor could be double-subscribed
- No escalation policy when contractor misses emergency notification
- Intent classification failure — GPT-4o-mini + GPT-4o both fail — silently lost?

### Go-to-Market Readiness: **Not ready**

**Must happen before any contractor is onboarded:**
1. Submit and approve WhatsApp templates — start today, 2-6 weeks
2. Move Google OAuth to production — 24-hour process
3. Verify Retell webhook payloads via live sandbox — 2 hours, highest-value validation
4. Add basic error monitoring (Sentry minimum)
5. Make emergency keywords configurable — 2-hour migration
6. Document Retell outage failover policy

**Should happen before scaling past 20:**
- Rate limiting on webhook endpoints
- In-flight emergency deduplication
- Secondary contact escalation for emergencies

### Risk Assessment: **HIGH**

| Category | Severity |
|----------|----------|
| Go-to-market blockers (WABA, OAuth) | Contractor onboarding fails within 7 days |
| Emergency dispatch reliability | Legal liability — no Retell outage runbook |
| Multi-tenant security | **LOW** — strongest part of architecture |
| Operational visibility | Blind to failures in 24/7 product |
| Emergency keyword configurability | Product doesn't fit many contractor use cases |
| Webhook correctness | Complete silent failure path if field names differ |
| Scale to 30 contractors | **LOW** — architecture handles it |

---

## Milestone Consensus Summary

### Agreed Strengths (both reviewers)
- Multi-tenant security (RLS + AES-256-GCM + IDOR prevention) — genuinely production-grade
- Async webhook pattern (`after()` + idempotency) — correct design for voice AI pipeline
- WhatsApp → SMS fallback with `Promise.allSettled`
- Code review discipline — Phase 8 had 7 findings, all fixed before deploy

### Agreed Concerns — Pre-Launch Blockers

| Concern | Gemini | OpenCode | Priority |
|---------|--------|----------|----------|
| Google OAuth testing mode | HIGH | HIGH | **BLOCKER** — Silent 7-day expiry |
| WABA not approved | HIGH | HIGH | **BLOCKER** — Fails at transport, not fallback |
| Retell webhook unverified | HIGH | HIGH | **BLOCKER** — Silent failure on every call |
| No observability/monitoring | HIGH | MEDIUM | **BLOCKER** — Blind to 24/7 failures |
| Emergency keywords hardcoded | MEDIUM | HIGH | **RISK** — Un-sellable to many contractors |
| Stale availability windows | MEDIUM | MEDIUM | **RISK** — False bookings on ad-hoc changes |

### Overall Risk Verdict
- Gemini: **MEDIUM** (external dependencies, quickly resolves once OAuth is live and first call parsed)
- OpenCode: **HIGH** (emergency dispatch liability, WABA timeline pessimism, keyword configurability blocks sales)
- **Consensus: MEDIUM-HIGH** — Engineering quality is high; go-to-market readiness is low

### Prioritized Pre-Launch Checklist
- [ ] Submit WABA registration + all notification templates *(start today — 2-6 week window)*
- [ ] Move Google OAuth app to production mode *(24-hour process)*
- [ ] Verify Retell webhook payloads against live sandbox *(2 hours — highest ROI)*
- [ ] Add error monitoring (Sentry or equivalent) for `after()` failures
- [ ] Make emergency keywords configurable per contractor

*Milestone review generated: 2026-05-20*
*Reviewers: Gemini CLI, OpenCode (deepseek-v4-flash-free)*
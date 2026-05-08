# Phase 3: Webhook Core - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 3-Webhook Core
**Areas discussed:** Webhook event strategy, Intent classification pipeline, LLM provider for classification, Ambiguous call fallback behavior, Webhook route structure, Recording storage, LLM prompt strategy per trade type, Supabase Realtime

---

## Webhook Event Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| call_analyzed only | Single handler, 1–3 min delay, full data. Simpler. Portal shows call only after analysis. | |
| call_ended + call_analyzed | Two handlers: skeleton row on call_ended, enriched on call_analyzed. More complex but better UX. | ✓ |
| You decide | Claude picks. | |

**User's choice:** call_ended + call_analyzed

---

**What data on call_ended skeleton row?**

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal: caller phone + duration + timestamp | Just enough for call log entry. | |
| Minimal + status indicator | Same + status='analyzing' so contractor sees it's in progress. | ✓ |
| You decide | Claude picks. | |

**User's choice:** Minimal + status indicator

---

**Status progression?**

| Option | Description | Selected |
|--------|-------------|----------|
| analyzing → complete | Two states post-call. | |
| pending → analyzing → complete | Three states, more granular for debugging. | ✓ |
| You decide | Claude picks. | |

**User's choice:** pending → analyzing → complete (plus analysis_failed for timeout)

---

**Analysis timeout if call_analyzed never arrives?**

| Option | Description | Selected |
|--------|-------------|----------|
| 10 minutes then mark failed | Inngest job, simpler. | |
| 30 minutes then mark failed | Longer window for slow analyses. | ✓ |
| You decide | Claude picks. | |

**User's choice:** 30 minutes

---

**Duplicate webhook delivery idempotency?**

| Option | Description | Selected |
|--------|-------------|----------|
| Separate webhook_events rows per event_type | Two rows in audit table. | |
| Upsert on calls row only | ON CONFLICT (retell_call_id) DO UPDATE. Simpler, no double-layer. | ✓ |
| You decide | Claude picks. | |

**User's choice:** Upsert on calls row only

---

## Intent Classification Pipeline

| Option | Description | Selected |
|--------|-------------|----------|
| LLM for all tiers | All three tiers (lead/emergency/info) go through LLM. More accurate. | ✓ |
| Keyword rules + LLM for emergencies only | LLM only for emergency confirmation. | |
| Keyword rules only | No LLM. Cheapest. | |

**User's choice:** LLM for all tiers

---

**Emergency hard-code vs LLM final arbiter?**

| Option | Description | Selected |
|--------|-------------|----------|
| Hard-coded first, LLM second | Gas smell + CO alarm trigger emergency before LLM. Cannot be overridden (EMRG-02). | ✓ |
| LLM decides everything | Keywords as prompt priming only. Technically violates EMRG-02. | |
| You decide | Apply EMRG-02 strictly. | |

**User's choice:** Hard-coded first, LLM second

---

**Structured data extraction: combined or separate LLM call?**

| Option | Description | Selected |
|--------|-------------|----------|
| Single LLM call: classify + extract | One prompt, one cost. | |
| Two LLM calls: classify first, extract separately | Different models per task (cheaper classifier, smarter extractor). | ✓ |
| You decide | Claude picks. | |

**User's choice:** Two LLM calls

---

**Summary storage?**

| Option | Description | Selected |
|--------|-------------|----------|
| Retell's summary as-is | No extra LLM for summarization. | |
| Retell's summary + our own structured extraction | Both: Retell summary in summary column, GPT-4o extraction in structured fields. | ✓ |
| You decide | Claude picks. | |

**User's choice:** Retell's summary + our own structured extraction

---

## LLM Provider for Classification

| Option | Description | Selected |
|--------|-------------|----------|
| OpenAI GPT-4o-mini | Fast, cheap, US-based, SOC 2 compliant. | |
| Claude Haiku (claude-haiku-4-5) | Anthropic, US-based, strong structured output. | |
| Claude Sonnet (claude-sonnet-4-6) | More capable, higher cost. | |
| You decide | Claude picks. | |

**Initial user response:** "How about Deepseek?"

**Notes:** Claude surfaced data privacy concern — DeepSeek stores data in China; call transcripts contain homeowner PII (names, addresses, phone numbers). User accepted the concern.

**Final choice:** OpenAI GPT-4o-mini (reverted to standard option after privacy discussion)

---

**Same model for both LLM calls or different?**

| Option | Description | Selected |
|--------|-------------|----------|
| GPT-4o-mini for both | One model, simpler. | |
| GPT-4o-mini for classification, GPT-4o for extraction | Mini for speed/cost; full GPT-4o for accuracy on messy transcripts. | ✓ |
| You decide | Claude picks. | |

**User's choice:** GPT-4o-mini for classification, GPT-4o for extraction

---

**OpenAI failure handling?**

| Option | Description | Selected |
|--------|-------------|----------|
| Retry via Inngest, transcript lost if all retries fail | Standard retry. | |
| Store transcript immediately, classify async via retry | Transcript never lost. | |
| You decide | Claude picks resilience pattern. | ✓ |

**User's choice:** You decide (Claude's discretion — store transcript immediately, queue Inngest retry for classification)

---

## Ambiguous Call Fallback Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| no_action (new intent type) | New value for unclassifiable calls. | |
| general_inquiry (catch-all) | Default to existing 'info' value in schema. | ✓ |
| You decide | Claude picks. | |

**User's choice:** general_inquiry catch-all (maps to existing `intent='info'` in Phase 1 schema)

---

**Short calls (< 15 seconds) treatment?**

| Option | Description | Selected |
|--------|-------------|----------|
| Skip LLM, store as info directly | No LLM cost for short calls. | |
| Run LLM with short-call flag in prompt | Consistent code path, flag gives LLM context. | ✓ |
| Treat all calls the same | No special casing. | |

**User's choice:** Run LLM with short-call flag

---

**General inquiry notifications?**

**Notes:** User rejected the multiple choice options and provided a specific product decision.

**User's choice (freeform):** "I want to make Notifications for general inquiries configurable in the Dashboard. The contractor should be able to decide, a checkbox by default unselected '[ ] Notify me on general_inquiry calls'"

**Captured as:** `notification_settings.notify_on_general_inquiry BOOLEAN DEFAULT false`. Phase 6 UI: checkbox default unchecked. Phase 5 reads preference before dispatching.

---

**Leads row for general_inquiry calls?**

| Option | Description | Selected |
|--------|-------------|----------|
| No — leads only for lead and emergency | | |
| Yes — leads for all non-trivial calls | Even general inquiry creates a lead. | ✓ |
| You decide | Claude picks. | |

**User's choice:** Yes — create leads for non-trivial (≥ 15s) calls

---

**Leads row for short calls (< 15s)?**

| Option | Description | Selected |
|--------|-------------|----------|
| Skip leads for very short calls | Wrong numbers / hang-ups don't pollute lead list. | ✓ |
| Always create a lead | Full visibility into every inbound contact. | |

**User's choice:** Skip leads for very short calls

---

**After-hours detection mechanism?**

| Option | Description | Selected |
|--------|-------------|----------|
| In webhook handler, comparing call_start_at to business_hours | Pure timestamp math, no LLM. | ✓ |
| Pass call_start_at to LLM | LLM factors in after-hours context. Overkill for a deterministic check. | |
| You decide | Claude picks cleanest approach. | |

**User's choice:** In webhook handler, deterministic timestamp comparison

---

## Webhook Route Structure

| Option | Description | Selected |
|--------|-------------|----------|
| One route, dispatch by event_type | Single URL for Retell config, branch on event_type. | |
| Separate routes per event | Two Retell webhook URLs. Needs Retell per-event URL support. | |
| You decide | Claude picks. | ✓ |

**User's choice:** You decide

**Claude's decision:** One route (`/api/webhooks/retell`), dispatching by `event.event_type`. Standard pattern.

---

## Recording Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Store Retell's recording URL directly | Simple, no download/re-upload. | ✓ |
| Download from Retell, re-upload to Supabase Storage | Full control, higher complexity. | |
| You decide | Claude picks. | |

**User's choice:** Store Retell's URL directly

---

**Recording proxy for PORTAL-02 (60s TTL signed URLs)?**

| Option | Description | Selected |
|--------|-------------|----------|
| Proxy via /api/recordings/:call_id | Our API validates session, returns URL with expiry. Portal never exposes Retell URL. | ✓ |
| Link directly to Retell's URL from portal | Simpler. Waives signed URL requirement. | |
| You decide | Claude picks. | |

**User's choice:** Proxy via our API (Phase 6 deliverable — not Phase 3)

---

## LLM Prompt Strategy Per Trade Type

| Option | Description | Selected |
|--------|-------------|----------|
| Trade-specific extraction prompts | Tailored schema per trade_type (hvac/plumbing/electrical). | ✓ |
| Single generic prompt with optional fields | One schema, all fields optional. Simpler. | |
| You decide | Claude picks. | |

**User's choice:** Trade-specific extraction prompts

---

**Multi-trade contractors?**

| Option | Description | Selected |
|--------|-------------|----------|
| Classification call identifies trade, then matching extraction runs | Two LLM calls, accurate. | ✓ |
| Combined multi-trade extraction schema | One prompt with all trade fields, nulls irrelevant sections. | |
| You decide | Claude picks. | |

**User's choice:** Run all three schemas / merge results (implemented as: classification call returns detected_trade, then matching extraction runs)

---

## Supabase Realtime

| Option | Description | Selected |
|--------|-------------|----------|
| Leave to Phase 6 — Supabase Realtime picks up calls table automatically | Phase 3 does nothing extra. | ✓ |
| Phase 3 explicitly enables Realtime on calls table | Guaranteed setup, no Phase 6 debugging. | |
| You decide | Claude picks. | |

**User's choice:** Leave to Phase 6

---

## Claude's Discretion

- **Webhook route structure:** Single `/api/webhooks/retell` route dispatching by `event.event_type`
- **OpenAI failure handling:** Store transcript immediately on call_analyzed; queue Inngest retry for classification. Max 5 retries with exponential backoff.
- **Multi-trade extraction:** Classification LLM call returns both `intent` and `detected_trade`; saves an extra round-trip vs a separate trade detection pass.

## Deferred Ideas

- Recording proxy API `/api/recordings/:call_id` → Phase 6
- Supabase Realtime subscription setup → Phase 6
- Lead record creation from calls → Phase 4
- Notification dispatch logic → Phase 5
- `notify_on_general_inquiry` checkbox UI → Phase 6

# Phase 2: Provisioning - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-05
**Phase:** 2-Provisioning
**Areas discussed:** Haitian Creole removal, System prompt design, Area code selection UX, Agent re-sync on config changes

---

## Haitian Creole Removal

**Question: What is the intent regarding HC support (LANG-02, delivered in Phase 1)?**

| Option | Description | Selected |
|--------|-------------|----------|
| Remove HC entirely | Drop HC from product scope — remove from UI, schema defaults, system prompt, requirements | ✓ |
| Defer HC to v2 (schema stays) | Keep schema, don't include HC in Phase 2 prompt. Re-enable in v2. | |
| Keep HC, confirm Retell support first | HC stays in scope — Phase 2 blocked until Retell native support verified | |

**User's choice:** Remove HC entirely

---

**Question: What scope of HC cleanup should Phase 2 include?**

| Option | Description | Selected |
|--------|-------------|----------|
| Full cleanup in Phase 2 | Remove HC from UI options, contractor_settings defaults, system prompt templates, REQUIREMENTS.md | ✓ |
| Minimal — just omit HC from Phase 2 | Don't backport cleanup; leave HC references as dormant dead code | |
| Dedicated cleanup plan item | Create a standalone 02-01-PLAN.md for cleanup before provisioning work | |

**User's choice:** Full cleanup in Phase 2

---

**Question: Should the emergency keywords JSONB structure change with HC removed?**

| Option | Description | Selected |
|--------|-------------|----------|
| Keep JSONB, just en/es keys | Leave `{ en: [...], es: [...] }` shape; no migration needed | ✓ |
| Flatten to two arrays | Replace JSONB with `emergency_keywords_en TEXT[]` and `emergency_keywords_es TEXT[]` | |
| You decide | Claude picks least-friction path | |

**User's choice:** Keep JSONB structure, just en/es keys

---

**Question: How should the language-selection UI be simplified?**

| Option | Description | Selected |
|--------|-------------|----------|
| Simple toggle: English-only vs. English+Spanish | Two radio options; no checkbox group needed | |
| Keep two checkboxes (English / Spanish) | Retain checkbox group pattern, just two options | ✓ |
| You decide | Claude picks simplest implementation | |

**User's choice:** Keep two checkboxes (English / Spanish)

---

## System Prompt Design

**Question: What persona and tone should the default system prompt use?**

| Option | Description | Selected |
|--------|-------------|----------|
| Professional + warm receptionist | Formal but warm; "Thank you for calling [Business Name]..." | ✓ |
| Efficient + direct | No-fluff, fast to the point | |
| Friendly + casual | Conversational and approachable | |

**User's choice:** Professional + warm receptionist

---

**Question: How should the system prompt handle multi-language calls?**

| Option | Description | Selected |
|--------|-------------|----------|
| Single agent, language branch in prompt | One Retell agent per contractor; prompt handles EN/ES branching | ✓ |
| Separate Retell agents per language | Two agents per contractor; route via Twilio IVR | |
| English only by default, Spanish on-demand | Default to English; add Spanish branch if enabled | |

**User's choice:** Single agent, language branch in prompt

---

**Question: What happens when caller asks something outside the agent's scope?**

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect + offer to take a message | "I can't help with that but I can take your contact info..." | ✓ |
| Politely decline + end call | "That's outside what we handle. Thanks for calling!" | |
| You decide | Claude picks most lead-protective behavior | |

**User's choice:** Redirect + offer to take a message

---

**Question: How should the after-hours branch behave?**

| Option | Description | Selected |
|--------|-------------|----------|
| Use after_hours_message + still capture lead | Acknowledges off-hours AND captures name/phone/issue | ✓ |
| Play message + end call | Clean but loses every after-hours lead | |
| Treat after-hours same as business hours | No distinction in prompt; Phase 3 handler tags it | |

**User's choice:** Use contractor's after_hours_message + still capture lead

---

## Area Code Selection UX

**Question: How should area code input work during provisioning?**

| Option | Description | Selected |
|--------|-------------|----------|
| Free text input with South FL defaults | Text field pre-filled with '305'; API picks first available number | ✓ |
| Dropdown of South Florida area codes | 305/786/954/561 options only | |
| Show available numbers to pick from | Query Twilio and display a list of numbers | |

**User's choice:** Free text input with South FL defaults (305)

---

**Question: Should Phase 2 include any self-serve provisioning UI?**

| Option | Description | Selected |
|--------|-------------|----------|
| API route only, no UI | POST /api/provisioning/create; Phase 7 wizard calls it | ✓ |
| Simple Provision button on dashboard | Temporary button for dev/testing; replaced by Phase 7 | |
| Auto-provision on account creation | Fires automatically at signup | |

**User's choice:** API route only, no UI

---

**Question: What happens if Twilio has no available numbers in the requested area code?**

| Option | Description | Selected |
|--------|-------------|----------|
| Return error + let contractor try different code | Clear error; suggest 786/954/561 as alternatives | ✓ |
| Auto-fallback to nearest area code | Auto-pick from 786 or 954 without asking | |
| Provision toll-free number as fallback | Use 800/888 if no local numbers available | |

**User's choice:** Return error + let contractor try a different code

---

## Agent Re-Sync on Config Changes

**Question: When should the Retell agent be updated when settings change?**

| Option | Description | Selected |
|--------|-------------|----------|
| On-demand via API call when settings saved | PATCH /api/provisioning/update-agent; Phase 6 calls it | ✓ |
| Background job via Inngest | Async; more resilient but adds latency | |
| Defer re-sync entirely to Phase 6 | Phase 2 handles initial provisioning only | |

**User's choice:** On-demand via API call when settings are saved

---

**Question: If the Retell API call fails during agent update, what's the error handling strategy?**

| Option | Description | Selected |
|--------|-------------|----------|
| Save to DB always, return warning if Retell fails | Settings persisted; warning shown to contractor | |
| Rollback DB save if Retell fails | Atomic unit; risks losing contractor changes | |
| Silent retry in background | Save to DB; queue Inngest retry; no error unless retries exhaust | ✓ |

**User's choice:** Silent retry in background (Inngest)

---

**Question: If all retries fail, should the contractor be notified?**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — persistent sync-failed banner in portal | Mark agent as out-of-sync in DB; show banner | ✓ |
| No — silent failure, support investigates | Log in DB; no user-facing notification | |
| Yes — send WhatsApp/SMS alert | Same channel as lead alerts | |

**User's choice:** Yes — show a persistent sync-failed banner in the portal

---

## Claude's Discretion

- Retell API call sequencing for number import + agent creation — researcher verifies against current Retell v2 docs
- System prompt template wording (beyond tone/behavior decisions locked above)
- Inngest retry backoff and max-retries for agent re-sync — standard exponential backoff, max 5 retries

## Deferred Ideas

- **Toll-free number option** — 800/888 fallback; deferred to v2
- **Number porting** — Contractor brings their existing number; complex Twilio flow, post-PMF
- **Multiple Retell agents per language** — Stronger language isolation; single-agent sufficient for v1
- **Haitian Creole re-enablement** — Schema supports it; re-evaluate post-PMF if South Florida demand warrants it

---
phase: 9
reviewers: [gemini, opencode]
reviewed_at: 2026-05-23T00:00:00.000Z
plans_reviewed: [09-01-PLAN.md, 09-02-PLAN.md]
codex: failed (empty output)
---

# Cross-AI Plan Review — Phase 9: Hardening & UX Polish

---

## Gemini Review

### 1. Summary
The Phase 9 plans are well-targeted, focusing on production-readiness by improving observability, fixing brand consistency, and enabling user self-service for phone provisioning. By leveraging existing API endpoints and Inngest's durable execution model, the plans minimize new architectural complexity. The implementation approach for the phone provisioning form is secure and pragmatic, correctly delegating authorization to the server-side JWT session rather than client-side identifiers.

### 2. Strengths
- **Observability:** Centralizing logs with the `[voicedesk]` prefix and using structured JSON is excellent for Vercel/Logflare searchability.
- **Security Invariants:** Deriving `contractor_id` from the JWT session in `/api/provisioning/create` follows best practices for preventing IDOR vulnerabilities.
- **UX Feedback Loop:** Using `router.refresh()` in the provisioning form is the correct Next.js pattern to trigger layout re-validation, ensuring the Sidebar reflects the new state immediately without manual page reloads.
- **Idempotency:** Explicit handling of `409 Conflict` and `422 Unprocessable Entity` in the UI provides clear, actionable feedback to the contractor.
- **Sidebar Integration:** Surfacing the VoiceDesk number in the sidebar provides constant context to the user, confirming their "active" status on the platform.

### 3. Concerns
- **MEDIUM — Logging Depth:** In the Inngest `onFailure` handlers, the plan logs a hardcoded `error: 'all retries exhausted'`. While accurate, it loses the actual error message/stack from the failed execution (e.g., a specific 500 from Retell or a 401 from Twilio). Inngest's `FailureEventPayload` includes the error details from the last failed attempt — these should be captured.
- **MEDIUM — Test Coverage:** The `tests/ui/phone-settings.test.tsx` file contains only `throw new Error('not yet implemented')` stubs. For a "Hardening" phase, these should be completed to prevent regressions in the provisioning flow.
- **LOW — Bot Name in .env.example:** While the bot name fix is planned for source files, the `.env.example` and some `.planning/` documents still reference `VoiceDeskBot`. Total consistency is preferred to avoid confusing new developers during environment setup.
- **LOW — Sidebar Clutter:** The sidebar bottom-left "User area" now includes Business Name, Phone Number, and Email. On small screens or with long business names, this may lead to vertical overflow or visual noise.

### 4. Suggestions
- **Enhance `onFailure` Logs:** Capture actual Inngest failure event error details:
  ```typescript
  onFailure: async ({ event }) => {
    const error = event.data.error; // FailureEventPayload includes error info
    console.error('[voicedesk]', JSON.stringify({
      event: '...',
      error: error.message,
      stack: error.stack,
    }));
  }
  ```
- **Complete UI Tests:** Prioritize implementing Vitest tests for the provisioning form error states (409, 422) in `tests/ui/phone-settings.test.tsx`.
- **Environment Variable for Bot Name:** Consider a `NEXT_PUBLIC_TELEGRAM_BOT_NAME` env var to avoid future hardcoded string replacements.
- **Copy button in Sidebar:** Add a copy-to-clipboard button next to the phone number in the Sidebar for quick access while navigating.

### 5. Risk Assessment
**Risk Level: LOW**

The changes are primarily additive or string-based. The provisioning logic relies on an existing, verified API, and the logging changes do not affect application logic. The "Bot Name" change is a safe find-and-replace. The risk of breaking existing functionality is minimal, provided `onFailure` handlers don't crash during logging attempts.

---

## OpenCode Review

### 1. Summary

Both plans (09-01 and 09-02) are well-scoped, narrowly targeted, and low-risk. They achieve their stated goals cleanly. Codebase verification shows both plans have already been executed — the bot name is fixed, structured logging is in place, `settings/phone` two-state form is implemented, and the Sidebar renders the provisioned number. The SUMMARY files confirm execution. The plans accurately describe what *was* done rather than what *needs* to be done.

### 2. Strengths
- **Narrow, safe scope for 09-01** — Bot name fix is a pure string replacement with a verifiable grep check. No logic changes, no env var changes.
- **Structured logging format** — `[voicedesk]` prefix + `JSON.stringify({event, contractor_id?, call_id?, error})` is searchable in Vercel Logs and avoids external log SDK dependency.
- **Security invariant in 09-02** — `contractor_id` explicitly excluded from the fetch body, derived from JWT server-side. Threat model correctly calls out T-09-02-01 (EoP), T-09-02-02 (client validation is UX only), T-09-02-03 (DoS via button disable + API 409 idempotency).
- **Two-state form design** — area code input with progressive disclosure, carrier forwarding grid gated on `twilioNumber`, inline error messages matching API status codes.
- **`router.refresh()` on success** is the right App Router pattern — avoids hard reloads or manual state passing.

### 3. Concerns
- **LOW — .env.example still references VoiceDeskBot:** The `.env.example` at line 66 still references `VoiceDeskBot`. A new developer onboarding will find a discrepancy between the env file and the source code.
- **LOW — Remaining unstructured console.error calls:** Plan 09-01 only addresses the `after()` catch block and four `onFailure` handlers. The main-function bodies contain ~15 additional unstructured `console.error` calls (e.g., `retell-call-classify.ts:121`, `retell-notify-dispatch.ts:162`). Filtering Vercel Logs on `[voicedesk]` will miss these.
- **LOW — Log namespace fragmentation:** `stripe-payment-failure.ts` `step.run()` logging (out of plan scope) uses a different prefix format. Fragments the log namespace.
- **MEDIUM — Unresolved human-verify checkpoint:** 09-02 SUMMARY reports `tasks_completed: 2` of 3 — Task 2 is a `checkpoint:human-verify` that was never completed. `VALIDATION.md` shows all items as `⬜ pending`. The page compiles and logic looks correct, but a real session with an unprovisioned contractor has not been exercised end-to-end.
- **LOW — Wave 0 stubs remain unimplemented:** `tests/ui/phone-settings.test.tsx` remains 3 stubs (`throw new Error('not yet implemented')`). VALIDATION.md shows `❌ W0` — a known Nyquist validation gap.

### 4. Suggestions
1. **Complete the human-verify checkpoint** for 09-02 before closing the phase. This is the highest-ROI action: run `settings/phone` in a real browser with both states (unprovisioned and provisioned).
2. **Convert remaining unstructured `console.error` calls** across the 5 Inngest files to the `[voicedesk]` structured format. This makes Vercel Logs filtering comprehensive.
3. **Update `.env.example`** — change `VoiceDeskBot` to `voiceDeskTelBot` (single remaining source of truth discrepancy).
4. **Implement the Wave 0 stubs** — 3 tests covering two-state rendering, API call path, and 422 error handling. Would close the Nyquist gap on VALIDATION.md.

### 5. Risk Assessment
**Overall: LOW**

The phase is low-risk because both plans have been executed and compile cleanly, changes are purely additive (new logging strings) or cosmetic (bot name in comments/display), the provisioning form calls an API with existing idempotency and auth guards, and there are no schema changes, new dependencies, or new endpoints. The only remaining risk is that `settings/phone` has not been end-to-end verified with a real Retell account (unresolved `checkpoint:human-verify`). A subtle race condition in `router.refresh()` or an API change in Retell would surface as a user-facing bug.

---

## Consensus Summary

### Agreed Strengths
- **Security-first provisioning form** — `contractor_id` never crosses the client boundary; JWT-derived server-side. Both reviewers flagged this explicitly as correct.
- **Structured `[voicedesk]` JSON logging** — Right approach for Vercel Logs searchability. Both reviewers validated the format.
- **`router.refresh()` pattern** — Correct App Router pattern for Sidebar sync without hard reload.
- **Overall low-risk scope** — Plans touch no new infrastructure, schemas, or dependencies.

### Agreed Concerns
- **MEDIUM — Human-verify checkpoint unresolved (09-02):** `settings/phone` has never been exercised with a real unprovisioned contractor account end-to-end. Both reviewers flagged test/verification gaps.
- **LOW — `.env.example` still has `VoiceDeskBot`:** Only remaining reference outside `src/`. Should be a one-liner fix.
- **LOW — Wave 0 test stubs remain unimplemented:** `tests/ui/phone-settings.test.tsx` is all `throw new Error('not yet implemented')` — leaves a Nyquist gap.

### Divergent Views
- **Gemini (MEDIUM)** wants to capture Inngest `FailureEventPayload` error details in `onFailure` logging (not just hardcoded `'all retries exhausted'`). **OpenCode** did not flag this as a concern — OpenCode validated the existing implementation as-is.
- **OpenCode** specifically flagged the ~15 remaining unstructured `console.error` calls in main function bodies (outside `onFailure`) as a follow-up item. **Gemini** did not mention this.

### Top Action Items Before Phase 10
1. Complete `settings/phone` human-verify with a real unprovisioned account
2. Fix `.env.example` line 66: `VoiceDeskBot` → `voiceDeskTelBot`
3. Implement or close the 3 `tests/ui/phone-settings.test.tsx` stubs

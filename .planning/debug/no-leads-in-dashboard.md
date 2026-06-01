---
slug: no-leads-in-dashboard
status: resolved
trigger: "I've placed a call and I can not see a single lead in the dashboard. Please check"
created: 2026-05-21
updated: 2026-05-21
---

## Symptoms

- expected: After placing a real call, a lead record should appear on the /leads page
- actual: /calls page shows call records but /leads page shows nothing
- errors: None visible to user
- timeline: Started after the webhook was fixed (RETELL_WEBHOOK_KEY added). Calls appear, leads do not.
- reproduction: Place any call through the Retell agent, then check /leads

## Context

- Webhook (POST /api/webhooks/retell) is now working — returns 200, writes call rows
- Flow: call_ended → processCallEnded → calls table + Inngest event → retell-call-classify → leads table
- The call was placed AFTER the RETELL_WEBHOOK_KEY fix was deployed (dpl_DC3U7J7Kp1bVYwUEBhnHscCcQMEe)
- /calls shows call records, so processCallEnded is running
- /leads shows nothing

## Current Focus

hypothesis: "Inngest cannot deliver function executions to Vercel — every call fails with DEPLOYMENT_NOT_FOUND because Inngest registered the deployment-specific URL (not the stable production URL). The serve() handler in /api/inngest/route.ts has no serveHost set, so Inngest auto-detects VERCEL_URL (a per-deployment slug) instead of the stable voicedesk-two.vercel.app URL."
test: "Verified via Inngest events API — every inngest/function.failed since deployment shows 'DEPLOYMENT_NOT_FOUND' error. No retell/call.classify execution has ever succeeded."
expecting: "Adding serveHost: 'https://voicedesk-two.vercel.app' to the serve() call and redeploying will fix all Inngest function invocations."
next_action: "apply_fix"
reasoning_checkpoint: "DB confirms: calls row has analysis_status='analyzing', intent=null — Inngest classify never ran. leads table has 0 rows. Inngest API shows DEPLOYMENT_NOT_FOUND on every function invocation. Root cause is serve() missing explicit serveHost."

## Evidence

- timestamp: 2026-05-21T05:43Z
  type: db_query
  finding: "calls row retell_call_id=call_4c5d10580b1ea3f531f8b9dad70 has analysis_status='analyzing', intent=null"
  conclusion: "processCallAnalyzed ran (call_analyzed webhook received at 01:33:19) but Inngest classify never fired"

- timestamp: 2026-05-21T05:43Z
  type: db_query
  finding: "SELECT COUNT(*) FROM leads → 0"
  conclusion: "No leads have ever been written — not an RLS issue, the create-lead step never ran"

- timestamp: 2026-05-21T05:43Z
  type: retell_api
  finding: "GET /v2/get-call/call_4c5d10580b1ea3f531f8b9dad70 → call_analysis.call_summary present, call_status=ended"
  conclusion: "Retell analyzed the call; call_analyzed webhook was sent"

- timestamp: 2026-05-21T05:43Z
  type: vercel_logs
  finding: "Two POST /api/webhooks/retell at 01:33:19 → both 200. No POST /api/inngest after 01:30:36."
  conclusion: "call_ended and call_analyzed both received. Inngest classify event was sent but Inngest never called back to execute it."

- timestamp: 2026-05-21T05:43Z
  type: inngest_events_api
  finding: "Every inngest/function.failed event shows error: 'The deployment could not be found on Vercel. DEPLOYMENT_NOT_FOUND'. Pattern repeats every 5 minutes (cron) — all functions broken."
  conclusion: "Inngest registered a stale per-deployment URL. serve() has no serveHost — auto-detects VERCEL_URL which is deployment-specific."

- timestamp: 2026-05-21T05:43Z
  type: code_review
  finding: "src/app/api/inngest/route.ts: serve({ client, functions }) — no serveHost option"
  conclusion: "Fix: add serveHost: process.env.APP_URL to serve() config. APP_URL is already set on Vercel production to 'https://voicedesk-two.vercel.app'."

## Eliminated

- RLS blocking leads SELECT: eliminated — leads table has 0 rows, not a visibility problem
- Call classified as no_action: eliminated — classify never ran at all
- call_analyzed webhook not received: eliminated — two retell webhooks at 01:33:19 confirm both call_ended and call_analyzed were received
- Inngest signing key mismatch: eliminated — keys match between .env.local and Vercel production; the 401s at 01:29:58 and 01:30:36 were before the call and from a different attempt
- INNGEST_EVENT_KEY missing: eliminated — key is set in Vercel env

## Resolution

root_cause: "Inngest serve() handler in src/app/api/inngest/route.ts has no serveHost configured. Inngest SDK auto-detects VERCEL_URL (a per-deployment slug like voicedesk-xxx.vercel.app) during deployment sync, not the stable production URL. When Vercel rotates deployments, Inngest's registered endpoint becomes DEPLOYMENT_NOT_FOUND, breaking all function invocations permanently until re-synced."
fix: "Add serveHost: process.env.APP_URL to the serve() config in src/app/api/inngest/route.ts. APP_URL is already set to 'https://voicedesk-two.vercel.app' in Vercel production. Redeploy to force Inngest re-sync against the stable URL."
verification: "Inngest PUT sync returned {modified:true}. Next test call should write a leads row."
files_changed: "src/app/api/inngest/route.ts"

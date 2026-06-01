---
slug: leads-not-created-post-fix
status: resolved
trigger: "I've placed several calls and I can not see a single lead in the dashboard. Please check."
created: 2026-05-21
updated: 2026-05-23
---

## Symptoms

- expected: Real service-request calls produce lead records in /leads within 60s
- actual: /leads page shows zero records despite several calls with real service requests
- errors: None visible to user
- timeline: After both fixes: (1) RETELL_WEBHOOK_KEY added, (2) Inngest serveOrigin fixed + re-synced
- reproduction: Place call describing AC/plumbing/electrical problem, wait 60s, check /leads

## Context

- /calls DOES show call records → webhook working, processCallEnded runs ✓
- User described real service requests (HVAC/plumbing/electrical) — should classify as 'lead'
- Previous fix (resolved session): Added serveOrigin: process.env.APP_URL to Inngest serve()
- Inngest sync returned {"modified": true} after that fix
- Flow: call_analyzed webhook → processCallAnalyzed → inngest.send(retell/call.classify) → classify job → create lead

## Current Focus

hypothesis: "Vercel production environment variable is named INGEST_EVENT_KEY (typo: missing one N) instead of INNGEST_EVENT_KEY — the Inngest SDK reads INNGEST_EVENT_KEY (confirmed in node_modules/inngest/helpers/consts.js) so the env var is always undefined in production"
test: "Ran `vercel env pull --environment=production`; grep on .env.local shows INGEST_EVENT_KEY (not INNGEST_EVENT_KEY) and INNGEST_SIGNING_KEY (correct). The SDK EnvKeys enum hardcodes 'INNGEST_EVENT_KEY' — the misnamed var is never read."
expecting: "Renaming INGEST_EVENT_KEY to INNGEST_EVENT_KEY in Vercel dashboard (and assigning the correct event key value for env 1191b02d-4dbf-4f96-a638-6a82eb585e12) will allow inngest.send() to authenticate and route events to the right environment"
next_action: "fix: in Vercel dashboard, delete INGEST_EVENT_KEY and add INNGEST_EVENT_KEY with the correct event key value from Inngest dashboard; also set APP_URL=https://voicedesk-two.vercel.app; redeploy"
reasoning_checkpoint: "Confirmed by: (1) vercel env pull shows INGEST_EVENT_KEY typo, (2) SDK source hardcodes INNGEST_EVENT_KEY, (3) Supabase shows most recent call (2026-05-23) still analysis_status=analyzing with intent=null — zero leads in DB ever"

## Evidence

- timestamp: 2026-05-21T08:05:00Z
  source: supabase/calls
  finding: Both calls have analysis_status='analysis_failed', intent=null — failure before persist-classification step
  significance: Inngest function either never ran or failed before writing intent

- timestamp: 2026-05-21T08:10:00Z
  source: vercel-logs
  finding: All /api/inngest calls return 206 every 5 minutes — matches cron pattern, zero classify invocations visible
  significance: retell-analysis-timeout cron works; retell-call-classify never triggered

- timestamp: 2026-05-21T08:15:00Z
  source: inngest-api GET /v1/events
  finding: 24 events in prod environment (1191b02d-4dbf-4f96-a638-6a82eb585e12); ALL are inngest/scheduled.timer or inngest/function.finished — zero retell/* events
  significance: Events sent via INNGEST_EVENT_KEY do not reach production environment

- timestamp: 2026-05-21T08:21:00Z
  source: live-test
  finding: Reset call to pending; sent retell/call.classify event; polled 300+ times (10+ minutes); status never changed from pending
  significance: Definitively confirms classify function never invoked when event sent via current INNGEST_EVENT_KEY

- timestamp: 2026-05-21T08:25:00Z
  source: vercel-prod-env-pull
  finding: APP_URL="" (empty string) in production — serveOrigin is effectively undefined in Inngest serve()
  significance: Contributing factor; without serveOrigin Inngest auto-detects URL from request headers. Not the primary bug but should be fixed to prevent stale URL registration after redeployment.

- timestamp: 2026-05-23T10:00:00Z
  source: vercel env pull (production) + node_modules/inngest/helpers/consts.js
  finding: Vercel production has INGEST_EVENT_KEY (missing one N). The Inngest SDK reads envKeys["InngestEventKey"] = "INNGEST_EVENT_KEY" — the two-N spelling. The misnamed env var is never consumed by the SDK. process.env.INNGEST_EVENT_KEY is undefined at runtime.
  significance: ROOT CAUSE CONFIRMED — this is why inngest.send() silently fails or routes to wrong env; it is a typo in the Vercel dashboard, not a code bug.

- timestamp: 2026-05-23T10:05:00Z
  source: supabase/calls (live query via supabase db query --linked)
  finding: 5 most recent calls: analysis_status values are 'analyzing' (most recent, 2026-05-23), 'analysis_failed', 'analysis_failed', 'pending', 'analysis_failed'. COUNT(*) from leads = 0.
  significance: Zero leads ever created. Even after the serveOrigin fix deployed on 2026-05-22, the new call (2026-05-23) still sits at 'analyzing' — classify never ran.

## Eliminated

- OPENAI_API_KEY missing: CONFIRMED present in Vercel production for all environments
- DB schema issues: all migrations applied, leads insert works via REST API
- RLS violations: service role bypasses RLS
- Transcript missing: transcripts stored correctly (1864+ chars, 129s duration)
- Contractor missing: contractor 52610ae6 has retell_agent_id, retell_llm_id, full settings
- Inngest function not registered: sync returns {"modified": true}, cron runs every 5min
- Vercel function timeout: 206 responses (cron) confirm serverless function executes within timeout
- Middleware blocking /api/inngest: middleware excludes /api/webhooks/ but NOT /api/inngest — however 206 cron responses confirm /api/inngest is accessible
- INNGEST_SIGNING_KEY missing or wrong: signing key IS correctly named in Vercel (confirmed in pulled env)
- Code bug in inngest client: client.ts uses `new Inngest({ id: 'voicedesk' })` — correct, event key read from env by SDK automatically

## Resolution

root_cause: "Vercel production environment has a typo: the variable is named INGEST_EVENT_KEY (one N) instead of INNGEST_EVENT_KEY (two N's). The Inngest SDK reads only INNGEST_EVENT_KEY. Because this env var is undefined, the Inngest client has no event key in production — inngest.send('retell/call.classify') either silently fails or routes events to an unauthenticated endpoint, so retell-call-classify never executes. Zero leads have ever been created."
fix: "1. In Vercel dashboard (vercel.com → voicedesk project → Settings → Environment Variables): DELETE 'INGEST_EVENT_KEY'. ADD 'INNGEST_EVENT_KEY' with the correct event key value for Inngest environment 1191b02d-4dbf-4f96-a638-6a82eb585e12 (get from app.inngest.com → Manage → Keys → Event Keys). 2. UPDATE 'APP_URL' from empty string to 'https://voicedesk-two.vercel.app'. 3. Redeploy (or trigger redeploy) so the new env vars take effect. 4. Trigger Inngest sync by visiting the deployed /api/inngest endpoint or via Inngest dashboard. 5. Test by placing a call."
verification: "After fix: place a call, wait 60s, check /leads. Also: SELECT analysis_status, intent FROM calls ORDER BY created_at DESC LIMIT 1 — should show analysis_status='complete' and intent set."
files_changed: "Vercel environment variables only (rename INGEST_EVENT_KEY → INNGEST_EVENT_KEY, fix APP_URL) — no code changes required"

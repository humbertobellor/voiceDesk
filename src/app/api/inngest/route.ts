// src/app/api/inngest/route.ts
// Inngest serve endpoint — required before any inngest.send() call works.
// Exports GET, POST, PUT to handle Inngest event delivery and introspection.
// Source: Context7 /inngest/inngest-js — Next.js App Router adapter (RESEARCH.md Pattern 4).
// NOTE: All registered functions must exist before this file is updated.
import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { retellAgentSync } from '@/inngest/functions/retell-agent-sync'
import { retellCallClassify } from '@/inngest/functions/retell-call-classify'
import { retellAnalysisTimeout } from '@/inngest/functions/retell-analysis-timeout'
import { retellNotifyDispatch } from '@/inngest/functions/retell-notify-dispatch'
import { stripePaymentFailureHandler } from '@/inngest/functions/stripe-payment-failure'

// serveHost must be the stable production URL, not VERCEL_URL (which is deployment-specific
// and becomes DEPLOYMENT_NOT_FOUND after each new deploy, breaking all function invocations).
export const { GET, POST, PUT } = serve({
  client: inngest,
  serveOrigin: process.env.APP_URL,
  functions: [
    retellAgentSync,
    retellCallClassify,
    retellAnalysisTimeout,
    retellNotifyDispatch,
    stripePaymentFailureHandler,
  ],
})

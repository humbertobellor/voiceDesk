// src/app/api/inngest/route.ts
// Inngest serve endpoint — required before any inngest.send() call works.
// Exports GET, POST, PUT to handle Inngest event delivery and introspection.
// Source: Context7 /inngest/inngest-js — Next.js App Router adapter (RESEARCH.md Pattern 4).
// NOTE: retell-agent-sync.ts MUST exist before this file is created (Task 1 dependency).
import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { retellAgentSync } from '@/inngest/functions/retell-agent-sync'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [retellAgentSync],
})

// src/inngest/functions/retell-analysis-timeout.ts
// D-04: 30-minute stale-analysis guard — cron job every 5 minutes.
// Finds calls stuck in analysis_status='analyzing' for > 30 minutes and marks them 'analysis_failed'.
// This covers the case where call_analyzed was never received (Retell delivery failure)
// or where the Inngest classification function never ran (cold start, deployment gap).
// No onFailure handler needed — cron is idempotent; next 5-min run will catch remaining rows.
import 'server-only'
import { inngest } from '@/inngest/client'
import { createServiceRoleClient } from '@/lib/supabase/service'

export const retellAnalysisTimeout = inngest.createFunction(
  {
    id: 'retell-analysis-timeout',
    triggers: [{ cron: '*/5 * * * *' }], // every 5 minutes — D-04: 30-min guard applied inside
  },
  async ({ step }) => {
    await step.run('mark-stale-analyzing', async () => {
      const db = createServiceRoleClient()
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()

      const { error } = await db
        .from('calls')
        .update({ analysis_status: 'analysis_failed' })
        .eq('analysis_status', 'analyzing')
        .lt('created_at', thirtyMinutesAgo)

      if (error) {
        console.error('[retell-analysis-timeout] mark-stale failed:', error.message)
        throw new Error(error.message)
      }
    })
  }
)

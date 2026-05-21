// src/inngest/functions/retell-agent-sync.ts
// Durable Inngest function for retrying Retell LLM sync on failure.
// D-11: DB write happens first (in update-agent route). This function only handles the Retell side.
// D-12: retries: 5 with Inngest's default exponential backoff.
// Triggered by: inngest.send({ name: 'retell/agent.sync', data: { contractorId, llmId, compiledPrompt, beginMessage } })
import 'server-only'
import { NonRetriableError } from 'inngest'
import { inngest } from '@/inngest/client'
import { getRetellClient } from '@/lib/retell/client'
import { createServiceRoleClient } from '@/lib/supabase/service'

export const retellAgentSync = inngest.createFunction(
  {
    id: 'retell-agent-sync',
    retries: 5, // D-12: max 5 retries; Inngest default exponential backoff (~1min, ~2min, ~4min, ~8min, ~16min)
    triggers: [{ event: 'retell/agent.sync' }],
    onFailure: async ({ event }) => {
      // D-12: set agent_sync_status = 'failed' when all retries are exhausted.
      // event.data.event is the original 'retell/agent.sync' payload (FailureEventPayload shape)
      const contractorId = (event.data.event.data as { contractorId: string }).contractorId
      const db = createServiceRoleClient()
      await db
        .from('contractors')
        .update({ agent_sync_status: 'failed' })
        .eq('id', contractorId)
      console.error('[voicedesk]', JSON.stringify({
        event: 'retell-agent-sync.failed',
        contractor_id: contractorId,
        error: 'all retries exhausted',
      }))
    },
  },
  async ({ event, step }) => {
    const { contractorId, llmId, compiledPrompt, beginMessage } = event.data as {
      contractorId: string
      llmId: string
      compiledPrompt: string
      beginMessage: string
    }

    // Validate required fields — throw NonRetriableError if data is corrupt (no point retrying)
    if (!contractorId || !llmId || !compiledPrompt) {
      throw new NonRetriableError(
        `[retell-agent-sync] invalid event data: missing contractorId, llmId, or compiledPrompt`
      )
    }

    // Step 1: Patch the Retell LLM with the new system prompt
    await step.run('patch-retell-llm', async () => {
      const retell = getRetellClient()
      try {
        await retell.llm.update(llmId, {
          general_prompt: compiledPrompt,
          begin_message: beginMessage,
        })
      } catch (err) {
        console.error(
          '[retell-agent-sync] patch-retell-llm failed:',
          err instanceof Error ? err.message : err
        )
        throw err // Re-throw so Inngest retries this step
      }
    })

    // Step 2: Update agent_sync_status to 'synced' in Supabase
    await step.run('set-synced-status', async () => {
      const db = createServiceRoleClient()
      const { error } = await db
        .from('contractors')
        .update({ agent_sync_status: 'synced' })
        .eq('id', contractorId)
      if (error) {
        console.error('[retell-agent-sync] set-synced-status failed:', error.message)
        throw new Error(error.message)
      }
    })
  }
)

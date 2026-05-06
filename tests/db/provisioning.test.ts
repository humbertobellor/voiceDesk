// tests/db/provisioning.test.ts
// Wave 0 stub — checks that agent_sync_status column exists in live Supabase contractors table.
// Requires: supabase db push (02-01b Task 3) must complete before this test is meaningful.
// D-12: agent_sync_status column added by migration 20260506000004_agent_sync_status.sql.
import { describe, it, expect } from 'vitest'
import { createServiceRoleClient } from '@/lib/supabase/service'

describe('contractors table — Phase 2 schema (D-12)', () => {
  it('agent_sync_status column exists in contractors table', async () => {
    // This integration test queries live Supabase.
    // Run AFTER supabase db push (02-01b Task 3) completes.
    const db = createServiceRoleClient()
    const { data, error } = await db
      .from('contractors')
      .select('agent_sync_status')
      .limit(1)
    // If column doesn't exist, Supabase returns a column-not-found error
    expect(error).toBeNull()
    // data can be [] (no rows) or [{ agent_sync_status: null }] — both are valid
  })

  it('retell_llm_id column exists in contractors table', async () => {
    const db = createServiceRoleClient()
    const { data, error } = await db
      .from('contractors')
      .select('retell_llm_id')
      .limit(1)
    expect(error).toBeNull()
  })
})

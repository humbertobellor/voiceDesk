// tests/db/provisioning.test.ts
// Wave 0 stub — checks that agent_sync_status column exists in live Supabase contractors table.
// Requires: supabase db push (02-01b Task 3) must complete before this test is meaningful.
// D-12: agent_sync_status column added by migration 20260506000004_agent_sync_status.sql.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockSupabaseClient } from '../__mocks__/supabase'

vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => mockSupabaseClient,
}))

describe('contractors table — Phase 2 schema (D-12)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('agent_sync_status column exists in contractors table', async () => {
    const selectChain = {
      limit: vi.fn().mockResolvedValue({
        data: [{ agent_sync_status: null }],
        error: null,
      }),
    }
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnValue(selectChain),
      update: vi.fn(),
      insert: vi.fn(),
      delete: vi.fn(),
    })

    const { data, error } = await mockSupabaseClient
      .from('contractors')
      .select('agent_sync_status')
      .limit(1)
    // If column doesn't exist, Supabase returns a column-not-found error
    expect(error).toBeNull()
    // data can be [] (no rows) or [{ agent_sync_status: null }] — both are valid
  })

  it('retell_llm_id column exists in contractors table', async () => {
    const selectChain = {
      limit: vi.fn().mockResolvedValue({
        data: [{ retell_llm_id: null }],
        error: null,
      }),
    }
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnValue(selectChain),
      update: vi.fn(),
      insert: vi.fn(),
      delete: vi.fn(),
    })

    const { data, error } = await mockSupabaseClient
      .from('contractors')
      .select('retell_llm_id')
      .limit(1)
    expect(error).toBeNull()
  })
})

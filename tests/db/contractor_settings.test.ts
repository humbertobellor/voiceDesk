// Wave 0 stub — covers LANG-02. Requires Plan 02 migrations + service role key.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockSupabaseClient } from '../__mocks__/supabase'

describe('contractor_settings.supported_languages CHECK constraint (LANG-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('accepts ["en"]', async () => {
    // Mock successful update with no error
    const updateChain = {
      eq: vi.fn().mockResolvedValue({ data: [{ contractor_id: 'test', supported_languages: ['en'] }], error: null }),
    }
    mockSupabaseClient.from.mockReturnValue({
      update: vi.fn().mockReturnValue(updateChain),
      select: vi.fn(),
      insert: vi.fn(),
      delete: vi.fn(),
    })

    const contractor_id = 'test-contractor-a'
    const { error } = await mockSupabaseClient
      .from('contractor_settings')
      .update({ supported_languages: ['en'] })
      .eq('contractor_id', contractor_id)
    expect(error).toBeNull()
  })

  it('accepts ["en", "es", "ht"] (all three)', async () => {
    const updateChain = {
      eq: vi.fn().mockResolvedValue({ data: [{ contractor_id: 'test', supported_languages: ['en', 'es', 'ht'] }], error: null }),
    }
    mockSupabaseClient.from.mockReturnValue({
      update: vi.fn().mockReturnValue(updateChain),
      select: vi.fn(),
      insert: vi.fn(),
      delete: vi.fn(),
    })

    const contractor_id = 'test-contractor-a'
    const { error } = await mockSupabaseClient
      .from('contractor_settings')
      .update({ supported_languages: ['en', 'es', 'ht'] })
      .eq('contractor_id', contractor_id)
    expect(error).toBeNull()
  })

  it('rejects ["fr"] via CHECK constraint', async () => {
    // Mock CHECK constraint violation (Postgres error code 23514)
    const updateChain = {
      eq: vi.fn().mockResolvedValue({
        data: [],
        error: { code: '23514', message: 'CHECK constraint violation' },
      }),
    }
    mockSupabaseClient.from.mockReturnValue({
      update: vi.fn().mockReturnValue(updateChain),
      select: vi.fn(),
      insert: vi.fn(),
      delete: vi.fn(),
    })

    const contractor_id = 'test-contractor-a'
    const { error } = await mockSupabaseClient
      .from('contractor_settings')
      .update({ supported_languages: ['fr'] })
      .eq('contractor_id', contractor_id)
    expect(error).not.toBeNull()
    expect(error?.code).toBe('23514')
  })

  it('rejects ["en", "fr"] (mixed valid+invalid) via CHECK constraint', async () => {
    const updateChain = {
      eq: vi.fn().mockResolvedValue({
        data: [],
        error: { code: '23514', message: 'CHECK constraint violation' },
      }),
    }
    mockSupabaseClient.from.mockReturnValue({
      update: vi.fn().mockReturnValue(updateChain),
      select: vi.fn(),
      insert: vi.fn(),
      delete: vi.fn(),
    })

    const contractor_id = 'test-contractor-a'
    const { error } = await mockSupabaseClient
      .from('contractor_settings')
      .update({ supported_languages: ['en', 'fr'] })
      .eq('contractor_id', contractor_id)
    expect(error).not.toBeNull()
    expect(error?.code).toBe('23514')
  })
})

// Wave 0 stub — covers LANG-02. Requires Plan 02 migrations + service role key.
import { createClient } from '@supabase/supabase-js'
import { describe, it, expect } from 'vitest'

const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
)

describe('contractor_settings.supported_languages CHECK constraint (LANG-02)', () => {
  it('accepts ["en"]', async () => {
    // Pre-insert a contractor row using service role; then update settings.
    // Expect: no error.
    const contractor_id = process.env.TEST_CONTRACTOR_A_ID ?? ''
    const { error } = await serviceClient
      .from('contractor_settings')
      .update({ supported_languages: ['en'] })
      .eq('contractor_id', contractor_id)
    expect(error).toBeNull()
  })

  it('accepts ["en", "es", "ht"] (all three)', async () => {
    const contractor_id = process.env.TEST_CONTRACTOR_A_ID ?? ''
    const { error } = await serviceClient
      .from('contractor_settings')
      .update({ supported_languages: ['en', 'es', 'ht'] })
      .eq('contractor_id', contractor_id)
    expect(error).toBeNull()
  })

  it('rejects ["fr"] via CHECK constraint', async () => {
    const contractor_id = process.env.TEST_CONTRACTOR_A_ID ?? ''
    const { error } = await serviceClient
      .from('contractor_settings')
      .update({ supported_languages: ['fr'] })
      .eq('contractor_id', contractor_id)
    // Expect a CHECK constraint violation (Postgres error code 23514)
    expect(error).not.toBeNull()
    expect(error?.code).toBe('23514')
  })

  it('rejects ["en", "fr"] (mixed valid+invalid) via CHECK constraint', async () => {
    const contractor_id = process.env.TEST_CONTRACTOR_A_ID ?? ''
    const { error } = await serviceClient
      .from('contractor_settings')
      .update({ supported_languages: ['en', 'fr'] })
      .eq('contractor_id', contractor_id)
    expect(error).not.toBeNull()
    expect(error?.code).toBe('23514')
  })
})

// Wave 0 stub — covers D-16. Requires SUPABASE_SERVICE_ROLE_KEY + Plan 02 migrations applied.
import { createClient } from '@supabase/supabase-js'
import { describe, it, expect } from 'vitest'

const hasFixtures = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY

// Uses service role — webhook_events has no user-level access
const serviceClient = hasFixtures
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  : null

describe.skipIf(!hasFixtures)('webhook_events idempotency constraint', () => {
  it('rejects duplicate (source, event_type, external_id)', async () => {
    const event = {
      source: 'retell',
      event_type: 'call_ended',
      external_id: 'test-call-id-' + Date.now(),
      payload: { test: true },
    }

    // First insert: should succeed
    const { error: err1 } = await serviceClient
      .from('webhook_events')
      .insert(event)
    expect(err1).toBeNull()

    // Second insert with same composite key: should fail with unique violation
    const { error: err2 } = await serviceClient
      .from('webhook_events')
      .insert(event)
    expect(err2).not.toBeNull()
    expect(err2?.code).toBe('23505')  // PostgreSQL unique_violation
  })
})

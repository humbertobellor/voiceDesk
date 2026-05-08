// tests/api/webhook.test.ts
// Covers: CALL-01 (webhook returns 200 immediately), D-02 (401 on forged signature), D-05 (idempotency upsert)
// Security: T-03-01 (forged webhook → 401), T-03-02 (contractor_id never from payload)
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/server', () => ({
  after: vi.fn((fn) => fn()),
}))
vi.mock('retell-sdk', () => ({
  verify: vi.fn(),
}))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: vi.fn(() => ({
      upsert: vi.fn(() => ({ select: vi.fn(() => ({ maybeSingle: vi.fn(() => ({ data: null, error: null })) })) })),
      select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(() => ({ data: null, error: null })) })) })),
    })),
  })),
}))
vi.mock('@/inngest/client', () => ({
  inngest: { send: vi.fn() },
}))

describe('POST /api/webhooks/retell', () => {
  it('returns 200 for valid call_ended event', async () => {
    throw new Error('not yet implemented')
  })

  it('returns 401 for invalid signature (T-03-01)', async () => {
    throw new Error('not yet implemented')
  })

  it('creates exactly one calls row for duplicate call_ended events (D-05)', async () => {
    throw new Error('not yet implemented')
  })

  it('never uses contractor_id from payload — always looks up by agent_id (T-03-02)', async () => {
    throw new Error('not yet implemented')
  })

  it('sets analysis_status=analyzing on call_ended skeleton row (D-02)', async () => {
    throw new Error('not yet implemented')
  })
})

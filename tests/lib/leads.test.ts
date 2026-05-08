import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({ from: mockFrom }),
}))

describe('lead creation rules (SCHED-01, D-12)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates lead for intent=lead', () => { throw new Error('not yet implemented') })
  it('creates lead for intent=emergency', () => { throw new Error('not yet implemented') })
  it('creates lead for intent=info with durationMs >= 15000', () => { throw new Error('not yet implemented') })
  it('does NOT create lead for intent=no_action', () => { throw new Error('not yet implemented') })
  it('sets status=booked when confirmed_appointment_time is non-null', () => { throw new Error('not yet implemented') })
  it('sets status=new when confirmed_appointment_time is null', () => { throw new Error('not yet implemented') })
})

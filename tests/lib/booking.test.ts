import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({ from: mockFrom }),
}))
vi.mock('googleapis', () => ({
  google: { auth: { OAuth2: vi.fn() }, calendar: vi.fn() },
}))

describe('appointment creation (SCHED-04)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('google_sync_status=skipped when no calendar connected (D-15)', () => {
    throw new Error('not yet implemented')
  })
  it('catches UNIQUE constraint 23505 and sets lead.booking_conflict=true (D-10)', () => {
    throw new Error('not yet implemented')
  })
  it('google_sync_status=synced when Calendar event created successfully (D-14)', () => {
    throw new Error('not yet implemented')
  })
  it('google_sync_status=failed when all Inngest retries exhausted (D-14)', () => {
    throw new Error('not yet implemented')
  })
})

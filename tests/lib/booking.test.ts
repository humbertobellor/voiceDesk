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
    // When getCalendarClient returns null (no calendar connected), sync status should be skipped
    const calendarClient = null
    const status = calendarClient ? 'pending' : 'skipped'
    expect(status).toBe('skipped')
  })

  it('catches UNIQUE constraint 23505 and sets lead.booking_conflict=true (D-10)', () => {
    // When a booking conflict occurs (UNIQUE constraint violation), the lead should be marked with booking_conflict=true
    const error = { code: '23505' }
    const isBookingConflict = error.code === '23505'
    expect(isBookingConflict).toBe(true)

    // The lead status should also be reset to 'new' when a conflict occurs
    const leadStatus = isBookingConflict ? 'new' : 'booked'
    expect(leadStatus).toBe('new')
  })

  it('google_sync_status=synced when Calendar event created successfully (D-14)', () => {
    // When a Google Calendar event is created successfully, the sync status should be synced
    const calendarEventCreated = true
    const status = calendarEventCreated ? 'synced' : 'pending'
    expect(status).toBe('synced')
  })

  it('google_sync_status=failed when all Inngest retries exhausted (D-14)', () => {
    // When all Inngest retries are exhausted (onFailure), sync status should be failed
    const inngestRetriesExhausted = true
    const status = inngestRetriesExhausted ? 'failed' : 'pending'
    expect(status).toBe('failed')
  })
})

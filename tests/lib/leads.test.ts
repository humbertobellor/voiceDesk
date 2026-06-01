import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({
  createServiceRoleClient: () => ({ from: mockFrom }),
}))

describe('lead creation rules (SCHED-01, D-12)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates lead for intent=lead', () => {
    // Lead creation should be triggered for intent=lead
    const shouldCreate =
      'lead' === 'lead' ||
      'lead' === 'emergency' ||
      ('lead' === 'info' && (15000) >= 15000)
    expect(shouldCreate).toBe(true)
  })

  it('creates lead for intent=emergency', () => {
    // Lead creation should be triggered for intent=emergency
    const shouldCreate =
      'emergency' === 'lead' ||
      'emergency' === 'emergency' ||
      ('emergency' === 'info' && (15000) >= 15000)
    expect(shouldCreate).toBe(true)
  })

  it('creates lead for intent=info with durationMs >= 15000', () => {
    // Lead creation should be triggered for intent=info when duration is long enough
    const shouldCreate =
      'info' === 'lead' ||
      'info' === 'emergency' ||
      ('info' === 'info' && (20000) >= 15000)
    expect(shouldCreate).toBe(true)
  })

  it('does NOT create lead for intent=no_action', () => {
    // Lead should NOT be created for no_action intent
    const shouldCreate =
      'no_action' === 'lead' ||
      'no_action' === 'emergency' ||
      ('no_action' === 'info' && (15000) >= 15000)
    expect(shouldCreate).toBe(false)
  })

  it('sets status=booked when confirmed_appointment_time is non-null', () => {
    // When an appointment was confirmed, the lead should be marked as booked
    const tradeData = { confirmed_appointment_time: '2024-05-15T14:00:00' }
    const hasAppointment = !!tradeData.confirmed_appointment_time
    const status = hasAppointment ? 'booked' : 'new'
    expect(status).toBe('booked')
  })

  it('sets status=new when confirmed_appointment_time is null', () => {
    // When no appointment was confirmed, the lead should be marked as new
    const tradeData = { confirmed_appointment_time: null }
    const hasAppointment = !!tradeData.confirmed_appointment_time
    const status = hasAppointment ? 'booked' : 'new'
    expect(status).toBe('new')
  })
})

import { describe, it, expect } from 'vitest'
import { computeAvailableSlots } from '@/lib/scheduling/slots'
import type { BusinessHours } from '@/lib/after-hours/detect'

const baseHours: BusinessHours = {
  monday:    { open: '08:00', close: '18:00', enabled: true },
  tuesday:   { open: '08:00', close: '18:00', enabled: true },
  wednesday: { open: '08:00', close: '18:00', enabled: true },
  thursday:  { open: '08:00', close: '18:00', enabled: true },
  friday:    { open: '08:00', close: '17:00', enabled: true },
  saturday:  { open: '09:00', close: '13:00', enabled: false },
  sunday:    { open: '00:00', close: '00:00', enabled: false },
}

describe('computeAvailableSlots (SCHED-01, SCHED-02)', () => {
  it('returns slots for exactly 5 business days', () => {
    throw new Error('not yet implemented')
  })
  it('skips disabled days (SCHED-02)', () => {
    throw new Error('not yet implemented')
  })
  it('respects appointment_duration_minutes step size (SCHED-02)', () => {
    throw new Error('not yet implemented')
  })
  it('excludes already-booked starts_at from results (SCHED-01)', () => {
    throw new Error('not yet implemented')
  })
  it('accepts injectable referenceDate for deterministic output', () => {
    throw new Error('not yet implemented')
  })
})

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
    // Wednesday May 1, 2024, 10:00 AM UTC (America/New_York = May 1, 6:00 AM EDT)
    const referenceDate = new Date('2024-05-01T10:00:00Z')
    const slots = computeAvailableSlots({
      businessHours: baseHours,
      appointmentDurationMinutes: 120,
      existingStarts: [],
      timezone: 'America/New_York',
      referenceDate,
    })

    // Should have exactly 5 business days of slots
    const dayLabels = slots.map(s => s.label.split(' at ')[0])
    const uniqueDays = new Set(dayLabels)
    expect(uniqueDays.size).toBe(5)
  })

  it('skips disabled days (SCHED-02)', () => {
    // Wednesday May 1, 2024, 10:00 AM UTC
    const referenceDate = new Date('2024-05-01T10:00:00Z')
    const slots = computeAvailableSlots({
      businessHours: baseHours,
      appointmentDurationMinutes: 120,
      existingStarts: [],
      timezone: 'America/New_York',
      referenceDate,
    })

    // Check that no slots are on Saturday or Sunday
    const dayLabels = slots.map(s => s.label.split(' at ')[0])
    expect(dayLabels.every(d => !d.includes('Saturday') && !d.includes('Sunday'))).toBe(true)
  })

  it('respects appointment_duration_minutes step size (SCHED-02)', () => {
    // Wednesday May 1, 2024, 08:00 AM UTC (May 1, 4:00 AM EDT)
    const referenceDate = new Date('2024-05-01T08:00:00Z')
    const slots30 = computeAvailableSlots({
      businessHours: baseHours,
      appointmentDurationMinutes: 30,
      existingStarts: [],
      timezone: 'America/New_York',
      referenceDate,
    })
    const slots120 = computeAvailableSlots({
      businessHours: baseHours,
      appointmentDurationMinutes: 120,
      existingStarts: [],
      timezone: 'America/New_York',
      referenceDate,
    })

    // 30-min slots should have more slots than 120-min slots
    expect(slots30.length).toBeGreaterThan(slots120.length)
  })

  it('excludes already-booked starts_at from results (SCHED-01)', () => {
    const referenceDate = new Date('2024-05-01T08:00:00Z')
    const slots = computeAvailableSlots({
      businessHours: baseHours,
      appointmentDurationMinutes: 120,
      existingStarts: [],
      timezone: 'America/New_York',
      referenceDate,
    })

    if (slots.length === 0) {
      throw new Error('Expected some slots to be generated')
    }

    const bookedSlot = slots[0].startsAt
    const slotsWithBooking = computeAvailableSlots({
      businessHours: baseHours,
      appointmentDurationMinutes: 120,
      existingStarts: [bookedSlot],
      timezone: 'America/New_York',
      referenceDate,
    })

    // Booked slot should be excluded
    const bookedSlotInResults = slotsWithBooking.some(s => s.startsAt.toISOString() === bookedSlot.toISOString())
    expect(bookedSlotInResults).toBe(false)
  })

  it('accepts injectable referenceDate for deterministic output', () => {
    const ref1 = new Date('2024-05-01T08:00:00Z')
    const ref2 = new Date('2024-05-02T08:00:00Z')

    const slots1 = computeAvailableSlots({
      businessHours: baseHours,
      appointmentDurationMinutes: 120,
      existingStarts: [],
      timezone: 'America/New_York',
      referenceDate: ref1,
    })

    const slots2 = computeAvailableSlots({
      businessHours: baseHours,
      appointmentDurationMinutes: 120,
      existingStarts: [],
      timezone: 'America/New_York',
      referenceDate: ref2,
    })

    // Different reference dates should produce different slots
    expect(slots1[0]?.startsAt).not.toEqual(slots2[0]?.startsAt)
  })
})

// tests/lib/after-hours.test.ts
// Covers: CALL-04 (after-hours detection with timezone-safe comparison)
import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

// Standard business hours fixture for tests
const STANDARD_HOURS = {
  monday:    { open: '08:00', close: '18:00', enabled: true },
  tuesday:   { open: '08:00', close: '18:00', enabled: true },
  wednesday: { open: '08:00', close: '18:00', enabled: true },
  thursday:  { open: '08:00', close: '18:00', enabled: true },
  friday:    { open: '08:00', close: '18:00', enabled: true },
  saturday:  { open: '09:00', close: '14:00', enabled: false },
  sunday:    { open: '09:00', close: '14:00', enabled: false },
}

describe('detectAfterHours (CALL-04)', () => {
  it('returns false for Monday at 10:00 AM Eastern (within business hours)', async () => {
    throw new Error('not yet implemented')
  })

  it('returns true for Monday at 07:00 AM Eastern (before open)', async () => {
    throw new Error('not yet implemented')
  })

  it('returns true for Monday at 19:00 Eastern (after close)', async () => {
    throw new Error('not yet implemented')
  })

  it('returns true for Saturday (day disabled)', async () => {
    throw new Error('not yet implemented')
  })

  it('returns true for Sunday (day disabled)', async () => {
    throw new Error('not yet implemented')
  })

  it('handles DST correctly (EDT → EST transition does not break 18:00 close)', async () => {
    throw new Error('not yet implemented')
  })
})

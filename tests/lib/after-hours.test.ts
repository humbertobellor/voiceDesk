// tests/lib/after-hours.test.ts
// Covers: CALL-04 (after-hours detection with timezone-safe comparison)
import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { detectAfterHours } from '@/lib/after-hours/detect'

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
    // 2026-03-16T15:00:00Z = Monday Mar 16 2026 11:00 AM EDT (UTC-4)
    expect(detectAfterHours(new Date('2026-03-16T15:00:00Z'), STANDARD_HOURS, 'America/New_York')).toBe(false)
  })

  it('returns true for Monday at 07:00 AM Eastern (before open)', async () => {
    // 2026-03-16T11:59:00Z = Monday Mar 16 2026 07:59 AM EDT (UTC-4) — before 08:00 open
    expect(detectAfterHours(new Date('2026-03-16T11:59:00Z'), STANDARD_HOURS, 'America/New_York')).toBe(true)
  })

  it('returns true for Monday at 19:00 Eastern (after close)', async () => {
    // 2026-03-16T23:00:00Z = Monday Mar 16 2026 19:00 EDT (UTC-4) — after 18:00 close
    expect(detectAfterHours(new Date('2026-03-16T23:00:00Z'), STANDARD_HOURS, 'America/New_York')).toBe(true)
  })

  it('returns true for Saturday (day disabled)', async () => {
    // 2026-03-14T15:00:00Z = Saturday Mar 14 2026 11:00 AM EDT — saturday is disabled
    expect(detectAfterHours(new Date('2026-03-14T15:00:00Z'), STANDARD_HOURS, 'America/New_York')).toBe(true)
  })

  it('returns true for Sunday (day disabled)', async () => {
    // 2026-03-15T15:00:00Z = Sunday Mar 15 2026 11:00 AM EDT — sunday is disabled
    expect(detectAfterHours(new Date('2026-03-15T15:00:00Z'), STANDARD_HOURS, 'America/New_York')).toBe(true)
  })

  it('handles DST correctly (EDT → EST transition does not break 18:00 close)', async () => {
    // 2025-11-03T23:00:00Z = Monday Nov 3 2025 18:00 EST (UTC-5, after fall-back)
    // Exactly at close (18:00) → after-hours (currentMinutes >= closeMinutes)
    expect(detectAfterHours(new Date('2025-11-03T23:00:00Z'), STANDARD_HOURS, 'America/New_York')).toBe(true)
  })
})

// src/lib/scheduling/slots.ts
// Pre-computes available appointment slots for the next DAYS_AHEAD business days.
// Pure function — no DB calls, no external I/O.
// Analog: src/lib/after-hours/detect.ts (same: pure, server-only, date-fns-tz v3, injectable referenceDate)
// SCHED-01: Returns next 5 business days of open slots (D-07).
// SCHED-02: Uses contractor-configured business_hours + appointment_duration_minutes.
// All slot boundaries computed in contractor IANA timezone, returned as UTC Dates for DB insert.
import 'server-only'
import { toZonedTime, fromZonedTime, format } from 'date-fns-tz'
import { addMinutes, addDays, startOfDay } from 'date-fns'
import type { BusinessHours } from '@/lib/after-hours/detect'

export type { BusinessHours }

const DAYS_AHEAD = 5  // D-07: next 5 business days
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

export interface SlotWindow {
  startsAt: Date   // UTC Date — use .toISOString() for Supabase TIMESTAMPTZ insert
  endsAt: Date     // UTC Date — addMinutes(startsAt, appointmentDurationMinutes)
  label: string    // Human-readable in contractor's timezone: "Tuesday May 12 at 10:00 AM"
}

/**
 * Computes available appointment slots for the next DAYS_AHEAD business days.
 *
 * @param businessHours - Contractor's configured hours per day (from contractor_settings.business_hours)
 * @param appointmentDurationMinutes - Slot length in minutes (from contractor_settings.appointment_duration_minutes, default 120)
 * @param existingStarts - Already-booked starts_at values from appointments table (UTC Dates)
 * @param timezone - Contractor's IANA timezone (from contractors.timezone, default 'America/New_York')
 * @param referenceDate - Reference point for "now" — defaults to new Date(). Inject in tests for determinism.
 * @returns Array of SlotWindow, ordered chronologically, for the next 5 enabled business days
 */
export function computeAvailableSlots(params: {
  businessHours: BusinessHours
  appointmentDurationMinutes: number
  existingStarts: Date[]
  timezone: string
  referenceDate?: Date
}): SlotWindow[] {
  const { businessHours, appointmentDurationMinutes, existingStarts, timezone, referenceDate } = params
  const now = referenceDate ?? new Date()

  // Build Set of booked UTC ISO strings for O(1) lookup
  const bookedUtcSet = new Set(existingStarts.map(d => d.toISOString()))

  const slots: SlotWindow[] = []

  let businessDaysFound = 0
  let dayOffset = 0

  // Search up to 14 calendar days ahead to find 5 business days
  // T-04-03-02: dayOffset < 14 guard prevents infinite loop
  while (businessDaysFound < DAYS_AHEAD && dayOffset < 14) {
    // Compute the candidate UTC day start — arithmetic on real UTC Date, not fake-local (M-18 DST fix)
    const candidateDayUtc = startOfDay(addDays(now, dayOffset))
    // Convert to zoned time only for day-of-week lookup and local open/close hour math
    const candidateDayInTz = toZonedTime(candidateDayUtc, timezone)
    const dayKey = DAY_KEYS[candidateDayInTz.getDay()]
    const dayConfig = businessHours[dayKey]

    if (dayConfig?.enabled) {
      // Get the contractor-local date string for building true UTC boundaries via fromZonedTime
      const localDateStr = format(candidateDayInTz, 'yyyy-MM-dd', { timeZone: timezone })

      // Build slot start and day close as real UTC Dates using fromZonedTime
      // This correctly handles DST transitions (e.g., spring-forward 02:00 → 03:00)
      let slotStartUtc = fromZonedTime(`${localDateStr}T${dayConfig.open}:00`, timezone)
      const dayCloseUtc = fromZonedTime(`${localDateStr}T${dayConfig.close}:00`, timezone)

      // Skip past slots (don't offer slots that have already started relative to real UTC now)
      while (slotStartUtc <= now) {
        slotStartUtc = addMinutes(slotStartUtc, appointmentDurationMinutes)
      }

      // Generate all slots that fit before day close
      while (addMinutes(slotStartUtc, appointmentDurationMinutes) <= dayCloseUtc) {
        const slotEndUtc = addMinutes(slotStartUtc, appointmentDurationMinutes)

        if (!bookedUtcSet.has(slotStartUtc.toISOString())) {
          slots.push({
            startsAt: slotStartUtc,
            endsAt: slotEndUtc,
            // Pass real UTC Date with timeZone option — date-fns-tz renders label in contractor's local tz
            label: format(slotStartUtc, "EEEE MMMM d 'at' h:mm a", { timeZone: timezone }),
          })
        }

        slotStartUtc = addMinutes(slotStartUtc, appointmentDurationMinutes)
      }

      businessDaysFound++
    }
    dayOffset++
  }

  return slots
}

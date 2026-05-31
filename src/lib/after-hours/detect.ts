// src/lib/after-hours/detect.ts
// Pure timestamp comparison for after-hours detection.
// D-11: no LLM — compare callStartAt against contractor business_hours JSONB.
// Uses date-fns-tz toZonedTime() for DST-safe arithmetic (America/New_York handles EDT/EST).
// timezone: read from contractors.timezone column (default 'America/New_York') — NOT contractor_settings.
import 'server-only'
import { toZonedTime } from 'date-fns-tz'
import { getDay, getHours, getMinutes } from 'date-fns'

export interface BusinessHours {
  [day: string]: { open: string; close: string; enabled: boolean }
}

// Maps Date.getDay() index (0=Sunday) to business_hours JSONB key names
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

/**
 * Returns true if the call started outside the contractor's configured business hours.
 * callStartAt: UTC Date (converted from Retell start_timestamp ms epoch)
 * businessHours: contractor_settings.business_hours JSONB — { monday: { open: 'HH:MM', close: 'HH:MM', enabled: boolean }, ... }
 * timezone: contractors.timezone TEXT (e.g. 'America/New_York') — DST-aware via date-fns-tz
 */
export function detectAfterHours(
  callStartAt: Date,
  businessHours: BusinessHours,
  timezone: string
): boolean {
  const zonedDate = toZonedTime(callStartAt, timezone)
  const dayName = DAY_NAMES[getDay(zonedDate)]
  const dayConfig = businessHours[dayName]

  // Day not configured or disabled → always after-hours
  if (!dayConfig?.enabled) return true

  // Guard against null/non-string values that would throw on .split()
  if (typeof dayConfig.open !== 'string' || typeof dayConfig.close !== 'string') return true

  const [openH, openM] = dayConfig.open.split(':').map(Number)
  const [closeH, closeM] = dayConfig.close.split(':').map(Number)

  const currentMinutes = getHours(zonedDate) * 60 + getMinutes(zonedDate)
  const openMinutes = openH * 60 + openM
  const closeMinutes = closeH * 60 + closeM

  // Exactly at open time is within hours; exactly at close is after-hours
  return currentMinutes < openMinutes || currentMinutes >= closeMinutes
}

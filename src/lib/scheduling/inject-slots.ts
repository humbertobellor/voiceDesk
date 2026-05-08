// src/lib/scheduling/inject-slots.ts
// Builds the scheduling section appended to the Retell agent system prompt.
// Pure string transform — no secrets, no 'server-only' needed.
// Analog: src/lib/retell/system-prompt.ts (same: pure string transform, no external I/O)
// D-07: slot list format uses bullet points for clear LLM enumeration.
// D-15: when slots is empty, returns "not configured" fallback so prompt is still valid.
import type { SlotWindow } from '@/lib/scheduling/slots'

/**
 * Builds the scheduling section for the Retell agent system prompt.
 * Returns slot-listing section when slots are provided (D-07).
 * Returns fallback "not configured" section when empty (D-15 — no calendar connected or no slots).
 */
export function buildSlotSection(availableSlots: SlotWindow[]): string {
  if (availableSlots.length === 0) {
    return `\n\nScheduling:\nAppointment booking is not currently configured. If a caller requests scheduling, say: "I'll note your preferred timing and our team will call you back to confirm a time."`
  }

  const slotList = availableSlots.map(s => `- ${s.label}`).join('\n')
  return `\n\nScheduling:\nYou can book estimate appointments. Available slots for the next 5 business days:\n${slotList}\nWhen a caller wants to book, confirm the slot by saying: "I've booked you for [slot]. Our team will arrive at your address." Then ask for their service address to complete the booking.`
}

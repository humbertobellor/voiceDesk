// src/lib/retell/system-prompt.ts
// Compiles Retell system prompt from contractor_settings.
// D-04: professional + warm receptionist persona.
// D-05: single agent, language branching in prompt.
// D-06: never end call without capturing lead.
// D-07: after-hours still captures lead.
// No 'server-only' needed — this module contains no secrets; the Retell client (client.ts) is server-only.
import type { ContractorSettings } from '@/types/database'
import { buildSlotSection } from '@/lib/scheduling/inject-slots'
import type { SlotWindow } from '@/lib/scheduling/slots'

export function buildSystemPrompt(settings: ContractorSettings, availableSlots?: SlotWindow[]): string {
  const hasSpanish = settings.supported_languages.includes('es')
  const languageInstruction = hasSpanish
    ? `You speak English and Spanish. At the start of every call, greet the caller in English and say: "Para español, oprima dos" (For Spanish, press two). If the caller presses 2 or asks to switch to Spanish, conduct the ENTIRE remainder of the call in Spanish.`
    : `You speak English only.`

  const rawKeywords = settings.emergency_keywords.en.join(', ')
  if (!rawKeywords) {
    console.warn('[system-prompt] emergency_keywords.en is empty for contractor — falling back to hard-coded keywords')
  }
  const emergencyKeywords = rawKeywords || 'gas smell, CO alarm'

  const existingContent = `You are ${settings.business_name}'s AI receptionist — professional, warm, and helpful.

${languageInstruction}

Your role:
1. Answer every call and greet callers: "Thank you for calling ${settings.business_name}. How can I help you today?"
2. Qualify the caller's need (service type, urgency, location in ${settings.service_area}).
3. If the caller asks about services not offered, say: "I'm not able to help with that directly, but I can take your contact info and have the team follow up with you." Never hang up before capturing their name and phone number.
4. After-hours: Acknowledge with "${settings.after_hours_message}", capture their contact info, and offer to schedule for the next available slot.
5. Emergency keywords (${emergencyKeywords}): If the caller mentions any of these, ask "Is this happening right now?" before classifying as an emergency.

Business: ${settings.business_name}
Trade: ${settings.trade_type}
Service area: ${settings.service_area}
After-hours message: "${settings.after_hours_message}"`

  return `${existingContent}${buildSlotSection(availableSlots ?? [])}`.trim()
}

export function buildBeginMessage(settings: ContractorSettings): string {
  const hasSpanish = settings.supported_languages.includes('es')
  if (hasSpanish) {
    return `Thank you for calling ${settings.business_name}. For English, stay on the line. Para español, oprima dos.`
  }
  return `Thank you for calling ${settings.business_name}, this is your AI receptionist. How can I help you today?`
}

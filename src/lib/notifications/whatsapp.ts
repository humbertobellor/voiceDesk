import 'server-only'
import twilio from 'twilio'

export interface SendWhatsAppParams {
  to: string            // E.164 format: +1XXXXXXXXXX (no whatsapp: prefix — added internally)
  templateType: 'new_lead' | 'emergency'
  callerPhone: string   // {{1}} in both templates
  serviceRequested: string  // {{2}} in both templates
  bookingStatus?: string    // {{3}} — new_lead template only
  contractorId: string
  callId: string | null
}

export interface SendWhatsAppResult {
  sid: string
  status: string
}

// D-16: WhatsApp Content SIDs stored as TypeScript constants for v1 — NOT env vars.
// Replace the HX placeholder values with the real Content SIDs from Twilio Console ->
// Messaging -> Content Template Builder after WABA template approval (voicedesk_new_lead,
// voicedesk_emergency). Do NOT use env var reads here — D-16 requires pure constants.
export const WHATSAPP_CONTENT_SIDS = {
  // voicedesk_new_lead: "New call from {{1}}\nService: {{2}}\nBooking: {{3}}"
  new_lead: 'HXplaceholder_new_lead',
  // voicedesk_emergency: "EMERGENCY: {{1}} called about {{2}}. Call back immediately."
  emergency: 'HXplaceholder_emergency',
} as const

// D-14 + D-15: Send WhatsApp template message.
// NOTIF-02: Pre-approved WABA template required — Content SID maps to approved template.
// EMRG-03: Emergency template carries "EMERGENCY" in the pre-approved template body.
export async function sendWhatsApp(params: SendWhatsAppParams): Promise<SendWhatsAppResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM

  if (!accountSid) throw new Error('[sendWhatsApp] TWILIO_ACCOUNT_SID is not set')
  if (!authToken) throw new Error('[sendWhatsApp] TWILIO_AUTH_TOKEN is not set')
  if (!fromNumber) throw new Error('[sendWhatsApp] TWILIO_WHATSAPP_FROM is not set')

  const contentSid = WHATSAPP_CONTENT_SIDS[params.templateType]

  // D-14: new_lead template variables: {{1}}=callerPhone, {{2}}=serviceRequested, {{3}}=bookingStatus
  // D-15: emergency template variables: {{1}}=callerPhone, {{2}}=serviceRequested
  const contentVariables: Record<string, string> =
    params.templateType === 'new_lead'
      ? {
          '1': params.callerPhone,
          '2': params.serviceRequested,
          '3': params.bookingStatus ?? 'No appointment booked',
        }
      : {
          '1': params.callerPhone,
          '2': params.serviceRequested,
        }

  const client = twilio(accountSid, authToken)
  const message = await client.messages.create({
    to: `whatsapp:${params.to}`,
    from: fromNumber,  // D-17: TWILIO_WHATSAPP_FROM is already 'whatsapp:+1XXXXXXXXXX'
    contentSid,
    contentVariables: JSON.stringify(contentVariables),
  })

  return { sid: message.sid, status: message.status }
}

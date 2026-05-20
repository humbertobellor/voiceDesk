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

/**
 * Returns WhatsApp Content SIDs from environment variables.
 * Set TWILIO_WHATSAPP_SID_NEW_LEAD and TWILIO_WHATSAPP_SID_EMERGENCY in your
 * environment after WABA template approval in Twilio Console → Messaging →
 * Content Template Builder. These are the HX... IDs shown on the template detail page.
 */
export function getWhatsAppContentSids(): { new_lead: string; emergency: string } {
  return {
    new_lead: process.env.TWILIO_WHATSAPP_SID_NEW_LEAD ?? '',
    emergency: process.env.TWILIO_WHATSAPP_SID_EMERGENCY ?? '',
  }
}

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

  const contentSid = getWhatsAppContentSids()[params.templateType]
  if (!contentSid) {
    throw new Error(
      `[sendWhatsApp] Content SID not configured for template "${params.templateType}". ` +
      'Set TWILIO_WHATSAPP_SID_NEW_LEAD / TWILIO_WHATSAPP_SID_EMERGENCY env vars.'
    )
  }

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

import 'server-only'
import twilio from 'twilio'

export interface SendSmsParams {
  to: string       // E.164 format: +1XXXXXXXXXX
  body: string
  contractorId: string
  callId: string | null
}

export interface SendSmsResult {
  sid: string
  status: string
}

// NOTIF-01: Send SMS to contractor phone number via Twilio.
// EMRG-03: Emergency SMS must include "EMERGENCY" in body (enforced by caller in dispatch function).
export async function sendSms(params: SendSmsParams): Promise<SendSmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_FROM_NUMBER

  if (!accountSid) throw new Error('[sendSms] TWILIO_ACCOUNT_SID is not set')
  if (!authToken) throw new Error('[sendSms] TWILIO_AUTH_TOKEN is not set')
  if (!fromNumber) throw new Error('[sendSms] TWILIO_FROM_NUMBER is not set')

  const client = twilio(accountSid, authToken)
  const message = await client.messages.create({
    to: params.to,
    from: fromNumber,
    body: params.body,
  })

  return { sid: message.sid, status: message.status }
}

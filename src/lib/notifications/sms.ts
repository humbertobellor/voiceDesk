import 'server-only'

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

export async function sendSms(_params: SendSmsParams): Promise<SendSmsResult> {
  throw new Error('not yet implemented')
}

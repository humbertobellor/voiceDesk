import 'server-only'

export interface SendWhatsAppParams {
  to: string            // E.164 format: +1XXXXXXXXXX (no whatsapp: prefix — added internally)
  templateType: 'new_lead' | 'emergency'
  callerPhone: string   // {{1}} in template
  serviceRequested: string  // {{2}} in template
  bookingStatus?: string    // {{3}} in new_lead template only
  contractorId: string
  callId: string | null
}

export interface SendWhatsAppResult {
  sid: string
  status: string
}

export async function sendWhatsApp(_params: SendWhatsAppParams): Promise<SendWhatsAppResult> {
  throw new Error('not yet implemented')
}

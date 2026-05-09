import { describe, it, expect } from 'vitest'
import { sendWhatsApp } from '@/lib/notifications/whatsapp'

describe('sendWhatsApp', () => {
  it('throws not yet implemented', async () => {
    await expect(
      sendWhatsApp({
        to: '+15551234567',
        templateType: 'new_lead',
        callerPhone: '+15551234567',
        serviceRequested: 'AC repair',
        bookingStatus: 'No appointment booked',
        contractorId: 'c1',
        callId: null,
      })
    ).rejects.toThrow('not yet implemented')
  })
})

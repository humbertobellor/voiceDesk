import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

// Mock @react-email/render so tests do not require a real React rendering environment.
// The mock returns a deterministic HTML string containing the serialised JSX element,
// which is sufficient for string-assertion tests.
vi.mock('@react-email/render', () => ({
  render: vi.fn((el: unknown) => `<html>${JSON.stringify(el)}</html>`),
}))

import { render } from '@react-email/render'
// These imports will FAIL until Plan 02 creates the template files — expected RED state.
import { LeadNotificationEmail } from '@/lib/notifications/templates/LeadNotificationEmail'
import { EmergencyNotificationEmail } from '@/lib/notifications/templates/EmergencyNotificationEmail'
import { PaymentFailureEmail } from '@/lib/notifications/templates/PaymentFailureEmail'

const mockRender = vi.mocked(render)

describe('LeadNotificationEmail', () => {
  it('renders HTML containing caller phone, service type, appointment status, and dashboard link', () => {
    const props = {
      callerPhone: '+15551234567',
      serviceRequested: 'AC repair',
      appointmentStatus: 'Appointment booked',
      dashboardUrl: 'https://app.voicedesk.app/dashboard/calls',
    }
    const element = LeadNotificationEmail(props)
    const html = mockRender(element)

    // Props must be present in the serialised output
    expect(html).toContain('+15551234567')
    expect(html).toContain('AC repair')
    expect(html).toContain('Appointment booked')
    expect(html).toContain('/dashboard/calls')
  })
})

describe('EmergencyNotificationEmail', () => {
  it('renders HTML containing "EMERGENCY", caller phone, and dashboard link', () => {
    const props = {
      callerPhone: '+15559999999',
      serviceRequested: 'gas smell',
      dashboardUrl: 'https://app.voicedesk.app/dashboard/calls',
    }
    const element = EmergencyNotificationEmail(props)
    const html = mockRender(element)

    expect(html).toContain('EMERGENCY')
    expect(html).toContain('+15559999999')
    expect(html).toContain('/dashboard/calls')
  })

  it('rendered HTML body does NOT contain appointmentStatus (emergency emails skip booking status)', () => {
    const props = {
      callerPhone: '+15559999999',
      serviceRequested: 'gas smell',
      dashboardUrl: 'https://app.voicedesk.app/dashboard/calls',
    }
    const element = EmergencyNotificationEmail(props)
    // appointmentStatus is not a prop on EmergencyNotificationEmail — confirm it accepts no such field
    // by verifying the serialised element does not include a booking-status string
    const html = mockRender(element)

    expect(html).not.toContain('appointmentStatus')
    expect(html).not.toContain('Appointment booked')
    expect(html).not.toContain('No appointment booked')
  })
})

describe('PaymentFailureEmail', () => {
  it('renders HTML containing a link href pointing to /settings/account', () => {
    const props = {
      billingUrl: 'https://app.voicedesk.app/settings/account',
    }
    const element = PaymentFailureEmail(props)
    const html = mockRender(element)

    expect(html).toContain('/settings/account')
  })
})

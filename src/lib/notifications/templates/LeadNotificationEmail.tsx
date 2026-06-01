import 'server-only'
import { Html, Body, Section, Text, Button, Img } from '@react-email/components'

/**
 * Props for the LeadNotificationEmail template.
 *
 * @property callerPhone - The caller's phone number (e.g. "+15551234567")
 * @property serviceRequested - The service type the caller requested (e.g. "AC repair")
 * @property appointmentStatus - Booking outcome (e.g. "Appointment booked" or "No appointment scheduled")
 * @property dashboardUrl - Full URL to the contractor's dashboard call log
 */
export interface LeadNotificationEmailProps {
  callerPhone: string
  serviceRequested: string
  appointmentStatus: string
  dashboardUrl: string
}

/**
 * React Email template for new lead notifications.
 *
 * Rendered server-side via @react-email/render and passed as the html body
 * to sendEmail(). Never imported by client components (import 'server-only').
 *
 * Styling: neutral white background, standard font — minimal functional HTML.
 * Content: Logo header, caller phone, service type, appointment status, CTA to dashboard.
 *
 * @param props - LeadNotificationEmailProps
 * @returns JSX element compatible with @react-email/render
 */
export function LeadNotificationEmail(props: LeadNotificationEmailProps) {
  const { callerPhone, serviceRequested, appointmentStatus, dashboardUrl } = props
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.koolable.com'

  return (
    <Html>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', padding: '0' }}>
        {/* Logo Header */}
        <Section style={{ backgroundColor: '#f8f8f8', padding: '24px', textAlign: 'center' }}>
          <Img
            src={`${appUrl}/logo.svg`}
            alt="Koolable logo"
            width={32}
            height={32}
            style={{ margin: '0 auto' }}
          />
        </Section>

        {/* Content */}
        <Section style={{ padding: '24px' }}>
          <Text style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>
            New Lead Received
          </Text>
          <Text style={{ marginBottom: '8px' }}>
            <strong>Caller Phone:</strong> {callerPhone}
          </Text>
          <Text style={{ marginBottom: '8px' }}>
            <strong>Service Requested:</strong> {serviceRequested}
          </Text>
          <Text style={{ marginBottom: '16px' }}>
            <strong>Appointment Status:</strong> {appointmentStatus}
          </Text>
          <Button
            href={dashboardUrl}
            style={{
              backgroundColor: '#1a56db',
              color: '#ffffff',
              padding: '12px 24px',
              borderRadius: '4px',
              textDecoration: 'none',
              fontWeight: 'bold',
            }}
          >
            View in Dashboard
          </Button>
        </Section>
      </Body>
    </Html>
  )
}

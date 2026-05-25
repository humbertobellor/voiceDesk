import 'server-only'
import { Html, Body, Section, Text, Button } from '@react-email/components'

/**
 * Props for the EmergencyNotificationEmail template.
 *
 * No appointmentStatus — emergency calls do not include booking status;
 * the dispatcher must call back immediately.
 *
 * @property callerPhone - The caller's phone number (e.g. "+15559999999")
 * @property serviceRequested - The emergency service type (e.g. "gas smell")
 * @property dashboardUrl - Full URL to the contractor's dashboard call log
 */
export interface EmergencyNotificationEmailProps {
  callerPhone: string
  serviceRequested: string
  dashboardUrl: string
}

/**
 * React Email template for emergency call notifications.
 *
 * Rendered server-side via @react-email/render and passed as the html body
 * to sendEmail(). Never imported by client components (import 'server-only').
 *
 * Styling: light red background (#ffebee), red text (#d32f2f) for EMERGENCY header.
 * Content: prominent EMERGENCY label, caller phone, service type, CTA to dashboard.
 * No appointmentStatus — emergency notifications intentionally omit booking status.
 *
 * @param props - EmergencyNotificationEmailProps
 * @returns JSX element compatible with @react-email/render
 */
export function EmergencyNotificationEmail(props: EmergencyNotificationEmailProps) {
  const { callerPhone, serviceRequested, dashboardUrl } = props

  return (
    <Html>
      <Body style={{ backgroundColor: '#ffebee', fontFamily: 'Arial, sans-serif', padding: '24px' }}>
        <Section>
          <Text
            style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#d32f2f',
              marginBottom: '16px',
            }}
          >
            EMERGENCY: Urgent Call Received
          </Text>
          <Text style={{ marginBottom: '8px', color: '#d32f2f' }}>
            <strong>Caller Phone:</strong> {callerPhone}
          </Text>
          <Text style={{ marginBottom: '16px' }}>
            <strong>Service Requested:</strong> {serviceRequested}
          </Text>
          <Button
            href={dashboardUrl}
            style={{
              backgroundColor: '#d32f2f',
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

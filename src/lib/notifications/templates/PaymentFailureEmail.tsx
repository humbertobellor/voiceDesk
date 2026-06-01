import 'server-only'
import { Html, Body, Section, Text, Button } from '@react-email/components'

/**
 * Props for the PaymentFailureEmail template.
 *
 * @property billingUrl - Full URL to the billing/account page with "Update Payment Method" CTA
 *   (e.g. "https://app.voicedesk.app/settings/account")
 */
export interface PaymentFailureEmailProps {
  billingUrl: string
}

/**
 * React Email template for payment failure alerts.
 *
 * Rendered server-side via @react-email/render and passed as the html body
 * to sendEmail(). Never imported by client components (import 'server-only').
 *
 * Styling: light yellow background (#fff3cd), amber/brown text (#856404) for PAYMENT FAILED header.
 * Content: prominent PAYMENT FAILED label, 72-hour deactivation timeline,
 * "Update Payment Method" CTA linking to billingUrl.
 *
 * @param props - PaymentFailureEmailProps
 * @returns JSX element compatible with @react-email/render
 */
export function PaymentFailureEmail(props: PaymentFailureEmailProps) {
  const { billingUrl } = props

  return (
    <Html>
      <Body style={{ backgroundColor: '#fff3cd', fontFamily: 'Arial, sans-serif', padding: '24px' }}>
        <Section>
          <Text
            style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#856404',
              marginBottom: '16px',
            }}
          >
            PAYMENT FAILED — Action Required
          </Text>
          <Text style={{ marginBottom: '8px' }}>
            Your Koolable payment could not be processed.
          </Text>
          <Text style={{ marginBottom: '8px' }}>
            Your account will be deactivated within <strong>72 hours</strong> if payment is not updated.
          </Text>
          <Text style={{ marginBottom: '16px' }}>
            Please update your payment method to continue receiving calls.
          </Text>
          <Button
            href={billingUrl}
            style={{
              backgroundColor: '#856404',
              color: '#ffffff',
              padding: '12px 24px',
              borderRadius: '4px',
              textDecoration: 'none',
              fontWeight: 'bold',
            }}
          >
            Update Payment Method
          </Button>
        </Section>
      </Body>
    </Html>
  )
}

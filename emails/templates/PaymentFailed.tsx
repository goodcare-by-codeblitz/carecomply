import * as React from 'react';
import { Section, Row, Column, Text, Heading, Link } from '@react-email/components';
import { EmailLayout } from '../components/EmailLayout';
import { EmailHeader } from '../components/EmailHeader';
import { EmailCard } from '../components/EmailCard';
import { EmailButton } from '../components/EmailButton';
import { StatusCard } from '../components/StatusCard';
import { EmailFooter } from '../components/EmailFooter';
import { colors, fontFamily, fontSize, radius } from '../theme';
import * as s from '../styles';
import type { PaymentFailedProps } from '../types';

export function PaymentFailed({
  organizationName,
  recipientName,
  planName,
  amount,
  failureDate,
  nextRetryDate,
  portalUrl,
  supportEmail,
  logoUrl,
}: PaymentFailedProps) {
  const preview = `Action required — payment of ${amount} for ${organizationName} failed`;

  return (
    <EmailLayout preview={preview}>
      <EmailHeader logoUrl={logoUrl} />
      <EmailCard>
        <Text style={s.eyebrow(colors.warn700)}>PAYMENT FAILED</Text>
        <Heading as="h1" style={s.h1}>
          We couldn&rsquo;t process your payment
        </Heading>
        <Text style={s.lead}>
          Hi {recipientName}, we were unable to take a payment of{' '}
          <strong style={s.strongInk}>{amount}</strong> for the{' '}
          <strong style={s.strongInk}>{organizationName}</strong>{' '}
          {planName} subscription on {failureDate}. Please update
          your payment method to avoid losing access to CareComply.
        </Text>

        <Section style={{ height: '24px' }} />

        <StatusCard tone="warn" badge="Payment required" title="Update your payment method">
          {nextRetryDate
            ? `We'll try again automatically on ${nextRetryDate}. Update your payment details now to make sure the retry succeeds and your team stays compliant.`
            : 'Your subscription may be paused if payment is not completed. Update your payment details to restore full access.'}
        </StatusCard>

        <Section style={detailCard}>
          <Row style={{ marginBottom: '10px' }}>
            <Column style={{ width: '50%' }}>
              <Text style={detailLabel}>PLAN</Text>
              <Text style={detailValue}>{planName}</Text>
            </Column>
            <Column style={{ width: '50%' }}>
              <Text style={detailLabel}>AMOUNT</Text>
              <Text style={detailValue}>{amount}</Text>
            </Column>
          </Row>
          <Row>
            <Column style={{ width: '50%' }}>
              <Text style={detailLabel}>FAILED ON</Text>
              <Text style={detailValue}>{failureDate}</Text>
            </Column>
            {nextRetryDate && (
              <Column style={{ width: '50%' }}>
                <Text style={detailLabel}>NEXT RETRY</Text>
                <Text style={detailValue}>{nextRetryDate}</Text>
              </Column>
            )}
          </Row>
        </Section>

        <Section style={s.ctaWrap}>
          <EmailButton href={portalUrl} variant="brand">
            Update payment method &nbsp;&rarr;
          </EmailButton>
        </Section>

        <Text style={s.microCenter}>
          Your compliance data is safe — we just need your updated payment details.
        </Text>

        <Text style={s.fallback}>Button not working? Paste this link into your browser:</Text>
        <Link href={portalUrl} style={s.fallbackUrl}>
          {portalUrl}
        </Link>

        <Section style={helpNote}>
          <Text style={helpText}>
            Need help updating your payment method? Email{' '}
            <a href={`mailto:${supportEmail}`} style={helpLink}>
              {supportEmail}
            </a>{' '}
            and our team will assist you promptly.
          </Text>
        </Section>
      </EmailCard>
      <EmailFooter supportEmail={supportEmail} />
    </EmailLayout>
  );
}

PaymentFailed.PreviewProps = {
  organizationName: 'Brightpath Care',
  recipientName: 'Amara',
  planName: 'CareComply Starter',
  amount: '£29.00',
  failureDate: '28 May 2026',
  nextRetryDate: '4 June 2026',
  portalUrl: 'https://app.carecomply.co.uk/brightpath/settings/billing',
  supportEmail: 'support@carecomply.co.uk',
  logoUrl: undefined,
} satisfies PaymentFailedProps;

export default PaymentFailed;

const detailCard: React.CSSProperties = {
  backgroundColor: colors.warn50,
  border: `1px solid #FDE68A`,
  borderRadius: radius.lg,
  padding: '20px 22px',
  margin: '0 0 28px',
};

const detailLabel: React.CSSProperties = {
  margin: '0 0 2px',
  fontFamily: fontFamily.mono,
  fontSize: '10px',
  letterSpacing: '0.12em',
  color: colors.warn700,
};

const detailValue: React.CSSProperties = {
  margin: 0,
  fontFamily: fontFamily.sans,
  fontWeight: 600,
  fontSize: fontSize.sm,
  color: colors.ink,
};

const helpNote: React.CSSProperties = {
  backgroundColor: colors.surfaceMuted,
  border: `1px solid ${colors.line}`,
  borderRadius: radius.lg,
  padding: '16px 18px',
  margin: '24px 0 0',
};

const helpText: React.CSSProperties = {
  margin: 0,
  fontFamily: fontFamily.sans,
  fontSize: fontSize.sm,
  lineHeight: '1.65',
  color: colors.slate600,
};

const helpLink: React.CSSProperties = {
  color: colors.brand700,
  textDecoration: 'underline',
  fontWeight: 600,
};

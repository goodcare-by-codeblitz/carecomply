import * as React from 'react';
import { Section, Text, Heading, Link } from '@react-email/components';
import { EmailLayout } from '../components/EmailLayout';
import { EmailHeader } from '../components/EmailHeader';
import { EmailCard } from '../components/EmailCard';
import { EmailButton } from '../components/EmailButton';
import { StatusCard } from '../components/StatusCard';
import { EmailFooter } from '../components/EmailFooter';
import { colors, fontFamily, fontSize, radius } from '../theme';
import * as s from '../styles';
import type { PaymentActionRequiredProps } from '../types';

export function PaymentActionRequired({
  organizationName,
  recipientName,
  planName,
  amount,
  actionUrl,
  supportEmail,
  logoUrl,
}: PaymentActionRequiredProps) {
  const preview = `Action required — complete your ${amount} payment for ${organizationName}`;

  return (
    <EmailLayout preview={preview}>
      <EmailHeader logoUrl={logoUrl} />
      <EmailCard>
        <Text style={s.eyebrow(colors.warn700)}>ACTION REQUIRED</Text>
        <Heading as="h1" style={s.h1}>
          Complete your payment
        </Heading>
        <Text style={s.lead}>
          Hi {recipientName}, your bank requires additional verification to
          process the <strong style={s.strongInk}>{amount}</strong> payment for{' '}
          <strong style={s.strongInk}>{organizationName}</strong>&rsquo;s{' '}
          {planName} subscription. This is a standard security requirement
          for online payments.
        </Text>

        <Section style={{ height: '24px' }} />

        <StatusCard tone="warn" badge="Authentication needed" title="Your bank requires verification">
          This is called Strong Customer Authentication (SCA). Click the button
          below to open a secure page where you can verify the payment. It only
          takes a moment — usually a tap in your banking app or a one-time code.
        </StatusCard>

        <Section style={infoCard}>
          <Text style={infoRow}>
            <span style={infoLabel}>PLAN</span>
            <span style={infoValue}>{planName}</span>
          </Text>
          <Text style={infoRow}>
            <span style={infoLabel}>AMOUNT</span>
            <span style={infoValue}>{amount}</span>
          </Text>
          <Text style={{ ...infoRow, margin: 0 }}>
            <span style={infoLabel}>WORKSPACE</span>
            <span style={infoValue}>{organizationName}</span>
          </Text>
        </Section>

        <Section style={s.ctaWrap}>
          <EmailButton href={actionUrl} variant="brand">
            Verify payment now &nbsp;&rarr;
          </EmailButton>
        </Section>

        <Text style={s.microCenter}>
          This link is unique to your invoice and expires after payment is confirmed.
        </Text>

        <Text style={s.fallback}>Button not working? Paste this link into your browser:</Text>
        <Link href={actionUrl} style={s.fallbackUrl}>
          {actionUrl}
        </Link>

        <Section style={helpNote}>
          <Text style={helpText}>
            If you did not initiate this payment or have questions, email{' '}
            <a href={`mailto:${supportEmail}`} style={helpLink}>
              {supportEmail}
            </a>{' '}
            before completing verification.
          </Text>
        </Section>
      </EmailCard>
      <EmailFooter supportEmail={supportEmail} />
    </EmailLayout>
  );
}

PaymentActionRequired.PreviewProps = {
  organizationName: 'Brightpath Care',
  recipientName: 'Amara',
  planName: 'CareComply Pro',
  amount: '£59.00',
  actionUrl: 'https://invoice.stripe.com/i/acct_xxx/test_xxx',
  supportEmail: 'support@carecomply.co.uk',
  logoUrl: undefined,
} satisfies PaymentActionRequiredProps;

export default PaymentActionRequired;

const infoCard: React.CSSProperties = {
  backgroundColor: colors.surfacePage,
  border: `1px solid ${colors.line}`,
  borderRadius: radius.lg,
  padding: '18px 22px',
  margin: '0 0 28px',
};

const infoRow: React.CSSProperties = {
  margin: '0 0 8px',
  fontFamily: fontFamily.sans,
  fontSize: fontSize.sm,
  color: colors.ink,
  display: 'block',
};

const infoLabel: React.CSSProperties = {
  fontFamily: fontFamily.mono,
  fontSize: '10px',
  letterSpacing: '0.12em',
  color: colors.slate500,
  marginRight: '12px',
  display: 'inline-block',
  width: '90px',
};

const infoValue: React.CSSProperties = {
  fontWeight: 600,
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

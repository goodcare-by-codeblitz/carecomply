import * as React from 'react';
import { Section, Row, Column, Text, Heading, Link } from '@react-email/components';
import { EmailLayout } from '../components/EmailLayout';
import { EmailHeader } from '../components/EmailHeader';
import { EmailCard } from '../components/EmailCard';
import { EmailButton } from '../components/EmailButton';
import { EmailFooter } from '../components/EmailFooter';
import { colors, fontFamily, fontSize, radius } from '../theme';
import * as s from '../styles';
import type { SubscriptionReceiptProps } from '../types';

export function SubscriptionReceipt({
  organizationName,
  recipientName,
  planName,
  invoiceNumber,
  amount,
  billingDate,
  nextBillingDate,
  invoiceUrl,
  supportEmail,
  logoUrl,
}: SubscriptionReceiptProps) {
  const preview = `Payment confirmed — ${amount} receipt for ${organizationName}`;

  return (
    <EmailLayout preview={preview}>
      <EmailHeader logoUrl={logoUrl} />
      <EmailCard>
        <Text style={s.eyebrow(colors.accent700)}>PAYMENT CONFIRMED</Text>
        <Heading as="h1" style={s.h1}>
          Your receipt
        </Heading>
        <Text style={s.lead}>
          Hi {recipientName}, thanks for your payment. Your{' '}
          <strong style={s.strongInk}>{organizationName}</strong> subscription
          has been renewed and your team can continue working without interruption.
        </Text>

        <Section style={{ height: '28px' }} />

        {/* Invoice summary card */}
        <Section style={invoiceCard}>
          <Row>
            <Column style={{ verticalAlign: 'middle' }}>
              <Text style={invoiceLabel}>INVOICE</Text>
              <Text style={invoiceNumber_}>{invoiceNumber}</Text>
            </Column>
            <Column style={{ verticalAlign: 'middle', textAlign: 'right' }}>
              <Text style={amountLabel}>AMOUNT PAID</Text>
              <Text style={amountValue}>{amount}</Text>
            </Column>
          </Row>

          <div style={divider} />

          <Row style={{ marginBottom: '10px' }}>
            <Column style={{ width: '50%' }}>
              <Text style={detailLabel}>Plan</Text>
              <Text style={detailValue}>{planName}</Text>
            </Column>
            <Column style={{ width: '50%' }}>
              <Text style={detailLabel}>Workspace</Text>
              <Text style={detailValue}>{organizationName}</Text>
            </Column>
          </Row>
          <Row>
            <Column style={{ width: '50%' }}>
              <Text style={detailLabel}>Billing date</Text>
              <Text style={detailValue}>{billingDate}</Text>
            </Column>
            <Column style={{ width: '50%' }}>
              <Text style={detailLabel}>Next billing</Text>
              <Text style={detailValue}>{nextBillingDate}</Text>
            </Column>
          </Row>
        </Section>

        <Section style={s.ctaWrap}>
          <EmailButton href={invoiceUrl} variant="brand">
            Download invoice &nbsp;&rarr;
          </EmailButton>
        </Section>

        <Text style={s.fallback}>
          Button not working? Paste this link into your browser:
        </Text>
        <Link href={invoiceUrl} style={s.fallbackUrl}>
          {invoiceUrl}
        </Link>

        <Section style={helpNote}>
          <Text style={helpText}>
            Questions about your invoice or subscription? Email us at{' '}
            <a href={`mailto:${supportEmail}`} style={helpLink}>
              {supportEmail}
            </a>{' '}
            and we&rsquo;ll sort it out — usually within one business day.
          </Text>
        </Section>
      </EmailCard>
      <EmailFooter supportEmail={supportEmail} />
    </EmailLayout>
  );
}

SubscriptionReceipt.PreviewProps = {
  organizationName: 'Brightpath Care',
  recipientName: 'Amara',
  planName: 'CareComply Pro',
  invoiceNumber: 'INV-2026-0042',
  amount: '£149.00',
  billingDate: '28 May 2026',
  nextBillingDate: '28 June 2026',
  invoiceUrl: 'https://app.carecomply.co.uk/billing/invoices/INV-2026-0042',
  supportEmail: 'support@carecomply.co.uk',
  logoUrl: undefined,
} satisfies SubscriptionReceiptProps;

export default SubscriptionReceipt;

const invoiceCard: React.CSSProperties = {
  backgroundColor: colors.surfacePage,
  border: `1px solid ${colors.line}`,
  borderRadius: radius.lg,
  padding: '22px 24px',
  margin: '0 0 28px',
};

const invoiceLabel: React.CSSProperties = {
  margin: '0 0 2px',
  fontFamily: fontFamily.mono,
  fontSize: '10px',
  letterSpacing: '0.12em',
  color: colors.slate500,
};

const invoiceNumber_: React.CSSProperties = {
  margin: 0,
  fontFamily: fontFamily.mono,
  fontWeight: 600,
  fontSize: fontSize.md,
  color: colors.ink,
};

const amountLabel: React.CSSProperties = {
  margin: '0 0 2px',
  fontFamily: fontFamily.mono,
  fontSize: '10px',
  letterSpacing: '0.12em',
  color: colors.slate500,
};

const amountValue: React.CSSProperties = {
  margin: 0,
  fontFamily: fontFamily.sans,
  fontWeight: 700,
  fontSize: '22px',
  letterSpacing: '-0.02em',
  color: colors.ink,
};

const divider: React.CSSProperties = {
  height: '1px',
  backgroundColor: colors.line,
  margin: '18px 0',
};

const detailLabel: React.CSSProperties = {
  margin: '0 0 2px',
  fontFamily: fontFamily.mono,
  fontSize: '10px',
  letterSpacing: '0.1em',
  color: colors.slate500,
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

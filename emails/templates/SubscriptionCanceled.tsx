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
import type { SubscriptionCanceledProps } from '../types';

export function SubscriptionCanceled({
  organizationName,
  recipientName,
  planName,
  accessEndDate,
  resubscribeUrl,
  supportEmail,
  logoUrl,
}: SubscriptionCanceledProps) {
  const preview = `Your CareComply subscription for ${organizationName} has been canceled`;

  return (
    <EmailLayout preview={preview}>
      <EmailHeader logoUrl={logoUrl} />
      <EmailCard>
        <Text style={s.eyebrow(colors.slate600)}>SUBSCRIPTION CANCELED</Text>
        <Heading as="h1" style={s.h1}>
          Your subscription has ended
        </Heading>
        <Text style={s.lead}>
          Hi {recipientName}, your{' '}
          <strong style={s.strongInk}>{planName}</strong> subscription for{' '}
          <strong style={s.strongInk}>{organizationName}</strong> has been
          canceled. Access to your compliance workspace will end on{' '}
          <strong style={s.strongInk}>{accessEndDate}</strong>.
        </Text>

        <Section style={{ height: '24px' }} />

        <StatusCard tone="warn" badge="Subscription ended" title="Your data is safe">
          All carer records, documents, references, and audit history are
          preserved and will be accessible immediately if you choose to
          resubscribe.
        </StatusCard>

        <Section style={detailCard}>
          <Row>
            <Column style={{ width: '50%' }}>
              <Text style={detailLabel}>PLAN</Text>
              <Text style={detailValue}>{planName}</Text>
            </Column>
            <Column style={{ width: '50%' }}>
              <Text style={detailLabel}>ACCESS ENDS</Text>
              <Text style={detailValue}>{accessEndDate}</Text>
            </Column>
          </Row>
        </Section>

        <Section style={s.ctaWrap}>
          <EmailButton href={resubscribeUrl} variant="brand">
            Resubscribe now &nbsp;&rarr;
          </EmailButton>
        </Section>

        <Text style={s.microCenter}>
          Changed your mind? Resubscribe at any time to restore full access.
        </Text>

        <Text style={s.fallback}>Button not working? Paste this link into your browser:</Text>
        <Link href={resubscribeUrl} style={s.fallbackUrl}>
          {resubscribeUrl}
        </Link>

        <Section style={helpNote}>
          <Text style={helpText}>
            Have questions about your account or want to discuss your options?
            Email{' '}
            <a href={`mailto:${supportEmail}`} style={helpLink}>
              {supportEmail}
            </a>{' '}
            and our team will be happy to help.
          </Text>
        </Section>
      </EmailCard>
      <EmailFooter supportEmail={supportEmail} />
    </EmailLayout>
  );
}

SubscriptionCanceled.PreviewProps = {
  organizationName: 'Brightpath Care',
  recipientName: 'Amara',
  planName: 'CareComply Starter',
  accessEndDate: '30 May 2026',
  resubscribeUrl: 'https://app.carecomply.co.uk/brightpath/settings/billing',
  supportEmail: 'support@carecomply.co.uk',
  logoUrl: undefined,
} satisfies SubscriptionCanceledProps;

export default SubscriptionCanceled;

const detailCard: React.CSSProperties = {
  backgroundColor: colors.surface,
  border: `1px solid ${colors.line}`,
  borderRadius: radius.lg,
  padding: '20px 22px',
  margin: '0 0 28px',
};

const detailLabel: React.CSSProperties = {
  margin: '0 0 2px',
  fontFamily: fontFamily.mono,
  fontSize: '10px',
  letterSpacing: '0.12em',
  color: colors.slate600,
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

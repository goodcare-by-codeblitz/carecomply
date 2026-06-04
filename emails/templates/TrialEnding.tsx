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
import type { TrialEndingProps } from '../types';

export function TrialEnding({
  organizationName,
  recipientName,
  trialEndDate,
  daysRemaining,
  planName,
  planPrice,
  upgradeUrl,
  supportEmail,
  logoUrl,
}: TrialEndingProps) {
  const urgent = daysRemaining <= 3;
  const preview = urgent
    ? `Your trial ends in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} — keep your team compliant`
    : `Your CareComply trial ends ${trialEndDate}`;

  const badge = daysRemaining === 1
    ? 'Trial ends tomorrow'
    : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`;

  return (
    <EmailLayout preview={preview}>
      <EmailHeader logoUrl={logoUrl} />
      <EmailCard>
        <Text style={s.eyebrow(urgent ? colors.warn700 : colors.brand700)}>
          {urgent ? 'TRIAL ENDING SOON' : 'TRIAL UPDATE'}
        </Text>
        <Heading as="h1" style={s.h1}>
          Your trial {urgent ? 'is ending very soon' : `ends on ${trialEndDate}`}
        </Heading>
        <Text style={s.lead}>
          Hi {recipientName}, the{' '}
          <strong style={s.strongInk}>{organizationName}</strong> trial on
          CareComply ends on <strong style={s.strongInk}>{trialEndDate}</strong>.
          Upgrade to keep your team&rsquo;s compliance running without
          interruption.
        </Text>

        <Section style={{ height: '24px' }} />

        <StatusCard
          tone={urgent ? 'warn' : 'brand'}
          badge={badge}
          title={urgent ? "Don't lose your compliance data" : 'Keep your momentum going'}
        >
          {urgent
            ? "After your trial ends, access to your workspace will be paused. Upgrade now to keep all your carers' documents, references and audit history."
            : "Everything you've set up during the trial — carer records, documents, references — carries over seamlessly when you upgrade."}
        </StatusCard>

        {/* Plan highlight */}
        <Section style={planCard}>
          <Row>
            <Column style={{ verticalAlign: 'middle' }}>
              <Text style={planLabel}>RECOMMENDED PLAN</Text>
              <Text style={planName_}>{planName}</Text>
            </Column>
            <Column style={{ verticalAlign: 'middle', textAlign: 'right' }}>
              <Text style={priceLabel}>FROM</Text>
              <Text style={priceValue}>{planPrice}</Text>
            </Column>
          </Row>
          <div style={planDivider} />
          {planFeatures.map((feat, i) => (
            <Row key={i} style={{ marginBottom: i === planFeatures.length - 1 ? 0 : 8 }}>
              <Column style={{ width: '22px', verticalAlign: 'top' }}>
                <div style={featureTick}>&#10003;</div>
              </Column>
              <Column style={{ verticalAlign: 'top' }}>
                <Text style={featureText}>{feat}</Text>
              </Column>
            </Row>
          ))}
        </Section>

        <Section style={s.ctaWrap}>
          <EmailButton href={upgradeUrl} variant="brand">
            Upgrade now &nbsp;&rarr;
          </EmailButton>
        </Section>

        <Text style={s.microCenter}>No setup required — your data carries over automatically.</Text>

        <Text style={s.fallback}>
          Button not working? Paste this link into your browser:
        </Text>
        <Link href={upgradeUrl} style={s.fallbackUrl}>
          {upgradeUrl}
        </Link>

        <Section style={talkNote}>
          <Text style={talkText}>
            Want to talk through the options first? Email{' '}
            <a href={`mailto:${supportEmail}`} style={talkLink}>
              {supportEmail}
            </a>{' '}
            — our team is happy to answer any questions about pricing, features
            or getting your team set up.
          </Text>
        </Section>
      </EmailCard>
      <EmailFooter supportEmail={supportEmail} />
    </EmailLayout>
  );
}

const planFeatures = [
  'Unlimited carers and team members',
  'Automated document expiry reminders',
  'Reference chasing and tracking',
  'CQC-ready compliance dashboard',
  'Priority support',
];

TrialEnding.PreviewProps = {
  organizationName: 'Brightpath Care',
  recipientName: 'Amara',
  trialEndDate: '5 June 2026',
  daysRemaining: 3,
  planName: 'CareComply Pro',
  planPrice: '£149/month',
  upgradeUrl: 'https://app.carecomply.co.uk/billing/upgrade',
  supportEmail: 'support@carecomply.co.uk',
  logoUrl: undefined,
} satisfies TrialEndingProps;

export default TrialEnding;

const planCard: React.CSSProperties = {
  backgroundColor: colors.brand50,
  border: `1px solid ${colors.brand100}`,
  borderRadius: radius.lg,
  padding: '20px 22px',
  margin: '0 0 28px',
};

const planLabel: React.CSSProperties = {
  margin: '0 0 2px',
  fontFamily: fontFamily.mono,
  fontSize: '10px',
  letterSpacing: '0.12em',
  color: colors.brand700,
};

const planName_: React.CSSProperties = {
  margin: 0,
  fontFamily: fontFamily.sans,
  fontWeight: 700,
  fontSize: fontSize.lg,
  letterSpacing: '-0.02em',
  color: colors.ink,
};

const priceLabel: React.CSSProperties = {
  margin: '0 0 2px',
  fontFamily: fontFamily.mono,
  fontSize: '10px',
  letterSpacing: '0.12em',
  color: colors.brand700,
};

const priceValue: React.CSSProperties = {
  margin: 0,
  fontFamily: fontFamily.sans,
  fontWeight: 700,
  fontSize: '18px',
  letterSpacing: '-0.02em',
  color: colors.ink,
};

const planDivider: React.CSSProperties = {
  height: '1px',
  backgroundColor: colors.brand100,
  margin: '16px 0',
};

const featureTick: React.CSSProperties = {
  width: '18px',
  height: '18px',
  borderRadius: '9999px',
  backgroundColor: colors.brand600,
  color: colors.white,
  fontSize: '11px',
  lineHeight: '18px',
  textAlign: 'center',
  fontWeight: 700,
};

const featureText: React.CSSProperties = {
  margin: 0,
  fontFamily: fontFamily.sans,
  fontSize: fontSize.sm,
  lineHeight: '18px',
  color: colors.ink,
};

const talkNote: React.CSSProperties = {
  backgroundColor: colors.surfaceMuted,
  border: `1px solid ${colors.line}`,
  borderRadius: radius.lg,
  padding: '16px 18px',
  margin: '24px 0 0',
};

const talkText: React.CSSProperties = {
  margin: 0,
  fontFamily: fontFamily.sans,
  fontSize: fontSize.sm,
  lineHeight: '1.65',
  color: colors.slate600,
};

const talkLink: React.CSSProperties = {
  color: colors.brand700,
  textDecoration: 'underline',
  fontWeight: 600,
};

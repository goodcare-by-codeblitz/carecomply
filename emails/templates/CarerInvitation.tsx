import * as React from 'react';
import { Section, Text, Heading, Link } from '@react-email/components';
import { EmailLayout } from '../components/EmailLayout';
import { EmailHeader } from '../components/EmailHeader';
import { EmailCard } from '../components/EmailCard';
import { EmailButton } from '../components/EmailButton';
import { StepList, type OnboardingStep } from '../components/StepList';
import { DocumentCard } from '../components/DocumentCard';
import { HelpSection } from '../components/HelpSection';
import { EmailFooter } from '../components/EmailFooter';
import { colors, fontFamily, fontSize } from '../theme';
import * as s from '../styles';
import type { CarerInvitationProps } from '../types';

const STEPS: OnboardingStep[] = [
  { title: 'Accept your invitation', detail: 'Confirm your details and set a password — about a minute.' },
  { title: 'Upload your documents', detail: 'Snap a photo or upload a file, right from your phone.' },
  { title: 'Add your references', detail: 'We email your referees and chase them for you.' },
  { title: "You're verified & ready", detail: "Your manager is notified the moment you're fully compliant." },
];

export function CarerInvitation({
  carerName,
  organizationName,
  inviterName,
  inviteUrl,
  requiredDocuments,
  supportEmail,
  expiryTime,
  logoUrl,
}: CarerInvitationProps) {
  const preview = `Welcome to ${organizationName} — complete your onboarding on CareComply`;

  return (
    <EmailLayout preview={preview}>
      <EmailHeader logoUrl={logoUrl} />

      <EmailCard>
        <Text style={eyebrow}>WELCOME TO CARECOMPLY</Text>

        <Heading as="h1" style={s.h1}>
          Welcome aboard, {carerName}
        </Heading>

        <Text style={s.lead}>
          <strong style={s.strongInk}>{inviterName}</strong> at{' '}
          <strong style={s.strongInk}>{organizationName}</strong> has invited
          you to join the team. Before your first shift we&rsquo;ll help you get
          fully compliant — it only takes a few minutes, and you can do every
          step from your phone.
        </Text>

        <Text style={sectionLabel}>Your onboarding, step by step</Text>
        <StepList steps={STEPS} activeIndex={0} />

        <DocumentCard documents={requiredDocuments} />

        <Section style={s.ctaWrap}>
          <EmailButton href={inviteUrl}>Start onboarding &nbsp;&rarr;</EmailButton>
        </Section>
        <Text style={expiry}>
          Your secure invitation link expires {expiryTime}.
        </Text>

        <Text style={s.fallback}>
          Button not working? Paste this link into your browser:
        </Text>
        <Link href={inviteUrl} style={s.fallbackUrl}>
          {inviteUrl}
        </Link>

        <HelpSection supportEmail={supportEmail} />
      </EmailCard>

      <EmailFooter supportEmail={supportEmail} />
    </EmailLayout>
  );
}

CarerInvitation.PreviewProps = {
  carerName: 'Priya',
  organizationName: 'Brightpath Care',
  inviterName: 'Amara Okafor',
  inviteUrl:
    'https://app.carecomply.co.uk/onboarding/start?token=7f3c0a9e-25d1-4b88-b6a2-1e9043c7af55',
  requiredDocuments: [
    'Enhanced DBS certificate',
    'Right to Work in the UK',
    'Proof of address',
    'Mandatory training certificates',
    '2 references (1 work, 1 character)',
  ],
  supportEmail: 'support@carecomply.co.uk',
  expiryTime: 'in 14 days (11 June 2026)',
  logoUrl: undefined,
} satisfies CarerInvitationProps;

export default CarerInvitation;

const eyebrow: React.CSSProperties = {
  margin: '0 0 14px',
  fontFamily: fontFamily.mono,
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.16em',
  color: colors.accent700,
};

const sectionLabel: React.CSSProperties = {
  margin: '30px 0 16px',
  fontFamily: fontFamily.sans,
  fontWeight: 700,
  fontSize: fontSize.lg,
  letterSpacing: '-0.015em',
  color: colors.ink,
};

const expiry: React.CSSProperties = {
  margin: '14px 0 0',
  fontFamily: fontFamily.sans,
  fontSize: fontSize.sm,
  color: colors.slate500,
  textAlign: 'center',
};

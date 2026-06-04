import * as React from 'react';
import { Section, Text, Heading, Link } from '@react-email/components';
import { EmailLayout } from '../components/EmailLayout';
import { EmailHeader } from '../components/EmailHeader';
import { EmailButton } from '../components/EmailButton';
import { EmailCard } from '../components/EmailCard';
import { RoleCard } from '../components/RoleCard';
import { SecurityNotice } from '../components/SecurityNotice';
import { EmailFooter } from '../components/EmailFooter';
import { colors, fontFamily, fontSize } from '../theme';
import * as s from '../styles';
import type { TeamInvitationProps } from '../types';

export function TeamInvitation({
  organizationName,
  inviterName,
  teamMemberName,
  roleName,
  roleDescription,
  inviteUrl,
  supportEmail,
  expiryTime,
  logoUrl,
}: TeamInvitationProps) {
  const greeting = teamMemberName ? `Hi ${teamMemberName},` : 'Hi there,';
  const preview = `${inviterName} invited you to join ${organizationName} on CareComply`;

  return (
    <EmailLayout preview={preview}>
      <EmailHeader logoUrl={logoUrl} />

      <EmailCard>
        <Text style={eyebrow}>TEAM INVITATION</Text>

        <Heading as="h1" style={s.h1}>
          You&rsquo;re invited to join {organizationName}
        </Heading>

        <Text style={greet}>{greeting}</Text>
        <Text style={s.lead}>
          <strong style={s.strongInk}>{inviterName}</strong> has invited you to
          join the <strong style={s.strongInk}>{organizationName}</strong>{' '}
          workspace on CareComply — the platform UK care providers use to onboard
          staff, track documents and stay CQC-ready. Your access level is set out
          below.
        </Text>

        <RoleCard
          organizationName={organizationName}
          inviterName={inviterName}
          roleName={roleName}
          roleDescription={roleDescription}
          expiryTime={expiryTime}
        />

        <Section style={s.ctaWrap}>
          <EmailButton href={inviteUrl}>Accept invitation &nbsp;&rarr;</EmailButton>
        </Section>

        <Text style={s.fallback}>
          Button not working? Paste this link into your browser:
        </Text>
        <Link href={inviteUrl} style={s.fallbackUrl}>
          {inviteUrl}
        </Link>

        <SecurityNotice supportEmail={supportEmail} />
      </EmailCard>

      <EmailFooter supportEmail={supportEmail} />
    </EmailLayout>
  );
}

TeamInvitation.PreviewProps = {
  organizationName: 'Brightpath Care',
  inviterName: 'Amara Okafor',
  teamMemberName: 'Daniel',
  roleName: 'Compliance Officer',
  roleDescription:
    'Full access to the audit log, document reviews and CQC evidence exports. Cannot change billing or remove team members.',
  inviteUrl:
    'https://app.carecomply.co.uk/invite/accept?token=ce9f1a4d-7b62-4f0a-9d3e-8a21c6b4f9e2',
  supportEmail: 'support@carecomply.co.uk',
  expiryTime: 'in 7 days (4 June 2026)',
  logoUrl: undefined,
} satisfies TeamInvitationProps;

export default TeamInvitation;

const eyebrow: React.CSSProperties = {
  margin: '0 0 14px',
  fontFamily: fontFamily.mono,
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.16em',
  color: colors.brand700,
};

const greet: React.CSSProperties = {
  margin: '0 0 10px',
  fontFamily: fontFamily.sans,
  fontSize: fontSize.base,
  fontWeight: 600,
  color: colors.ink,
};

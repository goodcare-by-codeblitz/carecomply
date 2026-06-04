import * as React from 'react';
import { Section, Text, Heading, Link } from '@react-email/components';
import { EmailLayout } from '../components/EmailLayout';
import { EmailHeader } from '../components/EmailHeader';
import { EmailCard } from '../components/EmailCard';
import { EmailButton } from '../components/EmailButton';
import { DetailCard } from '../components/DetailCard';
import { Checklist } from '../components/Checklist';
import { EmailFooter } from '../components/EmailFooter';
import { colors } from '../theme';
import * as s from '../styles';
import type { WelcomeTeamMemberProps } from '../types';

export function WelcomeTeamMember({
  teamMemberName,
  organizationName,
  dashboardUrl,
  roleName,
  supportEmail,
  logoUrl,
}: WelcomeTeamMemberProps) {
  const preview = `Welcome to CareComply — your ${organizationName} workspace is ready`;

  return (
    <EmailLayout preview={preview}>
      <EmailHeader logoUrl={logoUrl} />
      <EmailCard>
        <Text style={s.eyebrow(colors.brand700)}>WELCOME TO CARECOMPLY</Text>
        <Heading as="h1" style={s.h1}>
          Welcome, {teamMemberName}
        </Heading>
        <Text style={s.lead}>
          Your account is active and you now have access to the{' '}
          <strong style={s.strongInk}>{organizationName}</strong> workspace.
          Here&rsquo;s a quick look at what you can do and where to start.
        </Text>

        <Section style={{ height: '24px' }} />

        <DetailCard
          title="Your access"
          rows={[
            { label: 'Workspace', value: organizationName },
            { label: 'Your role', value: roleName, pill: true },
            { label: 'Status', value: 'Active' },
          ]}
        />

        <Checklist
          title="Your dashboard at a glance"
          items={[
            "Track every carer\u2019s compliance status in real time",
            'See documents and references as they\u2019re approved',
            'Get alerts before anything is due to expire',
            'Invite carers and team members in a couple of clicks',
          ]}
        />

        <Section style={s.ctaWrap}>
          <EmailButton href={dashboardUrl} variant="brand">
            Go to your dashboard &nbsp;&rarr;
          </EmailButton>
        </Section>

        <Text style={s.fallback}>
          Button not working? Paste this link into your browser:
        </Text>
        <Link href={dashboardUrl} style={s.fallbackUrl}>
          {dashboardUrl}
        </Link>

        <Section style={resources}>
          <Text style={resourcesTitle}>Helpful resources</Text>
          <Text style={resourcesText}>
            New to CareComply? Our{' '}
            <a href="https://help.carecomply.co.uk" style={resLink}>
              getting-started guide
            </a>{' '}
            walks through the essentials, and you can reach our team any time at{' '}
            <a href={`mailto:${supportEmail}`} style={resLink}>
              {supportEmail}
            </a>
            .
          </Text>
        </Section>
      </EmailCard>
      <EmailFooter supportEmail={supportEmail} />
    </EmailLayout>
  );
}

WelcomeTeamMember.PreviewProps = {
  teamMemberName: 'Daniel',
  organizationName: 'Brightpath Care',
  dashboardUrl: 'https://app.carecomply.co.uk/dashboard',
  roleName: 'Manager',
  supportEmail: 'support@carecomply.co.uk',
  logoUrl: undefined,
} satisfies WelcomeTeamMemberProps;

export default WelcomeTeamMember;

const resources: React.CSSProperties = {
  backgroundColor: colors.surfaceMuted,
  border: `1px solid ${colors.line}`,
  borderRadius: '12px',
  padding: '16px 18px',
  margin: '24px 0 0',
};

const resourcesTitle: React.CSSProperties = {
  margin: '0 0 6px',
  fontFamily: "'Manrope', sans-serif",
  fontWeight: 700,
  fontSize: '15px',
  color: colors.ink,
};

const resourcesText: React.CSSProperties = {
  margin: 0,
  fontSize: '13px',
  lineHeight: '1.65',
  color: colors.slate600,
};

const resLink: React.CSSProperties = {
  color: colors.brand700,
  textDecoration: 'underline',
  fontWeight: 600,
};

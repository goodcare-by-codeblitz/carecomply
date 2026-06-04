import * as React from 'react';
import { Section, Text, Heading, Link } from '@react-email/components';
import { EmailLayout } from '../components/EmailLayout';
import { EmailHeader } from '../components/EmailHeader';
import { EmailCard } from '../components/EmailCard';
import { EmailButton } from '../components/EmailButton';
import { StatusCard } from '../components/StatusCard';
import { Checklist } from '../components/Checklist';
import { HelpSection } from '../components/HelpSection';
import { EmailFooter } from '../components/EmailFooter';
import { colors } from '../theme';
import * as s from '../styles';
import type { WelcomeCarerProps } from '../types';

export function WelcomeCarer({
  carerName,
  organizationName,
  dashboardUrl,
  supportEmail,
  organizationContact,
  logoUrl,
}: WelcomeCarerProps) {
  const preview = `You're all set, ${carerName} — welcome to ${organizationName}`;

  return (
    <EmailLayout preview={preview}>
      <EmailHeader logoUrl={logoUrl} />
      <EmailCard>
        <Text style={s.eyebrow(colors.accent700)}>WELCOME ABOARD</Text>
        <Heading as="h1" style={s.h1}>
          You&rsquo;re all set, {carerName}
        </Heading>
        <Text style={s.lead}>
          Your account is live and your compliance is confirmed — you&rsquo;re
          officially part of the{' '}
          <strong style={s.strongInk}>{organizationName}</strong> team on
          CareComply. Thank you for getting everything sorted.
        </Text>

        <Section style={{ height: '24px' }} />

        <StatusCard tone="ok" badge="Account verified" title="Your onboarding is complete">
          Every document and reference has been received and approved.
          There&rsquo;s nothing more you need to do to get started.
        </StatusCard>

        <Checklist
          title="What you can do now"
          items={[
            'View your shifts and schedule in one place',
            'Keep your documents current with automatic expiry reminders',
            'Update your details and references any time from your phone',
            'Message your coordinator without leaving the app',
          ]}
        />

        <Section style={s.ctaWrap}>
          <EmailButton href={dashboardUrl} variant="brand">
            Open your dashboard &nbsp;&rarr;
          </EmailButton>
        </Section>

        <Text style={s.fallback}>
          Button not working? Paste this link into your browser:
        </Text>
        <Link href={dashboardUrl} style={s.fallbackUrl}>
          {dashboardUrl}
        </Link>

        <Section style={contact}>
          <Text style={contactText}>
            Your day-to-day contact at {organizationName} is{' '}
            <strong style={s.strongInk}>{organizationContact}</strong> — reach
            out to them about shifts and rota. For anything about the app itself,
            we&rsquo;re here to help below.
          </Text>
        </Section>

        <HelpSection supportEmail={supportEmail} />
      </EmailCard>
      <EmailFooter supportEmail={supportEmail} />
    </EmailLayout>
  );
}

WelcomeCarer.PreviewProps = {
  carerName: 'Priya',
  organizationName: 'Brightpath Care',
  dashboardUrl: 'https://app.carecomply.co.uk/dashboard',
  supportEmail: 'support@carecomply.co.uk',
  organizationContact: 'Amara Okafor',
  logoUrl: undefined,
} satisfies WelcomeCarerProps;

export default WelcomeCarer;

const contact: React.CSSProperties = {
  borderLeft: `2px solid ${colors.accent500}`,
  paddingLeft: '16px',
  margin: '8px 0 0',
};

const contactText: React.CSSProperties = {
  margin: 0,
  fontSize: '14px',
  lineHeight: '1.65',
  color: colors.slate600,
};

import * as React from 'react';
import { Section, Text, Heading, Link } from '@react-email/components';
import { EmailLayout } from '../components/EmailLayout';
import { EmailHeader } from '../components/EmailHeader';
import { EmailCard } from '../components/EmailCard';
import { EmailButton } from '../components/EmailButton';
import { StatusCard } from '../components/StatusCard';
import { DetailCard } from '../components/DetailCard';
import { EmailFooter } from '../components/EmailFooter';
import { colors } from '../theme';
import * as s from '../styles';
import type { ReferenceReminderProps } from '../types';

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

export function ReferenceReminder({
  refereeName,
  carerName,
  organizationName,
  referenceFormUrl,
  daysPending,
  supportEmail,
  logoUrl,
}: ReferenceReminderProps) {
  const preview = `A gentle reminder: ${carerName}'s reference is still pending`;

  return (
    <EmailLayout preview={preview}>
      <EmailHeader logoUrl={logoUrl} />
      <EmailCard>
        <Text style={s.eyebrow(colors.warn700)}>FRIENDLY REMINDER</Text>
        <Heading as="h1" style={s.h1}>
          Just a gentle nudge
        </Heading>
        <Text style={s.lead}>
          Hello {refereeName}, we recently asked if you could provide a reference
          for <strong style={s.strongInk}>{carerName}</strong> at{' '}
          <strong style={s.strongInk}>{organizationName}</strong>. We know
          inboxes get busy — this is just a friendly reminder, no rush beyond
          your convenience.
        </Text>

        <Section style={{ height: '24px' }} />

        <StatusCard
          tone="warn"
          badge={`Pending ${daysPending} day${daysPending === 1 ? '' : 's'}`}
          title="Your reference is still outstanding"
        >
          {carerName} can&rsquo;t complete onboarding until this reference is
          in. It only takes about three minutes whenever you have a moment.
        </StatusCard>

        <DetailCard
          avatarInitials={initials(carerName)}
          title={carerName}
          rows={[
            { label: 'Reference for', value: carerName },
            { label: 'Organisation', value: organizationName },
            { label: 'Time pending', value: `${daysPending} day${daysPending === 1 ? '' : 's'}` },
          ]}
        />

        <Section style={s.ctaWrap}>
          <EmailButton href={referenceFormUrl} variant="brand">
            Complete the reference &nbsp;&rarr;
          </EmailButton>
        </Section>

        <Text style={s.fallback}>
          Button not working? Paste this link into your browser:
        </Text>
        <Link href={referenceFormUrl} style={s.fallbackUrl}>
          {referenceFormUrl}
        </Link>

        <Section style={note}>
          <Text style={noteText}>
            Your response is treated in confidence and shared only with the
            organisation&rsquo;s verification team. If you believe you received
            this in error, please let us know at{' '}
            <a
              href={`mailto:${supportEmail}`}
              style={{ color: colors.brand700, textDecoration: 'underline' }}
            >
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

ReferenceReminder.PreviewProps = {
  refereeName: 'Mr Okonkwo',
  carerName: 'Priya Sharma',
  organizationName: 'Brightpath Care',
  referenceFormUrl: 'https://app.carecomply.co.uk/reference/form?token=a91f…',
  daysPending: 5,
  supportEmail: 'support@carecomply.co.uk',
  logoUrl: undefined,
} satisfies ReferenceReminderProps;

export default ReferenceReminder;

const note: React.CSSProperties = {
  backgroundColor: colors.surfaceMuted,
  border: `1px solid ${colors.line}`,
  borderRadius: '12px',
  padding: '16px 18px',
  margin: '24px 0 0',
};

const noteText: React.CSSProperties = {
  margin: 0,
  fontSize: '13px',
  lineHeight: '1.65',
  color: colors.slate600,
};

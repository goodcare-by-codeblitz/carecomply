import * as React from 'react';
import { Section, Text, Heading, Link } from '@react-email/components';
import { EmailLayout } from '../components/EmailLayout';
import { EmailHeader } from '../components/EmailHeader';
import { EmailCard } from '../components/EmailCard';
import { EmailButton } from '../components/EmailButton';
import { StatusCard, type StatusTone } from '../components/StatusCard';
import { DetailCard } from '../components/DetailCard';
import { EmailFooter } from '../components/EmailFooter';
import { colors } from '../theme';
import * as s from '../styles';
import type { DocumentExpiryReminderProps } from '../types';

export function DocumentExpiryReminder({
  recipientName,
  organizationName,
  documentName,
  expiryDate,
  daysRemaining,
  uploadUrl,
  supportEmail,
  logoUrl,
}: DocumentExpiryReminderProps) {
  const expired = daysRemaining <= 0;
  const urgent = !expired && daysRemaining <= 7;
  const tone: StatusTone = expired ? 'danger' : urgent ? 'warn' : 'brand';

  const badge = expired
    ? 'Action needed'
    : daysRemaining === 1
      ? 'Expires tomorrow'
      : `Expires in ${daysRemaining} days`;

  const statusTitle = expired
    ? `Your ${documentName} has expired`
    : `Your ${documentName} is expiring soon`;

  const preview = expired
    ? `Action needed: your ${documentName} has expired`
    : `Reminder: your ${documentName} expires ${expiryDate}`;

  return (
    <EmailLayout preview={preview}>
      <EmailHeader logoUrl={logoUrl} />
      <EmailCard>
        <Text style={s.eyebrow(expired ? '#B91C1C' : colors.warn700)}>
          COMPLIANCE REMINDER
        </Text>
        <Heading as="h1" style={s.h1}>
          {expired ? 'Time to renew a document' : 'A quick heads-up'}
        </Heading>
        <Text style={s.lead}>
          Hi {recipientName}, this is a friendly reminder to keep your records
          with <strong style={s.strongInk}>{organizationName}</strong> up to
          date. Updating now keeps you cleared to work — no interruption to your
          shifts.
        </Text>

        <Section style={{ height: '24px' }} />

        <StatusCard tone={tone} badge={badge} title={statusTitle}>
          {expired
            ? 'This document is now out of date. Please upload a current version as soon as you can so your compliance stays active.'
            : 'Uploading a renewed copy now takes a minute and keeps your compliance unbroken.'}
        </StatusCard>

        <DetailCard
          title="Document details"
          rows={[
            { label: 'Document', value: documentName },
            { label: 'Organisation', value: organizationName },
            { label: 'Expiry date', value: expiryDate },
            {
              label: 'Status',
              value: expired
                ? 'Expired'
                : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`,
            },
          ]}
        />

        <Section style={s.ctaWrap}>
          <EmailButton href={uploadUrl}>
            {expired ? 'Upload current document' : 'Update document'} &nbsp;&rarr;
          </EmailButton>
        </Section>

        <Text style={s.fallback}>
          Button not working? Paste this link into your browser:
        </Text>
        <Link href={uploadUrl} style={s.fallbackUrl}>
          {uploadUrl}
        </Link>

        <Section style={note}>
          <Text style={noteText}>
            Keeping documents current is a CQC requirement and protects the
            people you support. If a document lapses, your manager is notified
            and you may be paused from shifts until it&rsquo;s renewed — so
            it&rsquo;s always best to update early.
          </Text>
        </Section>
      </EmailCard>
      <EmailFooter supportEmail={supportEmail} />
    </EmailLayout>
  );
}

DocumentExpiryReminder.PreviewProps = {
  recipientName: 'Priya',
  organizationName: 'Brightpath Care',
  documentName: 'Enhanced DBS certificate',
  expiryDate: '12 June 2026',
  daysRemaining: 14,
  uploadUrl: 'https://app.carecomply.co.uk/documents/upload?ref=dbs-2026',
  supportEmail: 'support@carecomply.co.uk',
  logoUrl: undefined,
} satisfies DocumentExpiryReminderProps;

export default DocumentExpiryReminder;

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

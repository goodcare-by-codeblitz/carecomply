import * as React from 'react';
import { Section, Text, Heading, Link } from '@react-email/components';
import { EmailLayout } from '../components/EmailLayout';
import { EmailHeader } from '../components/EmailHeader';
import { EmailCard } from '../components/EmailCard';
import { EmailButton } from '../components/EmailButton';
import { DetailCard } from '../components/DetailCard';
import { SecurityNotice } from '../components/SecurityNotice';
import { EmailFooter } from '../components/EmailFooter';
import { colors, fontFamily, fontSize } from '../theme';
import * as s from '../styles';
import type { ReferenceRequestProps } from '../types';

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

export function ReferenceRequest({
  refereeName,
  carerName,
  organizationName,
  referenceFormUrl,
  requestedBy,
  supportEmail,
  expiryDate,
  logoUrl,
}: ReferenceRequestProps) {
  const preview = `${requestedBy} at ${organizationName} has requested a reference for ${carerName}`;

  return (
    <EmailLayout preview={preview}>
      <EmailHeader logoUrl={logoUrl} />
      <EmailCard>
        <Text style={s.eyebrow(colors.brand700)}>REFERENCE REQUEST</Text>
        <Heading as="h1" style={s.h1}>
          A reference request for {carerName}
        </Heading>
        <Text style={s.lead}>
          Hello {refereeName},{' '}
          <strong style={s.strongInk}>{requestedBy}</strong> at{' '}
          <strong style={s.strongInk}>{organizationName}</strong> has listed you
          as a referee for{' '}
          <strong style={s.strongInk}>{carerName}</strong>, who is joining their
          care team. They&rsquo;d be grateful if you could confirm a few details.
        </Text>

        <Section style={{ height: '20px' }} />

        <Text style={para}>
          Care providers are required to verify references before a new carer can
          start. Your answers help confirm {carerName}&rsquo;s suitability and
          keep the people in their care safe. It takes about three minutes.
        </Text>

        <DetailCard
          avatarInitials={initials(carerName)}
          title={carerName}
          rows={[
            { label: 'Reference for', value: carerName },
            { label: 'Requested by', value: `${requestedBy}, ${organizationName}` },
            { label: 'Secure link expires', value: expiryDate },
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

        <SecurityNotice supportEmail={supportEmail} />
      </EmailCard>
      <EmailFooter supportEmail={supportEmail} />
    </EmailLayout>
  );
}

ReferenceRequest.PreviewProps = {
  refereeName: 'Mr Okonkwo',
  carerName: 'Priya Sharma',
  organizationName: 'Brightpath Care',
  referenceFormUrl: 'https://app.carecomply.co.uk/reference/form?token=a91f…',
  requestedBy: 'Amara Okafor',
  supportEmail: 'support@carecomply.co.uk',
  expiryDate: '21 June 2026',
  logoUrl: undefined,
} satisfies ReferenceRequestProps;

export default ReferenceRequest;

const para: React.CSSProperties = {
  margin: '0 0 28px',
  fontFamily: fontFamily.sans,
  fontSize: fontSize.base,
  lineHeight: '1.65',
  color: colors.slate600,
};

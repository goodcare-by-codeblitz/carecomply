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
import type { ComplianceWarningProps } from '../types';

export function ComplianceWarning({
  recipientName,
  organizationName,
  warningTitle,
  warningDetail,
  actionItems,
  actionUrl,
  supportEmail,
  logoUrl,
}: ComplianceWarningProps) {
  const preview = `Compliance alert for ${organizationName}: ${warningTitle}`;

  return (
    <EmailLayout preview={preview}>
      <EmailHeader logoUrl={logoUrl} />
      <EmailCard>
        <Text style={s.eyebrow('#B91C1C')}>COMPLIANCE ALERT</Text>
        <Heading as="h1" style={s.h1}>
          Action required, {recipientName}
        </Heading>
        <Text style={s.lead}>
          A compliance issue has been flagged on the{' '}
          <strong style={s.strongInk}>{organizationName}</strong> workspace that
          requires your attention. Please review and resolve as soon as possible
          to maintain CQC-ready status.
        </Text>

        <Section style={{ height: '24px' }} />

        <StatusCard tone="danger" badge="Action required" title={warningTitle}>
          {warningDetail}
        </StatusCard>

        <Section style={actionList}>
          <Text style={actionListLabel}>ITEMS REQUIRING ACTION</Text>
          {actionItems.map((item, i) => (
            <Row key={i} style={{ marginBottom: i === actionItems.length - 1 ? 0 : 10 }}>
              <Column style={{ width: '28px', verticalAlign: 'top', paddingTop: '1px' }}>
                <div style={bullet}>{i + 1}</div>
              </Column>
              <Column style={{ verticalAlign: 'top' }}>
                <Text style={actionItemText}>{item}</Text>
              </Column>
            </Row>
          ))}
        </Section>

        <Section style={s.ctaWrap}>
          <EmailButton href={actionUrl}>
            Review compliance dashboard &nbsp;&rarr;
          </EmailButton>
        </Section>

        <Text style={s.fallback}>
          Button not working? Paste this link into your browser:
        </Text>
        <Link href={actionUrl} style={s.fallbackUrl}>
          {actionUrl}
        </Link>

        <Section style={cqcNote}>
          <Text style={cqcLabel}>WHY THIS MATTERS</Text>
          <Text style={cqcText}>
            CQC inspectors can request evidence of staff compliance at any time.
            Unresolved issues may result in regulatory action. Our team is here
            to help — contact us at{' '}
            <a href={`mailto:${supportEmail}`} style={cqcLink}>
              {supportEmail}
            </a>{' '}
            if you need guidance.
          </Text>
        </Section>
      </EmailCard>
      <EmailFooter supportEmail={supportEmail} />
    </EmailLayout>
  );
}

ComplianceWarning.PreviewProps = {
  recipientName: 'Amara',
  organizationName: 'Brightpath Care',
  warningTitle: '3 carers have expired compliance documents',
  warningDetail:
    'Three members of your care team have documents that have passed their expiry date. This puts your CQC-ready status at risk and must be resolved promptly.',
  actionItems: [
    'Priya Sharma — Enhanced DBS certificate expired 2 days ago',
    'James Osei — Right to Work document expired 5 days ago',
    'Maria Santos — Mandatory training certificates expired today',
  ],
  actionUrl: 'https://app.carecomply.co.uk/compliance',
  supportEmail: 'support@carecomply.co.uk',
  logoUrl: undefined,
} satisfies ComplianceWarningProps;

export default ComplianceWarning;

const actionList: React.CSSProperties = {
  backgroundColor: '#FEF2F2',
  border: '1px solid #FECACA88',
  borderRadius: radius.lg,
  padding: '20px 22px',
  margin: '0 0 28px',
};

const actionListLabel: React.CSSProperties = {
  margin: '0 0 14px',
  fontFamily: fontFamily.mono,
  fontSize: '10px',
  letterSpacing: '0.12em',
  color: '#B91C1C',
};

const bullet: React.CSSProperties = {
  width: '22px',
  height: '22px',
  borderRadius: '9999px',
  backgroundColor: '#EF4444',
  color: colors.white,
  fontFamily: fontFamily.sans,
  fontWeight: 700,
  fontSize: '11px',
  lineHeight: '22px',
  textAlign: 'center',
};

const actionItemText: React.CSSProperties = {
  margin: 0,
  fontFamily: fontFamily.sans,
  fontWeight: 600,
  fontSize: fontSize.sm,
  lineHeight: '1.5',
  color: colors.ink,
};

const cqcNote: React.CSSProperties = {
  backgroundColor: colors.surfaceMuted,
  border: `1px solid ${colors.line}`,
  borderRadius: radius.lg,
  padding: '16px 18px',
  margin: '24px 0 0',
};

const cqcLabel: React.CSSProperties = {
  margin: '0 0 6px',
  fontFamily: fontFamily.mono,
  fontSize: '10px',
  letterSpacing: '0.12em',
  color: colors.slate500,
};

const cqcText: React.CSSProperties = {
  margin: 0,
  fontFamily: fontFamily.sans,
  fontSize: fontSize.sm,
  lineHeight: '1.65',
  color: colors.slate600,
};

const cqcLink: React.CSSProperties = {
  color: colors.brand700,
  textDecoration: 'underline',
};

import * as React from 'react';
import { Section, Text, Link, Hr } from '@react-email/components';
import { colors, fontFamily, fontSize } from '../theme';

interface EmailFooterProps {
  supportEmail: string;
  /** Optional: when provided, personalises the legal line to mention the org. */
  organizationName?: string;
}

/** Footer: support contact, company line, legal microcopy. */
export function EmailFooter({ supportEmail, organizationName }: EmailFooterProps) {
  const sentReason = organizationName
    ? `Sent to you because ${organizationName} uses CareComply.`
    : 'Sent to you because someone invited you to a workspace.';
  return (
    <Section style={wrap}>
      <Hr style={rule} />
      <Text style={help}>
        Questions? We&rsquo;re here at{' '}
        <Link href={`mailto:${supportEmail}`} style={link}>
          {supportEmail}
        </Link>
      </Text>
      <Text style={company}>
        CareComply — compliance operations for UK care providers
      </Text>
      <Text style={legal}>
        {sentReason} This is a one-time transactional email, not marketing.
        <br />
        CareComply Ltd · 71–75 Shelton Street, London WC2H 9JQ
      </Text>
    </Section>
  );
}

const wrap: React.CSSProperties = {
  padding: '8px 8px 0',
  textAlign: 'center',
};

const rule: React.CSSProperties = {
  borderColor: colors.line,
  margin: '0 0 20px',
};

const help: React.CSSProperties = {
  margin: '0 0 8px',
  fontFamily: fontFamily.sans,
  fontSize: fontSize.sm,
  color: colors.slate600,
  textAlign: 'center',
};

const link: React.CSSProperties = {
  color: colors.brand700,
  textDecoration: 'none',
  fontWeight: 600,
};

const company: React.CSSProperties = {
  margin: '0 0 12px',
  fontFamily: fontFamily.sans,
  fontSize: fontSize.xs,
  fontWeight: 600,
  color: colors.ink3,
  textAlign: 'center',
};

const legal: React.CSSProperties = {
  margin: 0,
  fontFamily: fontFamily.sans,
  fontSize: '11px',
  lineHeight: '1.6',
  color: colors.slate400,
  textAlign: 'center',
};

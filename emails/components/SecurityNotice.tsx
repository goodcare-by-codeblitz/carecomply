import * as React from 'react';
import { Section, Text } from '@react-email/components';
import { colors, fontFamily, fontSize, radius } from '../theme';

interface SecurityNoticeProps {
  supportEmail: string;
}

/** Subtle, reassuring note for unintended recipients. */
export function SecurityNotice({ supportEmail }: SecurityNoticeProps) {
  return (
    <Section style={box}>
      <Text style={label}>SECURITY NOTICE</Text>
      <Text style={text}>
        This invitation is unique to your email address and can only be accepted
        once. If you weren&rsquo;t expecting it, you can safely ignore this
        message — no account will be created. Concerned? Reach us at{' '}
        <a href={`mailto:${supportEmail}`} style={link}>
          {supportEmail}
        </a>
        .
      </Text>
    </Section>
  );
}

const box: React.CSSProperties = {
  backgroundColor: colors.surfaceMuted,
  border: `1px solid ${colors.line}`,
  borderRadius: radius.lg,
  padding: '16px 18px',
  margin: '24px 0 0',
};

const label: React.CSSProperties = {
  margin: '0 0 6px',
  fontFamily: fontFamily.mono,
  fontSize: '10px',
  letterSpacing: '0.12em',
  color: colors.slate500,
};

const text: React.CSSProperties = {
  margin: 0,
  fontFamily: fontFamily.sans,
  fontSize: fontSize.sm,
  lineHeight: '1.65',
  color: colors.slate600,
};

const link: React.CSSProperties = {
  color: colors.brand700,
  textDecoration: 'underline',
};

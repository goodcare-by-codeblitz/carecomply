import * as React from 'react';
import { Section, Text, Link } from '@react-email/components';
import { colors, fontFamily, fontSize, radius } from '../theme';

interface HelpSectionProps {
  supportEmail: string;
  /** Override the body text for non-carer contexts. */
  message?: string;
}

/** Friendly "we're here to help" block above the footer. */
export function HelpSection({ supportEmail, message }: HelpSectionProps) {
  return (
    <Section style={box}>
      <Text style={title}>Stuck on anything?</Text>
      <Text style={text}>
        {message ?? (
          <>
            Onboarding takes most carers under ten minutes, and you can save and
            come back any time. If a document is hard to find or something
            won&rsquo;t upload, email us at{' '}
            <Link href={`mailto:${supportEmail}`} style={link}>
              {supportEmail}
            </Link>{' '}
            and a real person will help.
          </>
        )}
      </Text>
    </Section>
  );
}

const box: React.CSSProperties = {
  backgroundColor: colors.surfaceMuted,
  border: `1px solid ${colors.line}`,
  borderRadius: radius.lg,
  padding: '18px 20px',
  margin: '24px 0 0',
};

const title: React.CSSProperties = {
  margin: '0 0 6px',
  fontFamily: fontFamily.sans,
  fontWeight: 700,
  fontSize: fontSize.base,
  color: colors.ink,
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
  fontWeight: 600,
};

import * as React from 'react';
import { Section, Text, Heading, Link } from '@react-email/components';
import { EmailLayout } from '../components/EmailLayout';
import { EmailHeader } from '../components/EmailHeader';
import { EmailCard } from '../components/EmailCard';
import { EmailButton } from '../components/EmailButton';
import { EmailFooter } from '../components/EmailFooter';
import { colors, fontFamily, fontSize, radius } from '../theme';
import * as s from '../styles';
import type { PasswordResetProps } from '../types';

export function PasswordReset({
  recipientName,
  resetUrl,
  expiryTime,
  supportEmail,
  logoUrl,
}: PasswordResetProps) {
  const preview = 'Reset your CareComply password';

  return (
    <EmailLayout preview={preview}>
      <EmailHeader logoUrl={logoUrl} />
      <EmailCard>
        <Text style={s.eyebrow(colors.ink3)}>PASSWORD RESET</Text>
        <Heading as="h1" style={s.h1}>
          Reset your password
        </Heading>
        <Text style={s.lead}>
          Hi {recipientName}, we received a request to reset the password for
          your CareComply account. Click the button below to choose a new one.
          If you didn&rsquo;t request this, you can safely ignore this email.
        </Text>

        <Section style={{ height: '28px' }} />

        <Section style={s.ctaWrap}>
          <EmailButton href={resetUrl}>Reset password &nbsp;&rarr;</EmailButton>
        </Section>

        <Text style={expiry}>
          This link expires {expiryTime}. After that you&rsquo;ll need to
          request a new one.
        </Text>

        <Text style={s.fallback}>
          Button not working? Paste this link into your browser:
        </Text>
        <Link href={resetUrl} style={s.fallbackUrl}>
          {resetUrl}
        </Link>

        <Section style={securityBox}>
          <Text style={securityLabel}>SECURITY NOTICE</Text>
          <Text style={securityText}>
            This link can only be used once and expires {expiryTime}. We will
            never ask for your password over email or phone. If you didn&rsquo;t
            make this request, your account is safe — no changes have been made.
            If you&rsquo;re concerned, contact us at{' '}
            <a href={`mailto:${supportEmail}`} style={securityLink}>
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

PasswordReset.PreviewProps = {
  recipientName: 'Amara',
  resetUrl:
    'https://app.carecomply.co.uk/auth/reset-password?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  expiryTime: 'in 1 hour',
  supportEmail: 'support@carecomply.co.uk',
  logoUrl: undefined,
} satisfies PasswordResetProps;

export default PasswordReset;

const expiry: React.CSSProperties = {
  margin: '16px 0 0',
  fontFamily: fontFamily.sans,
  fontSize: fontSize.sm,
  color: colors.slate500,
  textAlign: 'center',
};

const securityBox: React.CSSProperties = {
  backgroundColor: colors.surfaceMuted,
  border: `1px solid ${colors.line}`,
  borderRadius: radius.lg,
  padding: '16px 18px',
  margin: '28px 0 0',
};

const securityLabel: React.CSSProperties = {
  margin: '0 0 6px',
  fontFamily: fontFamily.mono,
  fontSize: '10px',
  letterSpacing: '0.12em',
  color: colors.slate500,
};

const securityText: React.CSSProperties = {
  margin: 0,
  fontFamily: fontFamily.sans,
  fontSize: fontSize.sm,
  lineHeight: '1.65',
  color: colors.slate600,
};

const securityLink: React.CSSProperties = {
  color: colors.brand700,
  textDecoration: 'underline',
};

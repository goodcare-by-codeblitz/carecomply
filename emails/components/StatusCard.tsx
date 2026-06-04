import * as React from 'react';
import { Section, Row, Column, Text } from '@react-email/components';
import { colors, fontFamily, fontSize, radius } from '../theme';

export type StatusTone = 'warn' | 'danger' | 'ok' | 'brand';

interface StatusCardProps {
  tone: StatusTone;
  /** Short status label shown on the badge. e.g. "Expires in 14 days" */
  badge: string;
  title: string;
  children: React.ReactNode;
}

const palette: Record<StatusTone, { bg: string; border: string; fg: string; dot: string }> = {
  warn: { bg: colors.warn50, border: '#FCD9A555', fg: colors.warn700, dot: '#F59E0B' },
  danger: { bg: '#FEF2F2', border: '#FECACA88', fg: '#B91C1C', dot: '#EF4444' },
  ok: { bg: '#ECFDF5', border: '#A7F3D088', fg: '#047857', dot: '#10B981' },
  brand: { bg: colors.brand50, border: colors.brand100, fg: colors.brand700, dot: colors.brand600 },
};

/**
 * Tone-driven status banner. Carries the emotional weight of the email
 * (urgency, success, info) via colour — never via shouty copy.
 */
export function StatusCard({ tone, badge, title, children }: StatusCardProps) {
  const p = palette[tone];
  return (
    <Section
      style={{
        backgroundColor: p.bg,
        border: `1px solid ${p.border}`,
        borderRadius: radius.lg,
        padding: '20px 22px',
        margin: '0 0 28px',
      }}
    >
      <Row>
        <Column style={{ width: '10px', verticalAlign: 'top', paddingTop: '5px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '9999px', backgroundColor: p.dot }} />
        </Column>
        <Column style={{ paddingLeft: '12px' }}>
          <Text style={{ ...badgeStyle, color: p.fg }}>{badge.toUpperCase()}</Text>
          <Text style={titleStyle}>{title}</Text>
          <Text style={bodyStyle}>{children}</Text>
        </Column>
      </Row>
    </Section>
  );
}

const badgeStyle: React.CSSProperties = {
  margin: '0 0 6px',
  fontFamily: fontFamily.mono,
  fontSize: '10px',
  fontWeight: 600,
  letterSpacing: '0.12em',
};

const titleStyle: React.CSSProperties = {
  margin: '0 0 6px',
  fontFamily: fontFamily.sans,
  fontWeight: 700,
  fontSize: fontSize.lg,
  letterSpacing: '-0.015em',
  color: colors.ink,
};

const bodyStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: fontFamily.sans,
  fontSize: fontSize.sm,
  lineHeight: '1.6',
  color: colors.slate600,
};

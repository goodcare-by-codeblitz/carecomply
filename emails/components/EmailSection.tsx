import * as React from 'react';
import { Section } from '@react-email/components';
import { colors, fontFamily, fontSize, radius } from '../theme';

type Tone = 'muted' | 'warn' | 'danger' | 'ok' | 'accent';

interface EmailSectionProps {
  children: React.ReactNode;
  /** Visual tone for the section background. Default: `muted` (subtle grey). */
  tone?: Tone;
  /** Extra style overrides. */
  style?: React.CSSProperties;
}

const palette: Record<Tone, { bg: string; border: string }> = {
  muted: { bg: colors.surfaceMuted, border: colors.line },
  warn: { bg: colors.warn50, border: '#FCD9A555' },
  danger: { bg: '#FEF2F2', border: '#FECACA88' },
  ok: { bg: '#ECFDF5', border: '#A7F3D088' },
  accent: { bg: colors.accent50, border: `${colors.accent500}33` },
};

/**
 * Generic inset section — use for notices, resource boxes, info blocks.
 * Accepts a tone so the colour system stays consistent across templates.
 */
export function EmailSection({ children, tone = 'muted', style }: EmailSectionProps) {
  const p = palette[tone];
  return (
    <Section
      style={{
        backgroundColor: p.bg,
        border: `1px solid ${p.border}`,
        borderRadius: radius.lg,
        padding: '18px 20px',
        margin: '24px 0 0',
        ...style,
      }}
    >
      {children}
    </Section>
  );
}

/** Mono uppercase label used inside sections. */
export function SectionLabel({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <p
      style={{
        margin: '0 0 6px',
        fontFamily: fontFamily.mono,
        fontSize: '10px',
        letterSpacing: '0.12em',
        color: color ?? colors.slate500,
        fontWeight: 600,
      }}
    >
      {children}
    </p>
  );
}

/** Body text inside a section. */
export function SectionText({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: 0,
        fontFamily: fontFamily.sans,
        fontSize: fontSize.sm,
        lineHeight: '1.65',
        color: colors.slate600,
      }}
    >
      {children}
    </p>
  );
}

import * as React from 'react';
import { Section } from '@react-email/components';
import { colors, radius, shadow, spacing } from '../theme';

interface EmailCardProps {
  children: React.ReactNode;
}

/** The main white content card every template sits inside. */
export function EmailCard({ children }: EmailCardProps) {
  return (
    <Section style={outer}>
      <Section style={inner}>{children}</Section>
    </Section>
  );
}

const outer: React.CSSProperties = {
  backgroundColor: colors.surface,
  border: `1px solid ${colors.line}`,
  borderRadius: radius.xl,
  boxShadow: shadow.card,
  overflow: 'hidden',
};

const inner: React.CSSProperties = {
  padding: `${spacing.cardY} ${spacing.cardX}`,
};

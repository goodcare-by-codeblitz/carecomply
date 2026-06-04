import * as React from 'react';
import { Button } from '@react-email/components';
import { colors, fontFamily, radius } from '../theme';

type Variant = 'ink' | 'brand';

interface EmailButtonProps {
  href: string;
  children: React.ReactNode;
  /** Visual weight. `ink` (default) for most CTAs, `brand` for positive/welcome. */
  variant?: Variant;
}

/** Primary, filled CTA. Bulletproof padding so it renders everywhere. */
export function EmailButton({ href, children, variant = 'ink' }: EmailButtonProps) {
  return (
    <Button href={href} style={{ ...base, ...byVariant[variant] }}>
      {children}
    </Button>
  );
}

const base: React.CSSProperties = {
  color: colors.white,
  fontFamily: fontFamily.sans,
  fontWeight: 600,
  fontSize: '15px',
  lineHeight: '1',
  textDecoration: 'none',
  textAlign: 'center',
  borderRadius: radius.md,
  padding: '15px 28px',
  display: 'inline-block',
};

const byVariant: Record<Variant, React.CSSProperties> = {
  ink: { backgroundColor: colors.ink },
  brand: { backgroundColor: colors.brand600 },
};

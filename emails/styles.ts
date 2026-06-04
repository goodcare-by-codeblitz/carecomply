import * as React from 'react';
import { colors, fontFamily, fontSize } from './theme';

/** Mono uppercase eyebrow. Pass a hex (defaults to brand). */
export function eyebrow(color: string = colors.brand700): React.CSSProperties {
  return {
    margin: '0 0 14px',
    fontFamily: fontFamily.mono,
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.16em',
    color,
  };
}

export const h1: React.CSSProperties = {
  margin: '0 0 18px',
  fontFamily: fontFamily.sans,
  fontWeight: 700,
  fontSize: fontSize.h1,
  lineHeight: '1.2',
  letterSpacing: '-0.025em',
  color: colors.ink,
};

export const lead: React.CSSProperties = {
  margin: 0,
  fontFamily: fontFamily.sans,
  fontSize: fontSize.base,
  lineHeight: '1.65',
  color: colors.slate600,
};

export const strongInk: React.CSSProperties = { color: colors.ink };

export const ctaWrap: React.CSSProperties = {
  textAlign: 'center',
  padding: '4px 0 8px',
};

export const microCenter: React.CSSProperties = {
  margin: '14px 0 0',
  fontFamily: fontFamily.sans,
  fontSize: fontSize.sm,
  color: colors.slate500,
  textAlign: 'center',
};

export const fallback: React.CSSProperties = {
  margin: '18px 0 6px',
  fontFamily: fontFamily.sans,
  fontSize: fontSize.xs,
  color: colors.slate500,
  textAlign: 'center',
};

export const fallbackUrl: React.CSSProperties = {
  display: 'block',
  fontFamily: fontFamily.mono,
  fontSize: fontSize.xs,
  lineHeight: '1.5',
  color: colors.brand700,
  textAlign: 'center',
  wordBreak: 'break-all',
};

export const spacer = (h: number): React.CSSProperties => ({ height: `${h}px`, lineHeight: `${h}px`, fontSize: '1px' });

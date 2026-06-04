/**
 * CareComply — Email design tokens
 * Mirrors the "Slate" design system (slate/tokens.css) but scoped to the
 * subset that survives in email clients. Use these instead of raw hex so the
 * whole template stays in sync with the product.
 */

export const colors = {
  // Ink / neutral text
  ink: '#0F172A',
  ink2: '#1E293B',
  ink3: '#334155',
  slate400: '#94A3B8',
  slate500: '#64748B',
  slate600: '#475569',
  slate700: '#334155',

  // Brand (blue) + accent (teal)
  brand50: '#EFF4FF',
  brand100: '#DBE5FF',
  brand600: '#1D4ED8',
  brand700: '#1E40AF',
  accent50: '#ECFDF8',
  accent500: '#14B8A6',
  accent700: '#0F766E',

  // Surfaces & lines
  surface: '#FFFFFF',
  surfaceMuted: '#F1F5F9',
  surfacePage: '#F8FAFC',
  line: '#E2E8F0',
  lineStrong: '#CBD5E1',

  // Semantic
  warn50: '#FFFBEB',
  warn700: '#B45309',

  white: '#FFFFFF',
} as const;

export const fontFamily = {
  sans: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
} as const;

export const fontSize = {
  xs: '12px',
  sm: '13px',
  md: '14px',
  base: '15px',
  lg: '17px',
  xl: '20px',
  h2: '22px',
  h1: '26px',
} as const;

export const radius = {
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
} as const;

export const spacing = {
  /** Horizontal padding inside the main card */
  cardX: '40px',
  cardY: '40px',
  outerY: '40px',
} as const;

/** Bulletproof-ish shadow for the main card (rendered in supporting clients). */
export const shadow = {
  card: '0 1px 2px rgba(15,23,42,0.06), 0 8px 24px -16px rgba(15,23,42,0.18)',
} as const;

export type ThemeColor = keyof typeof colors;

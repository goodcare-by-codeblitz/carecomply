import * as React from 'react';
import { cn } from '@/lib/utils';

type PillTone = 'neutral' | 'brand' | 'accent' | 'ok' | 'warn' | 'danger' | 'ink';

const tones: Record<PillTone, string> = {
  neutral: 'bg-surface-muted text-ink-3 ring-1 ring-line',
  brand:   'bg-brand-50 text-brand-700 ring-1 ring-brand-100',
  accent:  'bg-teal-50 text-teal-700 ring-1 ring-teal-100',
  ok:      'bg-ok-50 text-emerald-700 ring-1 ring-emerald-100',
  warn:    'bg-warn-50 text-amber-700 ring-1 ring-amber-100',
  danger:  'bg-danger-50 text-red-700 ring-1 ring-red-100',
  ink:     'bg-ink text-white',
};

interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: PillTone;
}

export function Pill({ tone = 'neutral', className, children, ...props }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide',
        tones[tone],
        className
      )}
      {...props}>
      {children}
    </span>
  );
}

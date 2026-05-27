import * as React from 'react';
import { cn } from '@/lib/utils';

type EyebrowTone = 'brand' | 'accent' | 'muted';

const tones: Record<EyebrowTone, string> = {
  brand:  'text-brand-700',
  accent: 'text-teal-700',
  muted:  'text-slate-500',
};

interface EyebrowProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: EyebrowTone;
}

export function Eyebrow({ tone = 'brand', className, children, ...props }: EyebrowProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em]',
        tones[tone],
        className
      )}
      {...props}>
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {children}
    </div>
  );
}

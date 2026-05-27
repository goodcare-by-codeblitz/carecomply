import * as React from 'react';
import { cn } from '@/lib/utils';

type ProgressTone = 'brand' | 'ok' | 'warn';

const toneCls: Record<ProgressTone, string> = {
  brand: 'bg-brand',
  ok: 'bg-emerald-500',
  warn: 'bg-amber-500',
};

interface MProgressProps {
  value: number;
  tone?: ProgressTone;
  className?: string;
}

export function MProgress({ value, tone = 'brand', className }: MProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('h-1.5 w-full rounded-full bg-surface-muted overflow-hidden', className)}>
      <div
        className={cn('h-full rounded-full transition-all duration-500', toneCls[tone])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface MToggleProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
}

export function MToggle({ checked, onChange, label }: MToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange?.(!checked)}
      className={cn(
        'relative h-6 w-10 rounded-full transition focus-ring',
        checked ? 'bg-brand' : 'bg-line-strong'
      )}>
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
          checked ? 'left-[19px]' : 'left-0.5'
        )}
      />
    </button>
  );
}

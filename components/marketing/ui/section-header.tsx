import * as React from 'react';
import { cn } from '@/lib/utils';
import { Eyebrow } from './eyebrow';

type EyebrowTone = 'brand' | 'accent' | 'muted';

interface SectionHeaderProps {
  eyebrow?: string;
  eyebrowTone?: EyebrowTone;
  title: string;
  lead?: string;
  align?: 'left' | 'center';
  className?: string;
}

export function SectionHeader({
  eyebrow,
  eyebrowTone = 'brand',
  title,
  lead,
  align = 'left',
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        align === 'center' ? 'text-center mx-auto max-w-2xl' : 'max-w-2xl',
        className
      )}>
      {eyebrow && (
        <Eyebrow
          tone={eyebrowTone}
          className={cn('mb-4', align === 'center' && 'justify-center')}>
          {eyebrow}
        </Eyebrow>
      )}
      <h2 className="text-[26px] sm:text-[34px] lg:text-[44px] leading-[1.05] font-semibold tracking-ultratight text-ink">
        {title}
      </h2>
      {lead && (
        <p
          className={cn(
            'mt-5 text-[17px] leading-[1.55] text-slate-600',
            align === 'center' ? 'max-w-xl mx-auto' : 'max-w-xl'
          )}>
          {lead}
        </p>
      )}
    </div>
  );
}

import * as React from 'react';
import { cn } from '@/lib/utils';

const COLORS = [
  '#1D4ED8', '#0F766E', '#9333EA', '#D97706',
  '#0E7490', '#BE185D', '#15803D', '#475569',
];

type AvatarSize = 'sm' | 'md' | 'lg';

const sizes: Record<AvatarSize, string> = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-11 w-11 text-sm',
};

interface MAvatarProps {
  name: string;
  tone?: string;
  size?: AvatarSize;
  className?: string;
}

export function MAvatar({ name, tone, size = 'md', className }: MAvatarProps) {
  const idx = (name?.charCodeAt(0) ?? 0) % COLORS.length;
  const bg = tone ?? COLORS[idx];
  const initials = (name ?? '?')
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={cn(
        'shrink-0 rounded-full text-white font-semibold flex items-center justify-center',
        sizes[size],
        className
      )}
      style={{ background: bg }}>
      {initials}
    </div>
  );
}

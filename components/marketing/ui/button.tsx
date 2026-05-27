import * as React from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'brand' | 'secondary' | 'ghost' | 'link';
type ButtonSize = 'sm' | 'md' | 'lg';

interface MButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  as?: React.ElementType;
  href?: string;
}

const variants: Record<ButtonVariant, string> = {
  primary:   'bg-ink text-white hover:bg-ink-2 shadow-card',
  brand:     'bg-brand text-white hover:bg-brand-700 shadow-card',
  secondary: 'bg-white text-ink border border-line hover:border-line-strong hover:bg-surface-page',
  ghost:     'bg-transparent text-ink-3 hover:bg-surface-muted hover:text-ink',
  link:      'bg-transparent text-brand hover:text-brand-700 px-0',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-[15px]',
  lg: 'h-12 px-5 text-[15px]',
};

export function MButton({
  variant = 'primary',
  size = 'md',
  as: As = 'button',
  className,
  children,
  ...props
}: MButtonProps) {
  return (
    <As
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition focus-ring whitespace-nowrap',
        sizes[size],
        variants[variant],
        className
      )}
      {...props}>
      {children}
    </As>
  );
}

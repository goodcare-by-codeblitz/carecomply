import * as React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  mark?: boolean;
  className?: string;
  size?: number;
}

export function Logo({ mark = false, className, size = 22 }: LogoProps) {
  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        style={{ width: size, height: size, flexShrink: 0 }}>
        <rect x="1" y="1" width="30" height="30" rx="8" fill="#0F172A" />
        <path
          d="M9 20.5V11.5C9 10.67 9.67 10 10.5 10H17.5C19.43 10 21 11.57 21 13.5C21 14.6 20.47 15.58 19.65 16.2C21.04 16.66 22 18 22 19.5C22 21.43 20.43 23 18.5 23H10.5C9.67 23 9 22.33 9 21.5V20.5Z"
          stroke="#14B8A6"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="m13.5 16.5 1.6 1.6 3-3"
          stroke="#14B8A6"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {!mark && (
        <span className="font-semibold tracking-ultratight text-ink text-[17px]">
          CareComply
        </span>
      )}
    </div>
  );
}

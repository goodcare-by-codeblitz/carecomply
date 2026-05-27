import * as React from 'react';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrowserChromeProps {
  tab?: string;
  children: React.ReactNode;
  className?: string;
}

export function BrowserChrome({
  tab = 'app.carecomply.co.uk',
  children,
  className,
}: BrowserChromeProps) {
  return (
    <div className={cn('rounded-2xl bg-white border border-line shadow-lift overflow-hidden', className)}>
      <div className="h-9 flex items-center gap-3 px-3 border-b border-line bg-[#FCFCFD]">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#E2E8F0]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#E2E8F0]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#E2E8F0]" />
        </div>
        <div className="flex-1 max-w-md mx-auto h-5 rounded-md bg-white border border-line text-[11px] text-slate-500 flex items-center justify-center gap-1.5 px-2">
          <Lock size={10} style={{ width: 10, height: 10, flexShrink: 0 }} />
          {tab}
        </div>
        <div className="w-8" />
      </div>
      {children}
    </div>
  );
}

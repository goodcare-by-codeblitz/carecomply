import * as React from 'react';

export function KbdShortcut({ k }: { k: string }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-white px-1 text-[10px] font-mono text-slate-500 shadow-[0_1px_0_#E2E8F0]">
      {k}
    </kbd>
  );
}

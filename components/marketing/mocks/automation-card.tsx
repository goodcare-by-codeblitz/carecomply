'use client';

import * as React from 'react';
import { Clock, Users, Send, AlertTriangle } from 'lucide-react';
import { MToggle } from '../ui/toggle';

const STEPS = [
  { lab: 'When',              txt: 'A document of type DBS check is within 7 days of expiry', icon: Clock },
  { lab: 'And',               txt: 'Carer is in status "active"',                              icon: Users },
  { lab: 'Then',              txt: 'Email the assigned manager and assign a review task',       icon: Send },
  { lab: 'If not resolved in 48h', txt: 'Re-notify manager + branch admin',                   icon: AlertTriangle },
];

// Step highlight: T=7.2s, peak at 85% (6.12s), stagger=1.8s.
// delay[i] = -(6.12 - i*1.8)s so step 0 lights up first.
const STEP_DELAYS = ['-6.12s', '-4.32s', '-2.52s', '-0.72s'];

export function AutomationCard() {
  const [enabled, setEnabled] = React.useState(true);

  return (
    <div className="rounded-2xl bg-white border border-line shadow-card overflow-hidden">
      <div className="px-5 py-3 border-b border-line flex items-center justify-between">
        <div>
          <div className="text-[11px] text-slate-500 uppercase tracking-[0.14em] font-medium">Automation</div>
          <div className="text-[14px] font-semibold text-ink mt-0.5">
            DBS expiry → escalate to manager
          </div>
        </div>
        <MToggle checked={enabled} onChange={setEnabled} label="Toggle automation" />
      </div>
      <div className="px-5 py-4 space-y-1">
        {STEPS.map((s, i) => (
          <div
            key={i}
            className="animate-step-highlight flex items-start gap-3 px-2 py-2 rounded-lg transition-colors duration-500"
            style={{ animationDelay: STEP_DELAYS[i] }}
          >
            <div className="mt-0.5 h-6 w-12 rounded-md bg-surface-muted text-[10px] uppercase tracking-wide font-semibold text-slate-500 grid place-items-center flex-shrink-0">
              {s.lab}
            </div>
            <s.icon size={14} className="mt-1 text-slate-500 shrink-0" style={{ width: 14, height: 14 }} />
            <div className="text-[13px] text-ink-3 leading-snug">{s.txt}</div>
          </div>
        ))}
      </div>
      <div className="px-5 py-3 border-t border-line bg-[#FCFCFD] flex items-center justify-between text-[11.5px] text-slate-500">
        <span>Last run · 2 minutes ago · 3 carers matched</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-livepulse" />
          Active
        </span>
      </div>
    </div>
  );
}

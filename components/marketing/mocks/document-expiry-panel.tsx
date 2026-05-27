import * as React from 'react';
import { FileText, Bell } from 'lucide-react';
import { Pill } from '../ui/pill';

const DOCS = [
  { t: 'DBS check',          c: 'Marcus Holloway',   d: '+4d',  s: 'danger'  },
  { t: 'Right to Work',      c: 'Priya Subramanian', d: '+9d',  s: 'warn'    },
  { t: 'Manual Handling',    c: 'Hannah Wójcik',     d: '+18d', s: 'warn'    },
  { t: 'Public Liability',   c: 'Adaeze Okonkwo',    d: '+23d', s: 'neutral' },
  { t: 'Mandatory training', c: 'Reuben Castell',    d: '+27d', s: 'neutral' },
];

// Scan delays: T=8s, peak at 85% (6.8s), stagger=1.6s.
// delay[i] = -(6.8 - i*1.6)s — row 0 lights up first, sweeping top → bottom.
const SCAN_DELAYS = ['-6.8s', '-5.2s', '-3.6s', '-2.0s', '-0.4s'];

export function DocumentExpiryPanel() {
  return (
    <div className="rounded-2xl bg-white border border-line shadow-card overflow-hidden">
      <div className="px-5 py-3 border-b border-line flex items-center justify-between">
        <div>
          <div className="text-[14px] font-semibold text-ink">Document expiry queue</div>
          <div className="text-[11px] text-slate-500">
            Reminders fire at{' '}
            <span className="font-mono">−30</span>,{' '}
            <span className="font-mono">−7</span>,{' '}
            <span className="font-mono">0</span> days · Pro adds custom rules
          </div>
        </div>
        <Pill tone="brand">
          <Bell size={11} style={{ width: 11, height: 11 }} /> Auto-reminders on
        </Pill>
      </div>
      <ul className="divide-y divide-line">
        {DOCS.map((d, i) => (
          <li
            key={i}
            className="animate-scan-row px-5 py-3 flex items-center gap-3"
            style={{ animationDelay: SCAN_DELAYS[i] }}
          >
            <div className="h-8 w-8 rounded-md bg-surface-muted text-slate-600 grid place-items-center shrink-0">
              <FileText size={15} style={{ width: 15, height: 15 }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] text-ink font-medium">{d.t}</div>
              <div className="text-[11.5px] text-slate-500 truncate">{d.c}</div>
            </div>
            <div className="text-[11px] font-mono text-slate-500">{d.d}</div>
            <Pill tone={d.s === 'danger' ? 'danger' : d.s === 'warn' ? 'warn' : 'neutral'}>
              {d.s === 'danger' ? 'Critical' : d.s === 'warn' ? 'Reminding' : 'Watching'}
            </Pill>
          </li>
        ))}
      </ul>
    </div>
  );
}

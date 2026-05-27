import * as React from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Pill } from '../ui/pill';

const TIMELINE = [
  { d: 'Day 0',  t: 'Request sent',           sub: 'helen.whitfield@bluebellcare.co.uk', state: 'done' },
  { d: 'Day 3',  t: '1st automatic chase sent', sub: 'Resend message-id rh_8f2…',        state: 'done' },
  { d: 'Day 7',  t: '2nd automatic chase sent', sub: 'Subject: Reminder — reference for Marcus Holloway', state: 'done' },
  { d: 'Day 11', t: 'Reference responded',      sub: 'Form submitted via /reference/q4Sx… · 5/5 questions', state: 'now' },
  { d: 'Day 11', t: 'Manager notified',         sub: 'Imogen Reed · routed to Reviews queue', state: 'pending' },
];

export function ReferenceChasePanel() {
  return (
    <div className="rounded-2xl bg-white border border-line shadow-card overflow-hidden">
      <div className="px-5 py-3 border-b border-line flex items-center justify-between bg-[#FCFCFD]">
        <div>
          <div className="text-[11px] text-slate-500 uppercase tracking-[0.14em] font-medium">
            Reference request
          </div>
          <div className="text-[14px] font-semibold text-ink mt-0.5">
            Dr. Helen Whitfield → Marcus Holloway
          </div>
        </div>
        <Pill tone="warn">
          <Clock size={11} style={{ width: 11, height: 11 }} /> Chasing
        </Pill>
      </div>
      <div className="px-5 py-4">
        <div className="text-[11px] text-slate-500 mb-3">
          Type: <span className="text-ink-3 font-medium">Work reference</span> · Relationship: Senior carer · Token expires in 11 days
        </div>
        <ol className="relative pl-5 border-l border-line space-y-3.5">
          {TIMELINE.map((s, idx) => (
            <li key={idx} className="relative">
              <span
                className={cn(
                  'absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2',
                  s.state === 'done'    ? 'bg-emerald-500 border-emerald-500' :
                  s.state === 'now'     ? 'bg-brand border-brand animate-ring-expand' :
                                          'bg-white border-line-strong'
                )}
              />
              <div className="text-[10px] text-slate-500 font-mono">{s.d}</div>
              <div className="text-[13px] text-ink font-medium leading-snug">{s.t}</div>
              <div className="text-[11.5px] text-slate-500 leading-snug">{s.sub}</div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

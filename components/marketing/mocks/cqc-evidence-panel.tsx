import * as React from 'react';
import { ShieldCheck, Download } from 'lucide-react';

const CQC_CARDS = [
  { k: 'Safe',       v: 412, hint: 'Background, DBS, mandatory training' },
  { k: 'Effective',  v: 287, hint: 'Competency, supervision, induction' },
  { k: 'Caring',     v: 134, hint: 'Feedback, complaints, reviews' },
  { k: 'Responsive', v: 198, hint: 'Visit times, escalations' },
  { k: 'Well-led',   v: 322, hint: 'Governance, audit, billing' },
];

// Stat-num pulse: T=10s, peak at 85% (8.5s), stagger=2s.
// delay[i] = -(8.5 - i*2)s so card 0 lights up first.
const STAT_DELAYS = ['-8.5s', '-6.5s', '-4.5s', '-2.5s', '-0.5s'];

export function CQCEvidencePanel() {
  return (
    <div className="rounded-2xl bg-white border border-line shadow-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2 justify-between mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-brand-700" style={{ width: 14, height: 14, flexShrink: 0 }} />
            <div className="text-[14px] font-semibold text-ink">CQC evidence coverage</div>
          </div>
          <div className="text-[11.5px] text-slate-500 mt-0.5">
            Last 90 days · tamper-evident export ready
          </div>
        </div>
        <button className="h-8 px-3 rounded-md border border-line text-[12px] inline-flex items-center gap-1.5 whitespace-nowrap hover:bg-surface-page">
          <Download size={12} style={{ width: 12, height: 12 }} /> Export Excel
        </button>
      </div>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))' }}>
        {CQC_CARDS.map((c, i) => (
          <div key={c.k} className="rounded-lg border border-line p-3 bg-white min-w-0">
            <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-semibold whitespace-nowrap">
              {c.k}
            </div>
            <div
              className="animate-stat-num mt-1 text-[24px] font-semibold tracking-ultratight tabular-nums leading-none"
              style={{ animationDelay: STAT_DELAYS[i] }}
            >
              {c.v}
            </div>
            <div className="text-[10.5px] text-slate-500 mt-2 leading-snug">{c.hint}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

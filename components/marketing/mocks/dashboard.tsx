import * as React from 'react';
import {
  Activity, Users, FileText, ClipboardCheck, Mail,
  Zap, Shield, Settings, Search, Plus, ArrowRight,
  CheckCircle, AlertTriangle, Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '../logo';
import { MAvatar } from '../ui/avatar';
import { KbdShortcut } from '../ui/kbd';
import { Pill } from '../ui/pill';
import { StatusPill } from './status-pill';

/* ─── Sidebar ─────────────────────────────────────────────────────────────── */
const SIDEBAR_ITEMS: [string, React.FC<{ size: number }>][] = [
  ['Dashboard', Activity as any],
  ['Carers', Users as any],
  ['Documents', FileText as any],
  ['Reviews', ClipboardCheck as any],
  ['References', Mail as any],
  ['Automations', Zap as any],
  ['Audit logs', Shield as any],
  ['Team', Users as any],
  ['Settings', Settings as any],
];

function MockSidebar({ active = 'Dashboard' }) {
  return (
    <aside className="w-[176px] shrink-0 border-r border-line bg-[#FAFBFC] p-2.5 flex flex-col">
      <div className="px-1.5 py-1.5 flex items-center gap-2 min-w-0">
        <Logo mark size={20} />
        <div className="min-w-0">
          <div className="text-[12.5px] font-semibold text-ink leading-none truncate">
            Linden Domiciliary
          </div>
          <div className="text-[10px] text-slate-500 mt-1 truncate">Pro · 47 active carers</div>
        </div>
      </div>
      <div className="mt-2.5 mx-1.5 h-7 rounded-md bg-white border border-line flex items-center px-2 text-[11.5px] text-slate-500 gap-1.5">
        <Search size={11} style={{ width: 11, height: 11, flexShrink: 0 }} />
        Search
        <span className="ml-auto">
          <KbdShortcut k="⌘K" />
        </span>
      </div>
      <nav className="mt-2.5 space-y-0.5">
        {SIDEBAR_ITEMS.map(([label, Icon]) => (
          <div
            key={label}
            className={cn(
              'flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px]',
              label === active
                ? 'bg-white text-ink font-medium shadow-card'
                : 'text-slate-600'
            )}>
            <Icon size={13} />
            <span className="truncate">{label}</span>
            {label === 'Reviews' && (
              <span className="ml-auto text-[10px] px-1.5 rounded bg-amber-100 text-amber-700">3</span>
            )}
            {label === 'References' && (
              <span className="ml-auto text-[10px] px-1.5 rounded bg-brand-50 text-brand-700">7</span>
            )}
          </div>
        ))}
      </nav>
      <div className="mt-auto px-1.5 py-3 flex items-center gap-2 min-w-0">
        <MAvatar name="Imogen Reed" size="sm" tone="#1D4ED8" />
        <div className="min-w-0">
          <div className="text-[11.5px] font-medium text-ink truncate">Imogen Reed</div>
          <div className="text-[10px] text-slate-500 truncate">Compliance manager</div>
        </div>
      </div>
    </aside>
  );
}

/* ─── Stat card ────────────────────────────────────────────────────────────── */
function StatCard({
  label,
  value,
  sub,
  tone = 'neutral',
  icon: Icon,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: 'neutral' | 'warn' | 'ok';
  icon: React.FC<{ size: number }>;
}) {
  const bg = { neutral: 'bg-white', warn: 'bg-amber-50/60 border-amber-200', ok: 'bg-white' }[tone];
  return (
    <div className={cn('rounded-xl border border-line p-3', bg)}>
      <div className="flex items-center gap-1.5">
        <div
          className={cn(
            'h-5 w-5 rounded-md grid place-items-center',
            tone === 'warn' ? 'bg-amber-100 text-amber-700' : 'bg-surface-muted text-slate-600'
          )}>
          <Icon size={11} />
        </div>
        <div className="text-[10.5px] uppercase tracking-[0.12em] text-slate-500 font-semibold whitespace-nowrap">
          {label}
        </div>
      </div>
      <div
        className={cn(
          'mt-1.5 text-[24px] font-semibold tracking-ultratight tabular-nums leading-none',
          tone === 'warn' ? 'text-amber-700' : 'text-ink'
        )}>
        {value}
      </div>
      <div className="text-[10.5px] text-slate-500 mt-1 leading-snug">{sub}</div>
    </div>
  );
}

/* ─── Dashboard ─────────────────────────────────────────────────────────────── */
const CARERS = [
  { n: 'Adaeze Okonkwo',    s: 'active',     p: 100 },
  { n: 'Marcus Holloway',   s: 'incomplete', p: 80  },
  { n: 'Priya Subramanian', s: 'pending',    p: 45  },
  { n: 'Reuben Castell',    s: 'active',     p: 100 },
  { n: 'Hannah Wójcik',     s: 'on_leave',   p: 100 },
];

const EXPIRING = [
  { t: 'DBS check',         c: 'Marcus Holloway',   d: 4,  crit: true  },
  { t: 'Right to Work',     c: 'Priya Subramanian', d: 9              },
  { t: 'Manual Handling',   c: 'Hannah Wójcik',     d: 18             },
  { t: 'Public Liability',  c: 'Adaeze Okonkwo',    d: 23             },
];

export function MockDashboard({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex bg-[#F7F8FA] min-h-[560px]">
      <MockSidebar active="Dashboard" />
      <div className="flex-1 min-w-0 p-4 sm:p-5">
        {/* Header */}
        <div className="flex flex-wrap items-end gap-3 justify-between mb-4">
          <div className="min-w-0">
            <div className="text-[11px] text-slate-500">Linden Domiciliary · Wirral</div>
            <h3 className="text-[18px] sm:text-[20px] font-semibold tracking-tight text-ink whitespace-nowrap">
              Good morning, Imogen
            </h3>
            <p className="text-[12px] text-slate-500">Here is what needs attention today.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden lg:flex items-center gap-1.5 text-[11.5px] text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-livepulse" />
              Live
            </div>
            <button className="h-8 px-3 rounded-md bg-ink text-white text-[12px] inline-flex items-center gap-1.5 whitespace-nowrap">
              <Plus size={12} style={{ width: 12, height: 12 }} /> Add carer
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <StatCard label="Total carers"    value="47" sub="Registered in org"  icon={Users as any} />
          <StatCard label="Active"          value="38" sub="Fully compliant"    icon={CheckCircle as any} />
          <StatCard label="Pending reviews" value="3"  sub="Need your review"   icon={ClipboardCheck as any} tone="warn" />
          <StatCard label="Expiring soon"   value="6"  sub="Within 30 days"     icon={AlertTriangle as any} tone="warn" />
        </div>

        {/* Tables */}
        <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Recent carers */}
          <div className="rounded-xl border border-line bg-white">
            <div className="px-4 py-2.5 border-b border-line flex items-center justify-between">
              <div className="text-[13px] font-semibold text-ink">Recent carers</div>
              <button className="text-[11px] text-slate-500 hover:text-ink inline-flex items-center gap-1">
                View all <ArrowRight size={11} style={{ width: 11, height: 11 }} />
              </button>
            </div>
            <div className="divide-y divide-line">
              {CARERS.slice(0, compact ? 3 : 5).map((c) => (
                <div key={c.n} className="px-3.5 py-2.5 flex items-center gap-2.5">
                  <MAvatar name={c.n} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium text-ink truncate">{c.n}</div>
                    <div className="text-[11px] text-slate-500 truncate">{c.p}% onboarding</div>
                  </div>
                  <StatusPill s={c.s} />
                </div>
              ))}
            </div>
          </div>

          {/* Expiring documents */}
          <div className="rounded-xl border border-line bg-white">
            <div className="px-4 py-2.5 border-b border-line flex items-center justify-between">
              <div className="text-[13px] font-semibold text-ink">Expiring documents</div>
              <button className="text-[11px] text-slate-500 hover:text-ink inline-flex items-center gap-1">
                View all <ArrowRight size={11} style={{ width: 11, height: 11 }} />
              </button>
            </div>
            <div className="divide-y divide-line">
              {EXPIRING.slice(0, compact ? 3 : 4).map((d) => (
                <div key={d.t + d.c} className="px-3.5 py-2.5 flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-md bg-surface-muted grid place-items-center text-slate-600 shrink-0">
                    <FileText size={14} style={{ width: 14, height: 14 }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium text-ink truncate">{d.t}</div>
                    <div className="text-[11px] text-slate-500 truncate">{d.c}</div>
                  </div>
                  <Pill tone={d.crit ? 'danger' : 'warn'}>{d.d <= 0 ? 'Expired' : `${d.d}d`}</Pill>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

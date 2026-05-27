'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, CheckCircle, Circle, Clock, Eye, AlertTriangle, Bell,
  Send, Lock, Mail, Download, Activity, ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Container } from '../ui/container';
import { SectionHeader } from '../ui/section-header';
import { Pill } from '../ui/pill';
import { MAvatar } from '../ui/avatar';
import { MProgress } from '../ui/progress';

/* ─── Auto-cycling active stage hook ───────────────────────────────────────── */
function useActiveStage(count: number, intervalMs = 2600) {
  const [active, setActive] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setActive((a) => (a + 1) % count), intervalMs);
    return () => clearInterval(id);
  }, [count, intervalMs, paused]);

  return { active, setActive, setPaused };
}

/* ─── Stage stages metadata ─────────────────────────────────────────────────── */
const STAGES = [
  { k: 'invite',     n: '01', label: 'Invite' },
  { k: 'documents',  n: '02', label: 'Documents' },
  { k: 'review',     n: '03', label: 'Review' },
  { k: 'references', n: '04', label: 'References' },
  { k: 'expiry',     n: '05', label: 'Expiry' },
  { k: 'audit',      n: '06', label: 'Audit' },
];

/* ─── Stage card shell ─────────────────────────────────────────────────────── */
function StageCard({
  n, title, sub, footer, active, done, children,
}: {
  n: string;
  title: string;
  sub: string;
  footer: string;
  active: boolean;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      layout
      className={cn(
        'relative rounded-2xl border bg-white p-5 h-full flex flex-col',
        active ? 'border-brand' : done ? 'border-line' : 'border-line opacity-95'
      )}
      style={
        active
          ? { boxShadow: '0 0 0 1px rgba(29,78,216,0.45), 0 0 0 6px rgba(29,78,216,0.06), 0 8px 32px -8px rgba(29,78,216,0.18)' }
          : { boxShadow: '0 1px 0 rgba(15,23,42,0.04), 0 1px 2px rgba(15,23,42,0.04)' }
      }
      transition={{ duration: 0.3, ease: [0.21, 0.47, 0.32, 0.98] }}>

      {/* Stage header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <motion.span
            className={cn(
              'font-mono text-[11px] tracking-wide px-2 py-0.5 rounded-md',
              active ? 'bg-brand text-white' :
              done   ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' :
                       'bg-surface-muted text-slate-500'
            )}
            layout>
            {n}
          </motion.span>
          <span className="text-[14.5px] font-semibold text-ink">{title}</span>
        </div>

        {active ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-700">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-brand opacity-50 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
            </span>
            Running
          </span>
        ) : done ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
            <Check size={11} style={{ width: 11, height: 11 }} /> Done
          </span>
        ) : (
          <span className="text-[11px] text-slate-400 font-medium">Idle</span>
        )}
      </div>

      {sub && <p className="text-[12.5px] text-slate-600 mb-3 leading-snug">{sub}</p>}
      <div className="flex-1">{children}</div>
      {footer && (
        <div className="mt-3 pt-3 border-t border-line text-[11px] text-slate-500">{footer}</div>
      )}
    </motion.div>
  );
}

/* ─── Individual stage previews ─────────────────────────────────────────────── */
function StageInvite({ active }: { active: boolean }) {
  return (
    <div className="space-y-2.5">
      <div className="rounded-lg border border-line p-2.5 flex items-center gap-2.5">
        <MAvatar name="Adaeze Okonkwo" size="sm" tone="#1D4ED8" />
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-medium text-ink truncate">Adaeze Okonkwo</div>
          <div className="text-[10.5px] text-slate-500 truncate">adaeze.o@linden.co.uk</div>
        </div>
        <Pill tone="brand">Carer</Pill>
      </div>
      <div className="rounded-lg border border-line bg-surface-page px-2.5 py-2 font-mono text-[10.5px] text-slate-600 flex items-center gap-2 overflow-hidden">
        <Lock size={10} style={{ width: 10, height: 10, flexShrink: 0 }} />
        <span className="truncate">
          app.carecomply.co.uk/onboarding/<span className="text-ink">qK4f8a…</span>
        </span>
      </div>
      <motion.div
        className={cn(
          'h-9 rounded-lg flex items-center justify-center gap-2 text-[12.5px] font-medium',
          active ? 'bg-brand text-white' : 'bg-ink text-white opacity-80'
        )}
        animate={{ scale: active ? [1, 0.98, 1] : 1 }}
        transition={{ duration: 0.4 }}>
        <Send size={12} style={{ width: 12, height: 12 }} />
        {active ? 'Sending invite…' : 'Send invite link'}
      </motion.div>
    </div>
  );
}

function StageDocuments({ active }: { active: boolean }) {
  const docs = [
    { t: 'DBS check',       s: 'done',                  p: 100 },
    { t: 'Right to Work',   s: 'done',                  p: 100 },
    { t: 'Training certs',  s: active ? 'uploading' : 'done', p: active ? 64 : 100 },
    { t: 'Passport',        s: active ? 'pending' : 'done',   p: 100 },
  ];
  const completed = docs.filter((d) => d.s === 'done').length;
  return (
    <div className="space-y-1.5">
      {docs.map((d, i) => (
        <div key={i} className="flex items-center gap-2 text-[12px]">
          {d.s === 'done' && <CheckCircle size={13} className="text-emerald-600 shrink-0" style={{ width: 13, height: 13 }} />}
          {d.s === 'uploading' && (
            <span className="h-3 w-3 rounded-full border-2 border-brand border-t-transparent animate-spin shrink-0" style={{ flexShrink: 0 }} />
          )}
          {d.s === 'pending' && <Circle size={13} className="text-slate-300 shrink-0" style={{ width: 13, height: 13 }} />}
          <span className={cn('flex-1 truncate', d.s === 'pending' ? 'text-slate-400' : 'text-ink-3')}>
            {d.t}
          </span>
          {d.s === 'uploading' && (
            <div className="w-14 h-1.5 rounded-full bg-surface-muted overflow-hidden">
              <motion.div
                className="h-full bg-brand rounded-full"
                animate={{ width: `${d.p}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          )}
          {d.s === 'done' && <span className="text-[10px] text-slate-400">PDF</span>}
        </div>
      ))}
      <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span>{completed}/{docs.length} uploaded</span>
        <Pill tone="neutral">Self-serve</Pill>
      </div>
    </div>
  );
}

function StageReview({ active }: { active: boolean }) {
  const items = [
    { t: 'DBS check',                  k: 'Document',  s: active ? 'approving' : 'approved' },
    { t: 'Right to Work',              k: 'Document',  s: 'approved' },
    { t: 'Reference — Dr. H. Whitfield', k: 'Reference', s: active ? 'pending' : 'approved' },
    { t: 'Training certs',             k: 'Document',  s: active ? 'pending' : 'approved' },
  ];
  const approved = items.filter((i) => i.s === 'approved').length;
  const total = items.length;
  const allApproved = approved === total;

  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div
          key={i}
          className={cn(
            'rounded-lg border p-2 flex items-center gap-2.5 transition',
            it.s === 'approving' ? 'border-brand bg-brand-50/40' : 'border-line bg-white'
          )}>
          <div
            className={cn(
              'h-6 w-6 rounded-md grid place-items-center shrink-0',
              it.s === 'approved'  ? 'bg-emerald-50 text-emerald-700' :
              it.s === 'approving' ? 'bg-brand-50 text-brand-700' :
                                     'bg-surface-muted text-slate-500'
            )}>
            {it.s === 'approved'  ? <Check size={12} style={{ width: 12, height: 12 }} /> :
             it.s === 'approving' ? <Eye size={12} style={{ width: 12, height: 12 }} /> :
                                    <Clock size={12} style={{ width: 12, height: 12 }} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-medium text-ink truncate">{it.t}</div>
            <div className="text-[10px] text-slate-500">{it.k}</div>
          </div>
          {it.s === 'approving' ? (
            <span className="text-[10px] font-semibold text-brand-700 inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-brand animate-livepulse" /> Reviewing
            </span>
          ) : it.s === 'approved' ? (
            <span className="text-[10px] font-semibold text-emerald-700">Approved</span>
          ) : (
            <span className="text-[10px] text-slate-400">Pending</span>
          )}
        </div>
      ))}
      <div className="pt-2 mt-1 border-t border-line flex items-center gap-3">
        <MAvatar name="Imogen Reed" size="sm" tone="#1D4ED8" />
        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] font-medium text-ink leading-tight">Imogen Reed</div>
          <div className="text-[10px] text-slate-500">Approving as Compliance manager</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-mono text-slate-500 tabular-nums">{approved}/{total} approved</div>
          <div className={cn('text-[10px] font-semibold mt-0.5', allApproved ? 'text-emerald-700' : 'text-amber-700')}>
            {allApproved ? <>Status → <span className="font-bold">Active</span></> : <>Status: Incomplete</>}
          </div>
        </div>
      </div>
    </div>
  );
}

function StageReferences({ active }: { active: boolean }) {
  const dots = [
    { d: 'Day 0',  l: 'Request sent',   done: true,   now: false },
    { d: 'Day 3',  l: 'Chase 1',        done: true,   now: false },
    { d: 'Day 7',  l: 'Chase 2',        done: active, now: active },
    { d: 'Day 14', l: 'Chase 3',        done: false,  now: false },
  ];
  return (
    <div>
      <div className="rounded-lg border border-line p-2.5 flex items-center gap-2.5 mb-3">
        <div className="h-7 w-7 rounded-md bg-emerald-50 text-emerald-700 grid place-items-center shrink-0">
          <Mail size={14} style={{ width: 14, height: 14 }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-medium text-ink truncate">Dr. Helen Whitfield</div>
          <div className="text-[10.5px] text-slate-500 truncate">Work reference · /reference/q4Sx…</div>
        </div>
      </div>
      <div className="relative pl-3.5">
        <div className="absolute left-1 top-1.5 bottom-1.5 w-px bg-line" />
        {dots.map((s, i) => (
          <div key={i} className="relative flex items-center gap-2.5 py-1">
            <motion.span
              className={cn(
                'absolute -left-[10px] h-2.5 w-2.5 rounded-full border-2',
                s.now  ? 'bg-brand border-brand ring-4 ring-brand-50' :
                s.done ? 'bg-emerald-500 border-emerald-500' :
                         'bg-white border-line-strong'
              )}
              animate={s.now ? { scale: [1, 1.15, 1] } : {}}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
            <span className="text-[10px] font-mono text-slate-500 w-12">{s.d}</span>
            <span className={cn('text-[12px]', s.now ? 'text-ink font-medium' : 'text-ink-3')}>
              {s.l}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StageExpiry({ active }: { active: boolean }) {
  const docs = [
    { t: 'DBS check',       c: 'M. Holloway', d: 4,  tone: 'danger' },
    { t: 'Manual Handling', c: 'H. Wójcik',   d: 18, tone: 'warn'   },
    { t: 'Public Liability',c: 'A. Okonkwo',  d: 23, tone: 'neutral'},
  ];
  return (
    <div className="space-y-2">
      {docs.map((d, i) => (
        <motion.div
          key={i}
          className={cn(
            'rounded-lg border p-2 flex items-center gap-2.5 transition',
            d.tone === 'danger' && active ? 'border-red-200 bg-red-50/50' : 'border-line bg-white'
          )}>
          <div
            className={cn(
              'h-7 w-7 rounded-md grid place-items-center shrink-0',
              d.tone === 'danger' ? 'bg-red-50 text-red-700' :
              d.tone === 'warn'   ? 'bg-amber-50 text-amber-700' :
                                    'bg-surface-muted text-slate-600'
            )}>
            {d.tone === 'danger' ? <AlertTriangle size={13} style={{ width: 13, height: 13 }} /> : <Clock size={13} style={{ width: 13, height: 13 }} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-medium text-ink truncate">{d.t}</div>
            <div className="text-[10.5px] text-slate-500">{d.c}</div>
          </div>
          <span
            className={cn(
              'text-[10.5px] font-mono font-semibold tabular-nums px-1.5 py-0.5 rounded',
              d.tone === 'danger' ? 'bg-red-100 text-red-700' :
              d.tone === 'warn'   ? 'bg-amber-100 text-amber-700' :
                                    'bg-surface-muted text-slate-600'
            )}>
            {d.d}d
          </span>
        </motion.div>
      ))}
      <div className="pt-1 text-[11px] text-slate-500 flex items-center gap-1.5">
        <Bell
          size={11}
          style={{ width: 11, height: 11 }}
          className={active ? 'text-brand animate-pulse' : 'text-slate-400'}
        />
        Auto-reminders at −30, −7, 0
      </div>
    </div>
  );
}

function StageAudit({ active }: { active: boolean }) {
  const pct = active ? 96 : 91;
  const offset = active ? 4 : 8.5;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative h-12 w-12 shrink-0">
          <svg className="absolute inset-0" viewBox="0 0 36 36" style={{ width: '100%', height: '100%' }}>
            <circle cx="18" cy="18" r="15" fill="none" stroke="#E2E8F0" strokeWidth="3" />
            <motion.circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="#10B981"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="94.25"
              transform="rotate(-90 18 18)"
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-[11px] font-semibold text-ink tabular-nums">
            {pct}%
          </div>
        </div>
        <div>
          <div className="text-[12.5px] font-medium text-ink">Org compliance</div>
          <div className="text-[10.5px] text-slate-500">47 carers · CQC-ready</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { l: 'Safe',      v: '412' },
          { l: 'Effective', v: '287' },
          { l: 'Well-led',  v: '322' },
        ].map((s, i) => (
          <div key={i} className="rounded-md border border-line p-1.5 text-center">
            <div className="text-[9px] uppercase tracking-[0.10em] text-slate-500 font-semibold">{s.l}</div>
            <div className="text-[14px] font-semibold tabular-nums text-ink mt-0.5 leading-none">{s.v}</div>
          </div>
        ))}
      </div>
      <button className="w-full h-8 rounded-md bg-ink text-white text-[11.5px] font-medium inline-flex items-center justify-center gap-1.5">
        <Download size={12} style={{ width: 12, height: 12 }} /> Export signed evidence
      </button>
    </div>
  );
}

/* ─── SVG workflow connectors ────────────────────────────────────────────── */
function HArrow({ left, top, flowing }: { left: string; top: string; flowing: boolean }) {
  const stroke = flowing ? '#1D4ED8' : '#94A3B8';
  const halo = flowing ? 'rgba(29,78,216,0.10)' : 'rgba(255,255,255,0.80)';
  return (
    <div className="absolute" style={{ left, top, transform: 'translate(-50%, -50%)' }}>
      <svg width="64" height="28" viewBox="0 0 64 28" aria-hidden="true" style={{ width: 64, height: 28 }}>
        <rect x="2" y="6" width="60" height="16" rx="8" fill={halo} />
        <line
          x1="10" y1="14" x2="50" y2="14"
          stroke={stroke} strokeWidth="2" strokeLinecap="round"
          strokeDasharray={flowing ? '7 5' : '0'}>
          {flowing && (
            <animate attributeName="stroke-dashoffset" from="12" to="0" dur="0.9s" repeatCount="indefinite" />
          )}
        </line>
        <path d="M 47 8 L 55 14 L 47 20" stroke={stroke} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function SCurve({ flowing }: { flowing: boolean }) {
  const stroke = flowing ? '#1D4ED8' : '#94A3B8';
  const fill = flowing ? '#1D4ED8' : '#94A3B8';
  const markerId = flowing ? 'arrowOn' : 'arrowOff';
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="none"
      viewBox="0 0 1000 600"
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <defs>
        <marker id={markerId} viewBox="0 0 12 12" refX="9" refY="6" markerWidth="9" markerHeight="9" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M 1 1 L 10 6 L 1 11 Z" fill={fill} />
        </marker>
      </defs>
      <path
        d="M 930 168 C 1010 200, 990 320, 900 320 L 100 320 C 10 320, 10 432, 90 432"
        stroke={stroke}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={flowing ? '9 7' : '0'}
        markerEnd={`url(#${markerId})`}
        vectorEffect="non-scaling-stroke">
        {flowing && (
          <animate attributeName="stroke-dashoffset" from="32" to="0" dur="2.4s" repeatCount="indefinite" />
        )}
      </path>
    </svg>
  );
}

function WorkflowConnectors({ active }: { active: number }) {
  return (
    <div className="hidden lg:block absolute inset-0 pointer-events-none" aria-hidden="true">
      {[
        { left: '33.33%', top: '25%', flowing: active === 0 || active === 1 },
        { left: '66.66%', top: '25%', flowing: active === 1 || active === 2 },
        { left: '33.33%', top: '75%', flowing: active === 3 || active === 4 },
        { left: '66.66%', top: '75%', flowing: active === 4 || active === 5 },
      ].map((c, i) => (
        <HArrow key={i} left={c.left} top={c.top} flowing={c.flowing} />
      ))}
      <SCurve flowing={active === 2 || active === 3} />
    </div>
  );
}

/* ─── Stage configs ─────────────────────────────────────────────────────────── */
const STAGE_CONFIGS = [
  { title: 'Add the carer',      sub: 'Issue a personal, expiring invite link.',          Component: StageInvite,     footer: 'Token-protected · revocable' },
  { title: 'Collect documents',  sub: 'Carer self-uploads to the right doc types.',       Component: StageDocuments,  footer: 'Replaces obsolete · keeps trail' },
  { title: 'Review & approve',   sub: 'A manager approves each document and reference.',  Component: StageReview,     footer: 'Carer flips to Active only when all required items approved' },
  { title: 'Chase references',   sub: 'Day-3, day-7 and day-14 chases. Hands-off.',       Component: StageReferences, footer: 'Sent from your agency name' },
  { title: 'Track expiry',       sub: 'Reminders fire automatically. Escalations.',       Component: StageExpiry,     footer: '−30 · −7 · 0 day · Pro adds custom' },
  { title: 'Stay audit-ready',   sub: 'A signed pack the inspector can open.',            Component: StageAudit,      footer: 'Tamper-evident · 5 CQC questions' },
];

/* ─── Main component ─────────────────────────────────────────────────────────── */
export function WorkflowJourney() {
  const { active, setActive, setPaused } = useActiveStage(STAGES.length, 2600);

  return (
    <section className="relative py-20 lg:py-28 overflow-hidden border-y border-line bg-white">
      {/* Background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(60% 40% at 50% 0%, rgba(29,78,216,0.05) 0%, transparent 60%)' }}
      />
      <div className="absolute inset-0 pointer-events-none bg-speckle opacity-50" />

      <Container className="relative">
        {/* Header + stage pills */}
        <div className="grid md:grid-cols-[1fr_1fr] gap-8 items-end mb-12">
          <SectionHeader
            eyebrow="The carer lifecycle"
            title="From invite to audit-ready, on autopilot."
            lead="One workflow connects onboarding, document review, reference chasing, expiry tracking, and CQC evidence. Watch a carer flow through, end to end."
            className="!max-w-none"
          />
          <div className="hidden md:flex flex-wrap items-center gap-2 justify-end">
            {STAGES.map((s, i) => (
              <button
                key={s.k}
                onClick={() => setActive(i)}
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 h-8 rounded-full border text-[12px] transition focus-ring',
                  active === i
                    ? 'bg-ink text-white border-ink'
                    : 'bg-white border-line text-slate-600 hover:border-line-strong'
                )}>
                <span className="font-mono text-[10px] opacity-70">{s.n}</span>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid + connectors */}
        <div
          className="relative"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}>
          <WorkflowConnectors active={active} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-x-12 lg:gap-y-16 relative">
            {STAGE_CONFIGS.map(({ title, sub, Component, footer }, i) => (
              <StageCard
                key={i}
                n={STAGES[i].n}
                title={title}
                sub={sub}
                footer={footer}
                active={i === active}
                done={i < active}>
                <Component active={i === active} />
              </StageCard>
            ))}
          </div>
        </div>

        {/* Bottom outcome callouts */}
        <div className="mt-12 grid sm:grid-cols-3 gap-5">
          {[
            { Icon: Activity,    t: 'Live compliance status',  d: 'Per carer, recalculated automatically.' },
            { Icon: Bell,        t: 'Zero silent expiries',    d: 'Reminders + escalations on every doc.' },
            { Icon: ShieldCheck, t: 'CQC pack in one click',   d: 'Tamper-evident, scoped by key question.' },
          ].map(({ Icon, t, d }, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.45 }}
              className="flex items-start gap-3 rounded-2xl border border-line bg-surface-page p-4">
              <div className="h-9 w-9 rounded-lg bg-brand-50 text-brand-700 grid place-items-center shrink-0">
                <Icon size={16} style={{ width: 16, height: 16 }} />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-ink">{t}</div>
                <div className="text-[12.5px] text-slate-600 leading-snug mt-0.5">{d}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}

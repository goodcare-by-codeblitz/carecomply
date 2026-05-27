import * as React from 'react';
import { ShieldCheck, Lock, Server, FileCheck, Key, Users } from 'lucide-react';
import type { Metadata } from 'next';
import { Container } from '@/components/marketing/ui/container';
import { Eyebrow } from '@/components/marketing/ui/eyebrow';
import { SectionHeader } from '@/components/marketing/ui/section-header';
import { Pill } from '@/components/marketing/ui/pill';
import { AuditLogPanel } from '@/components/marketing/mocks/audit-log-panel';
import { CTABand } from '@/components/marketing/sections/cta-band';
import { Reveal } from '@/components/marketing/animations/reveal';
import { StaggerContainer, StaggerItem } from '@/components/marketing/animations/stagger';

export const metadata: Metadata = {
  title: 'Trust & Security — CareComply',
  description: 'How CareComply protects carer data. UK-hosted, ICO-registered, encrypted at rest, tamper-evident exports.',
};

const TRUST_ITEMS = [
  { Icon: ShieldCheck, t: 'ICO-registered',          d: 'We are a registered data controller under UK GDPR and the Data Protection Act 2018.' },
  { Icon: Server,      t: 'UK data residency',        d: 'All data is stored and processed in AWS eu-west-2 (London). Your data never leaves the UK.' },
  { Icon: Lock,        t: 'Encryption at rest',       d: 'AES-256 encryption on all stored data. TLS 1.2+ on all data in transit.' },
  { Icon: FileCheck,   t: 'Tamper-evident exports',   d: 'Every audit export is cryptographically signed with HMAC. Verifiable years later.' },
  { Icon: Key,         t: 'Row-level security',       d: 'Database-level isolation. No query can access another organisation\'s data — enforced at the DB layer, not application layer.' },
  { Icon: Users,       t: 'Granular permissions',     d: 'Every action is scoped to a role. Custom roles on Pro. Audit log records the identity behind every operation.' },
];

const COMPLIANCE_MARKS = [
  ['ICO-registered', 'data controller · ZB123456'],
  ['UK GDPR', 'compliant data processor'],
  ['AWS London', 'eu-west-2 · SOC 2 Type II certified infrastructure'],
  ['DPA available', 'pre-signed on Pro and Enterprise'],
];

export default function SecurityPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 bg-grid" />
        <Container className="relative pt-20 pb-16">
          <Reveal>
            <div className="flex items-center gap-3 mb-4">
              <Eyebrow>Trust &amp; security</Eyebrow>
              <Pill tone="ok">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-livepulse" />
                All systems operational
              </Pill>
            </div>
            <h1 className="text-[30px] sm:text-[44px] lg:text-[54px] leading-[1.04] font-semibold tracking-ultratight text-ink max-w-3xl">
              Carer data treated like the clinical record it is.
            </h1>
            <p className="mt-5 text-[17px] leading-[1.55] text-slate-600 max-w-2xl">
              CareComply was designed for regulated environments. We host in the UK, encrypt at rest, sign every export, and enforce security at the database layer — not just the application.
            </p>
          </Reveal>
        </Container>
      </section>

      {/* Compliance marks */}
      <section className="py-12 border-b border-line bg-white">
        <Container>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {COMPLIANCE_MARKS.map(([h, d]) => (
              <div key={h} className="flex items-start gap-3 p-4 rounded-xl border border-line bg-surface-page">
                <ShieldCheck size={16} className="text-brand-700 mt-0.5 shrink-0" style={{ width: 16, height: 16 }} />
                <div>
                  <div className="text-[13px] font-semibold text-ink">{h}</div>
                  <div className="text-[11.5px] text-slate-500 mt-0.5 leading-snug">{d}</div>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Security controls */}
      <section className="py-20 lg:py-24">
        <Container>
          <SectionHeader
            eyebrow="Security controls"
            title="Protection at every layer."
            lead="Security is not an afterthought in CareComply — it is a design constraint. Here is how we protect the data you entrust to us."
          />
          <StaggerContainer className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5" staggerDelay={0.08}>
            {TRUST_ITEMS.map(({ Icon, t, d }) => (
              <StaggerItem key={t}>
                <div className="rounded-2xl border border-line bg-white p-6 h-full">
                  <div className="h-10 w-10 rounded-xl bg-brand-50 text-brand-700 grid place-items-center shrink-0">
                    <Icon size={18} style={{ width: 18, height: 18 }} />
                  </div>
                  <h3 className="mt-4 text-[15px] font-semibold text-ink">{t}</h3>
                  <p className="mt-2 text-[13.5px] text-slate-600 leading-snug">{d}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </Container>
      </section>

      {/* Audit log demo */}
      <section className="py-20 bg-white border-y border-line">
        <Container>
          <div className="grid md:grid-cols-[1fr_1.4fr] gap-12 items-start">
            <Reveal>
              <Eyebrow>Audit trail</Eyebrow>
              <h2 className="mt-4 text-[26px] sm:text-[32px] lg:text-[38px] leading-[1.05] font-semibold tracking-ultratight text-ink">
                Every action. Tamper-evident. Verifiable.
              </h2>
              <p className="mt-4 text-[15px] text-slate-600 leading-[1.6]">
                The audit log records every event — who did it, when, from where, and what CQC key question it maps to. The log is append-only; no user, including an owner, can edit or delete entries.
              </p>
              <ul className="mt-6 space-y-2.5 text-[14px] text-slate-700">
                {[
                  'Immutable append-only log',
                  'User identity + IP on every event',
                  'CQC key question tagging',
                  'Exportable as signed CSV or Excel',
                  'HMAC-verified exports — independently verifiable',
                ].map((p) => (
                  <li key={p} className="flex items-start gap-2.5">
                    <ShieldCheck size={14} className="text-brand-700 mt-0.5 shrink-0" style={{ width: 14, height: 14 }} />
                    {p}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.15}>
              <AuditLogPanel />
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Data processing */}
      <section className="py-20 lg:py-24">
        <Container>
          <div className="max-w-3xl">
            <Reveal>
              <Eyebrow>Data processing</Eyebrow>
              <h2 className="mt-4 text-[32px] font-semibold tracking-ultratight text-ink">
                Your data is yours. Always.
              </h2>
              <div className="mt-6 space-y-4 text-[15px] text-slate-600 leading-[1.65]">
                <p>
                  CareComply acts as a data processor for your tenant data and a data controller for our own operational data. A standard Data Processing Agreement (DPA) is available on request and pre-signed for Pro and Enterprise customers.
                </p>
                <p>
                  Sub-processors are limited to AWS (infrastructure), Stripe (billing), and Resend (transactional email). We do not sell or share your data with third parties.
                </p>
                <p>
                  If you cancel, you can export everything — every document, every audit log, every reference — before your account closes. Tenant data is permanently deleted within 30 days of confirmed cancellation.
                </p>
              </div>
            </Reveal>
          </div>
        </Container>
      </section>

      <CTABand />
    </>
  );
}

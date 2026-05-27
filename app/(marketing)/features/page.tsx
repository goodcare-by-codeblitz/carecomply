import * as React from 'react';
import Link from 'next/link';
import {
  ListChecks, Mail, Bell, FileCheck, Users, ShieldCheck,
  Zap, Settings, Building2, BarChart2, Check, ArrowRight,
} from 'lucide-react';
import type { Metadata } from 'next';
import { Container } from '@/components/marketing/ui/container';
import { Eyebrow } from '@/components/marketing/ui/eyebrow';
import { SectionHeader } from '@/components/marketing/ui/section-header';
import { MButton } from '@/components/marketing/ui/button';
import { Pill } from '@/components/marketing/ui/pill';
import { CTABand } from '@/components/marketing/sections/cta-band';
import { Reveal } from '@/components/marketing/animations/reveal';
import { StaggerContainer, StaggerItem } from '@/components/marketing/animations/stagger';
import { ReferenceChasePanel } from '@/components/marketing/mocks/reference-chase-panel';
import { DocumentExpiryPanel } from '@/components/marketing/mocks/document-expiry-panel';
import { CQCEvidencePanel } from '@/components/marketing/mocks/cqc-evidence-panel';
import { AutomationCard } from '@/components/marketing/mocks/automation-card';
import { AuditLogPanel } from '@/components/marketing/mocks/audit-log-panel';

export const metadata: Metadata = {
  title: 'Features — CareComply',
  description: 'Twelve workflows. One operations layer. CareComply is built around the work compliance managers actually do every day.',
};

const IN_PAGE_NAV = [
  ['compliance', 'Compliance tracking'],
  ['onboarding', 'Carer onboarding'],
  ['documents', 'Document management'],
  ['expiry', 'Expiry reminders'],
  ['references', 'Reference chasing'],
  ['reviews', 'Document review'],
  ['audit', 'Audit logs'],
  ['cqc', 'CQC readiness'],
  ['automations', 'Automations'],
  ['team', 'Team & roles'],
  ['orgs', 'Multi-tenant orgs'],
  ['reporting', 'Reporting & exports'],
];

const ALL_CAPABILITIES = [
  { Icon: ListChecks,  t: 'Live compliance status',     d: 'Real-time per-carer status recalculated on every document change.',          section: 'compliance' },
  { Icon: Users,       t: 'Carer onboarding',           d: 'Token-protected invite links. Self-serve document upload. Automatic progress.', section: 'onboarding' },
  { Icon: FileCheck,   t: 'Document management',        d: 'Upload, version, supersede, and archive documents. Full replacement trail.',     section: 'documents' },
  { Icon: Bell,        t: 'Expiry reminders',           d: 'Fixed 30/7/0-day reminders. Pro adds per-document-type custom rules.',          section: 'expiry' },
  { Icon: Mail,        t: 'Reference chasing',          d: 'Token-protected forms. Automatic day-3, day-7, day-14 chases.',                 section: 'references' },
  { Icon: ShieldCheck, t: 'Document review',            d: 'Approve, reject, replace, supersede with timestamped audit trail.',             section: 'reviews' },
  { Icon: BarChart2,   t: 'Audit logs',                 d: 'Every action logged with user, IP, source, CQC key question, category.',        section: 'audit' },
  { Icon: ShieldCheck, t: 'CQC-ready evidence',         d: 'Tamper-evident exports tagged by Safe, Effective, Caring, Responsive, Well-led.', section: 'cqc' },
  { Icon: Zap,         t: 'Automations',                d: 'Plain-English rules. Escalation chains. Per-document-type triggers on Pro.',     section: 'automations' },
  { Icon: Settings,    t: 'Team & roles',               d: 'Unlimited team seats. Granular permissions. Custom roles on Pro.',              section: 'team' },
  { Icon: Building2,   t: 'Multi-tenant orgs',          d: 'Each branch is an isolated org with its own carers, audit log, and billing.',   section: 'orgs' },
  { Icon: BarChart2,   t: 'Reporting & exports',        d: 'CSV and Excel exports. Scoped by date, category, CQC question. Signed.',        section: 'reporting' },
];

function FeatureSplit({
  id, eyebrow, title, lead, points, children, reverse = false,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  lead: string;
  points: string[];
  children: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <section id={id} className="py-20 lg:py-24 border-b border-line scroll-mt-20">
      <Container>
        <div className={`grid md:grid-cols-2 gap-12 items-center ${reverse ? 'md:[&>*:first-child]:order-2' : ''}`}>
          <Reveal>
            <Eyebrow>{eyebrow}</Eyebrow>
            <h2 className="mt-4 text-[26px] sm:text-[32px] lg:text-[40px] leading-[1.05] font-semibold tracking-ultratight text-ink">
              {title}
            </h2>
            <p className="mt-4 text-[16px] text-slate-600 leading-[1.6] max-w-xl">{lead}</p>
            <ul className="mt-6 space-y-3">
              {points.map((p, i) => (
                <li key={i} className="flex items-start gap-3 text-[14.5px] text-ink-3 leading-snug">
                  <span className="mt-1 h-4 w-4 rounded-full bg-brand-50 text-brand-700 grid place-items-center shrink-0">
                    <Check size={11} style={{ width: 11, height: 11 }} />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.15}>{children}</Reveal>
        </div>
      </Container>
    </section>
  );
}

export default function FeaturesPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 bg-grid" />
        <Container className="relative pt-20 pb-16">
          <Reveal>
            <Eyebrow>Product</Eyebrow>
            <h1 className="mt-4 text-[30px] sm:text-[44px] lg:text-[54px] leading-[1.04] font-semibold tracking-ultratight text-ink">
              Twelve workflows.{' '}
              <span className="text-brand-700">One operations layer.</span>
            </h1>
            <p className="mt-5 text-[17px] leading-[1.55] text-slate-600 max-w-2xl">
              CareComply is built around the work that compliance managers, recruiters and coordinators actually do every day.
            </p>
          </Reveal>

          {/* In-page navigation */}
          <div className="mt-10 overflow-x-auto no-scrollbar -mx-6 px-6">
            <div className="flex items-center gap-1 min-w-max">
              {IN_PAGE_NAV.map(([k, l]) => (
                <a
                  key={k}
                  href={`#${k}`}
                  className="px-3 py-1.5 rounded-full text-[13px] text-slate-600 hover:text-ink hover:bg-surface-muted border border-line bg-white transition">
                  {l}
                </a>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* All capabilities overview */}
      <section className="py-20 border-b border-line">
        <Container>
          <SectionHeader eyebrow="All capabilities" title="Everything in one workspace." />
          <StaggerContainer className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4" staggerDelay={0.06}>
            {ALL_CAPABILITIES.map(({ Icon, t, d, section }) => (
              <StaggerItem key={t}>
                <a
                  href={`#${section}`}
                  className="flex items-start gap-3 p-4 rounded-2xl border border-line bg-white hover:shadow-lift transition-shadow group">
                  <div className="h-9 w-9 rounded-lg bg-brand-50 text-brand-700 grid place-items-center shrink-0">
                    <Icon size={16} style={{ width: 16, height: 16 }} />
                  </div>
                  <div>
                    <div className="text-[14px] font-semibold text-ink group-hover:text-brand-700 transition-colors">{t}</div>
                    <div className="text-[12.5px] text-slate-500 mt-0.5 leading-snug">{d}</div>
                  </div>
                </a>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </Container>
      </section>

      {/* Deep feature sections */}
      <FeatureSplit
        id="references"
        eyebrow="Reference chasing"
        title="Automatic chases. Real responses. Zero phone calls."
        lead="Referees receive a professionally-branded, token-protected form link. CareComply sends reminder emails on day 3, 7 and 14 automatically — from your agency's name. The moment they respond, your manager is notified."
        points={[
          'Token-protected referee links — expires after 21 days',
          'Automatic day-3, day-7 and day-14 chase emails',
          'Instant manager notification when a reference lands',
          'Full submission history with timestamp and IP',
          'Supports work references, character references, and custom types',
        ]}>
        <ReferenceChasePanel />
      </FeatureSplit>

      <FeatureSplit
        id="expiry"
        reverse
        eyebrow="Expiry reminders"
        title="Every document tracked. Every expiry anticipated."
        lead="CareComply tracks expiry dates on every document type — DBS, RTW, mandatory training, insurance, and any custom type you define. Reminders fire at −30, −7 and 0 days. Pro adds escalation if reminders go unanswered."
        points={[
          'Fixed reminders at −30, −7 and expiry day',
          'Pro: per-document-type custom reminder intervals',
          'Pro: escalation chains when reminders go unanswered',
          'Overdue queue surfaces critical items first',
          'Auto-reminder toggle per document type',
        ]}>
        <DocumentExpiryPanel />
      </FeatureSplit>

      <FeatureSplit
        id="cqc"
        eyebrow="CQC readiness"
        title="An evidence pack that writes itself."
        lead="Every action in CareComply is tagged to a CQC key question (Safe, Effective, Caring, Responsive, Well-led) and category. When an inspector calls, export a signed, tamper-evident Excel file in seconds — scoped to any date range or question."
        points={[
          'Every action tagged by CQC key question + category',
          'Tamper-evident HMAC signature on every export',
          'Scoped exports: by date, category, key question, carer',
          'Inspector can independently verify file integrity',
          'Full audit history with no retention cap on Pro',
        ]}>
        <CQCEvidencePanel />
      </FeatureSplit>

      <FeatureSplit
        id="automations"
        reverse
        eyebrow="Automations"
        title="Compliance rules in plain English. Escalations built in."
        lead="Define triggers, conditions, and actions without writing any code. Pro plans allow custom rules per document type, escalation chains when deadlines pass, and overdue queues that surface the right items to the right people."
        points={[
          'If/and/then automation builder with plain-English steps',
          'Trigger on: document expiry, reference status, carer status change',
          'Actions: email manager, create review task, notify branch admin',
          'Escalation after 24h, 48h or custom interval',
          'Last-run log and match count per automation',
        ]}>
        <AutomationCard />
      </FeatureSplit>

      <FeatureSplit
        id="audit"
        eyebrow="Audit logs"
        title="A tamper-evident record of every decision."
        lead="Every approval, rejection, upload, download, login, and export is logged with the user identity, IP address, user agent, and CQC category. The audit log is immutable — it cannot be edited or deleted by any user, including owners."
        points={[
          'Every action logged: who, when, what, from where',
          'CQC key question tagging on every row',
          'Category and severity filters for fast review',
          'Full event metadata on Pro: source, IP, user agent',
          'Tamper-evident export for off-system archiving',
        ]}>
        <AuditLogPanel />
      </FeatureSplit>

      {/* CTA */}
      <CTABand />
    </>
  );
}

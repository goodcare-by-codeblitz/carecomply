import * as React from 'react';
import Link from 'next/link';
import { Mail, Clock, ShieldCheck, Zap, ArrowRight } from 'lucide-react';
import { Container } from '../../ui/container';
import { SectionHeader } from '../../ui/section-header';
import { Pill } from '../../ui/pill';
import { MButton } from '../../ui/button';
import { ReferenceChasePanel } from '../../mocks/reference-chase-panel';
import { DocumentExpiryPanel } from '../../mocks/document-expiry-panel';
import { CQCEvidencePanel } from '../../mocks/cqc-evidence-panel';
import { AutomationCard } from '../../mocks/automation-card';
import { Reveal } from '../../animations/reveal';

export function FeatureBento() {
  return (
    <section className="py-20 lg:py-24 bg-white border-y border-line">
      <Container>
        <SectionHeader
          eyebrow="The operations layer"
          title="Built around the work compliance teams actually do."
          lead="Six surfaces that connect: onboarding pushes into documents, documents trigger reminders, reminders feed reviews, reviews log audit evidence."
        />

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-12 gap-5">
          {/* Reference chasing — big card */}
          <Reveal className="lg:col-span-7">
            <div className="rounded-2xl bg-surface-page border border-line p-6 lg:p-7 h-full">
              <div>
                <Pill tone="brand">
                  <Mail size={11} style={{ width: 11, height: 11 }} /> Reference chasing
                </Pill>
                <h3 className="mt-3 text-[22px] sm:text-[26px] font-semibold tracking-tight text-ink leading-tight">
                  Stop chasing referees. We deliver the link, the reminders and the responses.
                </h3>
                <p className="mt-2.5 text-[14.5px] text-slate-600 max-w-md">
                  Referees get a token-protected form. CareComply chases at day 3, 7 and 14 automatically, then notifies the manager the moment a reference lands.
                </p>
              </div>
              <div className="mt-6">
                <ReferenceChasePanel />
              </div>
            </div>
          </Reveal>

          {/* Expiry reminders */}
          <Reveal delay={0.1} className="lg:col-span-5">
            <div className="rounded-2xl bg-surface-page border border-line p-6 h-full">
              <Pill tone="warn">
                <Clock size={11} style={{ width: 11, height: 11 }} /> Expiry reminders
              </Pill>
              <h3 className="mt-3 text-[20px] sm:text-[22px] font-semibold tracking-tight text-ink leading-tight">
                Nothing expires quietly. Ever again.
              </h3>
              <p className="mt-2.5 text-[14px] text-slate-600">
                Fixed reminders at{' '}
                <span className="font-mono text-ink-3">−30</span>,{' '}
                <span className="font-mono text-ink-3">−7</span> and{' '}
                <span className="font-mono text-ink-3">0</span> days. Pro plans add custom per-document rules and escalation.
              </p>
              <div className="mt-5">
                <DocumentExpiryPanel />
              </div>
            </div>
          </Reveal>

          {/* CQC readiness */}
          <Reveal delay={0.05} className="lg:col-span-5">
            <div className="rounded-2xl bg-surface-page border border-line p-6 h-full">
              <Pill tone="ok">
                <ShieldCheck size={11} style={{ width: 11, height: 11 }} /> CQC readiness
              </Pill>
              <h3 className="mt-3 text-[20px] sm:text-[22px] font-semibold tracking-tight text-ink leading-tight">
                An inspection-ready evidence pack, on tap.
              </h3>
              <p className="mt-2.5 text-[14px] text-slate-600">
                Every action is tagged by CQC key question. Export a signed, tamper-evident audit file in seconds — verify it years later.
              </p>
              <div className="mt-5">
                <CQCEvidencePanel />
              </div>
            </div>
          </Reveal>

          {/* Automations — big card */}
          <Reveal delay={0.15} className="lg:col-span-7">
            <div className="rounded-2xl bg-surface-page border border-line p-6 h-full">
              <Pill tone="accent">
                <Zap size={11} style={{ width: 11, height: 11 }} /> Automations
              </Pill>
              <h3 className="mt-3 text-[22px] sm:text-[26px] font-semibold tracking-tight text-ink leading-tight">
                Custom rules in plain English. Escalations included.
              </h3>
              <p className="mt-2.5 text-[14.5px] text-slate-600 max-w-md">
                Wire reminders, reviews, and notifications to the people who can fix them. With Pro, define your own triggers per document type.
              </p>
              <div className="mt-6">
                <AutomationCard />
              </div>
            </div>
          </Reveal>
        </div>

        <div className="mt-10 flex justify-center">
          <MButton variant="ghost" as={Link} href="/features">
            See every feature in detail <ArrowRight size={15} />
          </MButton>
        </div>
      </Container>
    </section>
  );
}

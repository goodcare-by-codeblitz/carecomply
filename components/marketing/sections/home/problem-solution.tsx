import * as React from 'react';
import { XCircle, CheckCircle, X, Check } from 'lucide-react';
import { Container } from '../../ui/container';
import { SectionHeader } from '../../ui/section-header';
import { StaggerContainer, StaggerItem } from '../../animations/stagger';

const PROBLEMS = [
  'Carer files scattered across Drive, WhatsApp and a filing cabinet',
  'Expired DBS or RTW found during a CQC visit, not before',
  'Manually chasing references for two weeks per carer',
  'No clear answer to "is Marcus compliant?" — only opinions',
  'Inspection prep takes a fortnight of evening work',
];

const OURS = [
  'One workspace per agency, multi-branch ready, granular permissions',
  'Reminders fire at −30, −7 and 0 days. Pro adds custom rules + escalation',
  'Token-protected referee links + automatic chases at day 3, 7 and 14',
  'A live compliance status per carer, recalculated on every change',
  'Tamper-evident CQC export by key question — Safe, Effective, Caring, Responsive, Well-led',
];

export function ProblemSolution() {
  return (
    <section className="py-20 lg:py-24">
      <Container>
        <SectionHeader
          eyebrow="What we replace"
          title="The spreadsheet stops scaling at 20 carers. CareComply doesn't."
          lead="Most UK agencies grow into a tangle of trackers, emails, and shared drives. We replace that with one operational source of truth — built for how compliance work actually happens."
        />

        <StaggerContainer className="mt-12 grid md:grid-cols-2 gap-6" staggerDelay={0.12}>
          {/* Problem column */}
          <StaggerItem>
            <div className="rounded-2xl bg-white border border-line p-6 h-full">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-surface-muted grid place-items-center text-slate-500 shrink-0">
                  <XCircle size={16} style={{ width: 16, height: 16 }} />
                </div>
                <div className="text-[15px] font-semibold text-ink">Today, without CareComply</div>
              </div>
              <ul className="mt-4 space-y-3">
                {PROBLEMS.map((p, i) => (
                  <li key={i} className="flex gap-3 text-[14.5px] text-slate-600 leading-snug">
                    <X size={16} className="mt-0.5 text-slate-400 shrink-0" style={{ width: 16, height: 16 }} />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </StaggerItem>

          {/* Solution column */}
          <StaggerItem>
            <div className="rounded-2xl bg-ink text-white p-6 relative overflow-hidden h-full">
              <div className="absolute inset-0 opacity-[0.08] bg-grid pointer-events-none" />
              <div className="relative flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-white/10 grid place-items-center text-teal-300 shrink-0">
                  <CheckCircle size={16} style={{ width: 16, height: 16 }} />
                </div>
                <div className="text-[15px] font-semibold">With CareComply</div>
              </div>
              <ul className="relative mt-4 space-y-3">
                {OURS.map((p, i) => (
                  <li key={i} className="flex gap-3 text-[14.5px] text-slate-200 leading-snug">
                    <Check size={16} className="mt-0.5 text-teal-300 shrink-0" style={{ width: 16, height: 16 }} />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </StaggerItem>
        </StaggerContainer>
      </Container>
    </section>
  );
}

import * as React from 'react';
import { Building, ListChecks, Users, Bell, ClipboardCheck, Download } from 'lucide-react';
import { Container } from '../../ui/container';
import { SectionHeader } from '../../ui/section-header';
import { StaggerContainer, StaggerItem } from '../../animations/stagger';

const STEPS = [
  { n: '01', t: 'Spin up your organisation',    d: 'Sign up, name your agency, invite your compliance team. Roles and permissions inherit from sensible defaults.',   Icon: Building },
  { n: '02', t: 'Define what "compliant" means',d: 'Pick required document types (DBS, RTW, training, insurance) and how many work + character references you need.', Icon: ListChecks },
  { n: '03', t: 'Invite carers with a token link',d: 'Each carer gets a personal, expiring link. They upload documents and add referees themselves.',                  Icon: Users },
  { n: '04', t: 'Let CareComply chase and remind',d: 'References are chased on day 3, 7, 14. Documents trigger reminders at −30, −7 and on the expiry day.',           Icon: Bell },
  { n: '05', t: 'Review with one queue',         d: 'Every approval, rejection or replacement is logged with the user, IP, source, and CQC key question.',             Icon: ClipboardCheck },
  { n: '06', t: 'Export for inspection in one click', d: 'Generate a signed CSV or Excel pack scoped to a date range, category, or CQC question.',                    Icon: Download },
];

export function HowItWorks() {
  return (
    <section className="py-20 lg:py-24">
      <Container>
        <SectionHeader
          eyebrow="How it works"
          title="From spreadsheets to a signed CQC audit pack in six steps."
          lead="Typical agencies go live in a day. There is no implementation team to schedule, no SQL to write, no integrations to configure."
        />

        <StaggerContainer className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-5" staggerDelay={0.07}>
          {STEPS.map((s) => (
            <StaggerItem key={s.n}>
              <div className="rounded-2xl bg-white border border-line p-6 hover:shadow-lift transition-shadow duration-300 h-full">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[12px] text-slate-400">{s.n}</span>
                  <div className="h-8 w-8 rounded-lg bg-brand-50 text-brand-700 grid place-items-center shrink-0">
                    <s.Icon size={16} style={{ width: 16, height: 16 }} />
                  </div>
                </div>
                <h3 className="mt-4 text-[17px] font-semibold tracking-tight text-ink">{s.t}</h3>
                <p className="mt-1.5 text-[14px] text-slate-600 leading-snug">{s.d}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </Container>
    </section>
  );
}

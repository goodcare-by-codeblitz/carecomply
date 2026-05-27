import * as React from 'react';
import { Quote } from 'lucide-react';
import { Container } from '../../ui/container';
import { SectionHeader } from '../../ui/section-header';
import { MAvatar } from '../../ui/avatar';
import { StaggerContainer, StaggerItem } from '../../animations/stagger';

const QUOTES = [
  {
    q: "We stopped budgeting two weeks of evening admin before every CQC visit. The export is the inspector's preferred format now.",
    n: 'Chiamaka Egwu',
    r: 'Registered Manager, Linden Domiciliary',
  },
  {
    q: 'Our reference response rate went from 38% to 91% inside a month. We did not have to talk to a single referee.',
    n: 'David Pritchard',
    r: 'Operations Director, Westcombe Care Group',
  },
  {
    q: 'It is the first piece of software I have used that was clearly built by people who have done compliance work.',
    n: 'Saima Iqbal',
    r: 'Compliance Lead, Greenfield Home Care',
  },
];

export function Testimonials() {
  return (
    <section className="py-20 lg:py-24 bg-white border-y border-line">
      <Container>
        <SectionHeader
          eyebrow="Customers"
          title="Used by registered managers, not just IT."
          lead="The teams who have to answer to the CQC are the ones who chose CareComply."
        />

        <StaggerContainer className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5" staggerDelay={0.1}>
          {QUOTES.map((q, i) => (
            <StaggerItem key={i}>
              <figure className="rounded-2xl bg-surface-page border border-line p-6 flex flex-col h-full">
                <Quote size={20} className="text-brand-700 opacity-60 shrink-0" style={{ width: 20, height: 20 }} />
                <blockquote className="mt-3 text-[15px] leading-[1.55] text-ink-3 flex-1">
                  {q.q}
                </blockquote>
                <figcaption className="mt-5 pt-5 border-t border-line flex items-center gap-3">
                  <MAvatar name={q.n} size="md" />
                  <div>
                    <div className="text-[13px] font-semibold text-ink">{q.n}</div>
                    <div className="text-[11.5px] text-slate-500">{q.r}</div>
                  </div>
                </figcaption>
              </figure>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </Container>
    </section>
  );
}

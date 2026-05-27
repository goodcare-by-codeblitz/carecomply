import * as React from 'react';
import { Container } from '../../ui/container';
import { StaggerContainer, StaggerItem } from '../../animations/stagger';

const METRICS = [
  { v: '91%',   l: 'reference response rate' },
  { v: '5×',    l: 'less admin time per carer onboarded' },
  { v: '< 24h', l: 'from sign-up to first compliant carer' },
  { v: '0',     l: 'spreadsheets needed at inspection' },
];

export function MetricStrip() {
  return (
    <section className="py-14 border-t border-line">
      <Container>
        <StaggerContainer className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-10" staggerDelay={0.1}>
          {METRICS.map((it, i) => (
            <StaggerItem key={i}>
              <div className="border-l-2 border-brand pl-5">
                <div className="text-[36px] sm:text-[44px] leading-none font-semibold tracking-ultratight text-ink">
                  {it.v}
                </div>
                <div className="mt-2 text-[13.5px] text-slate-600">{it.l}</div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </Container>
    </section>
  );
}

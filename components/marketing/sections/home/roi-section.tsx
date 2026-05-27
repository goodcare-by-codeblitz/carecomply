import * as React from 'react';
import { Container } from '../../ui/container';
import { SectionHeader } from '../../ui/section-header';
import { ROICalculator } from '../roi-calculator';
import { Reveal } from '../../animations/reveal';

export function ROISection() {
  return (
    <section className="py-20 lg:py-24 bg-surface-page border-y border-line">
      <Container>
        <SectionHeader
          eyebrow="ROI"
          align="center"
          title="See what you'd save against your current setup."
          lead="Move the sliders to match your agency. Most teams break even within their first month of CareComply Pro."
        />
        <Reveal className="mt-12 max-w-5xl mx-auto" delay={0.1}>
          <ROICalculator />
        </Reveal>
      </Container>
    </section>
  );
}

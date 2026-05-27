import * as React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Container } from '../ui/container';
import { Eyebrow } from '../ui/eyebrow';
import { MButton } from '../ui/button';
import { Reveal } from '../animations/reveal';
import { StaggerContainer, StaggerItem } from '../animations/stagger';

const STATS = [
  { v: '14 days', l: 'Free trial, no card' },
  { v: '1 day',   l: 'Typical go-live' },
  { v: '5×',      l: 'Less admin per carer' },
  { v: 'CQC',     l: 'Evidence packs in 1 click' },
];

export function CTABand() {
  return (
    <section className="relative overflow-hidden ink-grad text-white">
      <div className="absolute inset-0 opacity-[0.18] bg-grid pointer-events-none" />
      <Container className="relative py-20 lg:py-24">
        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-10 items-center">
          <Reveal>
            <Eyebrow tone="accent" className="!text-teal-300 mb-4">Stop chasing paperwork</Eyebrow>
            <h2 className="text-[28px] sm:text-[36px] lg:text-[46px] leading-[1.05] font-semibold tracking-ultratight">
              Run a CQC-ready agency without the spreadsheet tax.
            </h2>
            <p className="mt-5 text-[17px] text-slate-300 max-w-xl">
              Move onboarding, document review, reference chasing, and inspection prep onto a single audited workspace. Live in a day, free for 14.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <MButton size="lg" variant="brand" as={Link} href="/auth/sign-up">
                Start free trial <ArrowRight size={16} />
              </MButton>
              <MButton
                size="lg"
                variant="secondary"
                as={Link}
                href="/demo"
                className="!bg-white/10 !border-white/15 !text-white hover:!bg-white/15">
                Book a demo
              </MButton>
              <span className="text-xs text-slate-400">No card required · UK-hosted on AWS · GDPR-compliant</span>
            </div>
          </Reveal>

          <StaggerContainer className="hidden md:grid grid-cols-2 gap-3" staggerDelay={0.1}>
            {STATS.map((s) => (
              <StaggerItem key={s.l}>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur p-5">
                  <div className="text-2xl font-semibold tracking-ultratight">{s.v}</div>
                  <div className="text-sm text-slate-300 mt-1">{s.l}</div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </Container>
    </section>
  );
}

import * as React from 'react';
import { Heart, Shield, Compass, Globe } from 'lucide-react';
import type { Metadata } from 'next';
import { Container } from '@/components/marketing/ui/container';
import { Eyebrow } from '@/components/marketing/ui/eyebrow';
import { SectionHeader } from '@/components/marketing/ui/section-header';
import { MAvatar } from '@/components/marketing/ui/avatar';
import { CTABand } from '@/components/marketing/sections/cta-band';
import { Reveal } from '@/components/marketing/animations/reveal';
import { StaggerContainer, StaggerItem } from '@/components/marketing/animations/stagger';

export const metadata: Metadata = {
  title: 'About — CareComply',
  description: 'We built CareComply because the spreadsheet kept failing the people who needed it most.',
};

const VALUES = [
  { Icon: Heart,   t: 'Built with care',        d: "We design assuming your time is the most valuable resource your agency has. We will not waste it." },
  { Icon: Shield,  t: 'Conservative by default', d: 'Reminders, exports and audit decisions default to the safe option. You can opt into risk.' },
  { Icon: Compass, t: 'CQC-native',              d: 'Every action ties back to the questions an inspector will ask. There is no off-ramp to a separate evidence pack.' },
  { Icon: Globe,   t: 'UK-first',                d: 'British English, GBP, GMT/BST, AWS London, ICO-registered. Built for the place we live.' },
];

const TEAM = [
  { name: 'Olu Adebayo',     role: 'Co-founder & CEO',     tone: '#14B8A6' },
  { name: 'Priya Menon',     role: 'Co-founder & CTO',     tone: '#1D4ED8' },
  { name: 'James Whitmore',  role: 'Head of Product',      tone: '#9333EA' },
  { name: 'Fatima Al-Rashid',role: 'Head of Partnerships', tone: '#D97706' },
];

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 bg-grid" />
        <Container className="relative pt-20 pb-16">
          <Reveal>
            <Eyebrow>About CareComply</Eyebrow>
            <h1 className="mt-4 text-[30px] sm:text-[44px] lg:text-[56px] leading-[1.04] font-semibold tracking-ultratight text-ink max-w-3xl">
              We built CareComply because the spreadsheet kept failing the people who needed it most.
            </h1>
            <p className="mt-5 text-[18px] leading-[1.6] text-slate-600 max-w-2xl">
              Domiciliary care agencies are running essential, regulated, life-affecting operations on tools designed for budgeting and project plans. The result is overworked compliance teams, anxious inspections, and avoidable risk.
            </p>
            <p className="mt-4 text-[18px] leading-[1.6] text-slate-600 max-w-2xl">
              We are a small UK team building the operational platform we wish those agencies had.
            </p>
          </Reveal>
        </Container>
      </section>

      {/* Mission */}
      <section className="py-20 lg:py-24">
        <Container>
          <div className="grid md:grid-cols-[1fr_1.2fr] gap-12 items-start">
            <Reveal>
              <Eyebrow>Our mission</Eyebrow>
              <h2 className="mt-4 text-[26px] sm:text-[34px] leading-[1.05] font-semibold tracking-ultratight text-ink">
                Make the regulated parts of running a care agency boring.
              </h2>
              <p className="mt-5 text-[16px] text-slate-600 leading-[1.6]">
                When compliance is boring, it is predictable. When it is predictable, you can plan. When you can plan, you can grow without panic. That is the entire point.
              </p>
            </Reveal>
            <StaggerContainer className="grid sm:grid-cols-2 gap-4" staggerDelay={0.1}>
              {VALUES.map(({ Icon, t, d }) => (
                <StaggerItem key={t}>
                  <div className="rounded-2xl border border-line bg-white p-5 h-full">
                    <div className="h-9 w-9 rounded-lg bg-brand-50 text-brand-700 grid place-items-center shrink-0">
                      <Icon size={16} style={{ width: 16, height: 16 }} />
                    </div>
                    <h3 className="mt-3 text-[15px] font-semibold text-ink">{t}</h3>
                    <p className="mt-1 text-[13.5px] text-slate-600 leading-snug">{d}</p>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </Container>
      </section>

      {/* Founder note */}
      <section className="py-20 bg-white border-y border-line">
        <Container>
          <Reveal>
            <div className="rounded-3xl bg-ink text-white p-8 lg:p-12 relative overflow-hidden">
              <div className="absolute inset-0 opacity-[0.08] bg-grid pointer-events-none" />
              <div className="relative grid md:grid-cols-[1.2fr_1fr] gap-10 items-start">
                <div>
                  <Eyebrow tone="accent" className="!text-teal-300">A note from our founders</Eyebrow>
                  <p className="mt-5 text-[20px] leading-[1.55] text-slate-100">
                    "Before CareComply, I spent five years inside two domiciliary agencies. I watched the same scene every quarter: a compliance manager rebuilding a spreadsheet at 11pm because three carers had expired DBS checks and an inspector was due on Friday."
                  </p>
                  <p className="mt-4 text-[16px] leading-[1.55] text-slate-300">
                    That work is not a software problem because of complexity. It is a software problem because nothing is built for it. Generic HR tools do not understand DBS. Generic compliance tools do not understand the carer–referee–manager loop. So we built one thing that does both.
                  </p>
                  <div className="mt-7 flex items-center gap-3">
                    <MAvatar name="Olu Adebayo" size="lg" tone="#14B8A6" />
                    <div>
                      <div className="text-[14px] font-semibold">Olu Adebayo</div>
                      <div className="text-[12px] text-slate-400">Co-founder &amp; CEO, CareComply</div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 lg:mt-8">
                  {[
                    { v: '2023',    l: 'Founded in London' },
                    { v: '£250k',   l: 'Pre-seed raised' },
                    { v: '40+',     l: 'Agencies on platform' },
                    { v: '1,800+',  l: 'Carers onboarded' },
                  ].map((s) => (
                    <div key={s.l} className="rounded-xl border border-white/10 bg-white/[0.05] p-4">
                      <div className="text-[28px] font-semibold tracking-ultratight">{s.v}</div>
                      <div className="text-[12px] text-slate-300 mt-0.5">{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>

      {/* Team */}
      <section className="py-20 lg:py-24">
        <Container>
          <SectionHeader eyebrow="The team" title="A small team. A focused mission." />
          <StaggerContainer className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5" staggerDelay={0.1}>
            {TEAM.map(({ name, role, tone }) => (
              <StaggerItem key={name}>
                <div className="rounded-2xl border border-line bg-white p-5 flex flex-col items-center text-center">
                  <MAvatar name={name} size="lg" tone={tone} />
                  <div className="mt-3 text-[14px] font-semibold text-ink">{name}</div>
                  <div className="text-[12.5px] text-slate-500 mt-0.5">{role}</div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </Container>
      </section>

      <CTABand />
    </>
  );
}

import * as React from 'react';
import { Check, Calendar, Clock, Users } from 'lucide-react';
import type { Metadata } from 'next';
import { Container } from '@/components/marketing/ui/container';
import { Eyebrow } from '@/components/marketing/ui/eyebrow';
import { Pill } from '@/components/marketing/ui/pill';
import { MAvatar } from '@/components/marketing/ui/avatar';
import { Reveal } from '@/components/marketing/animations/reveal';
import { DemoForm } from '@/components/marketing/sections/demo-form';

export const metadata: Metadata = {
  title: 'Book a demo — CareComply',
  description: 'Book a 25-minute walkthrough of CareComply with our team.',
};

const DEMO_POINTS = [
  'A live walkthrough of the full compliance workflow',
  'How reference chasing reduces your workload immediately',
  'CQC evidence export — from zero to inspector-ready',
  'Setting up your organisation and inviting your first carers',
  'Q&A with our team on your specific agency needs',
];

export default function DemoPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 bg-grid" />
        <Container className="relative pt-20 pb-16">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <Reveal>
              <Eyebrow>Book a demo</Eyebrow>
              <h1 className="mt-4 text-[30px] sm:text-[40px] lg:text-[50px] leading-[1.04] font-semibold tracking-ultratight text-ink">
                See CareComply in 25 minutes.
              </h1>
              <p className="mt-5 text-[17px] leading-[1.55] text-slate-600">
                Book a screen-share with our team. No sales script. We will show you the product working with a real agency's data.
              </p>

              <div className="mt-7 flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-[13.5px] text-slate-600">
                  <Clock size={14} className="text-brand-700" style={{ width: 14, height: 14 }} />
                  25 minutes
                </div>
                <span className="text-slate-300">·</span>
                <div className="flex items-center gap-1.5 text-[13.5px] text-slate-600">
                  <Users size={14} className="text-brand-700" style={{ width: 14, height: 14 }} />
                  Via Google Meet
                </div>
                <span className="text-slate-300">·</span>
                <div className="flex items-center gap-1.5 text-[13.5px] text-slate-600">
                  <Calendar size={14} className="text-brand-700" style={{ width: 14, height: 14 }} />
                  Available Mon–Fri
                </div>
              </div>

              <ul className="mt-8 space-y-3">
                {DEMO_POINTS.map((p, i) => (
                  <li key={i} className="flex items-start gap-3 text-[14.5px] text-ink-3 leading-snug">
                    <span className="mt-1 h-4 w-4 rounded-full bg-brand-50 text-brand-700 grid place-items-center shrink-0">
                      <Check size={11} style={{ width: 11, height: 11 }} />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex items-center gap-3">
                <MAvatar name="Olu Adebayo" size="md" tone="#14B8A6" />
                <div>
                  <div className="text-[13px] font-semibold text-ink">Olu Adebayo</div>
                  <div className="text-[12px] text-slate-500">Co-founder, runs your demo personally</div>
                </div>
              </div>
            </Reveal>

            {/* Booking form */}
            <Reveal delay={0.15}>
              <div className="rounded-2xl bg-white border border-line p-7 shadow-card">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-[18px] font-semibold tracking-tight text-ink">
                    Pick a time that works
                  </h2>
                  <Pill tone="ok">Free · no obligation</Pill>
                </div>
                <DemoForm />
              </div>
            </Reveal>
          </div>
        </Container>
      </section>
    </>
  );
}

import * as React from 'react';
import Link from 'next/link';
import { Check, Users, ChevronDown } from 'lucide-react';
import type { Metadata } from 'next';
import { cn } from '@/lib/utils';
import { Container } from '@/components/marketing/ui/container';
import { Eyebrow } from '@/components/marketing/ui/eyebrow';
import { SectionHeader } from '@/components/marketing/ui/section-header';
import { Pill } from '@/components/marketing/ui/pill';
import { MButton } from '@/components/marketing/ui/button';
import { TopNav } from '@/components/marketing/nav';
import { Footer } from '@/components/marketing/footer';
import { CTABand } from '@/components/marketing/sections/cta-band';
import { ROICalculator } from '@/components/marketing/sections/roi-calculator';
import { Reveal } from '@/components/marketing/animations/reveal';
import { StaggerContainer, StaggerItem } from '@/components/marketing/animations/stagger';

export const metadata: Metadata = {
  title: 'Pricing — CareComply',
  description: 'Simple, agency-friendly pricing. Two plans, both 14-day free. You only pay per active carer.',
};

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Run compliant onboarding',
    monthly: 29,
    included: 25, extra: 5,
    sections: [
      {
        h: 'Included', items: [
          'Unlimited team seats',
          'Carer onboarding with token-protected links',
          'Document uploads, types, expiry tracking',
          'Manual reference requests',
          'Reference review dashboard',
          'Basic compliance tracking',
        ],
      },
      {
        h: 'Reminders & audit', items: [
          'Fixed expiry reminders: −30 days, −7 days, expiry day',
          'Basic audit logs · CSV export · 90-day history',
        ],
      },
    ],
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Automate compliance operations',
    monthly: 59,
    included: 40, extra: 4,
    sections: [
      {
        h: 'Everything in Starter, plus', items: [
          'Automatic reference chasing on day 3, 7 and 14',
          'Scheduled reminder sequences per document type',
          'Escalation workflows when reminders go unanswered',
          'Overdue alerts and queue',
          'Custom compliance automations',
        ],
      },
      {
        h: 'Audit & evidence', items: [
          'Advanced CQC audit history (no retention cap)',
          'CQC coverage summary: Safe, Effective, Caring, Responsive, Well-led',
          'CSV and formatted Excel evidence export',
          'Advanced filters: category, severity, CQC key question',
        ],
      },
      {
        h: 'Controls', items: [
          'Custom roles and permissions',
          'Per-document-type reminder rules',
        ],
      },
    ],
    highlight: true,
  },
];

const COMPARISON_ROWS: [string, boolean, boolean][] = [
  ['Carer onboarding',                              true,  true  ],
  ['Document uploads & types',                      true,  true  ],
  ['Manual reference requests',                     true,  true  ],
  ['Fixed expiry reminders (−30 / −7 / 0)',        true,  true  ],
  ['Automatic reference chasing (day 3 / 7 / 14)', false, true  ],
  ['Per-document-type custom reminder rules',       false, true  ],
  ['Escalation workflows',                          false, true  ],
  ['Compliance automations',                        false, true  ],
  ['Basic audit log (90 days, CSV)',                true,  true  ],
  ['Full audit history',                            false, true  ],
  ['CQC key-question filters',                      false, true  ],
  ['Excel evidence export',                         false, true  ],
  ['Tamper-evident export signature',               true,  true  ],
  ['Custom roles & permissions',                    false, true  ],
  ['Unlimited team seats',                          true,  true  ],
  ['UK data residency · AWS London',                true,  true  ],
];

const FAQ_ITEMS = [
  { q: 'How does the free trial work?',        a: '14 days, full Pro access, no card required. After 14 days you choose a plan or downgrade your workspace to read-only — your data is never deleted automatically.' },
  { q: 'How is "active carer" counted?',       a: 'A carer is active if their status is active or on_leave at any point during the calendar month. Carers in pending, incomplete, suspended, or former do not count.' },
  { q: 'What if we go over our limit?',        a: 'You are not blocked. Overages are billed automatically at £5 (Starter) or £4 (Pro) per extra active carer at the end of the cycle.' },
  { q: 'Can we move between plans?',           a: 'Yes, at any time. Upgrading is immediate and pro-rated. Downgrading takes effect on your next renewal date.' },
  { q: 'Can we pay annually?',                 a: 'Yes. Annual billing saves roughly 17% (£290 instead of £348 on Starter, £590 instead of £708 on Pro).' },
  { q: 'Do you sign a Data Processing Agreement?', a: 'Yes. We are an ICO-registered data controller. A standard DPA is available on request and pre-signed for Pro and Enterprise.' },
];

export default function PricingPage() {
  return (
    <>
      <TopNav />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-line">
          <div className="absolute inset-0 bg-grid" />
          <Container className="relative pt-20 pb-12">
            <Reveal>
              <div className="text-center max-w-3xl mx-auto">
                <Eyebrow className="justify-center">Pricing</Eyebrow>
                <h1 className="mt-4 text-[44px] sm:text-[56px] leading-[1.04] font-semibold tracking-ultratight text-ink">
                  Simple, agency-friendly pricing.
                </h1>
                <p className="mt-5 text-[17px] leading-[1.55] text-slate-600 max-w-2xl mx-auto">
                  Two plans, both 14-day free. You only pay per active carer — your office team is included.
                </p>
              </div>
            </Reveal>
          </Container>
        </section>

        {/* Plans */}
        <section className="pt-12 pb-20">
          <Container>
            <StaggerContainer className="grid md:grid-cols-2 gap-5 max-w-5xl mx-auto" staggerDelay={0.12}>
              {PLANS.map((plan) => (
                <StaggerItem key={plan.id}>
                  <div className={cn(
                    'relative rounded-2xl border p-7 flex flex-col h-full',
                    plan.highlight ? 'border-ink bg-ink text-white shadow-lift' : 'border-line bg-white'
                  )}>
                    {plan.highlight && (
                      <div className="absolute top-5 right-5">
                        <Pill tone="ink" className="!bg-white/15 !text-white">Most popular</Pill>
                      </div>
                    )}
                    <div className={cn('text-[12px] font-semibold uppercase tracking-[0.16em]', plan.highlight ? 'text-teal-300' : 'text-brand-700')}>
                      {plan.name}
                    </div>
                    <div className={cn('mt-1 text-[14px]', plan.highlight ? 'text-slate-300' : 'text-slate-600')}>
                      {plan.tagline}
                    </div>
                    <div className="mt-5 flex items-baseline gap-1.5">
                      <span className="text-[52px] font-semibold tracking-ultratight leading-none">£{plan.monthly}</span>
                      <span className={cn('text-[14px]', plan.highlight ? 'text-slate-300' : 'text-slate-500')}>/month</span>
                    </div>
                    <div className={cn('mt-1 text-[12px]', plan.highlight ? 'text-slate-400' : 'text-slate-500')}>
                      plus applicable VAT
                    </div>
                    <div className={cn('mt-5 rounded-lg p-3.5 text-[13px]', plan.highlight ? 'bg-white/[0.06]' : 'bg-surface-page border border-line')}>
                      <div className="flex items-center gap-2 font-medium">
                        <Users size={14} style={{ width: 14, height: 14 }} /> {plan.included} active carers included
                      </div>
                      <div className={cn('mt-0.5 text-[12px]', plan.highlight ? 'text-slate-400' : 'text-slate-500')}>
                        £{plan.extra} per extra active carer
                      </div>
                    </div>
                    <Link
                      href={`/auth/sign-up?plan=${plan.id}`}
                      className={cn(
                        'mt-5 h-11 rounded-lg font-medium text-[14px] inline-flex items-center justify-center transition',
                        plan.highlight ? 'bg-white text-ink hover:bg-slate-100' : 'bg-ink text-white hover:bg-ink-2'
                      )}>
                      Start 14-day free trial
                    </Link>
                    <p className={cn('mt-2 text-center text-[11.5px]', plan.highlight ? 'text-slate-400' : 'text-slate-500')}>
                      No card · cancel any time
                    </p>
                    <div className="mt-6 space-y-5">
                      {plan.sections.map((sec) => (
                        <div key={sec.h}>
                          <div className={cn('text-[11px] uppercase tracking-[0.14em] font-semibold', plan.highlight ? 'text-slate-400' : 'text-slate-500')}>
                            {sec.h}
                          </div>
                          <ul className="mt-2.5 space-y-2">
                            {sec.items.map((f, i) => (
                              <li key={i} className="flex items-start gap-2.5 text-[13.5px]">
                                <Check size={14} className={cn('mt-0.5 shrink-0', plan.highlight ? 'text-teal-300' : 'text-emerald-600')} style={{ width: 14, height: 14 }} />
                                <span className={plan.highlight ? 'text-slate-200' : 'text-ink-3'}>{f}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>

            {/* Enterprise */}
            <Reveal className="mt-6 max-w-5xl mx-auto" delay={0.2}>
              <div className="rounded-2xl border border-line bg-surface-page p-6 lg:p-7">
                <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6 items-center">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Pill tone="brand">Enterprise</Pill>
                      <Pill tone="neutral">100+ active carers</Pill>
                    </div>
                    <h3 className="mt-3 text-[24px] font-semibold tracking-tight text-ink">
                      For multi-branch groups and franchise networks.
                    </h3>
                    <p className="mt-2 text-[14.5px] text-slate-600 max-w-xl">
                      Group-level reporting, custom SLA, procurement security review, SSO and a named CSM. Contact our team for a tailored quote.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <MButton size="lg" variant="primary" as={Link} href="/contact">Talk to sales</MButton>
                    <MButton size="lg" variant="secondary" as={Link} href="/demo">Book a tailored demo</MButton>
                  </div>
                </div>
              </div>
            </Reveal>
          </Container>
        </section>

        {/* ROI */}
        <section className="py-20 bg-white border-y border-line">
          <Container>
            <SectionHeader eyebrow="ROI" align="center" title="See what you'd save." lead="Most agencies break even within their first month of CareComply Pro." />
            <Reveal className="mt-12 max-w-5xl mx-auto" delay={0.1}>
              <ROICalculator />
            </Reveal>
          </Container>
        </section>

        {/* Comparison */}
        <section className="py-20">
          <Container>
            <SectionHeader eyebrow="Compare" title="Everything on both plans." />
            <Reveal className="mt-10" delay={0.1}>
              <div className="rounded-2xl border border-line bg-white overflow-hidden shadow-card">
                <div className="px-6 py-4 border-b border-line">
                  <div className="text-[15px] font-semibold text-ink">Plan comparison</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13.5px]">
                    <thead className="bg-[#FCFCFD] text-slate-500">
                      <tr>
                        <th className="text-left font-medium px-6 py-3 w-[55%]">Capability</th>
                        <th className="text-center font-medium py-3">Starter</th>
                        <th className="text-center font-medium py-3">Pro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {COMPARISON_ROWS.map(([label, s, p]) => (
                        <tr key={label} className="row-hover">
                          <td className="px-6 py-2.5 text-ink-3">{label}</td>
                          <td className="text-center py-2.5">
                            {s ? <Check size={14} className="text-emerald-600 inline" style={{ width: 14, height: 14 }} /> : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="text-center py-2.5">
                            {p ? <Check size={14} className="text-emerald-600 inline" style={{ width: 14, height: 14 }} /> : <span className="text-slate-300">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Reveal>
          </Container>
        </section>

        {/* FAQ */}
        <section className="py-20 lg:py-24">
          <Container>
            <SectionHeader eyebrow="FAQ" align="center" title="Honest answers, not sales spin." />
            <div className="mt-12 max-w-3xl mx-auto rounded-2xl bg-white border border-line divide-y divide-line overflow-hidden">
              {FAQ_ITEMS.map((it, i) => (
                <details key={i} className="group">
                  <summary className="cursor-pointer list-none px-6 py-4 flex items-center gap-4 hover:bg-surface-page transition">
                    <span className="text-[15px] font-medium text-ink flex-1">{it.q}</span>
                    <ChevronDown size={16} className="text-slate-400 group-open:rotate-180 transition-transform" style={{ width: 16, height: 16 }} />
                  </summary>
                  <div className="px-6 pb-5 text-[14px] text-slate-600 leading-[1.6]">{it.a}</div>
                </details>
              ))}
            </div>
          </Container>
        </section>

        <CTABand />
      </main>
      <Footer />
    </>
  );
}

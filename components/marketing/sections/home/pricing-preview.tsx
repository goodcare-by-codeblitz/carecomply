import * as React from 'react';
import Link from 'next/link';
import { Check, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Container } from '../../ui/container';
import { SectionHeader } from '../../ui/section-header';
import { Pill } from '../../ui/pill';
import { StaggerContainer, StaggerItem } from '../../animations/stagger';

const PLANS = [
  {
    n: 'Starter',
    tag: 'Run compliant onboarding',
    p: '£29', sub: '/mo',
    extra: '£5 per extra active carer',
    inc: '25 active carers included',
    feats: [
      'Carer onboarding',
      'Document uploads',
      'Manual reference requests',
      'Fixed expiry reminders at −30, −7, 0',
      'Basic 90-day audit history',
      'CSV audit export',
    ],
    highlight: false,
  },
  {
    n: 'Pro',
    tag: 'Automate compliance operations',
    p: '£59', sub: '/mo',
    extra: '£4 per extra active carer',
    inc: '40 active carers included',
    feats: [
      'Everything in Starter',
      'Automatic reference chasing (day 3 / 7 / 14)',
      'Per-document custom reminder rules',
      'Escalation workflows',
      'Full audit history + CQC key-question filters',
      'Tamper-evident Excel export',
      'Custom roles, permissions and automations',
    ],
    highlight: true,
  },
];

export function PricingPreview() {
  return (
    <section className="py-20 lg:py-24 bg-white border-y border-line">
      <Container>
        <SectionHeader
          eyebrow="Pricing"
          align="center"
          title="Priced for UK agencies, not Silicon Valley."
          lead="One simple price per active carer above the included limit. No per-seat tax on your office team."
        />

        <StaggerContainer className="mt-12 grid md:grid-cols-2 gap-5 max-w-4xl mx-auto" staggerDelay={0.12}>
          {PLANS.map((p) => (
            <StaggerItem key={p.n}>
              <div
                className={cn(
                  'rounded-2xl border p-6 flex flex-col h-full',
                  p.highlight ? 'border-ink bg-ink text-white shadow-lift' : 'border-line bg-white'
                )}>
                <div className="flex items-center justify-between">
                  <div
                    className={cn(
                      'text-[13px] font-semibold uppercase tracking-[0.14em]',
                      p.highlight ? 'text-teal-300' : 'text-brand-700'
                    )}>
                    {p.n}
                  </div>
                  {p.highlight && (
                    <Pill tone="ink" className="!bg-white/15 !text-white">Popular</Pill>
                  )}
                </div>
                <div className={cn('mt-2 text-[14px]', p.highlight ? 'text-slate-300' : 'text-slate-600')}>
                  {p.tag}
                </div>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-[36px] sm:text-[44px] font-semibold tracking-ultratight">{p.p}</span>
                  <span className={cn('text-[14px]', p.highlight ? 'text-slate-300' : 'text-slate-500')}>
                    {p.sub}
                  </span>
                </div>
                <div className={cn('text-[12px]', p.highlight ? 'text-slate-400' : 'text-slate-500')}>
                  plus applicable VAT
                </div>
                <div
                  className={cn(
                    'mt-3 rounded-lg p-3 text-[12.5px]',
                    p.highlight ? 'bg-white/[0.06]' : 'bg-surface-page border border-line'
                  )}>
                  <div className="flex items-center gap-2 font-medium">
                    <Users size={13} style={{ width: 13, height: 13 }} /> {p.inc}
                  </div>
                  <div className={cn('mt-0.5 text-[11.5px]', p.highlight ? 'text-slate-400' : 'text-slate-500')}>
                    {p.extra}
                  </div>
                </div>
                <ul className="mt-4 space-y-2 flex-1">
                  {p.feats.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13.5px]">
                      <Check
                        size={14}
                        className={cn('mt-0.5 shrink-0', p.highlight ? 'text-teal-300' : 'text-emerald-600')}
                        style={{ width: 14, height: 14 }}
                      />
                      <span className={p.highlight ? 'text-slate-200' : 'text-ink-3'}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={p.highlight ? '/auth/sign-up?plan=pro' : '/auth/sign-up?plan=starter'}
                  className={cn(
                    'mt-5 h-10 rounded-lg font-medium text-[14px] inline-flex items-center justify-center transition',
                    p.highlight
                      ? 'bg-white text-ink hover:bg-slate-100'
                      : 'bg-ink text-white hover:bg-ink-2'
                  )}>
                  {p.highlight ? 'Start with Pro' : 'Start with Starter'}
                </Link>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        <div className="mt-8 text-center text-[13px] text-slate-500">
          Need 100+ active carers, multi-branch, or a procurement security review?{' '}
          <Link href="/contact" className="text-brand-700 hover:text-brand-800 font-medium">
            Talk to sales →
          </Link>
        </div>
      </Container>
    </section>
  );
}

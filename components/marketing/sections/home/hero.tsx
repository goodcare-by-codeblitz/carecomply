'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, Sparkles, Mail, AlertTriangle } from 'lucide-react';
import { Container } from '../../ui/container';
import { MButton } from '../../ui/button';
import { MAvatar } from '../../ui/avatar';
import { BrowserChrome } from '../../mocks/browser-chrome';
import { MockDashboard } from '../../mocks/dashboard';

function FloatingCard({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const shouldReduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={shouldReduce ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay + 1, duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}>
      {children}
    </motion.div>
  );
}

const TRUST_BADGES = [
  'No card required',
  'UK-hosted on AWS London',
  'ICO-registered · GDPR-compliant',
  'Live in a day',
];

export function HomeHero() {
  const shouldReduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden">
      {/* Layered background */}
      <div className="absolute inset-0 bg-wash" />
      <div className="absolute inset-0 bg-speckle" />

      {/* Decorative SVG shapes */}
      <svg className="hidden lg:block absolute left-[4%] top-[180px]" width="40" height="40" viewBox="0 0 40 40" aria-hidden="true" style={{ width: 40, height: 40 }}>
        <circle cx="20" cy="20" r="3" fill="#1D4ED8" opacity="0.35" />
        <circle cx="20" cy="20" r="14" stroke="#1D4ED8" strokeOpacity="0.18" fill="none" />
      </svg>
      <svg className="hidden lg:block absolute right-[6%] top-[120px]" width="56" height="56" viewBox="0 0 56 56" aria-hidden="true" style={{ width: 56, height: 56 }}>
        <path d="M28 6 L34 22 L50 28 L34 34 L28 50 L22 34 L6 28 L22 22 Z" fill="#14B8A6" opacity="0.18" />
      </svg>
      <svg className="hidden lg:block absolute left-[8%] top-[460px]" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" style={{ width: 14, height: 14 }}>
        <rect x="2" y="2" width="10" height="10" stroke="#0F172A" strokeOpacity="0.20" fill="none" transform="rotate(15 7 7)" />
      </svg>
      <svg className="hidden lg:block absolute right-[10%] top-[420px]" width="80" height="20" viewBox="0 0 80 20" aria-hidden="true" style={{ width: 80, height: 20 }}>
        <path d="M2 10 Q 20 2, 40 10 T 78 10" stroke="#1D4ED8" strokeOpacity="0.22" strokeWidth="1.2" fill="none" />
      </svg>

      <Container className="relative pt-16 lg:pt-24 pb-0">
        {/* Hero text */}
        <div className="text-center max-w-4xl mx-auto">
          {/* Announcement pill */}
          <motion.div
            initial={shouldReduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/90 backdrop-blur border border-line px-3 py-1.5 text-[12px] text-ink-3 shadow-card">
              <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-brand text-white shrink-0">
                <Sparkles size={10} style={{ width: 10, height: 10 }} />
              </span>
              <span className="hidden sm:inline font-medium">New ·</span>{' '}
              Reference chasing now runs day-3, day-7 and day-14 chases automatically
              <ArrowRight size={11} className="text-slate-400" style={{ width: 11, height: 11 }} />
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h1
            className="mt-7 text-[32px] sm:text-[52px] lg:text-[76px] leading-[1.02] font-semibold tracking-ultratight text-ink"
            initial={shouldReduce ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.55, ease: [0.21, 0.47, 0.32, 0.98] }}>
            Compliance that runs itself, while you run the agency.
          </motion.h1>

          {/* Lead */}
          <motion.p
            className="mt-6 text-[17px] sm:text-[19px] leading-[1.55] text-slate-600 max-w-2xl mx-auto"
            initial={shouldReduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}>
            CareComply is the operations platform UK domiciliary care agencies use to onboard carers, track documents, chase references, and stay CQC-ready — without spreadsheets, WhatsApp threads or guesswork.
          </motion.p>

          {/* CTAs */}
          <motion.div
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
            initial={shouldReduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}>
            <MButton size="lg" variant="brand" as={Link} href="/auth/sign-up">
              Start 14-day free trial <ArrowRight size={16} />
            </MButton>
            <MButton size="lg" variant="secondary" as={Link} href="/demo">
              Book a 25-minute demo
            </MButton>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12.5px] text-slate-500"
            initial={shouldReduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}>
            {TRUST_BADGES.map((b) => (
              <span key={b} className="inline-flex items-center gap-1.5">
                <Check size={13} className="text-emerald-600" style={{ width: 13, height: 13 }} />
                {b}
              </span>
            ))}
          </motion.div>
        </div>

        {/* Dashboard mockup */}
        <motion.div
          className="relative mt-16 sm:mt-20 mx-auto max-w-[1180px]"
          initial={shouldReduce ? false : { opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.65, ease: [0.21, 0.47, 0.32, 0.98] }}>
          <BrowserChrome>
            <MockDashboard />
          </BrowserChrome>

          {/* Foreground gradient fade — dissolves bottom of mock into page */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] rounded-b-2xl z-[5]"
            style={{
              background:
                'linear-gradient(180deg, rgba(248,250,252,0) 0%, rgba(248,250,252,0.55) 45%, rgba(248,250,252,0.92) 78%, rgba(248,250,252,1) 100%)',
            }}
          />

          {/* Floating notification cards */}
          <FloatingCard
            delay={0.2}
            className="hidden xl:block absolute -left-14 top-24 w-[280px] rounded-xl bg-white border border-line shadow-lift p-3.5 z-10">
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="h-8 w-8 rounded-md bg-emerald-50 text-emerald-700 grid place-items-center shrink-0">
                <Mail size={15} style={{ width: 15, height: 15 }} />
              </div>
              <div className="min-w-0">
                <div className="text-[12.5px] font-medium text-ink truncate">Reference response received</div>
                <div className="text-[10.5px] text-slate-500">2 min ago · Marcus Holloway</div>
              </div>
            </div>
            <div className="text-[11px] text-slate-500 pl-10">
              Routed to Reviews · Imogen notified
            </div>
          </FloatingCard>

          <FloatingCard
            delay={0.35}
            className="hidden xl:block absolute -right-14 top-[300px] w-[280px] rounded-xl bg-white border border-line shadow-lift p-3.5 z-10">
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="h-8 w-8 rounded-md bg-amber-50 text-amber-700 grid place-items-center shrink-0">
                <AlertTriangle size={15} style={{ width: 15, height: 15 }} />
              </div>
              <div className="min-w-0">
                <div className="text-[12.5px] font-medium text-ink truncate">DBS expiring · 4 days</div>
                <div className="text-[10.5px] text-slate-500">Marcus Holloway · Auto-reminder sent</div>
              </div>
            </div>
            <button className="text-[11px] text-brand-700 font-medium pl-10 hover:text-brand-800">
              Open review →
            </button>
          </FloatingCard>
        </motion.div>
      </Container>
    </section>
  );
}

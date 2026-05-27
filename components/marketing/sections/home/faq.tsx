'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Container } from '../../ui/container';
import { SectionHeader } from '../../ui/section-header';

const FAQ_ITEMS = [
  {
    q: 'Is CareComply CQC-aligned?',
    a: 'Yes. Every action is tagged by CQC key question (Safe, Effective, Caring, Responsive, Well-led) and category (governance, staffing, documents, onboarding, billing). Exports are tamper-evident and can be verified months or years later.',
  },
  {
    q: 'How does the free trial work?',
    a: '14 days free, no card required. You get full access to all Pro features so you can run a real onboarding cycle. After 14 days you choose a plan or downgrade to read-only.',
  },
  {
    q: 'Will it work for a multi-branch group?',
    a: 'Yes. CareComply is multi-tenant. Each branch is its own organisation with its own carers, documents, audit log, billing, and team. Group-level roll-ups are on the roadmap for Q3.',
  },
  {
    q: 'What happens to my data if I leave?',
    a: 'You can export every document, every audit log and every reference in standard formats (PDF, CSV, Excel) before you cancel. We delete tenant data within 30 days of confirmed cancellation.',
  },
  {
    q: 'Do you integrate with our rota / payroll system?',
    a: 'Today, CareComply is the compliance source-of-truth. We export to CSV for any downstream system. Native integrations with the major UK rota platforms are coming. Talk to us about your stack.',
  },
  {
    q: 'How is "active carer" counted for billing?',
    a: 'An active carer is one whose status is active or on_leave and was active at any point in the calendar month. Former carers do not count. Pending carers do not count until they go active.',
  },
];

export function FAQ() {
  const [open, setOpen] = React.useState<number | null>(0);

  return (
    <section className="py-20 lg:py-24">
      <Container>
        <div className="grid md:grid-cols-[1fr_1.4fr] gap-12">
          <SectionHeader
            eyebrow="FAQ"
            title="The questions managers ask before they sign."
            lead="If you have one we have not answered, our team replies in business hours, in London time."
          />

          <div className="rounded-2xl bg-white border border-line divide-y divide-line">
            {FAQ_ITEMS.map((it, i) => (
              <div key={i}>
                <button
                  className="cursor-pointer w-full px-5 py-4 flex items-center gap-4 text-left focus-ring"
                  onClick={() => setOpen(open === i ? null : i)}
                  aria-expanded={open === i}
                  aria-controls={`faq-answer-${i}`}>
                  <span className="text-[15px] font-medium text-ink flex-1">{it.q}</span>
                  <motion.span
                    animate={{ rotate: open === i ? 180 : 0 }}
                    transition={{ duration: 0.22 }}>
                    <ChevronDown
                      size={16}
                      className={cn('text-slate-400 transition-colors', open === i && 'text-ink')}
                      style={{ width: 16, height: 16 }}
                    />
                  </motion.span>
                </button>
                <AnimatePresence>
                  {open === i && (
                    <motion.div
                      id={`faq-answer-${i}`}
                      key="answer"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: [0.21, 0.47, 0.32, 0.98] }}
                      className="overflow-hidden">
                      <div className="px-5 pb-5 text-[14px] text-slate-600 leading-[1.6] max-w-2xl">
                        {it.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

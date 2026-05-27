import * as React from 'react';
import Link from 'next/link';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { Container } from '../../ui/container';
import { Eyebrow } from '../../ui/eyebrow';
import { MButton } from '../../ui/button';
import { AuditLogPanel } from '../../mocks/audit-log-panel';
import { Reveal } from '../../animations/reveal';

const TRUST_ITEMS = [
  ['ICO-registered',        'data controller'],
  ['UK data residency',     'AWS eu-west-2'],
  ['Encryption',            'AES-256 at rest, TLS 1.2+ in transit'],
  ['Row-level security',    'enforced at the database'],
  ['Tamper-evident exports','HMAC signature on every file'],
  ['Granular roles',        'custom roles on Pro'],
];

export function SecurityPreview() {
  return (
    <section className="py-20 lg:py-24">
      <Container>
        <div className="grid md:grid-cols-[1.05fr_1.2fr] gap-12 items-center">
          <Reveal>
            <Eyebrow>Security &amp; trust</Eyebrow>
            <h2 className="mt-4 text-[34px] sm:text-[42px] leading-[1.05] font-semibold tracking-ultratight text-ink">
              Treats carer data like the clinical record that it is.
            </h2>
            <p className="mt-5 text-[16px] text-slate-600 max-w-xl leading-[1.55]">
              We host in the UK on AWS London. Every document is encrypted at rest, every audit export is cryptographically signed, every action is row-level secured by organisation.
            </p>
            <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-[14px] text-slate-700">
              {TRUST_ITEMS.map(([h, d]) => (
                <li key={h}>
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-brand-700 shrink-0" style={{ width: 14, height: 14 }} />
                    <span className="font-medium text-ink">{h}</span>
                  </div>
                  <div className="text-slate-500 pl-6 text-[12.5px]">{d}</div>
                </li>
              ))}
            </ul>
            <div className="mt-7">
              <MButton variant="primary" as={Link} href="/security">
                Read the trust report <ArrowRight size={15} />
              </MButton>
            </div>
          </Reveal>

          <Reveal delay={0.15}>
            <AuditLogPanel />
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

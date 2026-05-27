import * as React from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { Logo } from './logo';
import { Pill } from './ui/pill';
import { Container } from './ui/container';

const FOOTER_COLS = [
  {
    h: 'Product',
    items: [
      ['/features', 'Features'],
      ['/pricing', 'Pricing'],
      ['/features#cqc', 'CQC readiness'],
      ['/security', 'Security'],
      ['#', 'Changelog'],
    ],
  },
  {
    h: 'Solutions',
    items: [
      ['/', 'Domiciliary agencies'],
      ['/', 'Multi-branch groups'],
      ['/features#cqc', 'CQC readiness'],
      ['/features#compliance', 'Workforce compliance'],
      ['/about', 'Migrating from spreadsheets'],
    ],
  },
  {
    h: 'Resources',
    items: [
      ['#', 'Help centre'],
      ['#', 'Onboarding guides'],
      ['#', 'CQC evidence library'],
      ['/security', 'API status'],
      ['/demo', 'Book a demo'],
    ],
  },
  {
    h: 'Company',
    items: [
      ['/about', 'About'],
      ['/', 'Customers'],
      ['/contact', 'Contact sales'],
      ['/about', 'Press kit'],
      ['/about', 'Careers'],
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface-page">
      <Container className="py-16">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-[1.4fr_repeat(4,1fr)] gap-10">
          {/* Brand column */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Logo />
            <p className="mt-4 text-sm text-slate-600 max-w-xs leading-relaxed">
              The compliance operations platform for UK domiciliary care agencies. Built in the United Kingdom.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <Pill tone="ok">
                <ShieldCheck size={12} className="shrink-0" /> ICO-registered
              </Pill>
              <Pill tone="brand">UK-hosted</Pill>
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_COLS.map((col) => (
            <div key={col.h}>
              <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-slate-600">
                {col.h}
              </div>
              <ul className="mt-4 space-y-2.5">
                {col.items.map(([href, label]) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-[14px] text-slate-700 hover:text-ink transition">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-14 pt-6 border-t border-line flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="text-xs text-slate-600">
            © 2025 CareComply Ltd · Registered in England &amp; Wales · Company No. 15732910
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <Link href="#" className="hover:text-ink transition">Privacy</Link>
            <Link href="#" className="hover:text-ink transition">Terms</Link>
            <Link href="#" className="hover:text-ink transition">DPA</Link>
            <Link href="#" className="hover:text-ink transition">Sub-processors</Link>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-livepulse" />
              All systems operational
            </span>
          </div>
        </div>
      </Container>
    </footer>
  );
}

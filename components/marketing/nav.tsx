'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu, X, ChevronDown, ArrowRight,
  ListChecks, Mail, Bell, FileCheck, Users, ShieldCheck,
  BookOpen, Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from './logo';
import { Container } from './ui/container';
import { MButton } from './ui/button';

/* ─── Product dropdown items ─────────────────────────────────────────────── */
const PRODUCT_ITEMS = [
  { href: '/features#compliance', icon: ListChecks, title: 'Compliance tracking',  desc: 'Live status across documents, references, and required types.' },
  { href: '/features#references', icon: Mail,       title: 'Reference chasing',     desc: 'Token-protected forms, automatic chases at day 3, 7, 14.' },
  { href: '/features#expiry',     icon: Bell,       title: 'Expiry reminders',       desc: 'Fixed 30/7/0-day reminders; custom rules on Pro.' },
  { href: '/features#documents',  icon: FileCheck,  title: 'Document review',        desc: 'Approve, reject, replace, supersede with full trail.' },
  { href: '/features#onboarding', icon: Users,      title: 'Carer onboarding',       desc: 'Token invite, self-serve form, automatic progress.' },
  { href: '/features#cqc',        icon: ShieldCheck,title: 'CQC-ready audit',        desc: 'Tamper-evident exports tagged by key question.' },
];

const RESOURCES_ITEMS = [
  { href: '/security', icon: ShieldCheck, title: 'Trust & security', desc: 'How we protect carer data and audit evidence.' },
  { href: '/demo',     icon: Send,        title: 'Book a demo',      desc: 'A 25-minute walkthrough with our team.' },
  { href: '#',         icon: BookOpen,    title: 'Help centre',       desc: 'Setup guides, onboarding flows, automation recipes.' },
];

const NAV_LINKS = [
  { href: '/pricing', label: 'Pricing' },
  { href: '/about',   label: 'About' },
  { href: '/contact', label: 'Contact' },
];

/* ─── Dropdown ─────────────────────────────────────────────────────────────── */
function DropdownMenu({
  items,
  cols = 2,
  label,
}: {
  items: typeof PRODUCT_ITEMS;
  cols?: number;
  label: string;
}) {
  return (
    <motion.div
      role="menu"
      aria-label={label}
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.18, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={cn(
        'absolute top-full left-0 mt-2 rounded-2xl bg-white border border-line shadow-lift p-3 z-50',
        cols === 2 ? 'w-[min(640px,90vw)] grid grid-cols-1 sm:grid-cols-2 gap-1' : 'w-[min(460px,90vw)] grid grid-cols-1 gap-1'
      )}>
      {items.map((item) => (
        <Link
          key={item.title}
          href={item.href}
          role="menuitem"
          className="text-left p-3 rounded-xl hover:bg-surface-page transition flex gap-3 group focus-ring">
          <div className="h-9 w-9 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
            <item.icon size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-ink">{item.title}</div>
            <div className="text-[12px] text-slate-500 mt-0.5 leading-snug">{item.desc}</div>
          </div>
        </Link>
      ))}
    </motion.div>
  );
}

/* ─── Main nav ─────────────────────────────────────────────────────────────── */
export function TopNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [activeMenu, setActiveMenu] = React.useState<'product' | 'resources' | null>(null);
  const navRef = React.useRef<HTMLDivElement>(null);

  // Close on outside click or Escape key
  React.useEffect(() => {
    function clickHandler(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    }
    function keyHandler(e: KeyboardEvent) {
      if (e.key === 'Escape') setActiveMenu(null);
    }
    document.addEventListener('mousedown', clickHandler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', clickHandler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, []);

  // Close mobile on route change
  React.useEffect(() => {
    setMobileOpen(false);
    setActiveMenu(null);
  }, [pathname]);

  const isActive = (href: string) => pathname === href;

  return (
    <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-white/75 bg-white/95 border-b border-line">
      <Container className="flex h-16 items-center justify-between" ref={navRef as any}>
        {/* Left: Logo + Desktop nav */}
        <div className="flex items-center gap-8">
          <Link href="/" className="focus-ring rounded-md" aria-label="CareComply home">
            <Logo />
          </Link>

          <nav
            className="hidden lg:flex items-center gap-1 relative"
            aria-label="Main navigation"
            onMouseLeave={() => setActiveMenu(null)}>

            {/* Product dropdown trigger */}
            <div
              onMouseEnter={() => setActiveMenu('product')}
              onFocus={() => setActiveMenu('product')}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setActiveMenu(null);
              }}>
              <Link
                href="/features"
                aria-haspopup="true"
                aria-expanded={activeMenu === 'product'}
                className={cn(
                  'flex items-center gap-1 px-3 py-2 text-[14px] rounded-md transition focus-ring',
                  isActive('/features') ? 'text-ink font-medium' : 'text-slate-600 hover:text-ink'
                )}>
                Product <ChevronDown size={14} className="opacity-60" aria-hidden="true" />
              </Link>
            </div>

            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? 'page' : undefined}
                className={cn(
                  'px-3 py-2 text-[14px] rounded-md transition focus-ring',
                  isActive(href) ? 'text-ink font-medium' : 'text-slate-600 hover:text-ink'
                )}>
                {label}
              </Link>
            ))}

            {/* Resources dropdown trigger */}
            <div
              onMouseEnter={() => setActiveMenu('resources')}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setActiveMenu(null);
              }}>
              <button
                onClick={() => setActiveMenu(activeMenu === 'resources' ? null : 'resources')}
                aria-haspopup="true"
                aria-expanded={activeMenu === 'resources'}
                className="flex items-center gap-1 px-3 py-2 text-[14px] rounded-md transition focus-ring text-slate-600 hover:text-ink">
                Resources <ChevronDown size={14} className="opacity-60" aria-hidden="true" />
              </button>
            </div>

            {/* Dropdowns */}
            <AnimatePresence>
              {activeMenu === 'product' && (
                <DropdownMenu key="product" items={PRODUCT_ITEMS} cols={2} label="Product features" />
              )}
              {activeMenu === 'resources' && (
                <div className="absolute top-full left-[280px]">
                  <DropdownMenu key="resources" items={RESOURCES_ITEMS} cols={1} label="Resources" />
                </div>
              )}
            </AnimatePresence>
          </nav>
        </div>

        {/* Right: CTAs */}
        <div className="flex items-center gap-2">
          <Link
            href="/auth/login"
            className="hidden sm:inline-flex h-9 px-3 text-sm text-slate-700 hover:text-ink rounded-md focus-ring items-center">
            Sign in
          </Link>
          <MButton size="sm" variant="secondary" as={Link} href="/demo" className="hidden sm:inline-flex">
            Book a demo
          </MButton>
          <MButton size="sm" variant="brand" as={Link} href="/auth/sign-up">
            Start free trial
          </MButton>

          {/* Mobile menu toggle */}
          <button
            className="lg:hidden h-9 w-9 grid place-items-center rounded-md hover:bg-surface-muted focus-ring"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav">
            {mobileOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
        </div>
      </Container>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            id="mobile-nav"
            aria-label="Mobile navigation"
            key="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="lg:hidden overflow-hidden border-t border-line bg-white">
            <Container className="py-3 grid gap-0.5">
              {[
                ['/', 'Home'],
                ['/features', 'Product'],
                ['/pricing', 'Pricing'],
                ['/about', 'About'],
                ['/contact', 'Contact'],
                ['/demo', 'Book a demo'],
                ['/security', 'Trust & security'],
              ].map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive(href) ? 'page' : undefined}
                  className={cn(
                    'px-3 py-2.5 rounded-lg text-[14px] transition',
                    isActive(href) ? 'bg-brand-50 text-brand-700 font-medium' : 'text-slate-700 hover:bg-surface-page'
                  )}>
                  {label}
                </Link>
              ))}
              <div className="h-px bg-line my-1" role="separator" />
              <Link
                href="/auth/login"
                className="px-3 py-2.5 rounded-lg text-[14px] text-slate-700 hover:bg-surface-page">
                Sign in
              </Link>
            </Container>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

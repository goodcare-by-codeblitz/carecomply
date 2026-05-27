import * as React from 'react';

const FEATURES = [
  'Reference chasing',
  'Document expiry reminders',
  'CQC inspection readiness',
  'Carer onboarding',
  'Custom automation rules',
  'Tamper-evident audit exports',
  'Escalation workflows',
  'Digital document storage',
  'Team compliance tracking',
  'Automatic chase emails',
  'Per-document reminder rules',
  'Inspection evidence packs',
];

export function LogoMarquee() {
  // 6 copies (~10 000px total). translateX(-50%) scrolls 3 copies.
  // Even on a 3840px 4K display: 5000 + 3840 = 8840 < 10 000 — always filled.
  // Duration tripled vs a 2-copy strip to keep the same visual speed.
  const items = [...FEATURES, ...FEATURES, ...FEATURES, ...FEATURES, ...FEATURES, ...FEATURES];

  return (
    <div className="relative overflow-hidden border-y border-line bg-white py-5" aria-hidden="true">
      {/* Edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-10 sm:w-20 lg:w-32 bg-gradient-to-r from-white to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-10 sm:w-20 lg:w-32 bg-gradient-to-l from-white to-transparent z-10" />

      <div
        className="inline-flex items-center"
        style={{ animation: 'marquee 114s linear infinite', willChange: 'transform' }}
      >
        {items.map((label, i) => (
          <React.Fragment key={i}>
            <span className="text-[13.5px] font-medium text-slate-500 tracking-tight whitespace-nowrap shrink-0 px-7">
              {label}
            </span>
            <span className="h-[5px] w-[5px] rounded-full bg-brand/35 shrink-0" aria-hidden="true" />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

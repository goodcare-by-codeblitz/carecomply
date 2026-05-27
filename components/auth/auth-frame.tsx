import * as React from 'react';
import { Lock } from 'lucide-react';
import { Eyebrow } from '@/components/marketing/ui/eyebrow';
import { MAvatar } from '@/components/marketing/ui/avatar';
import { Container } from '@/components/marketing/ui/container';

interface AuthFrameProps {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function AuthFrame({ eyebrow, title, subtitle, footer, children }: AuthFrameProps) {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-surface-page">
      <Container>
        <div className="grid lg:grid-cols-2 gap-16 xl:gap-24">
          {/* Form column */}
          <div className="py-12 lg:py-16 w-full max-w-[520px]">
            {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
            <h1 className="text-[32px] sm:text-[36px] leading-[1.1] font-semibold tracking-ultratight text-ink">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2.5 text-[15px] text-slate-600">{subtitle}</p>
            )}
            <div className="mt-8">{children}</div>
            {footer && (
              <div className="mt-6 text-[14px] text-slate-700">{footer}</div>
            )}
            <div className="mt-10 flex items-center gap-2 text-[12px] text-slate-500">
              <Lock size={13} style={{ width: 13, height: 13 }} />
              <span>Encrypted in transit · UK-hosted · ICO-registered</span>
            </div>
          </div>

          {/* Decorative column — visible on lg+ */}
          <div className="hidden lg:flex flex-col justify-center py-16">
            <div className="rounded-2xl border border-line bg-white p-8 shadow-card max-w-md">
              <div className="space-y-6">
                <div>
                  <div className="text-[13px] font-medium text-slate-500 uppercase tracking-wide mb-4">Trusted by UK domiciliary agencies</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl border border-line bg-surface-page p-4">
                      <div className="text-[28px] font-semibold tracking-tight text-ink">98%</div>
                      <div className="text-[12px] text-slate-500 mt-1">inspection readiness rate</div>
                    </div>
                    <div className="rounded-xl border border-line bg-surface-page p-4">
                      <div className="text-[28px] font-semibold tracking-tight text-ink">4 min</div>
                      <div className="text-[12px] text-slate-500 mt-1">average carer onboard time</div>
                    </div>
                    <div className="rounded-xl border border-line bg-surface-page p-4">
                      <div className="text-[28px] font-semibold tracking-tight text-ink">£0</div>
                      <div className="text-[12px] text-slate-500 mt-1">card required to trial</div>
                    </div>
                    <div className="rounded-xl border border-line bg-surface-page p-4">
                      <div className="text-[28px] font-semibold tracking-tight text-ink">UK</div>
                      <div className="text-[12px] text-slate-500 mt-1">hosted · ICO-registered</div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-line pt-6">
                  <p className="text-[14.5px] leading-[1.65] text-slate-700">
                    "We replaced four spreadsheets, a Drive folder, and a WhatsApp group with CareComply. Our last inspection was the calmest we have ever had."
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <MAvatar name="Chiamaka Egwu" size="md" tone="#14B8A6" />
                    <div>
                      <div className="text-[13px] font-semibold text-ink">Chiamaka Egwu</div>
                      <div className="text-[12px] text-slate-500">Registered Manager, Linden Domiciliary</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}

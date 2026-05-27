'use client';

import * as React from 'react';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ROICalculator() {
  const [carers, setCarers] = React.useState(60);
  const [hoursPerCarer, setHoursPerCarer] = React.useState(2);
  const [hourlyRate, setHourlyRate] = React.useState(22);

  const manualMonthly = carers * hoursPerCarer * hourlyRate;
  const ccPro = 59 + Math.max(0, carers - 40) * 4;
  const saved = manualMonthly - ccPro;

  const sliders = [
    { l: 'Active carers', v: carers, set: setCarers, min: 1, max: 300, step: 1, unit: '' },
    { l: 'Hours of compliance admin / carer / month', v: hoursPerCarer, set: setHoursPerCarer, min: 0, max: 8, step: 0.5, unit: ' hrs' },
    { l: 'Loaded hourly cost of your admin team', v: hourlyRate, set: setHourlyRate, min: 12, max: 40, step: 1, unit: ' £/hr' },
  ];

  return (
    <div className="rounded-2xl bg-white border border-line shadow-card overflow-hidden">
      <div className="px-6 py-4 border-b border-line">
        <div className="text-[15px] font-semibold text-ink">Spreadsheet vs CareComply Pro</div>
        <div className="text-[12px] text-slate-500">A rough monthly comparison. Adjust the inputs to your agency.</div>
      </div>
      <div className="grid md:grid-cols-2 gap-6 p-6">
        <div className="space-y-4">
          {sliders.map((c, i) => {
            const pct = ((c.v - c.min) / (c.max - c.min)) * 100;
            return (
              <label key={i} className="block">
                <div className="flex items-center justify-between text-[12px] text-slate-500 font-medium mb-1.5">
                  <span>{c.l}</span>
                  <span className="text-ink font-semibold tabular-nums">{c.v}{c.unit}</span>
                </div>
                <input
                  type="range"
                  min={c.min}
                  max={c.max}
                  step={c.step}
                  value={c.v}
                  onChange={(e) => c.set(Number(e.target.value))}
                  className="roi-slider w-full"
                  style={{ background: `linear-gradient(to right, #1D4ED8 ${pct}%, #E2E8F0 ${pct}%)` }}
                />
              </label>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 rounded-xl bg-surface-page border border-line p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold">Estimated savings</div>
            <div className="mt-1 text-[32px] sm:text-[40px] leading-none font-semibold tracking-ultratight text-brand-700 tabular-nums">
              £{Math.max(0, saved).toLocaleString()}
              <span className="text-[16px] text-slate-500 font-normal">/mo</span>
            </div>
            <div className="mt-1 text-[12px] text-slate-500">
              Equivalent to £{Math.max(0, saved * 12).toLocaleString()} per year reinvested into care delivery.
            </div>
          </div>
          <div className="rounded-xl bg-white border border-line p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold">Manual today</div>
            <div className="mt-1 text-[26px] font-semibold tabular-nums text-slate-700">
              £{manualMonthly.toLocaleString()}
              <span className="text-[14px] text-slate-500">/mo</span>
            </div>
          </div>
          <div className="rounded-xl bg-ink text-white p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400 font-semibold">CareComply Pro</div>
            <div className="mt-1 text-[26px] font-semibold tabular-nums">
              £{ccPro.toLocaleString()}
              <span className="text-[14px] text-slate-400">/mo</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import * as React from 'react';

export function DemoForm() {
  return (
    <form className="space-y-4" onSubmit={(e) => e.preventDefault()} aria-label="Demo request form">
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-[13px] font-medium text-ink mb-1.5 block">First name</span>
          <input
            type="text"
            required
            aria-required="true"
            className="w-full h-10 rounded-lg border border-line bg-white px-3 text-[14px] text-ink placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition"
            placeholder="Chiamaka"
          />
        </label>
        <label className="block">
          <span className="text-[13px] font-medium text-ink mb-1.5 block">Last name</span>
          <input
            type="text"
            required
            aria-required="true"
            className="w-full h-10 rounded-lg border border-line bg-white px-3 text-[14px] text-ink placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition"
            placeholder="Egwu"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-[13px] font-medium text-ink mb-1.5 block">Work email</span>
        <input
          type="email"
          required
          aria-required="true"
          className="w-full h-10 rounded-lg border border-line bg-white px-3 text-[14px] text-ink placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition"
          placeholder="you@youragency.co.uk"
        />
      </label>
      <label className="block">
        <span className="text-[13px] font-medium text-ink mb-1.5 block">Agency name</span>
        <input
          type="text"
          required
          aria-required="true"
          className="w-full h-10 rounded-lg border border-line bg-white px-3 text-[14px] text-ink placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition"
          placeholder="Linden Domiciliary"
        />
      </label>
      <label className="block">
        <span className="text-[13px] font-medium text-ink mb-1.5 block">Active carers</span>
        <select className="w-full h-10 rounded-lg border border-line bg-white px-3 text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition">
          <option>Under 25</option>
          <option>25–50</option>
          <option>50–100</option>
          <option>100+</option>
        </select>
      </label>
      <button
        type="submit"
        className="w-full h-11 rounded-lg bg-brand text-white font-medium text-[14px] hover:bg-brand-700 transition focus-ring">
        Request a demo slot
      </button>
      <p className="text-center text-[12px] text-slate-500">
        We will reply with available times within one business day.
      </p>
    </form>
  );
}

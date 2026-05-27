'use client';

import * as React from 'react';

export function ContactForm() {
  return (
    <form className="space-y-5" onSubmit={(e) => e.preventDefault()} aria-label="Contact form">
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-[13px] font-medium text-ink mb-1.5 block">First name</span>
          <input
            type="text"
            autoComplete="given-name"
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
            autoComplete="family-name"
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
          autoComplete="email"
          required
          aria-required="true"
          className="w-full h-10 rounded-lg border border-line bg-white px-3 text-[14px] text-ink placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition"
          placeholder="chiamaka@lindendomiciliary.co.uk"
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
        <span className="text-[13px] font-medium text-ink mb-1.5 block">Number of active carers</span>
        <select className="w-full h-10 rounded-lg border border-line bg-white px-3 text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition">
          <option>1–25</option>
          <option>26–50</option>
          <option>51–100</option>
          <option>100+</option>
        </select>
      </label>
      <label className="block">
        <span className="text-[13px] font-medium text-ink mb-1.5 block">Message</span>
        <textarea
          rows={4}
          required
          aria-required="true"
          className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-[14px] text-ink placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition resize-none"
          placeholder="Tell us about your agency and what you'd like to achieve with CareComply."
        />
      </label>
      <button
        type="submit"
        className="w-full h-11 rounded-lg bg-brand text-white font-medium text-[14px] hover:bg-brand-700 transition focus-ring">
        Send message
      </button>
      <p className="text-[12px] text-slate-500 text-center">
        We reply within one business day. No spam, ever.
      </p>
    </form>
  );
}

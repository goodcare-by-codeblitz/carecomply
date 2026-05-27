import * as React from 'react';
import { Mail, Phone, MapPin, Clock } from 'lucide-react';
import type { Metadata } from 'next';
import { Container } from '@/components/marketing/ui/container';
import { Eyebrow } from '@/components/marketing/ui/eyebrow';
import { SectionHeader } from '@/components/marketing/ui/section-header';
import { Reveal } from '@/components/marketing/animations/reveal';
import { ContactForm } from '@/components/marketing/sections/contact-form';

export const metadata: Metadata = {
  title: 'Contact — CareComply',
  description: 'Talk to our team about CareComply for your care agency.',
};

const CONTACT_INFO = [
  { Icon: Mail,  l: 'Email us',     v: 'hello@carecomply.co.uk',        href: 'mailto:hello@carecomply.co.uk' },
  { Icon: Phone, l: 'Call us',      v: '+44 (0)20 3488 xxxx',           href: 'tel:+442034880000' },
  { Icon: MapPin,l: 'Registered office', v: 'London, United Kingdom',   href: null },
  { Icon: Clock, l: 'Support hours',v: 'Mon–Fri 9am–6pm GMT/BST',       href: null },
];

export default function ContactPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 bg-grid" />
        <Container className="relative pt-20 pb-16">
          <Reveal>
            <Eyebrow>Contact</Eyebrow>
            <h1 className="mt-4 text-[30px] sm:text-[44px] lg:text-[54px] leading-[1.04] font-semibold tracking-ultratight text-ink max-w-2xl">
              Talk to us. We reply in business hours.
            </h1>
            <p className="mt-5 text-[17px] leading-[1.55] text-slate-600 max-w-xl">
              Whether you are evaluating CareComply, migrating from another system, or running 100+ active carers and want to talk Enterprise — we are here.
            </p>
          </Reveal>
        </Container>
      </section>

      <section className="py-20 lg:py-24">
        <Container>
          <div className="grid md:grid-cols-[1.4fr_1fr] gap-16 items-start">
            {/* Contact form */}
            <Reveal>
              <div className="rounded-2xl bg-white border border-line p-7">
                <h2 className="text-[20px] font-semibold tracking-tight text-ink mb-6">Send us a message</h2>
                <ContactForm />
              </div>
            </Reveal>

            {/* Contact info */}
            <Reveal delay={0.15}>
              <div className="space-y-6">
                {CONTACT_INFO.map(({ Icon, l, v, href }) => (
                  <div key={l} className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-brand-50 text-brand-700 grid place-items-center shrink-0">
                      <Icon size={16} style={{ width: 16, height: 16 }} />
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-ink">{l}</div>
                      {href ? (
                        <a href={href} className="text-[14px] text-brand-700 hover:text-brand-800 transition mt-0.5 block">
                          {v}
                        </a>
                      ) : (
                        <div className="text-[14px] text-slate-600 mt-0.5">{v}</div>
                      )}
                    </div>
                  </div>
                ))}

                <div className="mt-8 rounded-2xl bg-surface-page border border-line p-5">
                  <div className="text-[13px] font-semibold text-ink mb-2">Enterprise enquiries</div>
                  <p className="text-[13.5px] text-slate-600 leading-snug">
                    Running 100+ active carers, multiple branches, or need a procurement security review? Our team will arrange a tailored commercial conversation.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </Container>
      </section>
    </>
  );
}

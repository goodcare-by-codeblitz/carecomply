import { HomeHero } from '@/components/marketing/sections/home/hero';
import { LogoMarquee } from '@/components/marketing/sections/logo-marquee';
import { ProblemSolution } from '@/components/marketing/sections/home/problem-solution';
import { FeatureBento } from '@/components/marketing/sections/home/feature-bento';
import { WorkflowJourney } from '@/components/marketing/workflow/workflow-journey';
import { MetricStrip } from '@/components/marketing/sections/home/metric-strip';
import { ROISection } from '@/components/marketing/sections/home/roi-section';
import { Testimonials } from '@/components/marketing/sections/home/testimonials';
import { SecurityPreview } from '@/components/marketing/sections/home/security-preview';
import { PricingPreview } from '@/components/marketing/sections/home/pricing-preview';
import { FAQ } from '@/components/marketing/sections/home/faq';
import { CTABand } from '@/components/marketing/sections/cta-band';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CareComply — Compliance that runs itself, while you run the agency',
  description:
    'CareComply is the operations platform UK domiciliary care agencies use to onboard carers, track documents, chase references, and stay CQC-ready — without spreadsheets.',
};

export default function HomePage() {
  return (
    <>
      <HomeHero />
      <LogoMarquee />
      <ProblemSolution />
      <FeatureBento />
      <WorkflowJourney />
      <MetricStrip />
      <ROISection />
      <Testimonials />
      <SecurityPreview />
      <PricingPreview />
      <FAQ />
      <CTABand />
    </>
  );
}

import type { Metadata } from 'next';
import { Faq } from '@/components/marketing/faq';
import { Reveal } from '@/components/marketing/reveal';
import { getI18n } from '@/lib/i18n/server';
import { pageMetadata } from '@/lib/seo';
import { PricingPlans } from './plans';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return pageMetadata(t.meta.pricingTitle, t.meta.pricingDescription, '/pricing');
}

export default async function PricingPage() {
  const { t } = await getI18n();
  const pt = t.pricing;
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{pt.title}</h1>
      <p className="mt-3 max-w-xl text-lg text-muted-foreground">{pt.intro}</p>
      <PricingPlans />
      <Reveal className="mx-auto mt-20 max-w-3xl">
        <Faq id="pricing-faq" title={pt.faqTitle} items={pt.faq} />
      </Reveal>
    </div>
  );
}

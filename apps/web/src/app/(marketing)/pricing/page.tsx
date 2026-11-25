import type { Metadata } from 'next';
import { getI18n } from '@/lib/i18n/server';
import { PricingPlans } from './plans';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.meta.pricingTitle, description: t.meta.pricingDescription };
}

export default function PricingPage() {
  return <PricingPlans />;
}

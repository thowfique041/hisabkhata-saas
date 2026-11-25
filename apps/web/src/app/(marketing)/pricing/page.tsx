import type { Metadata } from 'next';
import { PricingPlans } from './plans';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Simple prices in taka. Start free, try Basic for 14 days, pay by bKash, Nagad, card or bank transfer.',
};

export default function PricingPage() {
  return <PricingPlans />;
}

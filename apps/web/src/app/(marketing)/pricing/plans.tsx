'use client';
import * as React from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { formatMoney } from '@hisabkhata/shared';
import { usePlans } from '@/hooks/use-plans';
import { POPULAR_PLAN } from '@/config/plans';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const FEATURE: Record<string, string> = {
  ADVANCED_REPORTS: 'Profit and loss, product, customer and payment reports',
  ADVANCED_ANALYTICS: 'Advanced analytics',
  PRIORITY_SUPPORT: 'Priority support',
  INVOICE_EMAIL: 'Email invoices to customers',
};

export function PricingPlans() {
  const { plans: data } = usePlans();
  const [yearly, setYearly] = React.useState(false);
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Simple prices in taka</h1>
      <p className="mt-3 max-w-xl text-lg text-muted-foreground">
        Start free. Every new business gets 14 days of Basic. Pay by bKash, Nagad, card or bank
        transfer.
      </p>
      <div
        role="radiogroup"
        aria-label="Billing period"
        className="mt-8 inline-flex rounded-md border p-0.5 text-sm"
      >
        <button
          role="radio"
          aria-checked={!yearly}
          onClick={() => setYearly(false)}
          className={cn('rounded px-3 py-1.5', !yearly && 'bg-primary text-primary-foreground')}
        >
          Monthly
        </button>
        <button
          role="radio"
          aria-checked={yearly}
          onClick={() => setYearly(true)}
          className={cn('rounded px-3 py-1.5', yearly && 'bg-primary text-primary-foreground')}
        >
          Yearly, 2 months free
        </button>
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {data.map((p) => {
          const featured = p.code === POPULAR_PLAN;
          const price = yearly ? p.priceYearly : p.priceMonthly;
          return (
            <div
              key={p.code}
              className={cn(
                'flex flex-col rounded-lg border p-6',
                featured ? 'border-primary bg-surface ring-1 ring-primary' : 'bg-surface',
              )}
            >
              <h2 className="text-lg font-semibold">{p.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
              <p className="mt-6">
                <span className="num text-3xl font-semibold">
                  {formatMoney(String(price), p.currency).replace('.00', '')}
                </span>
                <span className="text-sm text-muted-foreground">
                  {' '}
                  / {yearly ? 'year' : 'month'}
                </span>
              </p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {[
                  p.maxProducts < 0 ? 'Unlimited products' : `Up to ${p.maxProducts} products`,
                  p.maxEmployees < 0
                    ? 'Unlimited team members'
                    : p.maxEmployees === 1
                      ? 'Just you'
                      : `Up to ${p.maxEmployees} team members`,
                  'POS, invoices, customers, purchases',
                  ...p.features.map((f) => FEATURE[f] ?? f),
                ].map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-positive" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-6" variant={featured ? 'default' : 'outline'}>
                <Link href={`/register?plan=${p.code}`}>
                  {Number(price) === 0 ? 'Start free' : `Try ${p.name} free`}
                </Link>
              </Button>
            </div>
          );
        })}
      </div>
      <p className="mt-8 text-sm text-muted-foreground">
        Prices include VAT where applicable. You can change or cancel your plan at any time from the
        Subscription page.
      </p>
    </div>
  );
}

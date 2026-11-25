'use client';
import * as React from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { formatMoney } from '@hisabkhata/shared';
import { usePlans } from '@/hooks/use-plans';
import { POPULAR_PLAN, type PublicPlan } from '@/config/plans';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/client';

export function PricingPlans() {
  const { plans } = usePlans();
  const [yearly, setYearly] = React.useState(false);
  const { t } = useI18n();
  const pt = t.pricing;
  const planName = (p: PublicPlan) => pt.plans[p.code]?.name ?? p.name;
  const planBullets = (p: PublicPlan) => [
    p.maxProducts < 0 ? pt.unlimitedProducts : pt.upToProducts(p.maxProducts),
    p.maxEmployees < 0
      ? pt.unlimitedTeam
      : p.maxEmployees === 1
        ? pt.justYou
        : pt.upToTeam(p.maxEmployees),
    pt.core,
    ...p.features.map((f) => pt.featureNames[f] ?? f),
  ];
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{pt.title}</h1>
      <p className="mt-3 max-w-xl text-lg text-muted-foreground">{pt.intro}</p>
      <div
        role="radiogroup"
        aria-label={pt.period}
        className="mt-8 inline-flex rounded-md border p-0.5 text-sm"
      >
        {[false, true].map((y) => (
          <button
            key={String(y)}
            role="radio"
            aria-checked={yearly === y}
            onClick={() => setYearly(y)}
            className={cn(
              'rounded px-3 py-1.5',
              yearly === y && 'bg-primary text-primary-foreground',
            )}
          >
            {y ? pt.yearly : pt.monthly}
          </button>
        ))}
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {plans.map((p) => {
          const featured = p.code === POPULAR_PLAN;
          const price = yearly ? p.priceYearly : p.priceMonthly;
          return (
            <div
              key={p.code}
              className={cn(
                'flex flex-col rounded-lg border bg-surface p-6',
                featured && 'border-primary ring-1 ring-primary',
              )}
            >
              <h2 className="text-lg font-semibold">{planName(p)}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {pt.plans[p.code]?.description ?? p.description}
              </p>
              <p className="mt-6">
                <span className="num text-3xl font-semibold">
                  {formatMoney(String(price), p.currency).replace('.00', '')}
                </span>
                <span className="text-sm text-muted-foreground">
                  {' '}
                  / {yearly ? t.common.perYear : t.common.perMonth}
                </span>
              </p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {planBullets(p).map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-positive" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-6" variant={featured ? 'default' : 'outline'}>
                <Link href={`/register?plan=${p.code}`}>
                  {price === 0 ? pt.startFree : pt.tryPlan(planName(p))}
                </Link>
              </Button>
            </div>
          );
        })}
      </div>
      <p className="mt-8 text-sm text-muted-foreground">{pt.note}</p>
    </div>
  );
}

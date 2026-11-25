'use client';
import * as React from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Minus } from 'lucide-react';
import { usePlans } from '@/hooks/use-plans';
import { POPULAR_PLAN, type PublicPlan } from '@/config/plans';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/client';

const taka = (n: number) => `৳${n.toLocaleString('en-IN')}`;

/** The price figure slides when switching Monthly/Yearly so the change is noticed. */
function Price({ value, id }: { value: number; id: string }) {
  const reduce = useReducedMotion();
  return (
    <span className="relative inline-flex overflow-hidden align-bottom">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={id}
          className="num inline-block text-4xl font-semibold tracking-tight"
          initial={reduce ? false : { y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduce ? undefined : { y: -24, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          {taka(value)}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function PricingPlans() {
  const { plans } = usePlans();
  const [yearly, setYearly] = React.useState(false);
  const { t } = useI18n();
  const pt = t.pricing;
  const planName = (p: PublicPlan) => pt.plans[p.code]?.name ?? p.name;
  const bullets = (p: PublicPlan) => [
    p.maxProducts < 0 ? pt.unlimitedProducts : pt.upToProducts(p.maxProducts),
    p.maxEmployees < 0
      ? pt.unlimitedTeam
      : p.maxEmployees === 1
        ? pt.justYou
        : pt.upToTeam(p.maxEmployees),
    pt.core,
    ...p.features.map((f) => pt.featureNames[f] ?? f),
  ];

  const has = (feature: string) => (p: PublicPlan) => (p.features as string[]).includes(feature);
  const always = () => true;
  const limit = (n: number) => (n < 0 ? pt.unlimited : n.toLocaleString('en-IN'));
  const rows: [string, (p: PublicPlan) => boolean | string][] = [
    [pt.rows.products, (p) => limit(p.maxProducts)],
    [pt.rows.team, (p) => limit(p.maxEmployees)],
    [pt.rows.pos, always],
    [pt.rows.dues, always],
    [pt.rows.purchases, always],
    [pt.rows.basicReports, always],
    [pt.rows.advancedReports, has('ADVANCED_REPORTS')],
    [pt.rows.emailInvoices, has('INVOICE_EMAIL')],
    [pt.rows.analytics, has('ADVANCED_ANALYTICS')],
    [pt.rows.support, has('PRIORITY_SUPPORT')],
  ];

  return (
    <>
      <div
        role="radiogroup"
        aria-label={pt.period}
        className="mt-8 inline-flex rounded-md border bg-surface p-0.5 text-sm"
      >
        {[false, true].map((y) => (
          <button
            key={String(y)}
            type="button"
            role="radio"
            aria-checked={yearly === y}
            onClick={() => setYearly(y)}
            className={cn(
              'rounded px-3 py-1.5 font-medium transition-colors',
              yearly === y
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {y ? pt.yearly : pt.monthly}
          </button>
        ))}
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {plans.map((p) => {
          const featured = p.code === POPULAR_PLAN;
          const price = yearly ? p.priceYearly : p.priceMonthly;
          return (
            <div
              key={p.code}
              className={cn(
                'relative flex flex-col rounded-lg border bg-surface p-6 transition-shadow hover:shadow-md',
                featured &&
                  'border-primary shadow-[0_24px_48px_-28px_rgba(15,30,61,0.45)] ring-1 ring-primary md:-my-3 md:py-9',
              )}
            >
              {featured && (
                <span className="absolute -top-3 left-6 rounded-full bg-emerald px-2.5 py-0.5 text-xs font-semibold text-white">
                  {pt.popular}
                </span>
              )}
              <h2 className="text-lg font-semibold">{planName(p)}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {pt.plans[p.code]?.description ?? p.description}
              </p>
              <p className="mt-6 flex items-baseline gap-1">
                <Price value={price} id={`${p.code}-${yearly}`} />
                <span className="text-sm text-muted-foreground">
                  / {yearly ? t.common.perYear : t.common.perMonth}
                </span>
              </p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {bullets(p).map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden />
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

      <section className="mt-20" aria-labelledby="compare-title">
        <h2 id="compare-title" className="text-2xl font-semibold tracking-tight">
          {pt.compareTitle}
        </h2>
        <div className="mt-6 overflow-x-auto rounded-lg border bg-surface">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {pt.compareFeature}
                </th>
                {plans.map((p) => (
                  <th
                    key={p.code}
                    scope="col"
                    className={cn(
                      'px-4 py-3 text-center font-semibold',
                      p.code === POPULAR_PLAN && 'bg-accent/60',
                    )}
                  >
                    {planName(p)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(([label, value]) => (
                <tr key={label}>
                  <th scope="row" className="px-4 py-3 text-left font-normal">
                    {label}
                  </th>
                  {plans.map((p) => {
                    const v = value(p);
                    return (
                      <td
                        key={p.code}
                        className={cn(
                          'num px-4 py-3 text-center',
                          p.code === POPULAR_PLAN && 'bg-accent/30',
                        )}
                      >
                        {typeof v === 'string' ? (
                          v
                        ) : v ? (
                          <Check
                            className="mx-auto size-4 text-positive"
                            aria-label={pt.included}
                          />
                        ) : (
                          <Minus
                            className="mx-auto size-4 text-muted-foreground/60"
                            aria-label={pt.notIncluded}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

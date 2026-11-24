'use client';
import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { PERMISSIONS } from '@hisabkhata/shared';
import { api } from '@/lib/api';
import { useAction, useApi } from '@/hooks/use-api';
import { useSession } from '@/hooks/use-session';
import { Money } from '@/components/money';
import { PageHeader, Panel, TableSkeleton } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/misc';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Select } from '@/components/ui/input';
import { RequirePermission } from '@/components/shell/guards';
import { cn, formatDate, titleCase } from '@/lib/utils';

const FEATURE_LABEL: Record<string, string> = {
  ADVANCED_REPORTS: 'Profit, product, customer and payment reports',
  ADVANCED_ANALYTICS: 'Advanced analytics',
  PRIORITY_SUPPORT: 'Priority support',
  INVOICE_EMAIL: 'Email invoices to customers',
};
const limit = (n: number, noun: string) => (n < 0 ? `Unlimited ${noun}` : `Up to ${n} ${noun}`);

function Usage({ used, max, label }: { used: number; max: number; label: string }) {
  const pct = max < 0 ? 0 : Math.min(100, Math.round((used / Math.max(1, max)) * 100));
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="num text-muted-foreground">
          {used} of {max < 0 ? 'unlimited' : max}
        </span>
      </div>
      {max >= 0 && (
        <div className="mt-1.5 h-1.5 rounded-full bg-muted">
          <div className={cn('h-full rounded-full', pct >= 90 ? 'bg-negative' : pct >= 70 ? 'bg-warning' : 'bg-emerald')} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

function Subscription() {
  const qc = useQueryClient();
  const tz = useSession().data?.activeTenant?.timezone;
  const status = useSearchParams().get('payment');
  const { data } = useApi<any>('/subscription');
  const [interval, setInterval] = React.useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [chosen, setChosen] = React.useState<any | null>(null);
  const [provider, setProvider] = React.useState('manual');
  const [result, setResult] = React.useState<any | null>(null);
  const change = useAction(() => api('/subscription/change', { method: 'POST', body: { planCode: chosen.code, interval, provider } }), {
    invalidate: [['/subscription']],
    onSuccess: (r: any) => {
      if (r.redirectUrl) window.location.href = r.redirectUrl;
      else {
        setResult(r);
        qc.invalidateQueries({ queryKey: ['session'] });
      }
    },
  });
  if (!data) return <TableSkeleton />;
  const { plan, subscription, usage } = data;

  return (
    <>
      <PageHeader title="Subscription" description="Your plan, what it includes and your billing history." />
      {status === 'processing' && <p className="mb-6 rounded-md border bg-accent px-4 py-3 text-sm">We are confirming your payment with the provider. Your plan updates as soon as it is verified.</p>}
      {status === 'failed' && <p className="mb-6 rounded-md border border-negative/30 bg-negative/5 px-4 py-3 text-sm text-negative">The payment did not go through. You were not charged.</p>}

      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        <Panel title="Current plan" className="lg:col-span-2" bodyClass="p-4">
          <div className="flex flex-wrap items-baseline gap-3">
            <p className="text-2xl font-semibold">{plan.name}</p>
            <Badge tone={subscription?.status === 'TRIALING' ? 'info' : 'positive'}>{titleCase(subscription?.status ?? 'ACTIVE')}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {subscription?.endsAt ? `${subscription.status === 'TRIALING' ? 'Trial ends' : 'Renews or ends'} on ${formatDate(subscription.endsAt, tz)}.` : 'No end date.'}
          </p>
          <ul className="mt-4 space-y-1.5 text-sm">
            {plan.features.map((f: string) => (
              <li key={f} className="flex items-center gap-2">
                <Check className="size-4 text-positive" /> {FEATURE_LABEL[f] ?? f}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Usage" bodyClass="space-y-4 p-4">
          <Usage used={usage.products} max={plan.maxProducts} label="Products" />
          <Usage used={usage.employees} max={plan.maxEmployees} label="Team members" />
        </Panel>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">Plans</h2>
        <div role="radiogroup" aria-label="Billing period" className="flex rounded-md border p-0.5 text-sm">
          {(['MONTHLY', 'YEARLY'] as const).map((i) => (
            <button key={i} role="radio" aria-checked={interval === i} onClick={() => setInterval(i)} className={cn('rounded px-3 py-1', interval === i && 'bg-primary text-primary-foreground')}>
              {i === 'MONTHLY' ? 'Monthly' : 'Yearly, 2 months free'}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-8 grid gap-4 md:grid-cols-3">
        {data.plans.map((p: any) => {
          const current = p.code === plan.code;
          const price = interval === 'YEARLY' ? p.priceYearly : p.priceMonthly;
          return (
            <div key={p.id} className={cn('flex flex-col rounded-lg border bg-surface p-5', current && 'border-primary ring-1 ring-primary')}>
              <p className="font-semibold">{p.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
              <p className="mt-4">
                <Money value={price} currency={p.currency} className="text-2xl font-semibold" />
                <span className="text-sm text-muted-foreground"> / {interval === 'YEARLY' ? 'year' : 'month'}</span>
              </p>
              <ul className="mt-4 flex-1 space-y-1.5 text-sm">
                <li>{limit(p.maxProducts, 'products')}</li>
                <li>{limit(p.maxEmployees, p.maxEmployees === 1 ? 'user' : 'users')}</li>
                {p.features.map((f: string) => (
                  <li key={f}>{FEATURE_LABEL[f] ?? f}</li>
                ))}
              </ul>
              <Button className="mt-5" variant={current ? 'outline' : 'default'} disabled={current && subscription?.status !== 'TRIALING'} onClick={() => setChosen(p)}>
                {current ? (subscription?.status === 'TRIALING' ? 'Subscribe' : 'Current plan') : Number(price) === 0 ? 'Switch to Free' : `Choose ${p.name}`}
              </Button>
            </div>
          );
        })}
      </div>

      <Panel title="Billing history">
        {data.payments.length ? (
          <table className="ledger">
            <thead>
              <tr>
                <th>Date</th>
                <th>Plan</th>
                <th>Reference</th>
                <th>Status</th>
                <th className="r">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((p: any) => (
                <tr key={p.id}>
                  <td className="text-muted-foreground">{formatDate(p.createdAt, tz)}</td>
                  <td>
                    {titleCase(p.planCode)}, {p.interval.toLowerCase()}
                  </td>
                  <td className="num text-xs">{p.providerRef}</td>
                  <td>
                    <Badge tone={p.status === 'SUCCEEDED' ? 'positive' : p.status === 'FAILED' ? 'negative' : 'warning'}>{p.status === 'PENDING' ? 'Awaiting payment' : titleCase(p.status)}</Badge>
                  </td>
                  <td className="r">
                    <Money value={p.amount} currency={p.currency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No payments yet.</p>
        )}
      </Panel>

      <Dialog open={!!chosen} onOpenChange={(o) => !o && (setChosen(null), setResult(null))}>
        {chosen && (
          <DialogContent title={result ? (result.status === 'ACTIVATED' ? 'Plan changed' : 'Complete your payment') : `Switch to ${chosen.name}`}>
            {result ? (
              <div className="space-y-4 text-sm">
                {result.status === 'ACTIVATED' ? <p>You are now on the {chosen.name} plan.</p> : <p className="rounded-md border bg-muted/50 p-3">{result.instructions}</p>}
                <div className="flex justify-end">
                  <Button onClick={() => (setChosen(null), setResult(null))}>Done</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-sm">
                {Number(interval === 'YEARLY' ? chosen.priceYearly : chosen.priceMonthly) > 0 ? (
                  <>
                    <p>
                      You will pay <Money value={interval === 'YEARLY' ? chosen.priceYearly : chosen.priceMonthly} currency={chosen.currency} className="font-semibold" /> for one {interval === 'YEARLY' ? 'year' : 'month'}. The plan starts once the payment is confirmed.
                    </p>
                    <Select value={provider} onChange={(e) => setProvider(e.target.value)} aria-label="Payment method">
                      {data.providers.map((p: any) => (
                        <option key={p.name} value={p.name}>
                          {p.label}
                        </option>
                      ))}
                    </Select>
                  </>
                ) : (
                  <p>The Free plan allows {limit(chosen.maxProducts, 'products').toLowerCase()} and {limit(chosen.maxEmployees, 'user').toLowerCase()}. If you have more, archive some first.</p>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setChosen(null)}>
                    Cancel
                  </Button>
                  <Button onClick={() => change.mutate(undefined)} loading={change.isPending}>
                    Continue
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

export default function SubscriptionPage() {
  return (
    <RequirePermission permission={PERMISSIONS.SUBSCRIPTION_MANAGE}>
      <React.Suspense>
        <Subscription />
      </React.Suspense>
    </RequirePermission>
  );
}

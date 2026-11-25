'use client';
import * as React from 'react';
import Link from 'next/link';
import { Download, FileDown, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { formatQty, PERMISSIONS } from '@hisabkhata/shared';
import { download, errorMessage } from '@/lib/api';
import { useApi } from '@/hooks/use-api';
import { useSession } from '@/hooks/use-session';
import { Money } from '@/components/money';
import { EmptyState, ErrorState, PageHeader, TableSkeleton } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { RequirePermission } from '@/components/shell/guards';
import { cn } from '@/lib/utils';
import { DateRangePicker } from '@/components/date-range-picker';
import { presetRange, rangeToQuery, type DateRange } from '@/lib/dhaka-dates';

const REPORTS = [
  { key: 'sales', label: 'Sales', advanced: false, range: true },
  { key: 'profit-loss', label: 'Profit and loss', advanced: true, range: true },
  { key: 'top-products', label: 'Top-selling products', advanced: true, range: true },
  { key: 'inventory', label: 'Inventory valuation', advanced: false, range: false },
  { key: 'low-stock', label: 'Low stock', advanced: false, range: false },
  { key: 'purchases', label: 'Purchases', advanced: true, range: true },
  { key: 'customers', label: 'Customers', advanced: true, range: true },
  { key: 'expenses', label: 'Expenses', advanced: false, range: true },
  { key: 'payments', label: 'Payments and dues', advanced: true, range: true },
];

function Cell({ type, value }: { type: string; value: any }) {
  if (type === 'money')
    return <Money value={value} signed={String(value).startsWith('-') ? 'negative' : undefined} />;
  if (type === 'qty') return <>{formatQty(String(value))}</>;
  if (type === 'percent') return <>{value}%</>;
  return <>{value}</>;
}

function Reports() {
  const plan = useSession().data?.plan;
  const advancedAllowed = plan?.features.includes('ADVANCED_REPORTS');
  const [key, setKey] = React.useState('sales');
  const [range, setRange] = React.useState<DateRange>(() => presetRange('last30'));
  const [period, setPeriod] = React.useState('daily');
  const def = REPORTS.find((r) => r.key === key)!;
  const locked = def.advanced && !advancedAllowed;
  const query = { ...rangeToQuery(range), period: key === 'sales' ? period : undefined };
  const { data, isLoading, error, refetch } = useApi<any>(
    locked ? null : `/reports/${key}`,
    def.range ? query : {},
  );
  const exp = (format: 'csv' | 'pdf') =>
    download(`/reports/${key}`, { ...(def.range ? query : {}), format }, `${key}.${format}`).catch(
      (e) => toast.error(errorMessage(e)),
    );

  return (
    <>
      <PageHeader
        title="Reports"
        description="Figures are calculated from your records each time you open a report."
      />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Reports" className="flex gap-1 overflow-x-auto lg:flex-col">
          {REPORTS.map((r) => (
            <button
              key={r.key}
              onClick={() => setKey(r.key)}
              aria-current={key === r.key ? 'page' : undefined}
              className={cn(
                'flex items-center justify-between whitespace-nowrap rounded-md px-3 py-2 text-left text-sm',
                key === r.key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
              )}
            >
              {r.label}
              {r.advanced && !advancedAllowed && <Lock className="size-3.5 opacity-60" />}
            </button>
          ))}
        </nav>
        <section className="min-w-0 rounded-lg border bg-surface">
          <div className="flex flex-col gap-3 border-b p-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-base font-semibold">{data?.title ?? def.label}</h2>
              {def.range && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <DateRangePicker className="h-8 w-52" value={range} onChange={setRange} />
                  {key === 'sales' && (
                    <Select
                      className="h-8 w-28"
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                      aria-label="Group by"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="annual">Annual</option>
                    </Select>
                  )}
                </div>
              )}
            </div>
            {!locked && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => exp('csv')}>
                  <Download /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => exp('pdf')}>
                  <FileDown /> PDF
                </Button>
              </div>
            )}
          </div>
          {locked ? (
            <EmptyState
              icon={Lock}
              title={`${def.label} is part of Basic and Premium`}
              description="Upgrade your plan to see profit, product, customer and payment reports."
              action={
                <Button asChild>
                  <Link href="/subscription">See plans</Link>
                </Button>
              }
            />
          ) : error ? (
            <ErrorState error={error} onRetry={() => refetch()} />
          ) : isLoading || !data ? (
            <TableSkeleton />
          ) : (
            <>
              {data.summary.length > 0 && (
                <dl className="grid grid-cols-2 divide-x divide-y border-b sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
                  {data.summary.map((s: any) => (
                    <div key={s.label} className="px-4 py-3">
                      <dt className="text-xs text-muted-foreground">{s.label}</dt>
                      <dd className={cn('mt-0.5 font-semibold', s.emphasis && 'text-lg')}>
                        <Cell type={s.type} value={s.value} />
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {data.rows.length ? (
                <div className="overflow-x-auto">
                  <table className="ledger">
                    <thead>
                      <tr>
                        {data.columns.map((c: any) => (
                          <th key={c.key} className={c.type !== 'text' ? 'r' : ''}>
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((r: any, i: number) => (
                        <tr
                          key={i}
                          className={cn(
                            key === 'profit-loss' &&
                              /^(Net revenue|Gross profit|Net profit|Total expenses)$/.test(
                                r.line,
                              ) &&
                              'bg-muted/40 font-semibold',
                          )}
                        >
                          {data.columns.map((c: any) => (
                            <td key={c.key} className={c.type !== 'text' ? 'r' : ''}>
                              <Cell type={c.type} value={r[c.key]} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No records in this period.
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}

export default function ReportsPage() {
  return (
    <RequirePermission permission={PERMISSIONS.REPORT_VIEW}>
      <Reports />
    </RequirePermission>
  );
}

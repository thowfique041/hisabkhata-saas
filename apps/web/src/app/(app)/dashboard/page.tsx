'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import * as React from 'react';
import { AlertTriangle, PackagePlus, ShoppingCart, Truck } from 'lucide-react';
import { formatQty, PERMISSIONS } from '@hisabkhata/shared';
import { useApi } from '@/hooks/use-api';
import { useCan, useSession } from '@/hooks/use-session';
import { Money } from '@/components/money';
import { ErrorState, PageHeader, Panel } from '@/components/page';
import { Skeleton } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { RevenueChart, SalesChart } from '@/components/charts';
import { SaleStatusBadge } from '@/components/status';
import { RequirePermission } from '@/components/shell/guards';
import { DemoBanner, LoadDemoButton, useDemoStatus } from '@/components/onboarding/demo-data';
import { ChartEmpty } from '@/components/charts';
import { useI18n } from '@/lib/i18n/client';
import { cn, formatDate } from '@/lib/utils';

function Cell({
  label,
  children,
  sub,
  className,
}: {
  label: string;
  children: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('px-4 py-4 sm:px-5', className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight">{children}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Welcome() {
  const can = useCan();
  const { t } = useI18n();
  const o = t.panel.onboarding;
  const owner = useSession().data?.activeTenant?.roleKey === 'OWNER';
  const demo = useDemoStatus().data;
  const steps = [
    {
      key: 'products',
      icon: PackagePlus,
      href: '/products?new=1',
      perm: PERMISSIONS.PRODUCT_MANAGE,
    },
    { key: 'purchase', icon: Truck, href: '/purchases/new', perm: PERMISSIONS.PURCHASE_MANAGE },
    { key: 'sale', icon: ShoppingCart, href: '/pos', perm: PERMISSIONS.SALE_CREATE },
  ].filter((s) => can(s.perm));
  return (
    <Panel title={o.checklistTitle} className="mb-6">
      <ol className="divide-y">
        {steps.map((s, i) => {
          const [title, text] = o.steps[s.key];
          return (
            <li key={s.key} className="flex items-center gap-4 px-4 py-4">
              <span className="num flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-medium">
                {i + 1}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium">{title}</p>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={s.href}>{o.start}</Link>
              </Button>
            </li>
          );
        })}
        {owner && demo && !demo.loaded && (
          <li className="flex flex-col gap-3 bg-accent/40 px-4 py-4 sm:flex-row sm:items-center sm:gap-4">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed text-sm">
              ?
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium">{o.demoStep}</p>
              <p className="text-sm text-muted-foreground">{o.demoStepText}</p>
            </div>
            <LoadDemoButton size="sm" />
          </li>
        )}
      </ol>
    </Panel>
  );
}

function Dashboard() {
  const { data, isLoading, error, refetch } = useApi<any>('/dashboard');
  const session = useSession().data;
  const tz = session?.activeTenant?.timezone;
  const welcome = useSearchParams().get('welcome');
  const { t } = useI18n();
  const can = useCan();
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-28 w-full" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }
  const k = data.kpis;
  const isNew = k.totalProducts === 0 && data.recentSales.length === 0;
  const hour = Number(
    new Intl.DateTimeFormat('en', { hour: 'numeric', hourCycle: 'h23', timeZone: tz }).format(
      new Date(),
    ),
  );
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <PageHeader
        title={`${greeting}, ${session?.user.name.split(' ')[0]}`}
        description={`${session?.activeTenant?.name}, ${formatDate(new Date(), tz)}`}
        actions={
          <Button asChild>
            <Link href="/pos">
              <ShoppingCart /> New sale
            </Link>
          </Button>
        }
      />
      <DemoBanner />
      {(isNew || welcome) && <Welcome />}

      {/* One ruled strip, read left to right like a ledger line. */}
      <section
        aria-label="Key figures"
        className="mb-6 overflow-hidden rounded-lg border bg-surface"
      >
        <div className="grid grid-cols-2 divide-x divide-y md:grid-cols-5 md:divide-y-0">
          <Cell
            label="Sales today"
            sub={`${k.ordersToday} ${k.ordersToday === 1 ? 'sale' : 'sales'}`}
          >
            <Money value={k.salesToday} />
          </Cell>
          <Cell label="Sales this month" sub={`${k.ordersThisMonth} sales`}>
            <Money value={k.salesThisMonth} />
          </Cell>
          <Cell label="Net profit this month" sub="Revenue less cost of goods and expenses">
            <Money value={k.netProfitThisMonth} signed="auto" />
          </Cell>
          <Cell
            label="Expenses this month"
            sub={
              <>
                All time <Money value={k.totalExpenses} />
              </>
            }
          >
            <Money value={k.expensesThisMonth} />
          </Cell>
          <Cell
            label="Customers owe you"
            sub={`${k.pendingInvoices} unpaid invoices`}
            className="col-span-2 md:col-span-1"
          >
            <Money
              value={k.pendingPayments}
              signed={Number(k.pendingPayments) > 0 ? 'negative' : undefined}
            />
          </Cell>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 border-t bg-muted/40 px-5 py-2.5 text-sm">
          <span>
            <span className="text-muted-foreground">Products </span>
            <span className="num font-medium">{k.totalProducts}</span>
          </span>
          <Link href="/products?stock=low" className="hover:underline">
            <span className="text-muted-foreground">Low stock </span>
            <span className={cn('num font-medium', k.lowStock > 0 && 'text-warning')}>
              {k.lowStock}
            </span>
          </Link>
          <Link href="/products?stock=out" className="hover:underline">
            <span className="text-muted-foreground">Out of stock </span>
            <span className={cn('num font-medium', k.outOfStock > 0 && 'text-negative')}>
              {k.outOfStock}
            </span>
          </Link>
          <span>
            <span className="text-muted-foreground">Customers </span>
            <span className="num font-medium">{k.totalCustomers}</span>
          </span>
          <span>
            <span className="text-muted-foreground">Revenue to date </span>
            <Money value={k.totalRevenue} className="font-medium" />
          </span>
        </div>
      </section>

      {k.outOfStock > 0 && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-negative/30 bg-negative/5 px-4 py-3 text-sm">
          <AlertTriangle className="size-4 shrink-0 text-negative" />
          <span className="flex-1">
            {k.outOfStock} {k.outOfStock === 1 ? 'product is' : 'products are'} out of stock and
            cannot be sold.
          </span>
          <Link href="/products?stock=out" className="font-medium underline underline-offset-2">
            Review
          </Link>
        </div>
      )}

      <div className="mb-6 grid gap-6 lg:grid-cols-5">
        <Panel title="Sales, last 30 days" className="lg:col-span-3" bodyClass="p-4">
          <SalesChart
            data={data.salesChart}
            empty={
              <ChartEmpty
                message={t.panel.onboarding.chartEmptySales}
                action={
                  can(PERMISSIONS.SALE_CREATE)
                    ? { label: t.panel.onboarding.firstSale, href: '/pos' }
                    : undefined
                }
              />
            }
          />
        </Panel>
        <Panel title="Top products this month" className="lg:col-span-2">
          {data.topProducts.length ? (
            <table className="ledger">
              <tbody>
                {data.topProducts.map((p: any) => (
                  <tr key={p.productId}>
                    <td className="max-w-0 truncate">{p.name}</td>
                    <td className="r w-16 text-muted-foreground">{formatQty(p.qty)}</td>
                    <td className="r w-28">
                      <Money value={p.revenue} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Best sellers appear here once you make sales this month.
            </p>
          )}
        </Panel>
      </div>

      <Panel
        title="Revenue, gross profit and expenses, last 12 months"
        className="mb-6"
        bodyClass="p-4"
      >
        <RevenueChart
          data={data.revenueChart}
          empty={<ChartEmpty kind="bar" message={t.panel.onboarding.chartEmptyRevenue} />}
        />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Recent sales"
          actions={
            <Link href="/sales" className="text-sm text-muted-foreground hover:text-foreground">
              All sales
            </Link>
          }
        >
          {data.recentSales.length ? (
            <table className="ledger">
              <tbody>
                {data.recentSales.map((s: any) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/sales?open=${s.id}`} className="font-medium hover:underline">
                        {s.invoiceNo}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {s.customer?.name ?? 'Walk-in'}
                      </p>
                    </td>
                    <td className="text-xs text-muted-foreground">
                      {formatDate(s.createdAt, tz, true)}
                    </td>
                    <td>
                      <SaleStatusBadge status={s.status} paymentStatus={s.paymentStatus} />
                    </td>
                    <td className="r">
                      <Money value={s.total} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              No sales yet. Sales from the point of sale show up here.
            </p>
          )}
        </Panel>
        <Panel
          title="Invoices with money due"
          actions={
            <Link href="/invoices" className="text-sm text-muted-foreground hover:text-foreground">
              All invoices
            </Link>
          }
        >
          {data.recentInvoices.length ? (
            <table className="ledger">
              <tbody>
                {data.recentInvoices.map((i: any) => (
                  <tr key={i.saleId}>
                    <td>
                      <Link
                        href={`/sales?open=${i.saleId}`}
                        className="font-medium hover:underline"
                      >
                        {i.invoiceNo}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {i.sale.customer?.name ?? 'Walk-in'}
                      </p>
                    </td>
                    <td className="text-xs text-muted-foreground">{formatDate(i.issuedAt, tz)}</td>
                    <td className="r">
                      <span className="text-xs text-muted-foreground">due </span>
                      <Money value={i.sale.dueAmount} signed="negative" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Every invoice is paid in full.
            </p>
          )}
        </Panel>
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <RequirePermission permission={PERMISSIONS.DASHBOARD_VIEW}>
      <React.Suspense>
        <Dashboard />
      </React.Suspense>
    </RequirePermission>
  );
}

'use client';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApi } from '@/hooks/use-api';
import { Money } from '@/components/money';
import { ErrorState, PageHeader, Panel, TableSkeleton } from '@/components/page';
import { titleCase } from '@/lib/utils';

export default function AdminOverview() {
  const { data, error, refetch } = useApi<any>('/admin/overview');
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data) return <TableSkeleton />;
  const cells = [
    ['Businesses', data.tenants.total, `${data.tenants.newLast30Days} new in 30 days`],
    ['Active', data.tenants.active, 'Can sign in and trade'],
    ['Suspended', data.tenants.suspended, 'Blocked by an administrator'],
    ['Users', data.users, 'Across all businesses'],
  ];
  return (
    <>
      <PageHeader title="Platform overview" description="Every business on HisabKhata. Business financials stay private to each tenant; this view shows platform usage and subscription revenue only." />
      <section className="mb-6 grid grid-cols-2 divide-x divide-y overflow-hidden rounded-lg border bg-surface md:grid-cols-4 md:divide-y-0">
        {cells.map(([l, v, s]) => (
          <div key={l as string} className="px-5 py-4">
            <p className="text-xs text-muted-foreground">{l}</p>
            <p className="num mt-1 text-xl font-semibold">{v}</p>
            <p className="text-xs text-muted-foreground">{s}</p>
          </div>
        ))}
      </section>
      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Subscription revenue" bodyClass="space-y-3 p-4">
          <p className="text-sm text-muted-foreground">All time</p>
          <Money value={data.revenue.total} currency="BDT" className="text-2xl font-semibold" />
          <p className="text-sm">
            Last 30 days <Money value={data.revenue.last30Days} currency="BDT" className="font-medium" />
          </p>
          <Link href="/super-admin/subscriptions" className="block text-sm underline underline-offset-2">
            {data.revenue.pendingPayments} payments waiting for confirmation
          </Link>
        </Panel>
        <Panel title="Revenue and sign-ups by month" className="lg:col-span-2" bodyClass="p-4">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.monthly.map((m: any) => ({ ...m, revenue: Number(m.revenue) }))}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="r" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={50} />
              <YAxis yAxisId="s" orientation="right" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={30} />
              <Tooltip contentStyle={{ fontSize: 12, background: 'hsl(var(--surface))', border: '1px solid hsl(var(--border))' }} />
              <Bar yAxisId="r" dataKey="revenue" name="Revenue (BDT)" fill="hsl(var(--primary))" />
              <Bar yAxisId="s" dataKey="signups" name="Sign-ups" fill="#059669" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>
      <Panel title="Live subscriptions by plan">
        <table className="ledger">
          <thead>
            <tr>
              <th>Plan</th>
              <th>Status</th>
              <th className="r">Businesses</th>
            </tr>
          </thead>
          <tbody>
            {data.subscriptions.map((s: any) => (
              <tr key={s.code + s.status}>
                <td className="font-medium">{s.name}</td>
                <td>{titleCase(s.status)}</td>
                <td className="r">{s.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

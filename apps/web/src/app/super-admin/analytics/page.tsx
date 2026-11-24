'use client';
import { useApi } from '@/hooks/use-api';
import { PageHeader, Panel, TableSkeleton } from '@/components/page';
import { titleCase } from '@/lib/utils';

export default function AnalyticsPage() {
  const { data } = useApi<any>('/admin/analytics');
  if (!data) return <TableSkeleton />;
  const total = data.tenantsByType.reduce((a: number, t: any) => a + t.count, 0) || 1;
  return (
    <>
      <PageHeader title="Analytics" description="How the platform is used. Counts only; no tenant amounts are shown." />
      <section className="mb-6 grid grid-cols-2 divide-x overflow-hidden rounded-lg border bg-surface">
        <div className="px-5 py-4">
          <p className="text-xs text-muted-foreground">Businesses that sold something in the last 30 days</p>
          <p className="num mt-1 text-xl font-semibold">{data.activeTenantsLast30Days}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-muted-foreground">Sales recorded in the last 30 days</p>
          <p className="num mt-1 text-xl font-semibold">{data.ordersLast30Days}</p>
        </div>
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Businesses by type" bodyClass="space-y-3 p-4">
          {data.tenantsByType.map((t: any) => (
            <div key={t.type}>
              <div className="flex justify-between text-sm">
                <span>{titleCase(t.type)}</span>
                <span className="num text-muted-foreground">{t.count}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(t.count / total) * 100}%` }} />
              </div>
            </div>
          ))}
        </Panel>
        <Panel title="Most active businesses (sales, 30 days)">
          <table className="ledger">
            <tbody>
              {data.mostActiveTenants.map((t: any) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td className="r">{t.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  );
}

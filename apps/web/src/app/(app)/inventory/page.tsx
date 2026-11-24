'use client';
import * as React from 'react';
import Link from 'next/link';
import { Boxes, History } from 'lucide-react';
import { formatQty, PERMISSIONS, STOCK_MOVEMENT_TYPES } from '@hisabkhata/shared';
import { useApi, useList } from '@/hooks/use-api';
import { useCan } from '@/hooks/use-session';
import { Money } from '@/components/money';
import { EmptyState, ErrorState, PageHeader, Pagination, Panel, TableSkeleton } from '@/components/page';
import { Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { MovementsTable } from '@/components/movements-table';
import { StockBadge } from '@/components/status';
import { RequirePermission } from '@/components/shell/guards';
import { titleCase } from '@/lib/utils';

function Valuation() {
  const can = useCan();
  const { data, error, isLoading, refetch } = useApi<any>(can(PERMISSIONS.REPORT_VIEW) ? '/reports/inventory' : null);
  const low = useApi<any[]>('/inventory/low-stock');
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Panel title="Needs restocking" className="lg:col-span-2" actions={<Link className="text-sm text-muted-foreground hover:text-foreground" href="/purchases/new">Record a purchase</Link>}>
        {low.isLoading ? (
          <TableSkeleton cols={3} />
        ) : !low.data?.length ? (
          <EmptyState icon={Boxes} title="Stock levels look healthy" description="Products at or below their alert level will be listed here." />
        ) : (
          <table className="ledger">
            <thead>
              <tr>
                <th>Product</th>
                <th className="r">In stock</th>
                <th className="r">Alert at</th>
              </tr>
            </thead>
            <tbody>
              {low.data.map((p) => (
                <tr key={p.id}>
                  <td>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.sku}</p>
                  </td>
                  <td className="r">
                    <span className="mr-2">
                      <StockBadge stock={p.stock} min={p.minStock} />
                    </span>
                    {formatQty(p.stock)} {p.unit}
                  </td>
                  <td className="r text-muted-foreground">{formatQty(p.minStock)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      {can(PERMISSIONS.REPORT_VIEW) && (
        <Panel title="Stock value">
          {error ? (
            <ErrorState error={error} onRetry={() => refetch()} />
          ) : isLoading || !data ? (
            <TableSkeleton rows={4} cols={2} />
          ) : (
            <dl className="divide-y text-sm">
              {data.summary.map((s: any) => (
                <div key={s.label} className="flex justify-between px-4 py-3">
                  <dt className="text-muted-foreground">{s.label}</dt>
                  <dd className="font-medium">{s.type === 'money' ? <Money value={s.value} /> : <span className="num">{s.value}</span>}</dd>
                </div>
              ))}
            </dl>
          )}
        </Panel>
      )}
    </div>
  );
}

function History_() {
  const list = useList<any>('/inventory/movements', { pageSize: 30 });
  return (
    <div className="rounded-lg border bg-surface">
      <div className="flex items-center gap-2 border-b p-3">
        <Select className="sm:w-56" value={String(list.params.type ?? '')} onChange={(e) => list.set({ type: e.target.value })} aria-label="Movement type">
          <option value="">All movements</option>
          {STOCK_MOVEMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {titleCase(t)}
            </option>
          ))}
        </Select>
      </div>
      {list.isLoading ? <TableSkeleton /> : list.data?.items.length ? <MovementsTable items={list.data.items} /> : <EmptyState icon={History} title="No stock movements yet" description="Purchases, sales, returns and adjustments are recorded here automatically." />}
      {list.data && <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} onPage={list.setPage} />}
    </div>
  );
}

export default function InventoryPage() {
  const can = useCan();
  return (
    <RequirePermission permission={PERMISSIONS.STOCK_VIEW}>
      <PageHeader
        title="Inventory"
        description="What you have, what it is worth, and every change to it."
        actions={can(PERMISSIONS.STOCK_ADJUST) && (
          <Button asChild variant="outline">
            <Link href="/stock-adjustments">Adjust stock</Link>
          </Button>
        )}
      />
      <Tabs defaultValue="overview">
        <TabsList className="mb-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">Stock history</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <Valuation />
        </TabsContent>
        <TabsContent value="history">
          <History_ />
        </TabsContent>
      </Tabs>
    </RequirePermission>
  );
}

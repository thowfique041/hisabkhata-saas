'use client';
import * as React from 'react';
import Link from 'next/link';
import { Pencil, Plus, Truck, Wallet } from 'lucide-react';
import { PERMISSIONS } from '@hisabkhata/shared';
import { api } from '@/lib/api';
import { useAction, useApi, useList } from '@/hooks/use-api';
import { useCan, useSession } from '@/hooks/use-session';
import { Money } from '@/components/money';
import { EmptyState, ErrorState, PageHeader, Pagination, SearchInput, Stat, TableSkeleton } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/misc';
import { PartyForm } from '@/components/forms/party-form';
import { PaymentForm } from '@/components/payment-form';
import { useConfirm } from '@/components/confirm';
import { RequirePermission } from '@/components/shell/guards';
import { cn, formatDate } from '@/lib/utils';

const INV = [['/suppliers'], ['/purchases'], ['/dashboard']];

function SupplierDetail({ id, onEdit }: { id: string; onEdit: (s: any) => void }) {
  const { data: s } = useApi<any>(`/suppliers/${id}`);
  const can = useCan();
  const tz = useSession().data?.activeTenant?.timezone;
  const confirm = useConfirm();
  const [paying, setPaying] = React.useState(false);
  const pay = useAction((v: any) => api(`/suppliers/${id}/payments`, { method: 'POST', body: v }), { success: 'Payment recorded', invalidate: INV, onSuccess: () => setPaying(false) });
  const archive = useAction(() => api(`/suppliers/${id}`, { method: 'DELETE' }), { success: 'Supplier archived', invalidate: INV });
  if (!s) return <TableSkeleton rows={5} cols={2} />;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 divide-x rounded-md border text-center">
        <div className="p-3">
          <p className="text-xs text-muted-foreground">Purchased</p>
          <Money value={s.stats.totalPurchased} className="font-semibold" />
        </div>
        <div className="p-3">
          <p className="text-xs text-muted-foreground">Paid</p>
          <Money value={s.stats.totalPaid} className="font-semibold" />
        </div>
        <div className="p-3">
          <p className="text-xs text-muted-foreground">You owe</p>
          <Money value={s.stats.payable} className={cn('font-semibold', Number(s.stats.payable) > 0 && 'text-negative')} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {Number(s.stats.payable) > 0 && can(PERMISSIONS.PURCHASE_MANAGE) && (
          <Button size="sm" onClick={() => setPaying((v) => !v)}>
            <Wallet /> Pay supplier
          </Button>
        )}
        {can(PERMISSIONS.SUPPLIER_MANAGE) && (
          <>
            <Button size="sm" variant="outline" onClick={() => onEdit(s)}>
              <Pencil /> Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                if (await confirm({ title: `Archive ${s.name}?`, description: 'Archived suppliers are hidden when recording purchases. History is kept.', confirmLabel: 'Archive', destructive: true })) archive.mutate(undefined);
              }}
            >
              Archive
            </Button>
          </>
        )}
      </div>
      {paying && <PaymentForm max={s.stats.payable} submitLabel="Record payment" defaultMethod="BANK" onSubmit={(v) => pay.mutate(v)} pending={pay.isPending} />}
      <div>
        <Stat label="Company">{s.company ?? 'None'}</Stat>
        <Stat label="Phone">{s.phone ?? 'None'}</Stat>
        <Stat label="Email">{s.email ?? 'None'}</Stat>
        <Stat label="Address">{s.address ?? 'None'}</Stat>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Recent purchases</h3>
        {s.purchases.length ? (
          <table className="ledger rounded-md border">
            <tbody>
              {s.purchases.map((p: any) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/purchases?open=${p.id}`} className="font-medium hover:underline">
                      {p.purchaseNo}
                    </Link>
                    <p className="text-xs text-muted-foreground">{formatDate(p.purchaseDate, tz)}</p>
                  </td>
                  <td>{p.status === 'CANCELLED' ? <Badge>Cancelled</Badge> : Number(p.dueAmount) > 0 ? <Badge tone="warning">Due</Badge> : <Badge tone="positive">Paid</Badge>}</td>
                  <td className="r">
                    <Money value={p.total} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">No purchases from this supplier yet.</p>
        )}
      </div>
    </div>
  );
}

function Suppliers() {
  const can = useCan();
  const list = useList<any>('/suppliers', { pageSize: 25 });
  const [panel, setPanel] = React.useState<{ mode: 'new' | 'view' | 'edit'; s?: any } | null>(null);
  const save = useAction((v: any) => (panel?.mode === 'edit' ? api(`/suppliers/${panel.s.id}`, { method: 'PUT', body: v }) : api('/suppliers', { method: 'POST', body: v })), {
    success: panel?.mode === 'edit' ? 'Supplier updated' : 'Supplier added',
    invalidate: INV,
    onSuccess: (s) => setPanel({ mode: 'view', s }),
  });
  const items = list.data?.items ?? [];
  return (
    <>
      <PageHeader
        title="Suppliers"
        description="Who you buy from and how much you owe them."
        actions={can(PERMISSIONS.SUPPLIER_MANAGE) && (
          <Button onClick={() => setPanel({ mode: 'new' })}>
            <Plus /> Add supplier
          </Button>
        )}
      />
      <div className="rounded-lg border bg-surface">
        <div className="border-b p-3">
          <SearchInput value={String(list.params.search ?? '')} onChange={(v) => list.set({ search: v })} placeholder="Name, company or phone" />
        </div>
        {list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : list.isLoading ? (
          <TableSkeleton />
        ) : !items.length ? (
          <EmptyState icon={Truck} title={list.params.search ? 'No suppliers match' : 'No suppliers yet'} description="Add the distributors and wholesalers you buy stock from." />
        ) : (
          <div className="overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th className="hidden md:table-cell">Phone</th>
                  <th className="r hidden sm:table-cell">Purchases</th>
                  <th className="r">Purchased</th>
                  <th className="r">You owe</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id} data-clickable="true" onClick={() => setPanel({ mode: 'view', s })}>
                    <td>
                      <p className="font-medium">{s.company || s.name}</p>
                      {s.company && <p className="text-xs text-muted-foreground">{s.name}</p>}
                    </td>
                    <td className="num hidden text-muted-foreground md:table-cell">{s.phone}</td>
                    <td className="r hidden sm:table-cell">{s.purchaseCount}</td>
                    <td className="r">
                      <Money value={s.totalPurchased} />
                    </td>
                    <td className="r">{Number(s.payable) > 0 ? <Money value={s.payable} signed="negative" /> : <span className="text-muted-foreground">-</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list.data && <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} onPage={list.setPage} />}
      </div>
      <Sheet open={!!panel} onOpenChange={(o) => !o && setPanel(null)} title={panel?.mode === 'new' ? 'Add supplier' : panel?.mode === 'edit' ? 'Edit supplier' : (panel?.s?.company || panel?.s?.name || '')}>
        {panel?.mode === 'view' && <SupplierDetail id={panel.s.id} onEdit={(s) => setPanel({ mode: 'edit', s })} />}
        {(panel?.mode === 'new' || panel?.mode === 'edit') && <PartyForm kind="supplier" initial={panel.mode === 'edit' ? panel.s : undefined} onSubmit={(v) => save.mutate(v)} pending={save.isPending} />}
      </Sheet>
    </>
  );
}

export default function SuppliersPage() {
  return (
    <RequirePermission permission={PERMISSIONS.SUPPLIER_VIEW}>
      <Suppliers />
    </RequirePermission>
  );
}

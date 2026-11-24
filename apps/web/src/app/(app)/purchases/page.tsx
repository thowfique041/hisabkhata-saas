'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Ban, ClipboardList, Plus } from 'lucide-react';
import { formatQty, PAYMENT_METHOD_LABELS, PERMISSIONS, type PaymentMethod } from '@hisabkhata/shared';
import { api } from '@/lib/api';
import { useAction, useApi, useList } from '@/hooks/use-api';
import { useCan, useSession } from '@/hooks/use-session';
import { Money } from '@/components/money';
import { EmptyState, ErrorState, PageHeader, Pagination, SearchInput, Stat, TableSkeleton } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Sheet } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/misc';
import { PaymentBadge } from '@/components/status';
import { useConfirm } from '@/components/confirm';
import { RequirePermission } from '@/components/shell/guards';
import { formatDate, titleCase } from '@/lib/utils';

function PurchaseDetail({ id }: { id: string }) {
  const { data: p } = useApi<any>(`/purchases/${id}`);
  const can = useCan();
  const tz = useSession().data?.activeTenant?.timezone;
  const confirm = useConfirm();
  const cancel = useAction((reason?: string) => api(`/purchases/${id}/cancel`, { method: 'POST', body: { reason } }), {
    success: 'Purchase cancelled and stock reversed',
    invalidate: [['/purchases'], ['/products'], ['/suppliers'], ['/dashboard']],
  });
  if (!p) return <TableSkeleton rows={5} cols={2} />;
  return (
    <div className="space-y-6">
      {p.status === 'RECEIVED' && can(PERMISSIONS.PURCHASE_CANCEL) && (
        <Button
          variant="outline"
          size="sm"
          className="text-negative"
          onClick={async () => {
            const ok = await confirm({ title: `Cancel ${p.purchaseNo}?`, description: 'The received quantities are removed from stock. This fails if those units were already sold.', confirmLabel: 'Cancel purchase', destructive: true, withReason: true });
            if (ok) cancel.mutate(ok.reason);
          }}
        >
          <Ban /> Cancel purchase
        </Button>
      )}
      <div>
        <Stat label="Supplier">{p.supplier.company || p.supplier.name}</Stat>
        <Stat label="Date">{formatDate(p.purchaseDate, tz)}</Stat>
        <Stat label="Supplier invoice">{p.reference ?? 'None'}</Stat>
        <Stat label="Status">{p.status === 'CANCELLED' ? <Badge>Cancelled</Badge> : <PaymentBadge status={p.paymentStatus} />}</Stat>
        {p.cancelReason && <Stat label="Cancel reason">{p.cancelReason}</Stat>}
      </div>
      <table className="ledger rounded-md border">
        <thead>
          <tr>
            <th>Item</th>
            <th className="r">Qty</th>
            <th className="r">Unit cost</th>
            <th className="r">Amount</th>
          </tr>
        </thead>
        <tbody>
          {p.items.map((i: any) => (
            <tr key={i.id}>
              <td>{i.productName}</td>
              <td className="r">
                {formatQty(i.quantity)} {i.product.unit}
              </td>
              <td className="r">
                <Money value={i.unitCost} />
              </td>
              <td className="r">
                <Money value={i.lineTotal} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ml-auto max-w-xs">
        <Stat label="Subtotal">
          <Money value={p.subtotal} />
        </Stat>
        {Number(p.discount) > 0 && (
          <Stat label="Discount">
            -<Money value={p.discount} />
          </Stat>
        )}
        {Number(p.shippingCost) > 0 && (
          <Stat label="Transport">
            <Money value={p.shippingCost} />
          </Stat>
        )}
        <Stat label="Total">
          <Money value={p.total} className="font-semibold" />
        </Stat>
        <Stat label="Paid">
          <Money value={p.paidAmount} />
        </Stat>
        <Stat label="You owe">
          <Money value={p.dueAmount} signed={Number(p.dueAmount) > 0 ? 'negative' : undefined} />
        </Stat>
      </div>
      {p.payments.length > 0 && (
        <table className="ledger rounded-md border">
          <tbody>
            {p.payments.map((x: any) => (
              <tr key={x.id}>
                <td className="text-xs text-muted-foreground">{formatDate(x.createdAt, tz)}</td>
                <td>
                  {PAYMENT_METHOD_LABELS[x.method as PaymentMethod]} <span className="text-xs text-muted-foreground">{titleCase(x.kind)}</span>
                </td>
                <td className="r">
                  <Money value={x.amount} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Purchases() {
  const params = useSearchParams();
  const router = useRouter();
  const can = useCan();
  const tz = useSession().data?.activeTenant?.timezone;
  const list = useList<any>('/purchases', { pageSize: 25 });
  const [open, setOpen] = React.useState<any | null>(params.get('open') ? { id: params.get('open') } : null);
  const items = list.data?.items ?? [];
  return (
    <>
      <PageHeader
        title="Purchases"
        description="Stock you bought. Each purchase adds to inventory and tracks what you owe the supplier."
        actions={can(PERMISSIONS.PURCHASE_MANAGE) && (
          <Button asChild>
            <Link href="/purchases/new">
              <Plus /> Record purchase
            </Link>
          </Button>
        )}
      />
      <div className="rounded-lg border bg-surface">
        <div className="flex flex-col gap-2 border-b p-3 sm:flex-row">
          <SearchInput value={String(list.params.search ?? '')} onChange={(v) => list.set({ search: v })} placeholder="Purchase no., reference or supplier" />
          <Select className="sm:w-40" value={String(list.params.status ?? '')} onChange={(e) => list.set({ status: e.target.value })} aria-label="Status">
            <option value="">Any status</option>
            <option value="RECEIVED">Received</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </div>
        {list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : list.isLoading ? (
          <TableSkeleton />
        ) : !items.length ? (
          <EmptyState icon={ClipboardList} title="No purchases yet" description="Record stock you receive from suppliers. Stock levels update immediately." action={can(PERMISSIONS.PURCHASE_MANAGE) && <Button asChild><Link href="/purchases/new">Record purchase</Link></Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th>Purchase</th>
                  <th>Supplier</th>
                  <th className="hidden md:table-cell">Date</th>
                  <th>Status</th>
                  <th className="r">Total</th>
                  <th className="r hidden sm:table-cell">You owe</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} data-clickable="true" onClick={() => setOpen(p)}>
                    <td>
                      <p className="font-medium">{p.purchaseNo}</p>
                      <p className="text-xs text-muted-foreground">{p._count.items} items</p>
                    </td>
                    <td>{p.supplier.name}</td>
                    <td className="hidden text-muted-foreground md:table-cell">{formatDate(p.purchaseDate, tz)}</td>
                    <td>{p.status === 'CANCELLED' ? <Badge>Cancelled</Badge> : <PaymentBadge status={p.paymentStatus} />}</td>
                    <td className="r">
                      <Money value={p.total} />
                    </td>
                    <td className="r hidden sm:table-cell">{Number(p.dueAmount) > 0 ? <Money value={p.dueAmount} signed="negative" /> : <span className="text-muted-foreground">-</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list.data && <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} onPage={list.setPage} />}
      </div>
      <Sheet
        open={!!open}
        onOpenChange={(o) => {
          if (!o) {
            setOpen(null);
            if (params.get('open')) router.replace('/purchases');
          }
        }}
        title={open?.purchaseNo ?? 'Purchase'}
      >
        {open && <PurchaseDetail id={open.id} />}
      </Sheet>
    </>
  );
}

export default function PurchasesPage() {
  return (
    <RequirePermission permission={PERMISSIONS.PURCHASE_VIEW}>
      <React.Suspense>
        <Purchases />
      </React.Suspense>
    </RequirePermission>
  );
}

'use client';
import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ShoppingCart } from 'lucide-react';
import { PERMISSIONS } from '@hisabkhata/shared';
import { useList } from '@/hooks/use-api';
import { useCan, useSession } from '@/hooks/use-session';
import { Money } from '@/components/money';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  SearchInput,
  TableSkeleton,
} from '@/components/page';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Sheet } from '@/components/ui/dialog';
import { SaleStatusBadge } from '@/components/status';
import { RequirePermission } from '@/components/shell/guards';
import { formatDate } from '@/lib/utils';
import { SaleDetail } from './sale-detail';
import { useUrlIntent } from '@/hooks/use-url-intent';
import { DateRangePicker } from '@/components/date-range-picker';
import { rangeToQuery, type DateRange } from '@/lib/dhaka-dates';

function Sales() {
  const params = useSearchParams();
  const can = useCan();
  const tz = useSession().data?.activeTenant?.timezone;
  const list = useList<any>('/sales', {
    pageSize: 25,
    paymentStatus: params.get('paymentStatus') ?? '',
  });
  const [open, setOpen] = React.useState<any | null>(null);
  useUrlIntent('open', (id) => setOpen({ id }));
  const [range, setRange] = React.useState<DateRange>({ preset: 'all' });
  const items = list.data?.items ?? [];
  const filtered = !!(
    list.params.search ||
    list.params.status ||
    list.params.paymentStatus ||
    list.params.from ||
    list.params.to
  );

  return (
    <>
      <PageHeader
        title="Sales"
        description="Every sale, its payments and returns."
        actions={
          can(PERMISSIONS.SALE_CREATE) && (
            <Button asChild>
              <Link href="/pos">
                <ShoppingCart /> New sale
              </Link>
            </Button>
          )
        }
      />
      <div className="rounded-lg border bg-surface">
        <div className="flex flex-col gap-2 border-b p-3 lg:flex-row lg:items-center">
          <SearchInput
            value={String(list.params.search ?? '')}
            onChange={(v) => list.set({ search: v })}
            placeholder="Invoice no., customer or phone"
          />
          <Select
            className="lg:w-40"
            value={String(list.params.paymentStatus ?? '')}
            onChange={(e) => list.set({ paymentStatus: e.target.value })}
            aria-label="Payment"
          >
            <option value="">Any payment</option>
            <option value="PAID">Paid</option>
            <option value="PARTIAL">Partly paid</option>
            <option value="DUE">Unpaid</option>
          </Select>
          <Select
            className="lg:w-44"
            value={String(list.params.status ?? '')}
            onChange={(e) => list.set({ status: e.target.value })}
            aria-label="Status"
          >
            <option value="">Any status</option>
            <option value="COMPLETED">Completed</option>
            <option value="PARTIALLY_REFUNDED">Partly returned</option>
            <option value="REFUNDED">Returned</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
          <DateRangePicker
            allowAll
            className="lg:w-52"
            value={range}
            onChange={(r) => {
              setRange(r);
              list.set(rangeToQuery(r));
            }}
          />
        </div>
        {list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : list.isLoading ? (
          <TableSkeleton />
        ) : !items.length ? (
          <EmptyState
            icon={ShoppingCart}
            title={filtered ? 'No sales match these filters' : 'No sales yet'}
            description={
              filtered
                ? 'Change the filters or date range.'
                : 'Sales you make at the point of sale will be listed here.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th className="hidden md:table-cell">Date</th>
                  <th>Status</th>
                  <th className="r">Total</th>
                  <th className="r hidden sm:table-cell">Due</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id} data-clickable="true" onClick={() => setOpen(s)}>
                    <td className="font-medium">{s.invoiceNo}</td>
                    <td>
                      {s.customer?.name ?? <span className="text-muted-foreground">Walk-in</span>}
                      <p className="text-xs text-muted-foreground">
                        {s._count.items} {s._count.items === 1 ? 'item' : 'items'}
                      </p>
                    </td>
                    <td className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                      {formatDate(s.createdAt, tz, true)}
                    </td>
                    <td>
                      <SaleStatusBadge status={s.status} paymentStatus={s.paymentStatus} />
                    </td>
                    <td className="r">
                      <Money value={s.total} />
                    </td>
                    <td className="r hidden sm:table-cell">
                      {Number(s.dueAmount) > 0 ? (
                        <Money value={s.dueAmount} signed="negative" />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list.data && (
          <Pagination
            page={list.data.page}
            pageCount={list.data.pageCount}
            total={list.data.total}
            onPage={list.setPage}
          />
        )}
      </div>
      <Sheet
        open={!!open}
        onOpenChange={(o) => {
          if (!o) setOpen(null);
        }}
        title={open?.invoiceNo ?? 'Sale'}
      >
        {open && <SaleDetail id={open.id} />}
      </Sheet>
    </>
  );
}

export default function SalesPage() {
  return (
    <RequirePermission permission={PERMISSIONS.SALE_VIEW}>
      <React.Suspense>
        <Sales />
      </React.Suspense>
    </RequirePermission>
  );
}

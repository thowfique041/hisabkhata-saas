'use client';
import * as React from 'react';
import { Download, Pencil, Plus, Users, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS } from '@hisabkhata/shared';
import { api, download, errorMessage } from '@/lib/api';
import { useAction, useApi, useList } from '@/hooks/use-api';
import { useCan, useSession } from '@/hooks/use-session';
import { Money } from '@/components/money';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  SearchInput,
  Stat,
  TableSkeleton,
} from '@/components/page';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { PartyForm } from '@/components/forms/party-form';
import { PaymentForm } from '@/components/payment-form';
import { SaleStatusBadge } from '@/components/status';
import { useConfirm } from '@/components/confirm';
import { RequirePermission } from '@/components/shell/guards';
import { Select } from '@/components/ui/input';
import { useNewIntent, useUrlFilter, useUrlIntent } from '@/hooks/use-url-intent';
import { useI18n } from '@/lib/i18n/client';
import { usePathname, useRouter } from 'next/navigation';
import { cn, formatDate } from '@/lib/utils';

const INV = [['/customers'], ['/sales'], ['/dashboard'], ['/invoices']];

function Statement({ id }: { id: string }) {
  const { data } = useApi<any>(`/customers/${id}/statement`);
  const tz = useSession().data?.activeTenant?.timezone;
  if (!data) return <TableSkeleton rows={4} cols={4} />;
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            download(`/customers/${id}/statement`, { format: 'csv' }, 'statement.csv').catch((e) =>
              toast.error(errorMessage(e)),
            )
          }
        >
          <Download /> Download CSV
        </Button>
      </div>
      {data.entries.length ? (
        <table className="ledger rounded-md border">
          <thead>
            <tr>
              <th>Date</th>
              <th>Entry</th>
              <th className="r">Debit</th>
              <th className="r">Credit</th>
              <th className="r">Balance</th>
            </tr>
          </thead>
          <tbody>
            {data.entries.map((e: any, i: number) => (
              <tr key={i}>
                <td className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatDate(e.date, tz)}
                </td>
                <td>
                  {e.type}
                  <p className="text-xs text-muted-foreground">{e.reference}</p>
                </td>
                <td className="r">{Number(e.debit) ? <Money value={e.debit} /> : ''}</td>
                <td className="r text-positive">
                  {Number(e.credit) ? <Money value={e.credit} /> : ''}
                </td>
                <td className={cn('r font-medium', Number(e.balance) > 0 && 'text-negative')}>
                  <Money value={e.balance} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">No transactions yet.</p>
      )}
    </div>
  );
}

function CustomerDetail({ id, onEdit }: { id: string; onEdit: (c: any) => void }) {
  const { data: c } = useApi<any>(`/customers/${id}`);
  const can = useCan();
  const tz = useSession().data?.activeTenant?.timezone;
  const confirm = useConfirm();
  const [paying, setPaying] = React.useState(false);
  const pay = useAction((v: any) => api(`/customers/${id}/payments`, { method: 'POST', body: v }), {
    success: (r: any) =>
      `Payment applied to ${r.applied.length} ${r.applied.length === 1 ? 'invoice' : 'invoices'}`,
    invalidate: INV,
    onSuccess: () => setPaying(false),
  });
  const archive = useAction(() => api(`/customers/${id}`, { method: 'DELETE' }), {
    success: 'Customer archived',
    invalidate: INV,
  });
  if (!c) return <TableSkeleton rows={5} cols={2} />;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 divide-x rounded-md border text-center">
        <div className="p-3">
          <p className="text-xs text-muted-foreground">Purchases</p>
          <Money value={c.stats.totalPurchases} className="font-semibold" />
        </div>
        <div className="p-3">
          <p className="text-xs text-muted-foreground">Paid</p>
          <Money value={c.stats.totalPaid} className="font-semibold text-positive" />
        </div>
        <div className="p-3">
          <p className="text-xs text-muted-foreground">Owes you</p>
          <Money
            value={c.stats.outstanding}
            className={cn('font-semibold', Number(c.stats.outstanding) > 0 && 'text-negative')}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {Number(c.stats.outstanding) > 0 && can(PERMISSIONS.PAYMENT_RECEIVE) && (
          <Button size="sm" onClick={() => setPaying((v) => !v)}>
            <Wallet /> Receive payment
          </Button>
        )}
        {can(PERMISSIONS.CUSTOMER_MANAGE) && (
          <>
            <Button size="sm" variant="outline" onClick={() => onEdit(c)}>
              <Pencil /> Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                if (
                  await confirm({
                    title: `Archive ${c.name}?`,
                    description:
                      'Archived customers are hidden from lists and the POS. Their sales history is kept.',
                    confirmLabel: 'Archive',
                    destructive: true,
                  })
                )
                  archive.mutate(undefined);
              }}
            >
              Archive
            </Button>
          </>
        )}
      </div>
      {paying && (
        <PaymentForm
          max={c.stats.outstanding}
          submitLabel="Record payment"
          onSubmit={(v) => pay.mutate(v)}
          pending={pay.isPending}
        />
      )}
      <div>
        <Stat label="Phone">{c.phone ?? 'None'}</Stat>
        <Stat label="Email">{c.email ?? 'None'}</Stat>
        <Stat label="Address">{c.address ?? 'None'}</Stat>
        <Stat label="Customer since">{formatDate(c.createdAt, tz)}</Stat>
        {c.notes && <Stat label="Notes">{c.notes}</Stat>}
      </div>
      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="statement">Statement</TabsTrigger>
        </TabsList>
        <TabsContent value="sales" className="pt-3">
          {c.sales.length ? (
            <table className="ledger rounded-md border">
              <tbody>
                {c.sales.map((s: any) => (
                  <tr key={s.id}>
                    <td>
                      <a href={`/sales?open=${s.id}`} className="font-medium hover:underline">
                        {s.invoiceNo}
                      </a>
                      <p className="text-xs text-muted-foreground">{formatDate(s.createdAt, tz)}</p>
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
            <p className="py-6 text-center text-sm text-muted-foreground">
              No sales to this customer yet.
            </p>
          )}
        </TabsContent>
        <TabsContent value="statement" className="pt-3">
          <Statement id={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Customers() {
  const can = useCan();
  const list = useList<any>('/customers', { pageSize: 25 });
  const [panel, setPanel] = React.useState<{ mode: 'new' | 'view' | 'edit'; c?: any } | null>(null);
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  useNewIntent(() => setPanel({ mode: 'new' }), can(PERMISSIONS.CUSTOMER_MANAGE));
  useUrlIntent('open', (id) => setPanel({ mode: 'view', c: { id } }));
  useUrlFilter('dues', 'all', (v) => list.set({ dues: v }));
  const setDues = (v: string) =>
    router.replace(v === 'all' ? pathname : `${pathname}?dues=${v}`, { scroll: false });
  const save = useAction(
    (v: any) =>
      panel?.mode === 'edit'
        ? api(`/customers/${panel.c.id}`, { method: 'PUT', body: v })
        : api('/customers', { method: 'POST', body: v }),
    {
      success: panel?.mode === 'edit' ? 'Customer updated' : 'Customer added',
      invalidate: INV,
      onSuccess: (c) => setPanel({ mode: 'view', c }),
    },
  );
  const items = list.data?.items ?? [];
  return (
    <>
      <PageHeader
        title="Customers"
        description="People you sell to, what they bought and what they owe."
        actions={
          can(PERMISSIONS.CUSTOMER_MANAGE) && (
            <Button onClick={() => setPanel({ mode: 'new' })}>
              <Plus /> Add customer
            </Button>
          )
        }
      />
      <div className="rounded-lg border bg-surface">
        <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center">
          <SearchInput
            value={String(list.params.search ?? '')}
            onChange={(v) => list.set({ search: v })}
            placeholder="Name, phone or email"
          />
          <Select
            className="sm:w-56"
            value={String(list.params.dues ?? 'all')}
            onChange={(e) => setDues(e.target.value)}
            aria-label={t.panel.dues.filter}
          >
            <option value="all">{t.panel.dues.all}</option>
            <option value="owing">{t.panel.dues.owing}</option>
            <option value="overdue">{t.panel.dues.overdue}</option>
          </Select>
        </div>
        {list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : list.isLoading ? (
          <TableSkeleton />
        ) : !items.length ? (
          <EmptyState
            icon={Users}
            title={
              list.params.search || (list.params.dues && list.params.dues !== 'all')
                ? 'No customers match'
                : 'No customers yet'
            }
            description={
              list.params.search || (list.params.dues && list.params.dues !== 'all')
                ? 'Try another name, number or filter.'
                : 'Add regular customers to track their purchases and let them buy on credit.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th className="hidden md:table-cell">Phone</th>
                  <th className="r hidden sm:table-cell">Orders</th>
                  <th className="r">Purchases</th>
                  <th className="r">Owes you</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr
                    key={c.id}
                    data-clickable="true"
                    onClick={() => setPanel({ mode: 'view', c })}
                  >
                    <td>
                      <p className="font-medium">{c.name}</p>
                      {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                    </td>
                    <td className="num hidden text-muted-foreground md:table-cell">{c.phone}</td>
                    <td className="r hidden sm:table-cell">{c.salesCount}</td>
                    <td className="r">
                      <Money value={c.totalPurchases} />
                    </td>
                    <td className="r">
                      {Number(c.outstanding) > 0 ? (
                        <Money value={c.outstanding} signed="negative" />
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
        open={!!panel}
        onOpenChange={(o) => !o && setPanel(null)}
        title={
          panel?.mode === 'new'
            ? 'Add customer'
            : panel?.mode === 'edit'
              ? 'Edit customer'
              : (panel?.c?.name ?? '')
        }
      >
        {panel?.mode === 'view' && (
          <CustomerDetail id={panel.c.id} onEdit={(c) => setPanel({ mode: 'edit', c })} />
        )}
        {(panel?.mode === 'new' || panel?.mode === 'edit') && (
          <PartyForm
            kind="customer"
            initial={panel.mode === 'edit' ? panel.c : undefined}
            onSubmit={(v) => save.mutate(v)}
            pending={save.isPending}
          />
        )}
      </Sheet>
    </>
  );
}

export default function CustomersPage() {
  return (
    <RequirePermission permission={PERMISSIONS.CUSTOMER_VIEW}>
      <React.Suspense>
        <Customers />
      </React.Suspense>
    </RequirePermission>
  );
}

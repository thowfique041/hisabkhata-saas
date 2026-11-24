'use client';
import * as React from 'react';
import { Store } from 'lucide-react';
import { api } from '@/lib/api';
import { useAction, useApi, useList } from '@/hooks/use-api';
import { EmptyState, PageHeader, Pagination, SearchInput, Stat, TableSkeleton } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/misc';
import { Sheet } from '@/components/ui/dialog';
import { Money } from '@/components/money';
import { useConfirm } from '@/components/confirm';
import { formatDate, titleCase } from '@/lib/utils';

function TenantDetail({ id }: { id: string }) {
  const { data: t } = useApi<any>(`/admin/tenants/${id}`);
  const confirm = useConfirm();
  const setStatus = useAction((body: any) => api(`/admin/tenants/${id}/status`, { method: 'PATCH', body }), { success: 'Business status updated', invalidate: [['/admin/tenants']] });
  if (!t) return <TableSkeleton rows={5} cols={2} />;
  return (
    <div className="space-y-6">
      <div>
        <Stat label="Status">{t.status === 'ACTIVE' ? <Badge tone="positive">Active</Badge> : <Badge tone="negative">Suspended</Badge>}</Stat>
        {t.suspendedReason && <Stat label="Reason">{t.suspendedReason}</Stat>}
        <Stat label="Type">{titleCase(t.businessType)}</Stat>
        <Stat label="Contact">{t.email ?? t.phone ?? 'None'}</Stat>
        <Stat label="Created">{formatDate(t.createdAt)}</Stat>
        <Stat label="Records">
          {t._count.products} products, {t._count.customers} customers, {t._count.sales} sales
        </Stat>
      </div>
      {t.status === 'ACTIVE' ? (
        <Button
          variant="destructive"
          onClick={async () => {
            const ok = await confirm({ title: `Suspend ${t.name}?`, description: 'All members are signed out and blocked until the business is reactivated. Data is kept.', confirmLabel: 'Suspend business', destructive: true, withReason: true });
            if (ok) setStatus.mutate({ status: 'SUSPENDED', reason: ok.reason });
          }}
        >
          Suspend business
        </Button>
      ) : (
        <Button onClick={() => setStatus.mutate({ status: 'ACTIVE' })}>Reactivate business</Button>
      )}
      <div>
        <h3 className="mb-2 text-sm font-semibold">Members</h3>
        <table className="ledger rounded-md border">
          <tbody>
            {t.memberships.map((m: any) => (
              <tr key={m.id}>
                <td>
                  {m.user.name}
                  <p className="text-xs text-muted-foreground">{m.user.email}</p>
                </td>
                <td>{m.role.name}</td>
                <td className="text-xs text-muted-foreground">{m.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Subscription history</h3>
        <table className="ledger rounded-md border">
          <tbody>
            {t.subscriptions.map((s: any) => (
              <tr key={s.id}>
                <td>{s.plan.name}</td>
                <td>{titleCase(s.status)}</td>
                <td className="text-xs text-muted-foreground">
                  {formatDate(s.startsAt)} to {s.endsAt ? formatDate(s.endsAt) : 'open'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {t.billingPayments.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Payments</h3>
          <table className="ledger rounded-md border">
            <tbody>
              {t.billingPayments.map((p: any) => (
                <tr key={p.id}>
                  <td className="num text-xs">{p.providerRef}</td>
                  <td>{titleCase(p.status)}</td>
                  <td className="r">
                    <Money value={p.amount} currency={p.currency} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function TenantsPage() {
  const list = useList<any>('/admin/tenants', { pageSize: 25 });
  const [open, setOpen] = React.useState<any | null>(null);
  return (
    <>
      <PageHeader title="Businesses" description="Every tenant on the platform." />
      <div className="rounded-lg border bg-surface">
        <div className="flex flex-col gap-2 border-b p-3 sm:flex-row">
          <SearchInput value={String(list.params.search ?? '')} onChange={(v) => list.set({ search: v })} placeholder="Name, slug or email" />
          <Select className="sm:w-40" value={String(list.params.status ?? '')} onChange={(e) => list.set({ status: e.target.value })} aria-label="Status">
            <option value="">Any status</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </Select>
        </div>
        {list.isLoading ? (
          <TableSkeleton />
        ) : !list.data?.items.length ? (
          <EmptyState icon={Store} title="No businesses found" description="Try a different search." />
        ) : (
          <div className="overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Plan</th>
                  <th className="r hidden md:table-cell">Members</th>
                  <th className="r hidden md:table-cell">Products</th>
                  <th className="r hidden md:table-cell">Sales</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((t: any) => (
                  <tr key={t.id} data-clickable="true" onClick={() => setOpen(t)}>
                    <td>
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {titleCase(t.businessType)}, joined {formatDate(t.createdAt)}
                      </p>
                    </td>
                    <td>
                      {t.plan?.name ?? 'Free'}
                      {t.plan?.status === 'TRIALING' && <span className="text-xs text-muted-foreground"> (trial)</span>}
                    </td>
                    <td className="r hidden md:table-cell">{t.members}</td>
                    <td className="r hidden md:table-cell">{t.products}</td>
                    <td className="r hidden md:table-cell">{t.sales}</td>
                    <td>{t.status === 'ACTIVE' ? <Badge tone="positive">Active</Badge> : <Badge tone="negative">Suspended</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list.data && <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} onPage={list.setPage} />}
      </div>
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)} title={open?.name ?? ''}>
        {open && <TenantDetail id={open.id} />}
      </Sheet>
    </>
  );
}

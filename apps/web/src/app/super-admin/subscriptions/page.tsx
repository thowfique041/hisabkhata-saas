'use client';
import * as React from 'react';
import { api } from '@/lib/api';
import { useAction, useList } from '@/hooks/use-api';
import { PageHeader, Pagination, TableSkeleton } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Badge, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { Money } from '@/components/money';
import { useConfirm } from '@/components/confirm';
import { formatDate, titleCase } from '@/lib/utils';

function Payments() {
  const list = useList<any>('/admin/billing-payments', { pageSize: 25, status: 'PENDING' });
  const confirm = useConfirm();
  const ok = useAction((id: string) => api(`/admin/billing-payments/${id}/confirm`, { method: 'POST', body: {} }), { success: 'Payment confirmed and plan activated', invalidate: [['/admin']] });
  return (
    <div className="rounded-lg border bg-surface">
      <div className="border-b p-3">
        <Select className="w-44" value={String(list.params.status ?? '')} onChange={(e) => list.set({ status: e.target.value })} aria-label="Status">
          <option value="">All payments</option>
          <option value="PENDING">Awaiting confirmation</option>
          <option value="SUCCEEDED">Succeeded</option>
          <option value="FAILED">Failed</option>
        </Select>
      </div>
      {list.isLoading ? (
        <TableSkeleton />
      ) : !list.data?.items.length ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">No payments in this view.</p>
      ) : (
        <table className="ledger">
          <thead>
            <tr>
              <th>Business</th>
              <th>Plan</th>
              <th>Reference</th>
              <th>Provider</th>
              <th>Status</th>
              <th className="r">Amount</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.data.items.map((p: any) => (
              <tr key={p.id}>
                <td>
                  {p.tenant.name}
                  <p className="text-xs text-muted-foreground">{formatDate(p.createdAt, undefined, true)}</p>
                </td>
                <td>
                  {p.planCode}, {p.interval.toLowerCase()}
                </td>
                <td className="num text-xs">{p.providerRef}</td>
                <td>{p.provider}</td>
                <td>
                  <Badge tone={p.status === 'SUCCEEDED' ? 'positive' : p.status === 'FAILED' ? 'negative' : 'warning'}>{titleCase(p.status)}</Badge>
                </td>
                <td className="r">
                  <Money value={p.amount} currency={p.currency} />
                </td>
                <td className="text-right">
                  {p.status === 'PENDING' && p.provider === 'manual' && (
                    <Button
                      size="sm"
                      onClick={async () =>
                        (await confirm({ title: 'Confirm this payment?', description: `Only confirm after the money for reference ${p.providerRef} is in the account. The ${p.planCode} plan activates immediately.`, confirmLabel: 'Payment received' })) && ok.mutate(p.id)
                      }
                    >
                      Confirm
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {list.data && <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} onPage={list.setPage} />}
    </div>
  );
}

function Subs() {
  const list = useList<any>('/admin/subscriptions', { pageSize: 25 });
  return (
    <div className="rounded-lg border bg-surface">
      <div className="border-b p-3">
        <Select className="w-44" value={String(list.params.status ?? '')} onChange={(e) => list.set({ status: e.target.value })} aria-label="Status">
          <option value="">Any status</option>
          {['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED'].map((s) => (
            <option key={s} value={s}>
              {titleCase(s)}
            </option>
          ))}
        </Select>
      </div>
      {list.isLoading ? (
        <TableSkeleton />
      ) : (
        <table className="ledger">
          <thead>
            <tr>
              <th>Business</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Started</th>
              <th>Ends</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((s: any) => (
              <tr key={s.id}>
                <td>{s.tenant.name}</td>
                <td>{s.plan.name}</td>
                <td>{titleCase(s.status)}</td>
                <td className="text-muted-foreground">{formatDate(s.startsAt)}</td>
                <td className="text-muted-foreground">{s.endsAt ? formatDate(s.endsAt) : 'No end'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {list.data && <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} onPage={list.setPage} />}
    </div>
  );
}

export default function SubscriptionsAdminPage() {
  return (
    <>
      <PageHeader title="Subscriptions" description="Plan history and incoming payments. Manual payments must be confirmed here before a plan activates." />
      <Tabs defaultValue="payments">
        <TabsList className="mb-5">
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
        </TabsList>
        <TabsContent value="payments">
          <Payments />
        </TabsContent>
        <TabsContent value="subscriptions">
          <Subs />
        </TabsContent>
      </Tabs>
    </>
  );
}

'use client';
import { useList } from '@/hooks/use-api';
import { PageHeader, Pagination, SearchInput, TableSkeleton } from '@/components/page';
import { formatDate } from '@/lib/utils';

export default function AuditLogsPage() {
  const list = useList<any>('/admin/audit-logs', { pageSize: 40 });
  return (
    <>
      <PageHeader title="Audit logs" description="Security-relevant actions across the platform: sign-ins, permission changes, cancellations, billing and admin actions." />
      <div className="rounded-lg border bg-surface">
        <div className="border-b p-3">
          <SearchInput value={String(list.params.search ?? '')} onChange={(v) => list.set({ search: v })} placeholder="Action, e.g. auth.login_failed" />
        </div>
        {list.isLoading ? (
          <TableSkeleton />
        ) : (
          <div className="overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>User</th>
                  <th className="hidden md:table-cell">Business</th>
                  <th className="hidden lg:table-cell">IP</th>
                </tr>
              </thead>
              <tbody>
                {list.data?.items.map((a: any) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(a.createdAt, undefined, true)}</td>
                    <td className="font-medium">{a.action}</td>
                    <td>{a.user?.email ?? 'System'}</td>
                    <td className="hidden md:table-cell">{a.tenant?.name ?? ''}</td>
                    <td className="num hidden text-xs text-muted-foreground lg:table-cell">{a.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list.data && <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} onPage={list.setPage} />}
      </div>
    </>
  );
}

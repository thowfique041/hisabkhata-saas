'use client';
import { api } from '@/lib/api';
import { useAction, useList } from '@/hooks/use-api';
import { useSession } from '@/hooks/use-session';
import { PageHeader, Pagination, SearchInput, TableSkeleton } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/misc';
import { useConfirm } from '@/components/confirm';
import { formatDate, formatRelative } from '@/lib/utils';

export default function UsersPage() {
  const me = useSession().data?.user.id;
  const list = useList<any>('/admin/users', { pageSize: 25 });
  const confirm = useConfirm();
  const setStatus = useAction(({ id, status }: { id: string; status: string }) => api(`/admin/users/${id}/status`, { method: 'PATCH', body: { status } }), { success: 'User updated', invalidate: [['/admin/users']] });
  return (
    <>
      <PageHeader title="Users" description="Everyone with a HisabKhata account." />
      <div className="rounded-lg border bg-surface">
        <div className="border-b p-3">
          <SearchInput value={String(list.params.search ?? '')} onChange={(v) => list.set({ search: v })} placeholder="Name or email" />
        </div>
        {list.isLoading ? (
          <TableSkeleton />
        ) : (
          <div className="overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th>User</th>
                  <th className="hidden md:table-cell">Businesses</th>
                  <th className="hidden sm:table-cell">Last sign-in</th>
                  <th>Status</th>
                  <th className="w-28" />
                </tr>
              </thead>
              <tbody>
                {list.data?.items.map((u: any) => (
                  <tr key={u.id}>
                    <td>
                      <p className="font-medium">
                        {u.name} {u.isSuperAdmin && <Badge tone="info">Platform admin</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {u.email}, joined {formatDate(u.createdAt)}
                      </p>
                    </td>
                    <td className="hidden text-sm md:table-cell">{u.memberships.map((m: any) => `${m.tenant.name} (${m.role.name})`).join(', ') || <span className="text-muted-foreground">None</span>}</td>
                    <td className="hidden text-muted-foreground sm:table-cell">{u.lastLoginAt ? formatRelative(u.lastLoginAt) : 'Never'}</td>
                    <td>{u.status === 'ACTIVE' ? <Badge tone="positive">Active</Badge> : <Badge tone="negative">Disabled</Badge>}</td>
                    <td className="text-right">
                      {u.id !== me &&
                        (u.status === 'ACTIVE' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-negative"
                            onClick={async () => (await confirm({ title: `Disable ${u.name}?`, description: 'They are signed out everywhere and cannot sign in.', confirmLabel: 'Disable user', destructive: true })) && setStatus.mutate({ id: u.id, status: 'DISABLED' })}
                          >
                            Disable
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => setStatus.mutate({ id: u.id, status: 'ACTIVE' })}>
                            Enable
                          </Button>
                        ))}
                    </td>
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

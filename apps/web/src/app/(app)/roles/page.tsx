'use client';
import * as React from 'react';
import { Plus, ShieldCheck } from 'lucide-react';
import { PERMISSIONS, type Permission } from '@hisabkhata/shared';
import { api } from '@/lib/api';
import { useAction, useApi } from '@/hooks/use-api';
import { useCan } from '@/hooks/use-session';
import { ErrorState, PageHeader, Panel, TableSkeleton } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Badge, Checkbox } from '@/components/ui/misc';
import { useConfirm } from '@/components/confirm';
import { RequirePermission } from '@/components/shell/guards';
import { cn } from '@/lib/utils';

const LABEL: Record<string, string> = {
  'dashboard.view': 'See the dashboard',
  'product.view': 'See products',
  'product.manage': 'Add and edit products, change prices',
  'category.manage': 'Manage categories',
  'stock.view': 'See stock levels and history',
  'stock.adjust': 'Adjust stock',
  'customer.view': 'See customers',
  'customer.manage': 'Add and edit customers',
  'supplier.view': 'See suppliers',
  'supplier.manage': 'Add and edit suppliers',
  'purchase.view': 'See purchases',
  'purchase.manage': 'Record purchases and pay suppliers',
  'purchase.cancel': 'Cancel purchases',
  'sale.view': 'See sales',
  'sale.create': 'Make sales at the POS',
  'sale.cancel': 'Cancel sales',
  'sale.refund': 'Take returns and refund',
  'payment.receive': 'Collect payments on dues',
  'invoice.view': 'See and print invoices',
  'invoice.send': 'Email invoices',
  'expense.view': 'See expenses',
  'expense.manage': 'Record and edit expenses',
  'report.view': 'See reports',
  'employee.view': 'See employees and roles',
  'employee.manage': 'Invite and manage employees',
  'role.manage': 'Create and edit roles',
  'settings.manage': 'Change business settings',
  'subscription.manage': 'Manage the subscription',
  'audit.view': 'See the activity log',
};

function RoleEditor({ role, groups, onDone }: { role?: any; groups: { label: string; permissions: string[] }[]; onDone: () => void }) {
  const can = useCan();
  const [name, setName] = React.useState(role?.name ?? '');
  const [perms, setPerms] = React.useState<string[]>(role?.permissions ?? []);
  const locked = role?.systemKey === 'OWNER';
  const save = useAction(() => (role ? api(`/roles/${role.id}`, { method: 'PUT', body: { name, permissions: perms } }) : api('/roles', { method: 'POST', body: { name, permissions: perms } })), {
    success: role ? 'Role updated' : 'Role created',
    invalidate: [['/roles'], ['/auth/session']],
    onSuccess: onDone,
  });
  return (
    <div className="space-y-5 p-4">
      <Field label="Role name" htmlFor="role-name" hint={role?.systemKey ? 'Built-in role names cannot be changed.' : undefined}>
        <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!!role?.systemKey} />
      </Field>
      {locked && <p className="text-sm text-muted-foreground">Owners always have every permission.</p>}
      <div className="grid gap-5 md:grid-cols-2">
        {groups.map((g) => (
          <fieldset key={g.label}>
            <legend className="mb-2 text-sm font-semibold">{g.label}</legend>
            <div className="space-y-2">
              {g.permissions.map((p) => {
                const mine = can(p as Permission);
                return (
                  <label key={p} className={cn('flex items-start gap-2 text-sm', (!mine || locked) && 'opacity-60')}>
                    <Checkbox
                      checked={perms.includes(p)}
                      disabled={locked || !mine}
                      onCheckedChange={(v) => setPerms((ps) => (v ? [...ps, p] : ps.filter((x) => x !== p)))}
                      className="mt-0.5"
                    />
                    {LABEL[p] ?? p}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
      {!locked && (
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate(undefined)} loading={save.isPending} disabled={name.trim().length < 2 || !perms.length}>
            {role ? 'Save role' : 'Create role'}
          </Button>
        </div>
      )}
    </div>
  );
}

function Roles() {
  const can = useCan();
  const confirm = useConfirm();
  const { data, isLoading, error, refetch } = useApi<any[]>('/roles');
  const groups = useApi<any[]>('/permissions');
  const [editing, setEditing] = React.useState<any | null | undefined>(undefined);
  const remove = useAction((id: string) => api(`/roles/${id}`, { method: 'DELETE' }), { success: 'Role deleted', invalidate: [['/roles']] });
  const manage = can(PERMISSIONS.ROLE_MANAGE);
  return (
    <>
      <PageHeader
        title="Roles"
        description="A role is a set of permissions. Every employee has exactly one role."
        actions={manage && editing === undefined && (
          <Button onClick={() => setEditing(null)}>
            <Plus /> New role
          </Button>
        )}
      />
      {editing !== undefined && groups.data && (
        <Panel title={editing ? `Edit ${editing.name}` : 'New role'} className="mb-6">
          <RoleEditor role={editing ?? undefined} groups={groups.data} onDone={() => setEditing(undefined)} />
        </Panel>
      )}
      <div className="rounded-lg border bg-surface">
        {error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : isLoading ? (
          <TableSkeleton cols={3} />
        ) : (
          <table className="ledger">
            <thead>
              <tr>
                <th>Role</th>
                <th className="r">Permissions</th>
                <th className="r">Members</th>
                {manage && <th className="w-40" />}
              </tr>
            </thead>
            <tbody>
              {data?.map((r) => (
                <tr key={r.id}>
                  <td>
                    <p className="flex items-center gap-2 font-medium">
                      {r.systemKey && <ShieldCheck className="size-3.5 text-muted-foreground" />}
                      {r.name} {r.systemKey && <Badge>Built-in</Badge>}
                    </p>
                    {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                  </td>
                  <td className="r">{r.permissions.length}</td>
                  <td className="r">{r.members}</td>
                  {manage && (
                    <td className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(r)}>
                        {r.systemKey === 'OWNER' ? 'View' : 'Edit'}
                      </Button>
                      {!r.systemKey && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-negative"
                          onClick={async () => (await confirm({ title: `Delete ${r.name}?`, description: 'Roles with members cannot be deleted. Move members to another role first.', confirmLabel: 'Delete role', destructive: true })) && remove.mutate(r.id)}
                        >
                          Delete
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export default function RolesPage() {
  return (
    <RequirePermission permission={PERMISSIONS.EMPLOYEE_VIEW}>
      <Roles />
    </RequirePermission>
  );
}

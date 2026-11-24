'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserPlus, UserRound } from 'lucide-react';
import { inviteEmployeeSchema, PERMISSIONS } from '@hisabkhata/shared';
import { api } from '@/lib/api';
import { useAction, useApi } from '@/hooks/use-api';
import { useCan, useSession } from '@/hooks/use-session';
import { EmptyState, ErrorState, PageHeader, TableSkeleton } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Badge } from '@/components/ui/misc';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/dropdown';
import { useConfirm } from '@/components/confirm';
import { RequirePermission } from '@/components/shell/guards';
import { formatDate, formatRelative } from '@/lib/utils';

const INV = [['/employees'], ['/roles'], ['/subscription']];

function InviteForm({ roles, onDone }: { roles: any[]; onDone: () => void }) {
  const form = useForm<{ name: string; email: string; roleId: string }>({
    resolver: zodResolver(inviteEmployeeSchema),
    defaultValues: { name: '', email: '', roleId: roles.find((r) => r.systemKey === 'CASHIER')?.id ?? roles[0]?.id },
  });
  const invite = useAction((v: any) => api('/employees', { method: 'POST', body: v }), { success: 'Invitation sent', invalidate: INV, onSuccess: onDone });
  const e = form.formState.errors;
  return (
    <form onSubmit={form.handleSubmit((v) => invite.mutate(v))} className="space-y-4" noValidate>
      <Field label="Full name" htmlFor="name" error={e.name?.message}>
        <Input id="name" autoFocus {...form.register('name')} />
      </Field>
      <Field label="Email" htmlFor="email" error={e.email?.message} hint="They receive a link to set a password. Existing HisabKhata users can sign in right away.">
        <Input id="email" type="email" {...form.register('email')} />
      </Field>
      <Field label="Role" htmlFor="roleId">
        <Select id="roleId" {...form.register('roleId')}>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
              {r.description ? `: ${r.description}` : ''}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex justify-end">
        <Button type="submit" loading={invite.isPending}>
          Send invitation
        </Button>
      </div>
    </form>
  );
}

function Employees() {
  const can = useCan();
  const me = useSession().data?.user.id;
  const tz = useSession().data?.activeTenant?.timezone;
  const confirm = useConfirm();
  const { data, isLoading, error, refetch } = useApi<any[]>('/employees');
  const roles = useApi<any[]>('/roles');
  const [inviting, setInviting] = React.useState(false);
  const update = useAction(({ id, body }: { id: string; body: any }) => api(`/employees/${id}`, { method: 'PATCH', body }), { success: 'Employee updated', invalidate: INV });
  const remove = useAction((id: string) => api(`/employees/${id}`, { method: 'DELETE' }), { success: 'Employee removed', invalidate: INV });
  const manage = can(PERMISSIONS.EMPLOYEE_MANAGE);
  return (
    <>
      <PageHeader
        title="Employees"
        description="People who can sign in to this business, and what they can do."
        actions={manage && (
          <Button onClick={() => setInviting(true)}>
            <UserPlus /> Invite employee
          </Button>
        )}
      />
      <div className="rounded-lg border bg-surface">
        {error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : isLoading ? (
          <TableSkeleton cols={4} />
        ) : !data?.length ? (
          <EmptyState icon={UserRound} title="Only you so far" description="Invite cashiers and managers so each person signs in with their own account." />
        ) : (
          <div className="overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th className="hidden md:table-cell">Last sign-in</th>
                  <th className="hidden sm:table-cell">Joined</th>
                  <th>Status</th>
                  {manage && <th className="w-24" />}
                </tr>
              </thead>
              <tbody>
                {data.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <p className="font-medium">
                        {m.user.name} {m.user.id === me && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{m.user.email}</p>
                    </td>
                    <td>
                      {manage && m.user.id !== me ? (
                        <Select className="h-8 w-36" value={m.role.id} onChange={(e) => update.mutate({ id: m.id, body: { roleId: e.target.value } })} aria-label={`Role for ${m.user.name}`}>
                          {roles.data?.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        m.role.name
                      )}
                    </td>
                    <td className="hidden text-muted-foreground md:table-cell">{m.user.lastLoginAt ? formatRelative(m.user.lastLoginAt) : 'Never'}</td>
                    <td className="hidden text-muted-foreground sm:table-cell">{formatDate(m.joinedAt ?? m.createdAt, tz)}</td>
                    <td>{m.status === 'ACTIVE' ? <Badge tone="positive">Active</Badge> : <Badge>Disabled</Badge>}</td>
                    {manage && (
                      <td className="text-right">
                        {m.user.id !== me && (
                          <Menu>
                            <MenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                Manage
                              </Button>
                            </MenuTrigger>
                            <MenuContent>
                              {m.status === 'ACTIVE' ? (
                                <MenuItem
                                  onSelect={async () =>
                                    (await confirm({ title: `Disable ${m.user.name}?`, description: 'They are signed out immediately and cannot access this business until you re-enable them.', confirmLabel: 'Disable', destructive: true })) &&
                                    update.mutate({ id: m.id, body: { status: 'DISABLED' } })
                                  }
                                >
                                  Disable access
                                </MenuItem>
                              ) : (
                                <MenuItem onSelect={() => update.mutate({ id: m.id, body: { status: 'ACTIVE' } })}>Enable access</MenuItem>
                              )}
                              <MenuItem
                                className="text-negative"
                                onSelect={async () =>
                                  (await confirm({ title: `Remove ${m.user.name}?`, description: 'They lose access to this business. Their past sales stay in your records.', confirmLabel: 'Remove', destructive: true })) && remove.mutate(m.id)
                                }
                              >
                                Remove from business
                              </MenuItem>
                            </MenuContent>
                          </Menu>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Dialog open={inviting} onOpenChange={setInviting}>
        {inviting && roles.data && (
          <DialogContent title="Invite employee">
            <InviteForm roles={roles.data} onDone={() => setInviting(false)} />
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

export default function EmployeesPage() {
  return (
    <RequirePermission permission={PERMISSIONS.EMPLOYEE_VIEW}>
      <Employees />
    </RequirePermission>
  );
}

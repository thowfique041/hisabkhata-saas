'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { PLAN_FEATURES, planSchema } from '@hisabkhata/shared';
import { api } from '@/lib/api';
import { useAction, useApi } from '@/hooks/use-api';
import { PageHeader, TableSkeleton } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Badge, Checkbox, Switch } from '@/components/ui/misc';
import { Sheet } from '@/components/ui/dialog';
import { Money } from '@/components/money';
import { titleCase } from '@/lib/utils';

function PlanForm({ plan, onDone }: { plan?: any; onDone: () => void }) {
  const form = useForm<any>({
    resolver: zodResolver(planSchema),
    defaultValues: plan
      ? { ...plan, priceMonthly: String(plan.priceMonthly), priceYearly: String(plan.priceYearly), description: plan.description ?? '' }
      : { code: '', name: '', description: '', priceMonthly: '0', priceYearly: '0', currency: 'BDT', maxProducts: 100, maxEmployees: 3, trialDays: 0, features: [], isActive: true, sortOrder: 10 },
  });
  const save = useAction((v: any) => (plan ? api(`/admin/plans/${plan.id}`, { method: 'PUT', body: v }) : api('/admin/plans', { method: 'POST', body: v })), { success: 'Plan saved', invalidate: [['/admin/plans'], ['/plans']], onSuccess: onDone });
  const e = form.formState.errors as any;
  const features: string[] = form.watch('features');
  return (
    <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Code" htmlFor="code" error={e.code?.message} hint="Uppercase, used in billing.">
          <Input id="code" {...form.register('code')} disabled={plan?.code === 'FREE'} />
        </Field>
        <Field label="Name" htmlFor="pname" error={e.name?.message}>
          <Input id="pname" {...form.register('name')} />
        </Field>
      </div>
      <Field label="Description" htmlFor="pdesc">
        <Textarea id="pdesc" rows={2} {...form.register('description')} />
      </Field>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Monthly price" htmlFor="pm" error={e.priceMonthly?.message}>
          <Input id="pm" className="num" {...form.register('priceMonthly')} />
        </Field>
        <Field label="Yearly price" htmlFor="py" error={e.priceYearly?.message}>
          <Input id="py" className="num" {...form.register('priceYearly')} />
        </Field>
        <Field label="Currency" htmlFor="pc">
          <Input id="pc" {...form.register('currency')} />
        </Field>
        <Field label="Max products" htmlFor="mp" hint="-1 for unlimited">
          <Input id="mp" type="number" {...form.register('maxProducts', { valueAsNumber: true })} />
        </Field>
        <Field label="Max users" htmlFor="me" hint="-1 for unlimited">
          <Input id="me" type="number" {...form.register('maxEmployees', { valueAsNumber: true })} />
        </Field>
        <Field label="Trial days" htmlFor="td">
          <Input id="td" type="number" {...form.register('trialDays', { valueAsNumber: true })} />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Features</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {PLAN_FEATURES.map((f) => (
            <label key={f} className="flex items-center gap-2 text-sm">
              <Checkbox checked={features.includes(f)} onCheckedChange={(v) => form.setValue('features', v ? [...features, f] : features.filter((x) => x !== f))} />
              {titleCase(f)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={form.watch('isActive')} onCheckedChange={(v) => form.setValue('isActive', v)} /> Offered to customers
        </label>
        <Field label="Sort order" htmlFor="so" className="w-28">
          <Input id="so" type="number" {...form.register('sortOrder', { valueAsNumber: true })} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={save.isPending}>
          Save plan
        </Button>
      </div>
    </form>
  );
}

export default function PlansPage() {
  const { data } = useApi<any[]>('/admin/plans');
  const [edit, setEdit] = React.useState<any | null | undefined>(undefined);
  return (
    <>
      <PageHeader
        title="Plans"
        description="Limits and prices. Changes apply to every business on the plan immediately."
        actions={
          <Button onClick={() => setEdit(null)}>
            <Plus /> New plan
          </Button>
        }
      />
      <div className="rounded-lg border bg-surface">
        {!data ? (
          <TableSkeleton />
        ) : (
          <table className="ledger">
            <thead>
              <tr>
                <th>Plan</th>
                <th className="r">Monthly</th>
                <th className="r">Yearly</th>
                <th className="r">Products</th>
                <th className="r">Users</th>
                <th className="r">Subscriptions</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} data-clickable="true" onClick={() => setEdit(p)}>
                  <td>
                    <p className="font-medium">
                      {p.name} <span className="text-xs text-muted-foreground">{p.code}</span>
                    </p>
                    {p.trialDays > 0 && <p className="text-xs text-muted-foreground">{p.trialDays}-day trial</p>}
                  </td>
                  <td className="r">
                    <Money value={p.priceMonthly} currency={p.currency} />
                  </td>
                  <td className="r">
                    <Money value={p.priceYearly} currency={p.currency} />
                  </td>
                  <td className="r">{p.maxProducts < 0 ? 'Unlimited' : p.maxProducts}</td>
                  <td className="r">{p.maxEmployees < 0 ? 'Unlimited' : p.maxEmployees}</td>
                  <td className="r">{p._count.subscriptions}</td>
                  <td>{!p.isActive && <Badge>Hidden</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Sheet open={edit !== undefined} onOpenChange={(o) => !o && setEdit(undefined)} title={edit ? `Edit ${edit.name}` : 'New plan'}>
        {edit !== undefined && <PlanForm plan={edit ?? undefined} onDone={() => setEdit(undefined)} />}
      </Sheet>
    </>
  );
}

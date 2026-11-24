'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { SlidersHorizontal } from 'lucide-react';
import { ADJUSTMENT_REASONS, formatQty, PERMISSIONS, stockAdjustmentSchema } from '@hisabkhata/shared';
import { api } from '@/lib/api';
import { useAction, useList } from '@/hooks/use-api';
import { EmptyState, PageHeader, Pagination, Panel, TableSkeleton } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { MovementsTable } from '@/components/movements-table';
import { ProductPicker } from '@/components/product-picker';
import { RequirePermission } from '@/components/shell/guards';
import { cn, titleCase } from '@/lib/utils';

type Values = z.input<typeof stockAdjustmentSchema>;

function AdjustForm() {
  const [product, setProduct] = React.useState<any | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(stockAdjustmentSchema), defaultValues: { productId: '', direction: 'OUT', quantity: '', reason: 'DAMAGE', note: '' } });
  const dir = form.watch('direction');
  const save = useAction((v: Values) => api('/inventory/adjustments', { method: 'POST', body: v }), {
    success: (r: any) => `Stock updated. New balance: ${formatQty(r.stock)}`,
    invalidate: [['/inventory'], ['/products'], ['/dashboard']],
    onSuccess: (r: any) => {
      setProduct((p: any) => (p ? { ...p, stock: r.stock } : p));
      form.reset({ ...form.getValues(), quantity: '', note: '' });
    },
  });
  const e = form.formState.errors;
  return (
    <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4 p-4" noValidate>
      <Field label="Product" error={e.productId ? 'Choose a product' : undefined}>
        <ProductPicker
          onPick={(p) => {
            setProduct(p);
            form.setValue('productId', p.id, { shouldValidate: true });
          }}
        />
        {product && (
          <p className="text-sm">
            <span className="font-medium">{product.name}</span> <span className="text-muted-foreground">has</span> <span className="num font-medium">{formatQty(product.stock)} {product.unit}</span>
          </p>
        )}
      </Field>
      <div role="radiogroup" aria-label="Direction" className="grid grid-cols-2 gap-2">
        {(['IN', 'OUT'] as const).map((d) => (
          <button
            type="button"
            role="radio"
            aria-checked={dir === d}
            key={d}
            onClick={() => {
              form.setValue('direction', d);
              form.setValue('reason', d === 'IN' ? 'FOUND' : 'DAMAGE');
            }}
            className={cn('rounded-md border px-3 py-2 text-sm', dir === d ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}
          >
            {d === 'IN' ? 'Add stock' : 'Remove stock'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Quantity" htmlFor="quantity" error={e.quantity?.message}>
          <Input id="quantity" inputMode="decimal" className="num" {...form.register('quantity')} />
        </Field>
        <Field label="Reason" htmlFor="reason">
          <Select id="reason" {...form.register('reason')}>
            {ADJUSTMENT_REASONS.map((r) => (
              <option key={r} value={r}>
                {titleCase(r)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Note (optional)" htmlFor="note">
        <Textarea id="note" rows={2} {...form.register('note')} placeholder="e.g. 2 bottles broken during unloading" />
      </Field>
      <Button type="submit" className="w-full" loading={save.isPending}>
        {dir === 'IN' ? 'Add to stock' : 'Remove from stock'}
      </Button>
    </form>
  );
}

function Recent() {
  const IN = useList<any>('/inventory/movements', { type: 'ADJUSTMENT_IN', pageSize: 15 });
  const OUT = useList<any>('/inventory/movements', { type: 'ADJUSTMENT_OUT', pageSize: 15 });
  const [tab, setTab] = React.useState<'OUT' | 'IN'>('OUT');
  const list = tab === 'IN' ? IN : OUT;
  return (
    <Panel
      title="Recent adjustments"
      actions={
        <Select className="h-8 w-36" value={tab} onChange={(e) => setTab(e.target.value as 'IN' | 'OUT')} aria-label="Show">
          <option value="OUT">Removed</option>
          <option value="IN">Added</option>
        </Select>
      }
    >
      {list.isLoading ? <TableSkeleton /> : list.data?.items.length ? <MovementsTable items={list.data.items} /> : <EmptyState icon={SlidersHorizontal} title="No adjustments yet" description="Corrections for damage, expiry, loss or a recount appear here." />}
      {list.data && <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} onPage={list.setPage} />}
    </Panel>
  );
}

export default function StockAdjustmentsPage() {
  return (
    <RequirePermission permission={PERMISSIONS.STOCK_ADJUST}>
      <PageHeader title="Stock adjustments" description="Correct stock for damage, expiry, loss or a physical count. Each change is logged with a reason." />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Panel title="New adjustment" className="self-start">
          <AdjustForm />
        </Panel>
        <Recent />
      </div>
    </RequirePermission>
  );
}

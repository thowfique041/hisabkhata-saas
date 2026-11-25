'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { FolderTree, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import {
  expenseSchema,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  PERMISSIONS,
  type PaymentMethod,
} from '@hisabkhata/shared';
import { api } from '@/lib/api';
import { useAction, useApi, useList } from '@/hooks/use-api';
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
import { Input, Select, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { NameForm } from '@/components/forms/simple-name-form';
import { useConfirm } from '@/components/confirm';
import { RequirePermission } from '@/components/shell/guards';
import { useNewIntent } from '@/hooks/use-url-intent';
import { formatDate, isoDay } from '@/lib/utils';
import { DateRangePicker } from '@/components/date-range-picker';
import { rangeToQuery, type DateRange } from '@/lib/dhaka-dates';

type Values = z.input<typeof expenseSchema>;
const INV = [['/expenses'], ['/expense-categories'], ['/dashboard'], ['/reports']];

function ExpenseForm({
  expense,
  categories,
  onDone,
}: {
  expense?: any;
  categories: any[];
  onDone: () => void;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      categoryId: expense?.categoryId ?? categories[0]?.id ?? '',
      amount: expense?.amount ?? '',
      method: expense?.method ?? 'CASH',
      description: expense?.description ?? '',
      reference: expense?.reference ?? '',
      expenseDate: (expense ? isoDay(new Date(expense.expenseDate)) : isoDay(new Date())) as any,
    },
  });
  const save = useAction(
    (v: Values) => {
      const body = {
        ...v,
        expenseDate: new Date(String(v.expenseDate) + 'T12:00:00').toISOString(),
      };
      return expense
        ? api(`/expenses/${expense.id}`, { method: 'PUT', body })
        : api('/expenses', { method: 'POST', body });
    },
    {
      success: expense ? 'Expense updated' : 'Expense recorded',
      invalidate: INV,
      onSuccess: onDone,
    },
  );
  const e = form.formState.errors;
  return (
    <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Amount" htmlFor="amount" error={e.amount?.message}>
          <Input
            id="amount"
            className="num"
            inputMode="decimal"
            autoFocus
            {...form.register('amount')}
          />
        </Field>
        <Field label="Date" htmlFor="expenseDate" error={e.expenseDate?.message}>
          <Input id="expenseDate" type="date" {...form.register('expenseDate')} />
        </Field>
        <Field
          label="Category"
          htmlFor="categoryId"
          error={e.categoryId ? 'Choose a category' : undefined}
        >
          <Select id="categoryId" {...form.register('categoryId')}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Paid by" htmlFor="method">
          <Select id="method" {...form.register('method')}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Description" htmlFor="description">
        <Textarea
          id="description"
          rows={2}
          {...form.register('description')}
          placeholder="e.g. Electricity bill for October"
        />
      </Field>
      <Field label="Receipt / reference no." htmlFor="reference">
        <Input id="reference" {...form.register('reference')} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" loading={save.isPending}>
          {expense ? 'Save changes' : 'Record expense'}
        </Button>
      </div>
    </form>
  );
}

function Categories({ onClose }: { onClose: () => void }) {
  const { data } = useApi<any[]>('/expense-categories');
  const [edit, setEdit] = React.useState<any | null>(null);
  const confirm = useConfirm();
  const save = useAction(
    (v: any) =>
      edit?.id
        ? api(`/expense-categories/${edit.id}`, { method: 'PUT', body: v })
        : api('/expense-categories', { method: 'POST', body: v }),
    {
      success: 'Category saved',
      invalidate: INV,
      onSuccess: () => setEdit(null),
    },
  );
  const archive = useAction(
    (id: string) => api(`/expense-categories/${id}`, { method: 'DELETE' }),
    { success: 'Category removed', invalidate: INV },
  );
  return (
    <div className="space-y-4">
      <ul className="divide-y rounded-md border">
        {data?.map((c) => (
          <li key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
            {c.name}
            <span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEdit(c)}
                aria-label={`Rename ${c.name}`}
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${c.name}`}
                onClick={async () =>
                  (await confirm({
                    title: `Remove ${c.name}?`,
                    description:
                      'Existing expenses keep this category; it will no longer be offered for new ones.',
                    confirmLabel: 'Remove',
                    destructive: true,
                  })) && archive.mutate(c.id)
                }
              >
                <Trash2 />
              </Button>
            </span>
          </li>
        ))}
      </ul>
      <div className="rounded-md border p-3">
        <p className="mb-3 text-sm font-medium">
          {edit ? `Rename ${edit.name}` : 'Add a category'}
        </p>
        <NameForm
          key={edit?.id ?? 'new'}
          initial={edit ?? undefined}
          submitLabel={edit ? 'Save' : 'Add'}
          onSubmit={(v) => save.mutate(v)}
          pending={save.isPending}
        />
      </div>
      <div className="flex justify-end">
        <Button variant="outline" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}

function Expenses() {
  const can = useCan();
  const tz = useSession().data?.activeTenant?.timezone;
  const confirm = useConfirm();
  const categories = useApi<any[]>('/expense-categories');
  const list = useList<any>('/expenses', { pageSize: 25 });
  const [dialog, setDialog] = React.useState<{
    mode: 'new' | 'edit' | 'categories';
    e?: any;
  } | null>(null);
  const remove = useAction((id: string) => api(`/expenses/${id}`, { method: 'DELETE' }), {
    success: 'Expense deleted',
    invalidate: INV,
  });
  const manage = can(PERMISSIONS.EXPENSE_MANAGE);
  const [range, setRange] = React.useState<DateRange>({ preset: 'all' });
  useNewIntent(() => setDialog({ mode: 'new' }), manage && !!categories.data?.length);
  const items = list.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Rent, salaries, bills and other running costs. They reduce your net profit."
        actions={
          manage && (
            <>
              <Button variant="outline" onClick={() => setDialog({ mode: 'categories' })}>
                <FolderTree /> Categories
              </Button>
              <Button
                onClick={() => setDialog({ mode: 'new' })}
                disabled={!categories.data?.length}
              >
                <Plus /> Record expense
              </Button>
            </>
          )
        }
      />
      <div className="rounded-lg border bg-surface">
        <div className="flex flex-col gap-2 border-b p-3 lg:flex-row lg:items-center">
          <SearchInput
            value={String(list.params.search ?? '')}
            onChange={(v) => list.set({ search: v })}
            placeholder="Description or reference"
          />
          <Select
            className="lg:w-44"
            value={String(list.params.categoryId ?? '')}
            onChange={(e) => list.set({ categoryId: e.target.value })}
            aria-label="Category"
          >
            <option value="">All categories</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
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
          {list.data && (
            <p className="text-sm lg:ml-auto">
              <span className="text-muted-foreground">Total </span>
              <Money value={(list.data as any).totalAmount} className="font-semibold" />
            </p>
          )}
        </div>
        {list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : list.isLoading ? (
          <TableSkeleton />
        ) : !items.length ? (
          <EmptyState
            icon={Wallet}
            title="No expenses recorded"
            description="Record costs as you pay them to see your real profit in reports."
            action={
              manage && <Button onClick={() => setDialog({ mode: 'new' })}>Record expense</Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th className="hidden md:table-cell">Description</th>
                  <th className="hidden sm:table-cell">Paid by</th>
                  <th className="r">Amount</th>
                  {manage && <th className="w-24" />}
                </tr>
              </thead>
              <tbody>
                {items.map((x) => (
                  <tr key={x.id}>
                    <td className="whitespace-nowrap text-muted-foreground">
                      {formatDate(x.expenseDate, tz)}
                    </td>
                    <td className="font-medium">{x.category.name}</td>
                    <td className="hidden text-muted-foreground md:table-cell">{x.description}</td>
                    <td className="hidden sm:table-cell">
                      {PAYMENT_METHOD_LABELS[x.method as PaymentMethod]}
                    </td>
                    <td className="r">
                      <Money value={x.amount} />
                    </td>
                    {manage && (
                      <td className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDialog({ mode: 'edit', e: x })}
                          aria-label="Edit expense"
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete expense"
                          onClick={async () =>
                            (await confirm({
                              title: 'Delete this expense?',
                              description:
                                'Reports and profit figures will be recalculated without it.',
                              confirmLabel: 'Delete',
                              destructive: true,
                            })) && remove.mutate(x.id)
                          }
                        >
                          <Trash2 />
                        </Button>
                      </td>
                    )}
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
      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        {dialog && (
          <DialogContent
            title={
              dialog.mode === 'categories'
                ? 'Expense categories'
                : dialog.mode === 'edit'
                  ? 'Edit expense'
                  : 'Record expense'
            }
          >
            {dialog.mode === 'categories' ? (
              <Categories onClose={() => setDialog(null)} />
            ) : (
              <ExpenseForm
                expense={dialog.e}
                categories={categories.data ?? []}
                onDone={() => setDialog(null)}
              />
            )}
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

export default function ExpensesPage() {
  return (
    <RequirePermission permission={PERMISSIONS.EXPENSE_VIEW}>
      <React.Suspense>
        <Expenses />
      </React.Suspense>
    </RequirePermission>
  );
}

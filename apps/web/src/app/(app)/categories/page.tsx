'use client';
import * as React from 'react';
import Link from 'next/link';
import { FolderTree, Pencil, Plus, Trash2 } from 'lucide-react';
import { PERMISSIONS } from '@hisabkhata/shared';
import { api } from '@/lib/api';
import { useAction, useApi } from '@/hooks/use-api';
import { useCan } from '@/hooks/use-session';
import { EmptyState, ErrorState, PageHeader, TableSkeleton } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { NameForm } from '@/components/forms/simple-name-form';
import { useConfirm } from '@/components/confirm';
import { RequirePermission } from '@/components/shell/guards';

function Categories() {
  const { data, isLoading, error, refetch } = useApi<any[]>('/categories');
  const can = useCan();
  const confirm = useConfirm();
  const [edit, setEdit] = React.useState<any | null | undefined>(undefined);
  const inv = { invalidate: [['/categories'], ['/products']] };
  const save = useAction((v: any) => (edit?.id ? api(`/categories/${edit.id}`, { method: 'PUT', body: v }) : api('/categories', { method: 'POST', body: v })), {
    ...inv,
    success: edit?.id ? 'Category updated' : 'Category added',
    onSuccess: () => setEdit(undefined),
  });
  const remove = useAction((id: string) => api(`/categories/${id}`, { method: 'DELETE' }), { ...inv, success: 'Category deleted' });
  const manage = can(PERMISSIONS.CATEGORY_MANAGE);

  return (
    <>
      <PageHeader
        title="Categories"
        description="Group products so they are easier to find and report on."
        actions={manage && (
          <Button onClick={() => setEdit(null)}>
            <Plus /> Add category
          </Button>
        )}
      />
      <div className="rounded-lg border bg-surface">
        {error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : isLoading ? (
          <TableSkeleton cols={3} />
        ) : !data?.length ? (
          <EmptyState icon={FolderTree} title="No categories yet" description="For example: Rice and grains, Beverages, Household." action={manage && <Button onClick={() => setEdit(null)}>Add category</Button>} />
        ) : (
          <table className="ledger">
            <thead>
              <tr>
                <th>Name</th>
                <th className="hidden sm:table-cell">Description</th>
                <th className="r">Products</th>
                {manage && <th className="w-24" />}
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.name}</td>
                  <td className="hidden text-muted-foreground sm:table-cell">{c.description}</td>
                  <td className="r">
                    <Link href={`/products?categoryId=${c.id}`} className="hover:underline">
                      {c.productCount}
                    </Link>
                  </td>
                  {manage && (
                    <td className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setEdit(c)} aria-label={`Edit ${c.name}`}>
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${c.name}`}
                        onClick={async () => {
                          if (await confirm({ title: `Delete ${c.name}?`, description: 'Only empty categories can be deleted. Products are not affected.', confirmLabel: 'Delete category', destructive: true }))
                            remove.mutate(c.id);
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Dialog open={edit !== undefined} onOpenChange={(o) => !o && setEdit(undefined)}>
        {edit !== undefined && (
          <DialogContent title={edit ? 'Edit category' : 'Add category'}>
            <NameForm initial={edit ?? undefined} submitLabel={edit ? 'Save changes' : 'Add category'} onSubmit={(v) => save.mutate(v)} pending={save.isPending} />
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

export default function CategoriesPage() {
  return (
    <RequirePermission permission={PERMISSIONS.PRODUCT_VIEW}>
      <Categories />
    </RequirePermission>
  );
}

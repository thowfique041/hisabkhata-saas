'use client';
import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Archive, ArchiveRestore, PackageSearch, Plus } from 'lucide-react';
import { formatQty, PERMISSIONS } from '@hisabkhata/shared';
import { api } from '@/lib/api';
import { useAction, useApi, useList } from '@/hooks/use-api';
import { useCan } from '@/hooks/use-session';
import { Money } from '@/components/money';
import { EmptyState, ErrorState, PageHeader, Pagination, SearchInput, Stat, TableSkeleton } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/misc';
import { Sheet } from '@/components/ui/dialog';
import { StockBadge } from '@/components/status';
import { ProductForm } from '@/components/forms/product-form';
import { useConfirm } from '@/components/confirm';
import { RequirePermission } from '@/components/shell/guards';
import { formatDate, titleCase } from '@/lib/utils';

function ProductDetail({ id, onEdit }: { id: string; onEdit: () => void }) {
  const { data } = useApi<any>(`/products/${id}`);
  const can = useCan();
  if (!data) return <TableSkeleton rows={4} cols={2} />;
  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        {data.imageUrl && <img src={data.imageUrl} alt="" className="size-20 rounded-md border object-cover" />}
        <div className="flex-1">
          <Stat label="SKU">{data.sku}</Stat>
          <Stat label="Barcode">{data.barcode ?? 'None'}</Stat>
          <Stat label="Category">{data.category?.name ?? 'None'}</Stat>
        </div>
      </div>
      <div>
        <Stat label="In stock">
          <span className="num">
            {formatQty(data.stock)} {data.unit}
          </span>{' '}
          <StockBadge stock={data.stock} min={data.minStock} />
        </Stat>
        <Stat label="Low stock alert at">
          <span className="num">{formatQty(data.minStock)}</span>
        </Stat>
        <Stat label="Purchase price">
          <Money value={data.purchasePrice} />
        </Stat>
        <Stat label="Selling price">
          <Money value={data.sellingPrice} />
        </Stat>
        <Stat label="Tax">{data.taxRate}%</Stat>
      </div>
      {can(PERMISSIONS.PRODUCT_MANAGE) && (
        <Button variant="outline" onClick={onEdit}>
          Edit product
        </Button>
      )}
      <div>
        <h3 className="mb-2 text-sm font-semibold">Recent stock history</h3>
        <table className="ledger rounded-md border">
          <thead>
            <tr>
              <th>Date</th>
              <th>Movement</th>
              <th className="r">Change</th>
              <th className="r">Balance</th>
            </tr>
          </thead>
          <tbody>
            {data.stockMovements.map((m: any) => (
              <tr key={m.id}>
                <td className="text-xs text-muted-foreground">{formatDate(m.createdAt, undefined, true)}</td>
                <td>
                  {titleCase(m.type)}
                  {m.note && <p className="text-xs text-muted-foreground">{m.note}</p>}
                </td>
                <td className={`r ${Number(m.quantity) < 0 ? 'text-negative' : 'text-positive'}`}>{Number(m.quantity) > 0 ? '+' : ''}{formatQty(m.quantity)}</td>
                <td className="r">{formatQty(m.balanceAfter)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Products() {
  const params = useSearchParams();
  const router = useRouter();
  const can = useCan();
  const confirm = useConfirm();
  const list = useList<any>('/products', { search: params.get('search') ?? '', stock: params.get('stock') ?? 'all', archived: 'false', pageSize: 25 });
  const categories = useApi<any[]>('/categories');
  const [selected, setSelected] = React.useState<string[]>([]);
  const [panel, setPanel] = React.useState<{ mode: 'new' | 'view' | 'edit'; id?: string; product?: any } | null>(params.get('new') ? { mode: 'new' } : null);
  const bulk = useAction((b: any) => api('/products/bulk', { method: 'POST', body: b }), {
    success: (r: any) => `${r.updated} products updated`,
    invalidate: [['/products'], ['/categories']],
    onSuccess: () => setSelected([]),
  });
  const items = list.data?.items ?? [];
  const archived = list.params.archived === 'true';
  const allChecked = items.length > 0 && items.every((i) => selected.includes(i.id));

  React.useEffect(() => setSelected([]), [list.params]);

  return (
    <>
      <PageHeader
        title="Products"
        description="Everything you sell, with live stock levels."
        actions={
          can(PERMISSIONS.PRODUCT_MANAGE) && (
            <Button onClick={() => setPanel({ mode: 'new' })}>
              <Plus /> Add product
            </Button>
          )
        }
      />
      <div className="rounded-lg border bg-surface">
        <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center">
          <SearchInput value={String(list.params.search ?? '')} onChange={(v) => list.set({ search: v })} placeholder="Name, SKU or barcode" />
          <Select className="sm:w-44" value={String(list.params.categoryId ?? '')} onChange={(e) => list.set({ categoryId: e.target.value })} aria-label="Category">
            <option value="">All categories</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select className="sm:w-40" value={String(list.params.stock)} onChange={(e) => list.set({ stock: e.target.value })} aria-label="Stock level">
            <option value="all">Any stock level</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </Select>
          <label className="flex items-center gap-2 text-sm text-muted-foreground sm:ml-auto">
            <Checkbox checked={archived} onCheckedChange={(v) => list.set({ archived: v ? 'true' : 'false' })} /> Show archived
          </label>
        </div>
        {selected.length > 0 && can(PERMISSIONS.PRODUCT_MANAGE) && (
          <div className="flex flex-wrap items-center gap-2 border-b bg-accent/60 px-3 py-2 text-sm">
            <span className="font-medium">{selected.length} selected</span>
            {archived ? (
              <Button size="sm" variant="outline" onClick={() => bulk.mutate({ ids: selected, action: 'restore' })}>
                <ArchiveRestore /> Restore
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  if (await confirm({ title: `Archive ${selected.length} products?`, description: 'Archived products are hidden from the POS and lists. Their sales history stays intact, and you can restore them later.', confirmLabel: 'Archive', destructive: true }))
                    bulk.mutate({ ids: selected, action: 'archive' });
                }}
              >
                <Archive /> Archive
              </Button>
            )}
            <Select className="h-8 w-48" defaultValue="" onChange={(e) => e.target.value && bulk.mutate({ ids: selected, action: 'setCategory', categoryId: e.target.value === 'none' ? null : e.target.value })} aria-label="Move to category">
              <option value="">Move to category</option>
              <option value="none">No category</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        {list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : list.isLoading ? (
          <TableSkeleton />
        ) : items.length === 0 ? (
          list.params.search || list.params.stock !== 'all' || list.params.categoryId || archived ? (
            <EmptyState icon={PackageSearch} title="No products match" description="Try a different search or clear the filters." />
          ) : (
            <EmptyState
              icon={PackageSearch}
              title="Add your first product"
              description="Products are what you sell. Add a name, prices and opening stock; you can scan barcodes at the counter later."
              action={can(PERMISSIONS.PRODUCT_MANAGE) && <Button onClick={() => setPanel({ mode: 'new' })}>Add product</Button>}
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  {can(PERMISSIONS.PRODUCT_MANAGE) && (
                    <th className="w-10">
                      <Checkbox checked={allChecked} onCheckedChange={(v) => setSelected(v ? items.map((i) => i.id) : [])} aria-label="Select all" />
                    </th>
                  )}
                  <th>Product</th>
                  <th className="hidden md:table-cell">Category</th>
                  <th className="r">Cost</th>
                  <th className="r">Price</th>
                  <th className="r">In stock</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} data-clickable="true" onClick={() => setPanel({ mode: 'view', id: p.id, product: p })}>
                    {can(PERMISSIONS.PRODUCT_MANAGE) && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selected.includes(p.id)} onCheckedChange={(v) => setSelected((s) => (v ? [...s, p.id] : s.filter((x) => x !== p.id)))} aria-label={`Select ${p.name}`} />
                      </td>
                    )}
                    <td>
                      <div className="flex items-center gap-3">
                        {p.imageUrl ? <img src={p.imageUrl} alt="" className="size-8 rounded object-cover" /> : <span className="size-8 rounded bg-muted" />}
                        <div className="min-w-0">
                          <p className="truncate font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.sku}
                            {p.barcode ? `, ${p.barcode}` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden text-muted-foreground md:table-cell">{p.category?.name ?? ''}</td>
                    <td className="r text-muted-foreground">
                      <Money value={p.purchasePrice} />
                    </td>
                    <td className="r">
                      <Money value={p.sellingPrice} />
                    </td>
                    <td className="r">
                      <span className="mr-2">
                        <StockBadge stock={p.stock} min={p.minStock} />
                      </span>
                      {formatQty(p.stock)} <span className="text-xs text-muted-foreground">{p.unit}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list.data && <Pagination page={list.data.page} pageCount={list.data.pageCount} total={list.data.total} onPage={list.setPage} />}
      </div>

      <Sheet
        open={!!panel}
        onOpenChange={(o) => {
          if (!o) {
            setPanel(null);
            if (params.get('new')) router.replace('/products');
          }
        }}
        title={panel?.mode === 'new' ? 'Add product' : panel?.mode === 'edit' ? 'Edit product' : (panel?.product?.name ?? 'Product')}
      >
        {panel?.mode === 'view' && panel.id && <ProductDetail id={panel.id} onEdit={() => api(`/products/${panel.id}`).then((p) => setPanel({ mode: 'edit', id: p.id, product: p }))} />}
        {(panel?.mode === 'new' || panel?.mode === 'edit') && <ProductForm product={panel.mode === 'edit' ? panel.product : undefined} onDone={(p) => setPanel({ mode: 'view', id: p.id, product: p })} />}
      </Sheet>
    </>
  );
}

export default function ProductsPage() {
  return (
    <RequirePermission permission={PERMISSIONS.PRODUCT_VIEW}>
      <React.Suspense>
        <Products />
      </React.Suspense>
    </RequirePermission>
  );
}

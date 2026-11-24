'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { ImagePlus } from 'lucide-react';
import { PRODUCT_UNITS, productSchema } from '@hisabkhata/shared';
import { api, errorMessage } from '@/lib/api';
import { useApi, useAction } from '@/hooks/use-api';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { FormError } from '@/components/auth-form';
import { toast } from 'sonner';

type Values = z.input<typeof productSchema>;

export function ProductForm({ product, onDone }: { product?: any; onDone: (p: any) => void }) {
  const categories = useApi<any[]>('/categories');
  const [error, setError] = React.useState<string | null>(null);
  const [image, setImage] = React.useState<{ id: string; url: string } | null>(product?.imageId ? { id: product.imageId, url: product.imageUrl } : null);
  const [uploading, setUploading] = React.useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(product ? productSchema.omit({ openingStock: true }) : productSchema),
    defaultValues: {
      name: product?.name ?? '',
      sku: product?.sku ?? '',
      barcode: product?.barcode ?? '',
      categoryId: product?.categoryId ?? '',
      unit: product?.unit ?? 'pcs',
      purchasePrice: product?.purchasePrice ?? '',
      sellingPrice: product?.sellingPrice ?? '',
      taxRate: product?.taxRate ?? '0',
      minStock: product?.minStock ?? '0',
      openingStock: product ? undefined : '0',
      description: product?.description ?? '',
    },
  });
  const e = form.formState.errors;

  const save = useAction(
    (v: Values) =>
      product
        ? api(`/products/${product.id}`, { method: 'PATCH', body: { ...v, categoryId: v.categoryId || null, imageId: image?.id ?? null } })
        : api('/products', { method: 'POST', body: { ...v, categoryId: v.categoryId || null, imageId: image?.id ?? null } }),
    { success: product ? 'Product updated' : 'Product added', invalidate: [['/products'], ['/categories'], ['/dashboard']], onSuccess: (p) => onDone(p) },
  );

  async function upload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      setImage(await api('/files', { method: 'POST', body: fd, query: { kind: 'PRODUCT_IMAGE' } }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  const margin = (() => {
    const c = Number(form.watch('purchasePrice'));
    const s = Number(form.watch('sellingPrice'));
    return c > 0 && s > 0 ? (((s - c) / s) * 100).toFixed(1) : null;
  })();

  return (
    <form
      onSubmit={form.handleSubmit(async (v) => {
        setError(null);
        await save.mutateAsync(v).catch((err) => setError(errorMessage(err)));
      })}
      className="space-y-5"
      noValidate
    >
      <FormError message={error} />
      <div className="flex gap-4">
        <label className="flex size-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed bg-muted/50 text-muted-foreground hover:bg-muted" title="Product photo">
          {image ? <img src={image.url} alt="" className="size-full object-cover" /> : <ImagePlus className="size-5" />}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(ev) => ev.target.files?.[0] && upload(ev.target.files[0])} disabled={uploading} />
        </label>
        <Field label="Product name" htmlFor="name" error={e.name?.message} className="flex-1">
          <Input id="name" autoFocus {...form.register('name')} aria-invalid={!!e.name} placeholder="e.g. Miniket Rice (25 kg bag)" />
          {image && (
            <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setImage(null)}>
              Remove photo
            </button>
          )}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="SKU" htmlFor="sku" error={e.sku?.message} hint={product ? undefined : 'Leave empty to generate one.'}>
          <Input id="sku" {...form.register('sku')} className="uppercase" />
        </Field>
        <Field label="Barcode" htmlFor="barcode" error={e.barcode?.message}>
          <Input id="barcode" inputMode="numeric" {...form.register('barcode')} />
        </Field>
        <Field label="Category" htmlFor="categoryId">
          <Select id="categoryId" {...form.register('categoryId')}>
            <option value="">No category</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Unit" htmlFor="unit" error={e.unit?.message}>
          <Input id="unit" list="units" {...form.register('unit')} />
          <datalist id="units">
            {PRODUCT_UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </Field>
      </div>
      <div className="grid gap-4 border-t pt-5 sm:grid-cols-3">
        <Field label="Purchase price" htmlFor="purchasePrice" error={e.purchasePrice?.message}>
          <Input id="purchasePrice" inputMode="decimal" className="num" {...form.register('purchasePrice')} aria-invalid={!!e.purchasePrice} />
        </Field>
        <Field label="Selling price" htmlFor="sellingPrice" error={e.sellingPrice?.message} hint={margin ? `Margin ${margin}%` : undefined}>
          <Input id="sellingPrice" inputMode="decimal" className="num" {...form.register('sellingPrice')} aria-invalid={!!e.sellingPrice} />
        </Field>
        <Field label="Tax %" htmlFor="taxRate" error={e.taxRate?.message}>
          <Input id="taxRate" inputMode="decimal" className="num" {...form.register('taxRate')} />
        </Field>
        {!product && (
          <Field label="Opening stock" htmlFor="openingStock" error={e.openingStock?.message} hint="Units on hand today.">
            <Input id="openingStock" inputMode="decimal" className="num" {...form.register('openingStock')} />
          </Field>
        )}
        <Field label="Low stock alert at" htmlFor="minStock" error={e.minStock?.message}>
          <Input id="minStock" inputMode="decimal" className="num" {...form.register('minStock')} />
        </Field>
      </div>
      <Field label="Notes" htmlFor="description">
        <Textarea id="description" rows={2} {...form.register('description')} />
      </Field>
      {product && <p className="text-xs text-muted-foreground">To change the quantity on hand, use a stock adjustment or record a purchase. Every change is kept in the stock history.</p>}
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="submit" loading={save.isPending || uploading}>
          {product ? 'Save changes' : 'Add product'}
        </Button>
      </div>
    </form>
  );
}

'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { customerSchema, supplierSchema } from '@hisabkhata/shared';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';

/** Customer or supplier details. Suppliers also have a company name. */
export function PartyForm({ kind, initial, onSubmit, pending }: { kind: 'customer' | 'supplier'; initial?: any; onSubmit: (v: any) => void; pending?: boolean }) {
  const form = useForm<any>({
    resolver: zodResolver(kind === 'supplier' ? supplierSchema : customerSchema),
    defaultValues: { name: initial?.name ?? '', company: initial?.company ?? '', phone: initial?.phone ?? '', email: initial?.email ?? '', address: initial?.address ?? '', notes: initial?.notes ?? '' },
  });
  const e = form.formState.errors as Record<string, { message?: string }>;
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Field label={kind === 'supplier' ? 'Contact name' : 'Name'} htmlFor="name" error={e.name?.message}>
        <Input id="name" autoFocus {...form.register('name')} />
      </Field>
      {kind === 'supplier' && (
        <Field label="Company" htmlFor="company">
          <Input id="company" {...form.register('company')} />
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mobile" htmlFor="phone" error={e.phone?.message} hint="01XXXXXXXXX or an international number with +">
          <Input id="phone" type="tel" {...form.register('phone')} />
        </Field>
        <Field label="Email" htmlFor="email" error={e.email?.message}>
          <Input id="email" type="email" {...form.register('email')} />
        </Field>
      </div>
      <Field label="Address" htmlFor="address">
        <Textarea id="address" rows={2} {...form.register('address')} />
      </Field>
      <Field label="Notes" htmlFor="notes">
        <Textarea id="notes" rows={2} {...form.register('notes')} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          {initial ? 'Save changes' : kind === 'supplier' ? 'Add supplier' : 'Add customer'}
        </Button>
      </div>
    </form>
  );
}

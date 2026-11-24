'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { categorySchema } from '@hisabkhata/shared';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';

/** Name + description form used for product and expense categories. */
export function NameForm({ initial, submitLabel, onSubmit, pending }: { initial?: { name: string; description?: string | null }; submitLabel: string; onSubmit: (v: { name: string; description?: string }) => void; pending?: boolean }) {
  const form = useForm<{ name: string; description?: string }>({ resolver: zodResolver(categorySchema), defaultValues: { name: initial?.name ?? '', description: initial?.description ?? '' } });
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Field label="Name" htmlFor="name" error={form.formState.errors.name?.message}>
        <Input id="name" autoFocus {...form.register('name')} />
      </Field>
      <Field label="Description (optional)" htmlFor="description">
        <Textarea id="description" rows={2} {...form.register('description')} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

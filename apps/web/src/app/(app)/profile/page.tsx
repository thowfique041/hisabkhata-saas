'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { toast } from 'sonner';
import { changePasswordSchema, updateProfileSchema } from '@hisabkhata/shared';
import { api, errorMessage } from '@/lib/api';
import { useAction, useApi } from '@/hooks/use-api';
import { PageHeader, Panel, TableSkeleton } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Input, PasswordInput } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Badge } from '@/components/ui/misc';

function ProfileForm({ p }: { p: any }) {
  const qc = useQueryClient();
  const form = useForm<{ name: string; phone?: string }>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name: p.name, phone: p.phone ?? '' },
  });
  const save = useAction((v: any) => api('/profile', { method: 'PUT', body: v }), {
    success: 'Profile saved',
    invalidate: [['/profile']],
    onSuccess: () => qc.invalidateQueries({ queryKey: ['session'] }),
  });
  async function avatar(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    try {
      await api('/files/avatar', { method: 'POST', body: fd });
      toast.success('Photo updated');
      qc.invalidateQueries();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }
  return (
    <form
      onSubmit={form.handleSubmit((v) => save.mutate(v))}
      method="post"
      className="space-y-4 p-4"
      noValidate
    >
      <div className="flex items-center gap-4">
        <span className="flex size-14 items-center justify-center overflow-hidden rounded-full bg-navy text-lg font-medium text-white">
          {p.avatarUrl ? (
            <img src={p.avatarUrl} alt="" className="size-full object-cover" />
          ) : (
            p.name[0]
          )}
        </span>
        <label className="cursor-pointer rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
          Change photo
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => e.target.files?.[0] && avatar(e.target.files[0])}
          />
        </label>
      </div>
      <Field label="Name" htmlFor="name" error={form.formState.errors.name?.message}>
        <Input id="name" {...form.register('name')} />
      </Field>
      <Field label="Email">
        <p className="flex items-center gap-2 text-sm">
          {p.email}{' '}
          {p.emailVerifiedAt ? (
            <Badge tone="positive">Verified</Badge>
          ) : (
            <Badge tone="warning">Not verified</Badge>
          )}
        </p>
      </Field>
      <Field label="Mobile" htmlFor="phone" error={form.formState.errors.phone?.message}>
        <Input id="phone" {...form.register('phone')} />
      </Field>
      <Button type="submit" loading={save.isPending}>
        Save profile
      </Button>
    </form>
  );
}

const pwSchema = changePasswordSchema
  .extend({ confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, {
    path: ['confirm'],
    message: 'Passwords do not match',
  });

function PasswordForm() {
  const router = useRouter();
  const form = useForm<z.infer<typeof pwSchema>>({
    resolver: zodResolver(pwSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });
  const save = useAction(
    (v: any) =>
      api('/auth/change-password', {
        method: 'POST',
        body: { currentPassword: v.currentPassword, newPassword: v.newPassword },
      }),
    {
      success: 'Password changed. Sign in again with your new password.',
      onSuccess: () => router.replace('/login'),
    },
  );
  const e = form.formState.errors;
  return (
    <form
      onSubmit={form.handleSubmit((v) => save.mutate(v))}
      method="post"
      className="space-y-4 p-4"
      noValidate
    >
      <Field label="Current password" htmlFor="currentPassword" error={e.currentPassword?.message}>
        <PasswordInput
          id="currentPassword"
          autoComplete="current-password"
          {...form.register('currentPassword')}
        />
      </Field>
      <Field label="New password" htmlFor="newPassword" error={e.newPassword?.message}>
        <PasswordInput
          id="newPassword"
          autoComplete="new-password"
          {...form.register('newPassword')}
        />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm" error={e.confirm?.message}>
        <PasswordInput id="confirm" autoComplete="new-password" {...form.register('confirm')} />
      </Field>
      <p className="text-xs text-muted-foreground">
        Changing your password signs you out on every device.
      </p>
      <Button type="submit" variant="outline" loading={save.isPending}>
        Change password
      </Button>
    </form>
  );
}

export default function ProfilePage() {
  const { data } = useApi<any>('/profile');
  return (
    <>
      <PageHeader
        title="Profile"
        description="Your personal details and password. These are shared across every business you belong to."
      />
      <div className="grid max-w-4xl gap-6 md:grid-cols-2">
        <Panel title="Your details">
          {data ? <ProfileForm p={data} /> : <TableSkeleton rows={3} cols={1} />}
        </Panel>
        <Panel title="Password">
          <PasswordForm />
        </Panel>
      </div>
    </>
  );
}

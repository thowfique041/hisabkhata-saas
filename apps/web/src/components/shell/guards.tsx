'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import type { Permission } from '@hisabkhata/shared';
import { useCan, useSession } from '@/hooks/use-session';
import { EmptyState } from '@/components/page';
import { LogoMark } from '@/components/logo';

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Loading">
      <LogoMark className="size-9 animate-pulse" />
    </div>
  );
}

/** Requires a signed-in user with an active business; otherwise routes to onboarding. */
export function TenantGate({ children }: { children: React.ReactNode }) {
  const { data, isLoading, isError } = useSession();
  const router = useRouter();
  React.useEffect(() => {
    if (isError) router.replace('/login');
    else if (data && !data.activeTenant) router.replace(data.user.isSuperAdmin && !data.tenants.length ? '/super-admin' : '/onboarding');
  }, [data, isError, router]);
  if (isLoading || !data?.activeTenant) return <FullScreenLoader />;
  return <>{children}</>;
}

export function SuperAdminGate({ children }: { children: React.ReactNode }) {
  const { data, isLoading, isError } = useSession();
  const router = useRouter();
  React.useEffect(() => {
    if (isError) router.replace('/login');
    else if (data && !data.user.isSuperAdmin) router.replace('/dashboard');
  }, [data, isError, router]);
  if (isLoading || !data?.user.isSuperAdmin) return <FullScreenLoader />;
  return <>{children}</>;
}

/** Page-level permission check. The API enforces the same rule; this avoids a page of errors. */
export function RequirePermission({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const can = useCan();
  if (!can(permission)) {
    return <EmptyState icon={Lock} title="You do not have access to this page" description="Ask the business owner to give your role this permission." />;
  }
  return <>{children}</>;
}

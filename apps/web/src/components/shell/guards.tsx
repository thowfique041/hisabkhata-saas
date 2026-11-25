'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import type { Permission } from '@hisabkhata/shared';
import { useCan, useSession } from '@/hooks/use-session';
import { isUnreachable } from '@/lib/api';
import { EmptyState } from '@/components/page';
import { LogoMark } from '@/components/logo';

function FullScreenLoader() {
  // Only explain the wait when it is long enough to notice: that is a sleeping API waking up.
  const [slow, setSlow] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setSlow(true), 5000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center"
      role="status"
      aria-label="Loading"
    >
      <LogoMark className="size-9 animate-pulse" />
      {slow && (
        <p className="max-w-xs text-sm text-muted-foreground">
          Starting the server. After a quiet spell this can take a minute or two.
        </p>
      )}
    </div>
  );
}

/** Requires a signed-in user with an active business; otherwise routes to onboarding. */
export function TenantGate({ children }: { children: React.ReactNode }) {
  const { data, isLoading, isError, error } = useSession();
  const router = useRouter();
  React.useEffect(() => {
    if (isError) router.replace(isUnreachable(error) ? '/login?offline=1' : '/login');
    else if (data && !data.activeTenant)
      router.replace(
        data.user.isSuperAdmin && !data.tenants.length ? '/super-admin' : '/onboarding',
      );
  }, [data, isError, error, router]);
  if (isLoading || !data?.activeTenant) return <FullScreenLoader />;
  return <>{children}</>;
}

export function SuperAdminGate({ children }: { children: React.ReactNode }) {
  const { data, isLoading, isError, error } = useSession();
  const router = useRouter();
  React.useEffect(() => {
    if (isError) router.replace(isUnreachable(error) ? '/login?offline=1' : '/login');
    else if (data && !data.user.isSuperAdmin) router.replace('/dashboard');
  }, [data, isError, error, router]);
  if (isLoading || !data?.user.isSuperAdmin) return <FullScreenLoader />;
  return <>{children}</>;
}

/** Page-level permission check. The API enforces the same rule; this avoids a page of errors. */
export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: React.ReactNode;
}) {
  const can = useCan();
  if (!can(permission)) {
    return (
      <EmptyState
        icon={Lock}
        title="You do not have access to this page"
        description="Ask the business owner to give your role this permission."
      />
    );
  }
  return <>{children}</>;
}

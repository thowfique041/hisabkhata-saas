'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Permission, SessionPayload } from '@hisabkhata/shared';
import { api } from '@/lib/api';

export function useSession() {
  return useQuery<SessionPayload>({ queryKey: ['session'], queryFn: () => api('/auth/session'), staleTime: 60_000, retry: false });
}

export function useCan() {
  const { data } = useSession();
  const set = new Set(data?.permissions ?? []);
  return (p: Permission) => set.has(p);
}

export function useSwitchTenant() {
  const qc = useQueryClient();
  return async (tenantId: string) => {
    await api('/auth/switch-tenant', { method: 'POST', body: { tenantId } });
    qc.clear();
    window.location.href = '/dashboard';
  };
}

'use client';
import * as React from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Paginated } from '@hisabkhata/shared';
import { api, errorMessage } from '@/lib/api';

export function useApi<T = any>(path: string | null, query?: Record<string, unknown>, opts: { enabled?: boolean } = {}) {
  return useQuery<T>({
    queryKey: [path, query ?? {}],
    queryFn: () => api<T>(path!, { query }),
    enabled: !!path && opts.enabled !== false,
    placeholderData: keepPreviousData,
  });
}

/** List state (page, search, filters) plus the paginated query. */
export function useList<T = any>(path: string, initial: Record<string, unknown> = {}) {
  const [params, setParams] = React.useState<Record<string, unknown>>({ page: 1, pageSize: 20, ...initial });
  const q = useApi<Paginated<T>>(path, params);
  const set = React.useCallback((patch: Record<string, unknown>) => setParams((p) => ({ ...p, page: 1, ...patch })), []);
  const setPage = React.useCallback((page: number) => setParams((p) => ({ ...p, page })), []);
  return { ...q, params, set, setPage };
}

/** Mutation with toast feedback and cache invalidation. */
export function useAction<TVars = any, TRes = any>(
  fn: (vars: TVars) => Promise<TRes>,
  opts: { success?: string | ((r: TRes) => string); invalidate?: QueryKey[]; onSuccess?: (r: TRes, v: TVars) => void } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (res, vars) => {
      if (opts.success) toast.success(typeof opts.success === 'function' ? opts.success(res) : opts.success);
      // Paths are the first element of every query key; invalidate by prefix.
      await Promise.all(
        (opts.invalidate ?? []).map((k) => qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).startsWith(String(k[0])) })),
      );
      opts.onSuccess?.(res, vars);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
}

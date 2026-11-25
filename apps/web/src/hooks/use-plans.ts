'use client';
import { useQuery } from '@tanstack/react-query';
import { STATIC_PLANS, toPublicPlan, type PublicPlan } from '@/config/plans';

async function fetchPlans(): Promise<PublicPlan[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5_000);
  try {
    const res = await fetch('/api/plans', { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`plans ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('no plans');
    return rows.map(toPublicPlan);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Plans for the marketing site. Always returns data: the static catalogue first, replaced by the
 * live list when the API answers within 5 seconds. A failed fetch keeps the static plans.
 */
export function usePlans() {
  const q = useQuery({
    queryKey: ['public-plans'],
    queryFn: fetchPlans,
    initialData: STATIC_PLANS,
    initialDataUpdatedAt: 0,
    staleTime: 10 * 60_000,
    retry: false,
  });
  return { plans: q.data ?? STATIC_PLANS, live: q.isSuccess && q.dataUpdatedAt > 0 };
}

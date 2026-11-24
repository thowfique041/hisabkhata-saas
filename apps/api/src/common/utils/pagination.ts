import type { Paginated } from '@hisabkhata/shared';

export function pageArgs(q: { page: number; pageSize: number }) {
  return { skip: (q.page - 1) * q.pageSize, take: q.pageSize };
}

export function paginated<T>(items: T[], total: number, q: { page: number; pageSize: number }): Paginated<T> {
  return { items, total, page: q.page, pageSize: q.pageSize, pageCount: Math.max(1, Math.ceil(total / q.pageSize)) };
}

/** Whitelist-based sort so clients cannot order by arbitrary columns. */
export function orderBy<T extends string>(
  sort: string | undefined,
  order: 'asc' | 'desc',
  allowed: readonly T[],
  fallback: T,
): Record<string, 'asc' | 'desc'> {
  const key = allowed.includes(sort as T) ? (sort as T) : fallback;
  return { [key]: order };
}

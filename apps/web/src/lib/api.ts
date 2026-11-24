import type { ApiErrorBody } from '@hisabkhata/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody & { code?: string; details?: { path: string; message: string }[] },
  ) {
    super(body?.message || `Request failed (${status})`);
  }
  get code() {
    return this.body?.code;
  }
}

function csrfToken(): string {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(/(?:^|;\s*)hk_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

export function hasSessionCookie(): boolean {
  return csrfToken() !== '';
}

let refreshing: Promise<boolean> | null = null;

/** One refresh at a time, shared by every request that hit a 401. */
async function refreshSession(): Promise<boolean> {
  refreshing ??= fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-CSRF-Token': csrfToken() },
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => setTimeout(() => (refreshing = null), 0));
  return refreshing;
}

type Options = {
  method?: string;
  body?: unknown;
  query?: Record<string, unknown>;
  raw?: boolean;
  retry?: boolean;
};

export function qs(query?: Record<string, unknown>) {
  if (!query) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    p.set(k, v instanceof Date ? v.toISOString() : String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export async function api<T = any>(path: string, opts: Options = {}): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && opts.body instanceof FormData;
  const res = await fetch(`/api${path}${qs(opts.query)}`, {
    method: opts.method ?? 'GET',
    credentials: 'include',
    headers: {
      ...(opts.body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.method && opts.method !== 'GET' ? { 'X-CSRF-Token': csrfToken() } : {}),
    },
    body:
      opts.body === undefined
        ? undefined
        : isForm
          ? (opts.body as FormData)
          : JSON.stringify(opts.body),
  });

  if (res.status === 401 && opts.retry !== false && !path.startsWith('/auth/')) {
    if (await refreshSession()) return api<T>(path, { ...opts, retry: false });
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    }
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({
      statusCode: res.status,
      error: res.statusText,
      // A non-JSON gateway error almost always means the API server is waking up from sleep.
      message:
        res.status >= 502 && res.status <= 504
          ? 'The server is starting up. Please try again in a minute.'
          : 'Something went wrong. Please try again.',
    }));
    throw new ApiError(res.status, body);
  }
  if (opts.raw) return res as unknown as T;
  if (res.status === 204) return undefined as T;
  const type = res.headers.get('content-type') ?? '';
  return (type.includes('application/json') ? res.json() : res.text()) as Promise<T>;
}

/** Downloads a file response (PDF, CSV) using the authenticated session. */
export async function download(
  path: string,
  query?: Record<string, unknown>,
  fallbackName = 'download',
) {
  const res = await api<Response>(path, { query, raw: true });
  const blob = await res.blob();
  const name =
    res.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function openPdf(path: string) {
  const win = window.open('', '_blank');
  const res = await api<Response>(path, { raw: true });
  const url = URL.createObjectURL(await res.blob());
  if (win) win.location.href = url;
  else window.location.href = url;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.body?.details?.length) return err.body.details.map((d) => d.message).join('. ');
    return err.message;
  }
  return 'Something went wrong. Check your connection and try again.';
}

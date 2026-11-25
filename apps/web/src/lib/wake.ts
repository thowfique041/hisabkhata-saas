/**
 * The API runs on a free Render instance that sleeps when idle, and Vercel's proxy gives up after
 * 30 seconds, which is shorter than a cold start. Instead of letting a form POST die in the proxy,
 * we wake the API with cheap health checks first and only send the real request once it answers.
 */

let awake = false;
let pending: Promise<boolean> | null = null;

async function ping(timeoutMs: number): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch('/api/health', { cache: 'no-store', signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** True once a health check has succeeded in this tab. */
export function isApiAwake() {
  return awake;
}

/** Starts waking the API without waiting. Safe to call many times. */
export function wakeApi() {
  void waitForApi();
}

/**
 * Resolves true as soon as the API answers a health check, or false after `maxMs`.
 * Render's free tier has been seen to need more than 90 s to wake, so the default is 3 minutes.
 * Concurrent callers share one polling loop.
 */
export function waitForApi(maxMs = 180_000): Promise<boolean> {
  if (awake) return Promise.resolve(true);
  if (typeof window === 'undefined') return Promise.resolve(false);
  pending ??= (async () => {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      if (await ping(Math.min(20_000, Math.max(1_000, deadline - Date.now())))) {
        awake = true;
        return true;
      }
      await new Promise((r) => setTimeout(r, 2_500));
    }
    return false;
  })().finally(() => {
    pending = null;
  });
  return pending;
}

/** Runs `fn` once the API is awake; `onWaiting` fires only if the caller actually has to wait. */
export async function whenApiReady<T>(
  fn: () => Promise<T>,
  onWaiting?: (waiting: boolean) => void,
): Promise<T> {
  if (!awake) {
    // Give an already-awake API a moment to answer before telling the user anything.
    const quick = await Promise.race([
      waitForApi(),
      new Promise<false>((r) => setTimeout(() => r(false), 1_200)),
    ]);
    if (!quick) {
      onWaiting?.(true);
      const ok = await waitForApi();
      onWaiting?.(false);
      if (!ok) throw new ServerAsleepError();
    }
  }
  return fn();
}

export class ServerAsleepError extends Error {
  constructor() {
    super('We could not reach the server. Check your connection and try again.');
  }
}

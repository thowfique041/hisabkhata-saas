'use client';
import * as React from 'react';

/**
 * Tiny localStorage-backed store with cross-tab sync. Reads never throw (private mode, quota,
 * disabled storage all fall back to the default) so the counter keeps working regardless.
 */
const listeners = new Set<() => void>();

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeLocal<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: keep working in memory for this render */
  }
  listeners.forEach((l) => l());
}

export function useLocalState<T>(
  key: string | null,
  fallback: T,
): [T, (v: T | ((prev: T) => T)) => void] {
  const cache = React.useRef<{ raw: string | null; value: T }>({ raw: null, value: fallback });
  const subscribe = React.useCallback(
    (cb: () => void) => {
      listeners.add(cb);
      const onStorage = (e: StorageEvent) => e.key === key && cb();
      window.addEventListener('storage', onStorage);
      return () => {
        listeners.delete(cb);
        window.removeEventListener('storage', onStorage);
      };
    },
    [key],
  );
  const getSnapshot = React.useCallback(() => {
    if (!key) return fallback;
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      raw = null;
    }
    // Return a stable reference while the stored JSON is unchanged.
    if (raw !== cache.current.raw)
      cache.current = { raw, value: raw === null ? fallback : read(key, fallback) };
    return cache.current.value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const value = React.useSyncExternalStore(subscribe, getSnapshot, () => fallback);
  const set = React.useCallback(
    (v: T | ((prev: T) => T)) => {
      if (!key) return;
      const next = typeof v === 'function' ? (v as (p: T) => T)(read(key, fallback)) : v;
      writeLocal(key, next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  return [value, set];
}

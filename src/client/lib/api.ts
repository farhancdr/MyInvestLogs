import { useCallback, useEffect, useState } from 'react';
import type { ApiResult, ApiError } from '@shared/types.ts';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  const body = (await res.json()) as ApiResult<T>;
  if (!body.ok) throw body.error;
  return body.data;
}

export const api = {
  get: <T,>(path: string, query?: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    return request<T>(qs ? `${path}?${qs}` : path);
  },
  post: <T,>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: <T,>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T,>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
};

export function isApiError(e: unknown): e is ApiError {
  return typeof e === 'object' && e !== null && 'code' in e && 'message' in e;
}

export function errorMessage(e: unknown): string {
  return isApiError(e) ? e.message : e instanceof Error ? e.message : 'Something went wrong.';
}

/** Minimal fetch-on-mount hook with a manual reload for post-write refresh. */
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetcher()
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(load, [load]);

  return { data, error, loading, reload: load };
}

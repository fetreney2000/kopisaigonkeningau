import { useCallback, useEffect, useRef, useState } from 'react';

/** Ralat API dengan kod status HTTP (contoh: 409 = kod QR lama tidak disimpan) */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // respons kosong
  }
  if (!res.ok) {
    // Sesi tidak sah / dibatalkan: beritahu App supaya kembali ke skrin log masuk
    if (res.status === 401) window.dispatchEvent(new Event('sg:unauthorized'));
    const msg = (body as { error?: string } | null)?.error ?? `Ralat ${res.status}`;
    throw new ApiError(msg, res.status);
  }
  return body as T;
}

export const api = {
  get: <T,>(url: string) => request<T>(url),
  post: <T,>(url: string, data: unknown) => request<T>(url, { method: 'POST', body: JSON.stringify(data) }),
  put: <T,>(url: string, data: unknown) => request<T>(url, { method: 'PUT', body: JSON.stringify(data) }),
  patch: <T,>(url: string, data: unknown) => request<T>(url, { method: 'PATCH', body: JSON.stringify(data) }),
  del: <T,>(url: string) => request<T>(url, { method: 'DELETE' }),
};

/** Hook data mudah: ambil JSON + muat semula secara manual */
export function useApi<T>(url: string): { data: T | null; loading: boolean; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const urlRef = useRef(url);
  urlRef.current = url;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .get<T>(urlRef.current)
      .then((d) => {
        if (alive) {
          setData(d);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : 'Ralat tidak diketahui');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [url, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, reload };
}

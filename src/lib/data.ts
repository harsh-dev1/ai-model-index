import { useEffect, useState } from 'react';
import type { IndexPayload, TrendsPayload } from './types.ts';

const base = import.meta.env.BASE_URL;

async function loadJson<T>(file: string): Promise<T> {
  const res = await fetch(`${base}data/${file}`);
  if (!res.ok) throw new Error(`Could not load ${file} (HTTP ${res.status})`);
  return (await res.json()) as T;
}

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

function useJson<T>(file: string): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: true });
  useEffect(() => {
    let live = true;
    loadJson<T>(file)
      .then((data) => live && setState({ data, error: null, loading: false }))
      .catch((err: Error) => live && setState({ data: null, error: err.message, loading: false }));
    return () => {
      live = false;
    };
  }, [file]);
  return state;
}

export const useIndex = () => useJson<IndexPayload>('index.json');
export const useTrends = () => useJson<TrendsPayload>('trends.json');

/** Days since an ISO timestamp, used for the staleness badge. */
export function ageInDays(iso: string): number {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return (Date.now() - t) / 86_400_000;
}

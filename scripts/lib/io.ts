import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const RAW_DIR = join(ROOT, 'data', 'raw');
export const HISTORY_DIR = join(ROOT, 'data', 'history');
export const OUT_DIR = join(ROOT, 'public', 'data');

/** UTC date stamp. Snapshots are keyed by day, so the timezone must not drift. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function writeJson(path: string, data: unknown): void {
  ensureDir(dirname(path));
  // Stable 2-space JSON keeps git diffs reviewable and byte-comparable across runs.
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

/**
 * Fetch with retry and exponential backoff.
 * Sources are public and unauthenticated, so transient failures are the normal
 * failure mode, not permanent ones.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  attempts = 4,
): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { 'user-agent': 'ai-model-index (+https://github.com/harsh-dev1/ai-model-index)', ...init.headers },
        signal: AbortSignal.timeout(90_000),
      });
      if (res.ok) return res;
      // 4xx other than 429 will not fix themselves; fail fast.
      if (res.status < 500 && res.status !== 429) {
        throw new Error(`${url} responded ${res.status}`);
      }
      lastError = new Error(`${url} responded ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 2 ** i * 1000));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetchWithRetry(url);
  return (await res.json()) as T;
}

/** Run tasks with bounded concurrency so we stay a polite client. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor;
      cursor += 1;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Minimal RFC-4180 CSV parser. Epoch's exports contain quoted fields with embedded
 * commas, quotes and newlines, so a naive split on ',' silently corrupts rows.
 */
export function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }

  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, i) => {
      obj[h] = (r[i] ?? '').trim();
    });
    return obj;
  });
}

/** Parse a number, treating blanks and the source's null markers as absent. */
export function num(value: string | undefined | null): number | null {
  if (value === undefined || value === null) return null;
  const t = value.trim();
  if (t === '' || t === 'NA' || t === 'N/A' || t === '-') return null;
  const n = Number(t.replace(/[$,%\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Most recent snapshot for a source, or null when none has ever been written.
 * This is what makes a source outage degrade rather than break the build.
 */
export function latestSnapshot<T>(source: string): { date: string; data: T } | null {
  const dir = join(RAW_DIR, source);
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
  const last = files.at(-1);
  if (!last) return null;
  return { date: last.slice(0, 10), data: readJson<T>(join(dir, last)) };
}

export function snapshotPath(source: string, date = today()): string {
  return join(RAW_DIR, source, `${date}.json`);
}

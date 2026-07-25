/**
 * Fetch every source and write one dated snapshot per source.
 *
 * Design rule: a source that fails must not fail the run. We fall back to the last
 * committed snapshot and mark it stale, so the site keeps building and the UI can tell
 * visitors exactly how old the number they are reading is.
 */
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { unzipSync } from 'fflate';
import { ALL_ARENA_BOARDS, BENCHMARKS } from './config/benchmarks.ts';
import {
  RAW_DIR,
  fetchJson,
  fetchWithRetry,
  latestSnapshot,
  mapLimit,
  num,
  parseCsv,
  snapshotPath,
  today,
  writeJson,
} from './lib/io.ts';

const EPOCH_ZIP = 'https://epoch.ai/data/benchmark_data.zip';
const ARENA_API = 'https://api.wulong.dev/arena-ai-leaderboards/v1/leaderboard';
const OPENROUTER_API = 'https://openrouter.ai/api/v1/models';

export interface EpochRow {
  model: string;
  score: number;
  stderr: number | null;
  releaseDate: string | null;
  organization: string | null;
  country: string | null;
}
export interface EpochSnapshot {
  fetchedAt: string;
  source: string;
  licence: string;
  benchmarks: Record<string, EpochRow[]>;
  eci: Array<{
    model: string;
    name: string;
    score: number | null;
    releaseDate: string | null;
    organization: string | null;
    country: string | null;
    accessibility: string | null;
  }>;
}

export interface ArenaModel {
  rank: number;
  model: string;
  vendor: string | null;
  license: string | null;
  score: number | null;
  ci: number | null;
  votes: number | null;
}
export interface ArenaSnapshot {
  fetchedAt: string;
  source: string;
  boards: Record<string, { lastUpdated: string | null; models: ArenaModel[] }>;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  created: number;
  contextLength: number | null;
  inputPerM: number | null;
  outputPerM: number | null;
  inputModalities: string[];
  outputModalities: string[];
  supportsReasoning: boolean;
}
export interface OpenRouterSnapshot {
  fetchedAt: string;
  source: string;
  models: OpenRouterModel[];
}

// ---------------------------------------------------------------------------

async function fetchEpoch(): Promise<EpochSnapshot> {
  const res = await fetchWithRetry(EPOCH_ZIP);
  const zip = unzipSync(new Uint8Array(await res.arrayBuffer()));
  const decoder = new TextDecoder('utf-8');

  const benchmarks: Record<string, EpochRow[]> = {};
  const missing: string[] = [];

  for (const cfg of BENCHMARKS) {
    const entry = zip[cfg.file];
    if (!entry) {
      missing.push(cfg.file);
      continue;
    }
    const rows = parseCsv(decoder.decode(entry));
    const parsed: EpochRow[] = [];
    for (const r of rows) {
      const score = num(r[cfg.scoreColumn]);
      if (score === null) continue;
      const model = r['Model version'];
      if (!model) continue;
      parsed.push({
        model,
        score,
        stderr: cfg.stderrColumn ? num(r[cfg.stderrColumn]) : null,
        releaseDate: r['Release date'] || null,
        organization: r['Organization'] || null,
        country: r['Country'] || null,
      });
    }
    benchmarks[cfg.id] = parsed;
  }

  // A renamed or withdrawn benchmark file must be loud, not silent.
  if (missing.length) {
    console.warn(`  ! epoch: ${missing.length} configured file(s) absent from the zip: ${missing.join(', ')}`);
  }

  const eciEntry = zip['epoch_capabilities_index.csv'];
  const eci: EpochSnapshot['eci'] = [];
  if (eciEntry) {
    for (const r of parseCsv(decoder.decode(eciEntry))) {
      const model = r['Model version'];
      if (!model) continue;
      eci.push({
        model,
        name: r['Display name'] || r['Model name'] || model,
        score: num(r['ECI Score']),
        releaseDate: r['Release date'] || null,
        organization: r['Organization'] || null,
        country: r['Country'] || null,
        accessibility: r['Model accessibility'] || null,
      });
    }
  }

  return {
    fetchedAt: new Date().toISOString(),
    source: 'https://epoch.ai/benchmarks',
    licence: 'CC-BY 4.0 — Epoch AI, "AI Benchmarking Hub"',
    benchmarks,
    eci,
  };
}

async function fetchArena(): Promise<ArenaSnapshot> {
  const boards: ArenaSnapshot['boards'] = {};
  await mapLimit(ALL_ARENA_BOARDS, 4, async (board) => {
    try {
      const d = await fetchJson<{
        meta: { last_updated?: string };
        models: ArenaModel[];
      }>(`${ARENA_API}?name=${board}`);
      boards[board] = { lastUpdated: d.meta?.last_updated ?? null, models: d.models ?? [] };
    } catch (err) {
      console.warn(`  ! arena board "${board}" failed: ${(err as Error).message}`);
    }
  });
  if (Object.keys(boards).length === 0) throw new Error('arena: every board failed');
  return {
    fetchedAt: new Date().toISOString(),
    source: 'https://arena.ai/leaderboard (via oolong-tea-2026/arena-ai-leaderboards)',
    boards,
  };
}

async function fetchOpenRouter(): Promise<OpenRouterSnapshot> {
  const d = await fetchJson<{ data: Array<Record<string, never>> }>(OPENROUTER_API);
  const models: OpenRouterModel[] = [];
  for (const raw of d.data as unknown as Array<{
    id: string;
    name: string;
    created: number;
    context_length: number | null;
    pricing?: { prompt?: string; completion?: string };
    architecture?: { input_modalities?: string[]; output_modalities?: string[] };
    supported_parameters?: string[];
    reasoning?: unknown;
  }>) {
    // OpenRouter quotes prices per token; the whole site talks in dollars per million.
    const prompt = num(raw.pricing?.prompt ?? null);
    const completion = num(raw.pricing?.completion ?? null);
    models.push({
      id: raw.id,
      name: raw.name,
      created: raw.created,
      contextLength: raw.context_length ?? null,
      inputPerM: prompt === null ? null : prompt * 1_000_000,
      outputPerM: completion === null ? null : completion * 1_000_000,
      inputModalities: raw.architecture?.input_modalities ?? [],
      outputModalities: raw.architecture?.output_modalities ?? [],
      supportsReasoning:
        raw.reasoning != null || (raw.supported_parameters ?? []).includes('reasoning'),
    });
  }
  return {
    fetchedAt: new Date().toISOString(),
    source: 'https://openrouter.ai/api/v1/models',
    models,
  };
}

// ---------------------------------------------------------------------------

async function run<T>(name: string, fn: () => Promise<T>): Promise<void> {
  const started = Date.now();
  try {
    const data = await fn();
    writeJson(snapshotPath(name), data);
    console.log(`  ✓ ${name}: snapshot written (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  } catch (err) {
    const prev = latestSnapshot(name);
    if (!prev) {
      throw new Error(`${name} failed and no previous snapshot exists`, { cause: err });
    }
    // Do not rewrite history: keep the old snapshot at its own date and let the
    // normaliser mark the source stale from the date alone.
    console.warn(`  ! ${name} failed (${(err as Error).message}); falling back to ${prev.date}`);
  }
}

/**
 * Keep a rolling audit window of raw snapshots rather than every day forever.
 * The long-term record lives in data/history/, which is compact; raw snapshots exist so
 * a published number can be re-derived from the exact bytes it came from, and 60 days is
 * a generous window for that.
 */
const RETENTION_DAYS = 60;
function prune(source: string): void {
  const dir = join(RAW_DIR, source);
  if (!existsSync(dir)) return;
  const files = readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
  for (const f of files.slice(0, Math.max(0, files.length - RETENTION_DAYS))) {
    rmSync(join(dir, f));
  }
}

const results = await Promise.allSettled([
  run('epoch', fetchEpoch),
  run('arena', fetchArena),
  run('openrouter', fetchOpenRouter),
]);

const failed = results.filter((r) => r.status === 'rejected');
if (failed.length === results.length) {
  console.error('All sources failed and none had a usable snapshot.');
  process.exit(1);
}
for (const f of failed) {
  console.error(`  ✗ ${(f as PromiseRejectedResult).reason}`);
}
for (const s of ['epoch', 'arena', 'openrouter']) prune(s);
console.log(`Snapshots for ${today()} complete (${results.length - failed.length}/${results.length} sources fresh).`);

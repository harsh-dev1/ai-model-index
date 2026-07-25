/**
 * Join the three source snapshots onto one canonical model per row.
 *
 * Output: data/normalized/models.json  — the joined but unscored dataset
 *         data/normalized/unmatched.json — everything that did NOT join, with a reason
 *
 * The unmatched file is not a debug artifact. It ships to the methodology page, because
 * a leaderboard that silently drops what it cannot match is a leaderboard that lies by
 * omission.
 */
import { join } from 'node:path';
import { ARENA_BOARDS, BENCHMARKS } from './config/benchmarks.ts';
import { HISTORY_DIR, ROOT, latestSnapshot, readJson, writeJson } from './lib/io.ts';
import { canonicalSlug, canonicalVendor, displayName, inferVendor } from '../src/lib/identity.ts';
import type { UnmatchedEntry } from '../src/lib/types.ts';
import type { ArenaSnapshot, EpochSnapshot, OpenRouterSnapshot } from './fetch-all.ts';

export interface JoinedBenchmark {
  id: string;
  raw: number;
  stderr: number | null;
}

export interface JoinedModel {
  slug: string;
  name: string;
  vendor: string;
  country: string | null;
  releaseDate: string | null;
  accessibility: string | null;
  eci: number | null;
  contextLength: number | null;
  inputPerM: number | null;
  outputPerM: number | null;
  modalities: string[];
  supportsReasoning: boolean;
  benchmarks: JoinedBenchmark[];
  arena: Array<{ board: string; elo: number; ci: number | null; votes: number | null; rank: number }>;
  sources: string[];
}

export interface NormalizedPayload {
  /** Derived from the sources, never the wall clock, so the build is reproducible. */
  generatedAt: string;
  snapshotDates: Record<string, string>;
  snapshotFetchedAt: Record<string, string>;
  models: JoinedModel[];
  unmatched: UnmatchedEntry[];
  stats: {
    epochModels: number;
    arenaModels: number;
    openrouterModels: number;
    joined: number;
    eligible: number;
    arenaMatchRate: number;
    arenaTopMatchRate: number;
  };
}

/** A model must be buyable and measured to enter the index. */
const MIN_BENCHMARKS = 3;

function requireSnapshot<T>(name: string): { date: string; data: T } {
  const snap = latestSnapshot<T>(name);
  if (!snap) throw new Error(`No snapshot for "${name}". Run "pnpm data:fetch" first.`);
  return snap;
}

const epochSnap = requireSnapshot<EpochSnapshot>('epoch');
const arenaSnap = requireSnapshot<ArenaSnapshot>('arena');
const orSnap = requireSnapshot<OpenRouterSnapshot>('openrouter');

type Draft = JoinedModel & { benchmarkMap: Map<string, JoinedBenchmark> };
const models = new Map<string, Draft>();

function draft(slug: string): Draft {
  let d = models.get(slug);
  if (!d) {
    d = {
      slug,
      name: slug,
      vendor: inferVendor(slug) ?? 'Unknown',
      country: null,
      releaseDate: null,
      accessibility: null,
      eci: null,
      contextLength: null,
      inputPerM: null,
      outputPerM: null,
      modalities: [],
      supportsReasoning: false,
      benchmarks: [],
      arena: [],
      sources: [],
      benchmarkMap: new Map(),
    };
    models.set(slug, d);
  }
  return d;
}

/** Drop the internal lookup map before a draft becomes a published record. */
function stripDraft(d: Draft): JoinedModel {
  const { benchmarkMap, ...rest } = d;
  void benchmarkMap;
  return rest;
}

function addSource(d: Draft, source: string) {
  if (!d.sources.includes(source)) d.sources.push(source);
}

// ---- Epoch: capability benchmarks + identity metadata ----------------------
// A source often reports several reasoning-effort configurations of one model
// ("_high", "_xhigh", "_max"). We keep the best, which is the convention every
// leaderboard uses, and record it on the methodology page.
for (const cfg of BENCHMARKS) {
  for (const row of epochSnap.data.benchmarks[cfg.id] ?? []) {
    const slug = canonicalSlug(row.model);
    if (!slug) continue;
    const d = draft(slug);
    addSource(d, 'epoch');
    const existing = d.benchmarkMap.get(cfg.id);
    if (!existing || row.score > existing.raw) {
      d.benchmarkMap.set(cfg.id, { id: cfg.id, raw: row.score, stderr: row.stderr });
    }
    if (row.releaseDate && (!d.releaseDate || row.releaseDate < d.releaseDate)) {
      d.releaseDate = row.releaseDate;
    }
    if (row.organization) d.vendor = canonicalVendor(row.organization);
    if (row.country) d.country = row.country;
  }
}

for (const row of epochSnap.data.eci) {
  const slug = canonicalSlug(row.model);
  if (!slug) continue;
  const d = models.get(slug);
  if (!d) continue; // ECI-only models carry no benchmark detail; skip rather than half-populate
  if (row.score !== null && (d.eci === null || row.score > d.eci)) d.eci = row.score;
  if (row.name && d.name === d.slug) d.name = row.name;
  if (row.organization) d.vendor = canonicalVendor(row.organization);
  if (row.country) d.country = row.country;
  if (row.accessibility) d.accessibility = row.accessibility;
  if (row.releaseDate && (!d.releaseDate || row.releaseDate < d.releaseDate)) {
    d.releaseDate = row.releaseDate;
  }
}

// ---- Arena: human preference ----------------------------------------------
const arenaSlugs = new Set<string>();
const arenaRaw = new Map<string, string>();
// Match rate is measured only against the language boards. The image and video boards
// list models (Veo, Flux, Sora) that an LLM benchmark hub and an LLM router will never
// contain, so counting them would understate the join for no reason.
const LANGUAGE_BOARDS = new Set(ARENA_BOARDS.map((b) => b.board));
const languageArenaSlugs = new Set<string>();
for (const [board, data] of Object.entries(arenaSnap.data.boards)) {
  for (const m of data.models) {
    const slug = canonicalSlug(m.model);
    if (!slug || m.score === null) continue;
    arenaSlugs.add(slug);
    if (LANGUAGE_BOARDS.has(board)) languageArenaSlugs.add(slug);
    arenaRaw.set(slug, m.model);
    const d = draft(slug);
    addSource(d, 'arena');
    const prev = d.arena.find((a) => a.board === board);
    if (!prev || m.score > prev.elo) {
      d.arena = d.arena.filter((a) => a.board !== board);
      d.arena.push({ board, elo: m.score, ci: m.ci, votes: m.votes, rank: m.rank });
    }
    if (m.vendor && d.vendor === 'Unknown') d.vendor = canonicalVendor(m.vendor);
  }
}

// ---- OpenRouter: price, context, modality ----------------------------------
const orSlugs = new Set<string>();
for (const m of orSnap.data.models) {
  const slug = canonicalSlug(m.id);
  if (!slug) continue;
  orSlugs.add(slug);
  const d = models.get(slug);
  // Do not create rows from OpenRouter alone: it lists hundreds of models nobody has
  // benchmarked, and an unmeasured model has nothing to rank.
  if (!d) continue;
  addSource(d, 'openrouter');
  // Cheapest listing wins — the same model is often served by several providers.
  if (m.inputPerM !== null && (d.inputPerM === null || m.inputPerM < d.inputPerM)) {
    d.inputPerM = m.inputPerM;
    d.outputPerM = m.outputPerM;
  }
  if (m.contextLength && (d.contextLength === null || m.contextLength > d.contextLength)) {
    d.contextLength = m.contextLength;
  }
  for (const mod of m.inputModalities) if (!d.modalities.includes(mod)) d.modalities.push(mod);
  if (m.supportsReasoning) d.supportsReasoning = true;
  if (d.name === d.slug && m.name) d.name = m.name.replace(/\s*\(.*?\)\s*$/, '');
}

// ---- Eligibility -----------------------------------------------------------
const unmatched: UnmatchedEntry[] = [];
const eligible: JoinedModel[] = [];

for (const d of models.values()) {
  const benchmarks = [...d.benchmarkMap.values()];
  const pillarsCovered = new Set(
    benchmarks.map((b) => BENCHMARKS.find((c) => c.id === b.id)?.pillar).filter(Boolean),
  );
  const model: JoinedModel = { ...stripDraft(d), benchmarks };

  const hasPrice = d.inputPerM !== null && d.outputPerM !== null;
  const measured = benchmarks.length >= MIN_BENCHMARKS && pillarsCovered.size >= 2;
  const voted = d.arena.some((a) => a.board === 'text');

  if (!hasPrice) {
    unmatched.push({
      source: d.sources.join('+') || 'unknown',
      raw: arenaRaw.get(d.slug) ?? d.slug,
      slug: d.slug,
      reason: 'no public API pricing found on OpenRouter',
    });
    continue;
  }
  if (!measured && !voted) {
    unmatched.push({
      source: d.sources.join('+'),
      raw: d.slug,
      slug: d.slug,
      reason: `too few results to rank (${benchmarks.length} benchmark${benchmarks.length === 1 ? '' : 's'}, no Arena votes)`,
    });
    continue;
  }
  eligible.push(model);
}

// Arena models that reached no other source at all — the honest "we could not place
// this model" list, reported on the methodology page.
let arenaMatched = 0;
for (const slug of languageArenaSlugs) {
  const d = models.get(slug);
  if (d && (d.sources.includes('epoch') || d.sources.includes('openrouter'))) arenaMatched += 1;
}
const arenaMatchRate = languageArenaSlugs.size ? arenaMatched / languageArenaSlugs.size : 0;

// The headline bar is about models people actually use, so measure the top of the board.
const textBoard = (arenaSnap.data.boards['text']?.models ?? [])
  .filter((m) => m.score !== null)
  .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  .slice(0, 50);
const topMatched = textBoard.filter((m) => {
  const d = models.get(canonicalSlug(m.model));
  return d && (d.sources.includes('epoch') || d.sources.includes('openrouter'));
}).length;
const arenaTopMatchRate = textBoard.length ? topMatched / textBoard.length : 0;

eligible.sort((a, b) => a.slug.localeCompare(b.slug));
unmatched.sort((a, b) => a.slug.localeCompare(b.slug));

// Tidy the labels, but never at the cost of telling two models apart: if stripping the
// run qualifier makes two distinct rows read the same, both keep their raw label.
const cleaned = new Map<string, string>();
const seen = new Map<string, number>();
for (const m of eligible) {
  const name = displayName(m.name, m.vendor) || m.name;
  cleaned.set(m.slug, name);
  seen.set(name, (seen.get(name) ?? 0) + 1);
}
for (const m of eligible) {
  const name = cleaned.get(m.slug)!;
  if ((seen.get(name) ?? 0) === 1) m.name = name;
}

// Deterministic build stamp: the freshest source timestamp, not the time the script ran.
// Done-bar #9 requires that re-running the pipeline on committed inputs reproduces the
// published files byte for byte, and a wall-clock field would break that every time.
const snapshotFetchedAt = {
  epoch: epochSnap.data.fetchedAt,
  arena: arenaSnap.data.fetchedAt,
  openrouter: orSnap.data.fetchedAt,
};
const payload: NormalizedPayload = {
  generatedAt: Object.values(snapshotFetchedAt).sort().at(-1) ?? '',
  snapshotDates: { epoch: epochSnap.date, arena: arenaSnap.date, openrouter: orSnap.date },
  snapshotFetchedAt,
  models: eligible,
  unmatched,
  stats: {
    epochModels: new Set(
      Object.values(epochSnap.data.benchmarks).flat().map((r) => canonicalSlug(r.model)),
    ).size,
    arenaModels: languageArenaSlugs.size,
    openrouterModels: orSlugs.size,
    joined: models.size,
    eligible: eligible.length,
    arenaMatchRate,
    arenaTopMatchRate,
  },
};

writeJson(join(ROOT, 'data', 'normalized', 'models.json'), payload);
writeJson(join(ROOT, 'data', 'normalized', 'unmatched.json'), unmatched);

console.log(`Joined ${models.size} distinct models from 3 sources.`);
console.log(`  eligible for the index : ${eligible.length}`);
console.log(`  arena match rate       : ${(arenaMatchRate * 100).toFixed(0)}% overall, ${(arenaTopMatchRate * 100).toFixed(0)}% of the Arena top 50`);
console.log(`  excluded (with reasons): ${unmatched.length}`);

// Done-bar #5: a drop in match rate means a naming convention changed upstream and the
// index is quietly losing models. That must break the build, not degrade in silence.
const BAR = 0.95;
if (arenaTopMatchRate < BAR) {
  console.error(
    `\nFAIL: only ${(arenaTopMatchRate * 100).toFixed(0)}% of the Arena top 50 matched another source (bar: ${BAR * 100}%).`,
  );
  console.error('A new model or a renamed one is probably missing an alias rule in src/lib/identity.ts.');
  process.exit(1);
}

// Keep the history file fresh for the trend charts.
if (!readJsonSafe(join(HISTORY_DIR, 'arena.json'))) {
  console.log('\nNote: no Arena history yet — run "pnpm data:backfill" to load the archive.');
}

function readJsonSafe(path: string): unknown {
  try {
    return readJson(path);
  } catch {
    return null;
  }
}

/**
 * Turn the joined dataset into the published index.
 *
 * Deterministic by construction: same inputs in, byte-identical outputs out. CI asserts
 * this (done-bar #9), because an index a stranger cannot re-derive is an opinion wearing
 * a lab coat.
 */
import { join } from 'node:path';
import { ARENA_BOARDS, BENCHMARKS } from './config/benchmarks.ts';
import { OUT_DIR, ROOT, readJson, writeJson } from './lib/io.ts';
import { normaliseValues, rankModels, round } from '../src/lib/scoring.ts';
import { DEFAULT_WEIGHTS, PILLARS } from '../src/lib/types.ts';
import type {
  BenchmarkScore,
  IndexPayload,
  ModelRecord,
  PillarId,
  SourceMeta,
  TrendsPayload,
} from '../src/lib/types.ts';
import type { NormalizedPayload } from './normalize.ts';

const norm = readJson<NormalizedPayload>(join(ROOT, 'data', 'normalized', 'models.json'));
const models = norm.models;

function formatValue(raw: number, unit: string): string {
  switch (unit) {
    case 'fraction':
      return `${(raw * 100).toFixed(1)}%`;
    case 'percent':
      return `${raw.toFixed(1)}%`;
    case 'elo':
      return raw.toFixed(0);
    case 'minutes':
      return raw >= 60 ? `${(raw / 60).toFixed(1)} h` : `${raw.toFixed(0)} min`;
    default:
      return raw.toFixed(2);
  }
}

// ---- Normalise each benchmark across the eligible set ----------------------
const benchmarkNormalisers = new Map<string, (v: number) => number>();
for (const cfg of BENCHMARKS) {
  const values = models
    .map((m) => m.benchmarks.find((b) => b.id === cfg.id)?.raw)
    .filter((v): v is number => v !== undefined);
  benchmarkNormalisers.set(cfg.id, normaliseValues(values, { logScale: cfg.logScale }));
}

// ---- Normalise each Arena board -------------------------------------------
const arenaNormalisers = new Map<string, (v: number) => number>();
for (const { board } of ARENA_BOARDS) {
  const values = models
    .map((m) => m.arena.find((a) => a.board === board)?.elo)
    .filter((v): v is number => v !== undefined);
  arenaNormalisers.set(board, normaliseValues(values));
}

// ---- Normalise cost --------------------------------------------------------
// A 3:1 input:output blend approximates a typical workload far better than either price
// alone. Log scale, because the step from $1 to $10 changes what you can build; the step
// from $60 to $70 does not.
function blended(m: (typeof models)[number]): number | null {
  if (m.inputPerM === null || m.outputPerM === null) return null;
  return (m.inputPerM * 3 + m.outputPerM) / 4;
}
const costValues = models.map(blended).filter((v): v is number => v !== null && v > 0);
const costNormaliser = normaliseValues(costValues, { logScale: true, invert: true });

// ---- Build the records -----------------------------------------------------
const records: ModelRecord[] = models.map((m) => {
  const benchmarks: BenchmarkScore[] = [];
  for (const b of m.benchmarks) {
    const cfg = BENCHMARKS.find((c) => c.id === b.id);
    if (!cfg) continue;
    benchmarks.push({
      id: cfg.id,
      label: cfg.label,
      pillar: cfg.pillar,
      raw: b.raw,
      display: formatValue(b.raw, cfg.unit),
      normalised: round(benchmarkNormalisers.get(cfg.id)!(b.raw), 1),
      stderr: b.stderr,
      sourceUrl: 'https://epoch.ai/benchmarks',
    });
  }
  benchmarks.sort((a, b) => a.label.localeCompare(b.label));

  const pillarScores: Partial<Record<PillarId, number>> = {};
  const pillarCoverage: Partial<Record<PillarId, number>> = {};

  for (const pillar of PILLARS) {
    if (pillar.id === 'preference' || pillar.id === 'cost') continue;
    const inPillar = benchmarks.filter((b) => b.pillar === pillar.id);
    if (inPillar.length === 0) continue;
    pillarScores[pillar.id] = round(
      inPillar.reduce((s, b) => s + b.normalised, 0) / inPillar.length,
      1,
    );
    pillarCoverage[pillar.id] = inPillar.length;
  }

  // Human preference: weighted across boards the model actually appears on.
  let prefWeighted = 0;
  let prefWeight = 0;
  for (const { board, weight } of ARENA_BOARDS) {
    const entry = m.arena.find((a) => a.board === board);
    if (!entry) continue;
    prefWeighted += arenaNormalisers.get(board)!(entry.elo) * weight;
    prefWeight += weight;
  }
  if (prefWeight > 0) {
    pillarScores.preference = round(prefWeighted / prefWeight, 1);
    pillarCoverage.preference = m.arena.filter((a) =>
      ARENA_BOARDS.some((b) => b.board === a.board),
    ).length;
  }

  const cost = blended(m);
  if (cost !== null && cost > 0) {
    pillarScores.cost = round(costNormaliser(cost), 1);
    pillarCoverage.cost = 1;
  }

  return {
    slug: m.slug,
    name: m.name,
    vendor: m.vendor,
    country: m.country,
    releaseDate: m.releaseDate,
    accessibility: m.accessibility,
    contextLength: m.contextLength,
    modalities: [...m.modalities].sort(),
    supportsReasoning: m.supportsReasoning,
    pricing:
      m.inputPerM !== null && m.outputPerM !== null
        ? {
            inputPerM: round(m.inputPerM, 4),
            outputPerM: round(m.outputPerM, 4),
            blendedPerM: round(cost ?? 0, 4),
          }
        : null,
    benchmarks,
    arena: [...m.arena].sort((a, b) => a.board.localeCompare(b.board)),
    eci: m.eci,
    sources: [...m.sources].sort(),
    pillarScores,
    pillarCoverage,
    score: 0,
    rank: 0,
    scoreUncertainty: 0,
  } satisfies ModelRecord;
});

/**
 * Standardise each pillar to a common mean and spread.
 *
 * Without this the index has a bias that is easy to miss and hard to defend: the Arena
 * boards produce a much lower average pillar score than the benchmark pillars (observed
 * mean ~29 against ~48), so a model that *is* measured on Arena scored worse than an
 * otherwise identical model that simply was not listed, whose 20% preference weight got
 * redistributed to pillars where it scored higher. Being measured must never be a
 * penalty. After this pass every pillar contributes on the same scale, so a missing
 * pillar is neutral in expectation rather than a quiet bonus.
 */
const PILLAR_TARGET_MEAN = 50;
const PILLAR_TARGET_SD = 18;
for (const pillar of PILLARS) {
  const values = records
    .map((r) => r.pillarScores[pillar.id])
    .filter((v): v is number => v !== undefined);
  if (values.length < 2) continue;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
  if (sd < 1e-6) continue;
  for (const r of records) {
    const v = r.pillarScores[pillar.id];
    if (v === undefined) continue;
    const scaled = PILLAR_TARGET_MEAN + ((v - mean) / sd) * PILLAR_TARGET_SD;
    r.pillarScores[pillar.id] = round(Math.min(100, Math.max(0, scaled)), 1);
  }
}

const ranked = rankModels(records, DEFAULT_WEIGHTS);

const sources: SourceMeta[] = [
  {
    id: 'epoch',
    label: 'Epoch AI — AI Benchmarking Hub',
    url: 'https://epoch.ai/benchmarks',
    licence: 'CC-BY 4.0',
    fetchedAt: norm.snapshotFetchedAt.epoch,
    records: norm.stats.epochModels,
    stale: isStale(norm.snapshotDates.epoch),
  },
  {
    id: 'arena',
    label: 'Arena AI leaderboards',
    url: 'https://arena.ai/leaderboard',
    licence: 'Public leaderboard data, via the arena-ai-leaderboards archive',
    fetchedAt: norm.snapshotFetchedAt.arena,
    records: norm.stats.arenaModels,
    stale: isStale(norm.snapshotDates.arena),
  },
  {
    id: 'openrouter',
    label: 'OpenRouter model catalogue',
    url: 'https://openrouter.ai/api/v1/models',
    licence: 'Public API',
    fetchedAt: norm.snapshotFetchedAt.openrouter,
    records: norm.stats.openrouterModels,
    stale: isStale(norm.snapshotDates.openrouter),
  },
];

/** A snapshot older than two days means the scheduled refresh has been failing. */
function isStale(date: string): boolean {
  const age = (Date.now() - new Date(`${date}T00:00:00Z`).getTime()) / 86_400_000;
  return age > 2;
}

const payload: IndexPayload = {
  meta: {
    generatedAt: norm.generatedAt,
    sources,
    eligibleModels: ranked.length,
    totalModelsSeen: norm.stats.joined,
    unmatched: norm.unmatched,
    matchRate: round(norm.stats.arenaTopMatchRate, 4),
    benchmarkCount: BENCHMARKS.length,
  },
  pillars: PILLARS,
  models: ranked,
};

writeJson(join(OUT_DIR, 'index.json'), payload);

// ---- Trends ----------------------------------------------------------------
// Only ship series for models that are actually in the index, and only where there are
// enough points to draw a line worth looking at.
const MIN_POINTS = 4;
try {
  const history = readJson<{
    boards: Record<
      string,
      { dates: string[]; series: Record<string, { name: string; vendor: string; elo: Array<number | null> }> }
    >;
  }>(join(ROOT, 'data', 'history', 'arena.json'));

  const inIndex = new Map(ranked.map((m) => [m.slug, m]));
  const series: TrendsPayload['series'] = [];
  let firstDate = '9999';
  let lastDate = '0000';

  for (const [board, bucket] of Object.entries(history.boards)) {
    for (const [slug, s] of Object.entries(bucket.series)) {
      const model = inIndex.get(slug);
      if (!model) continue;
      const points = bucket.dates
        .map((date, i) => ({ date, elo: s.elo[i] }))
        .filter((p): p is { date: string; elo: number } => p.elo !== null && p.elo !== undefined);
      if (points.length < MIN_POINTS) continue;
      if (points[0].date < firstDate) firstDate = points[0].date;
      if (points[points.length - 1].date > lastDate) lastDate = points[points.length - 1].date;
      series.push({ slug, name: model.name, vendor: model.vendor, board, points });
    }
  }

  series.sort((a, b) => a.board.localeCompare(b.board) || a.slug.localeCompare(b.slug));
  const trends: TrendsPayload = {
    generatedAt: payload.meta.generatedAt,
    firstDate,
    lastDate,
    series,
  };
  writeJson(join(OUT_DIR, 'trends.json'), trends);
  const totalPoints = series.reduce((s, x) => s + x.points.length, 0);
  console.log(
    `Trends: ${series.length} series, ${totalPoints} points, ${firstDate} → ${lastDate}.`,
  );
} catch {
  console.warn('No Arena history found — run "pnpm data:backfill" to enable trend charts.');
  writeJson(join(OUT_DIR, 'trends.json'), {
    generatedAt: payload.meta.generatedAt,
    firstDate: '',
    lastDate: '',
    series: [],
  } satisfies TrendsPayload);
}

console.log(`Scored ${ranked.length} models across ${BENCHMARKS.length} benchmarks + ${ARENA_BOARDS.length} Arena boards.`);
console.log('\nTop 12 under the default weights:\n');
console.log('  #   score ±band   model                              vendor');
let lastGroup = 0;
for (const m of ranked.slice(0, 12)) {
  if (lastGroup && m.tieGroup !== lastGroup) console.log('  ---');
  lastGroup = m.tieGroup;
  console.log(
    `  ${String(m.rank).padStart(2)}  ${m.score.toFixed(1).padStart(5)} ±${m.scoreUncertainty.toFixed(1)}   ${m.name.slice(0, 34).padEnd(34)} ${m.vendor}`,
  );
}
console.log(
  `\nRows between dividers are statistical ties — their uncertainty bands overlap, so ordering within a block is not a real ranking. ${new Set(ranked.map((m) => m.tieGroup)).size} distinct tiers across ${ranked.length} models.`,
);

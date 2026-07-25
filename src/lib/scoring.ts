import type { ModelRecord, PillarId, Weights } from './types.ts';
import { PILLARS } from './types.ts';

/**
 * Scoring lives in one pure module so the number the build publishes and the number the
 * browser recomputes when you drag a slider come from exactly the same code. If they
 * could drift, the sliders would quietly be lying.
 */

/** Percentile of a sorted ascending array, linearly interpolated. */
export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const idx = (sortedAsc.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo);
}

/**
 * Map raw benchmark values onto 0-100 across the eligible set.
 *
 * Winsorised min-max rather than percentile rank: percentile rank would say a model is
 * "in the top 5%" but throw away *by how much*, and on benchmarks that are still far
 * from saturated the margin is the whole story.
 *
 * Clipping uses Tukey fences (quartiles ± 1.5·IQR) snapped to the nearest real
 * observation, not a fixed p2/p98. On a benchmark with only a handful of models a
 * percentile cut sits right next to the outlier and does nothing, so a single absurd
 * value — a dollar-denominated score, a broken row — would squash the entire real field
 * into the bottom of the range.
 */
export function normaliseValues(
  values: number[],
  opts: { logScale?: boolean; invert?: boolean } = {},
): (value: number) => number {
  const transform = (v: number) => (opts.logScale ? Math.log10(Math.max(v, 1e-6)) : v);
  const transformed = values.map(transform).filter((v) => Number.isFinite(v));
  if (transformed.length === 0) return () => 0;

  const sorted = [...transformed].sort((a, b) => a - b);
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  const iqr = q3 - q1;
  const lowFence = q1 - 1.5 * iqr;
  const highFence = q3 + 1.5 * iqr;
  // Snap the bounds inwards to the most extreme values that are not outliers.
  const lo = sorted.find((v) => v >= lowFence) ?? sorted[0];
  const hi = [...sorted].reverse().find((v) => v <= highFence) ?? sorted[sorted.length - 1];
  const span = hi - lo;

  return (value: number) => {
    const t = transform(value);
    if (!Number.isFinite(t)) return 0;
    if (span <= 0) return 50; // every model scored identically — say so, don't invent spread
    const clipped = Math.min(Math.max(t, lo), hi);
    const scaled = ((clipped - lo) / span) * 100;
    return opts.invert ? 100 - scaled : scaled;
  };
}

/** Uncertainty assumed for a benchmark whose source publishes no standard error. */
const DEFAULT_PILLAR_SD = 3;
/** Uncertainty added for a pillar we have no measurement for at all. */
const MISSING_PILLAR_SD = 18;

export interface ScoredModel extends ModelRecord {
  score: number;
  rank: number;
  scoreUncertainty: number;
  /** Ranks sharing a tie group have overlapping uncertainty bands. */
  tieGroup: number;
  /** Fraction of total weight backed by real measurements, 0-1. */
  coverage: number;
}

export function normaliseWeights(weights: Weights): Weights {
  const total = PILLARS.reduce((sum, p) => sum + (weights[p.id] ?? 0), 0);
  if (total <= 0) {
    // Refuse to divide by zero; fall back to equal weighting.
    const equal = 100 / PILLARS.length;
    return Object.fromEntries(PILLARS.map((p) => [p.id, equal])) as Weights;
  }
  return Object.fromEntries(
    PILLARS.map((p) => [p.id, ((weights[p.id] ?? 0) / total) * 100]),
  ) as Weights;
}

/**
 * Rank models under a given set of weights.
 *
 * Models missing a pillar have that pillar's weight redistributed across the pillars
 * they do have — but they also take an uncertainty penalty for it, so a model that wins
 * on thin coverage shows a wide band and ties with the models it "beat" rather than
 * quietly claiming the top spot.
 */
export function rankModels(models: ModelRecord[], weights: Weights): ScoredModel[] {
  const w = normaliseWeights(weights);

  const scored = models.map((m) => {
    let weighted = 0;
    let availableWeight = 0;
    let variance = 0;
    let missingWeight = 0;

    for (const pillar of PILLARS) {
      const pw = w[pillar.id];
      if (pw <= 0) continue;
      const value = m.pillarScores[pillar.id];
      if (value === undefined || !Number.isFinite(value)) {
        missingWeight += pw;
        continue;
      }
      weighted += value * pw;
      availableWeight += pw;
      const n = m.pillarCoverage[pillar.id] ?? 1;
      // More benchmarks behind a pillar means a tighter estimate of it.
      const sd = DEFAULT_PILLAR_SD / Math.sqrt(Math.max(n, 1));
      variance += (pw / 100) ** 2 * sd ** 2;
    }

    const totalWeight = availableWeight + missingWeight;
    const score = availableWeight > 0 ? weighted / availableWeight : 0;
    variance += (missingWeight / 100) ** 2 * MISSING_PILLAR_SD ** 2;

    return {
      ...m,
      score: round(score, 2),
      scoreUncertainty: round(Math.sqrt(variance), 2),
      coverage: totalWeight > 0 ? availableWeight / totalWeight : 0,
      rank: 0,
      tieGroup: 0,
    } satisfies ScoredModel;
  });

  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  // Assign ranks, then group models whose uncertainty bands overlap the group leader's.
  let tieGroup = 0;
  let leader: ScoredModel | null = null;
  scored.forEach((m, i) => {
    m.rank = i + 1;
    if (
      leader === null ||
      leader.score - leader.scoreUncertainty > m.score + m.scoreUncertainty
    ) {
      tieGroup += 1;
      leader = m;
    }
    m.tieGroup = tieGroup;
  });

  return scored;
}

export function round(value: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

/** Pillar a model is unusually strong at, relative to its own average. Used for labels. */
export function standoutPillar(m: ModelRecord): PillarId | null {
  const entries = Object.entries(m.pillarScores) as Array<[PillarId, number]>;
  if (entries.length < 2) return null;
  const mean = entries.reduce((s, [, v]) => s + v, 0) / entries.length;
  let best: [PillarId, number] | null = null;
  for (const e of entries) if (!best || e[1] - mean > best[1] - mean) best = e;
  return best && best[1] - mean > 8 ? best[0] : null;
}

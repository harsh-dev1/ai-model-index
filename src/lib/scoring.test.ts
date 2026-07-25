import { describe, expect, it } from 'vitest';
import { normaliseValues, normaliseWeights, percentile, rankModels, round } from './scoring.ts';
import type { ModelRecord, Weights } from './types.ts';
import { DEFAULT_WEIGHTS } from './types.ts';

function model(name: string, pillars: Partial<ModelRecord['pillarScores']>, coverage = 3): ModelRecord {
  return {
    slug: name,
    name,
    vendor: 'Test',
    country: null,
    releaseDate: null,
    accessibility: null,
    contextLength: null,
    modalities: [],
    supportsReasoning: false,
    pricing: null,
    benchmarks: [],
    arena: [],
    eci: null,
    sources: ['epoch'],
    pillarScores: pillars,
    pillarCoverage: Object.fromEntries(Object.keys(pillars).map((k) => [k, coverage])),
    score: 0,
    rank: 0,
    scoreUncertainty: 0,
  };
}

describe('percentile', () => {
  it('interpolates', () => {
    expect(percentile([0, 10], 0.5)).toBe(5);
    expect(percentile([0, 5, 10], 0)).toBe(0);
    expect(percentile([0, 5, 10], 1)).toBe(10);
  });
  it('survives degenerate input', () => {
    expect(percentile([], 0.5)).toBe(0);
    expect(percentile([7], 0.9)).toBe(7);
  });
});

describe('normaliseValues', () => {
  it('maps the range onto 0-100', () => {
    const f = normaliseValues([0, 25, 50, 75, 100]);
    expect(f(0)).toBeCloseTo(0, 1);
    expect(f(100)).toBeCloseTo(100, 1);
    expect(f(50)).toBeCloseTo(50, 1);
  });

  it('inverts for metrics where lower is better', () => {
    const f = normaliseValues([1, 10, 100], { invert: true, logScale: true });
    expect(f(1)).toBeGreaterThan(f(100));
  });

  it('clips outliers instead of letting them flatten the field', () => {
    // One absurd value must not push the rest of the field into the bottom few points.
    const values = [1, 2, 3, 4, 5, 1_000_000];
    const f = normaliseValues(values);
    expect(f(5)).toBeGreaterThan(60);
  });

  it('returns a neutral 50 when every model scored the same', () => {
    const f = normaliseValues([7, 7, 7, 7]);
    expect(f(7)).toBe(50);
  });

  it('handles an empty set', () => {
    expect(normaliseValues([])(5)).toBe(0);
  });
});

describe('normaliseWeights', () => {
  it('rescales to sum to 100', () => {
    const w = normaliseWeights({ reasoning: 1, coding: 1, preference: 1, agentic: 1, cost: 1 });
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
  });

  it('falls back to equal weights rather than dividing by zero', () => {
    const w = normaliseWeights({ reasoning: 0, coding: 0, preference: 0, agentic: 0, cost: 0 });
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
    expect(w.reasoning).toBeCloseTo(20, 6);
  });
});

describe('rankModels', () => {
  const full = { reasoning: 90, coding: 90, preference: 90, agentic: 90, cost: 90 };

  it('ranks higher scores first', () => {
    const out = rankModels(
      [model('low', { ...full, reasoning: 10 }), model('high', full)],
      DEFAULT_WEIGHTS,
    );
    expect(out[0].name).toBe('high');
    expect(out[0].rank).toBe(1);
  });

  it('responds to weights — the sliders must actually change the answer', () => {
    const cheap = model('cheap', { reasoning: 40, coding: 40, preference: 40, agentic: 40, cost: 100 });
    const smart = model('smart', { reasoning: 95, coding: 95, preference: 95, agentic: 95, cost: 5 });
    const byCapability = rankModels([cheap, smart], {
      reasoning: 40, coding: 30, preference: 5, agentic: 25, cost: 0,
    } as Weights);
    const byValue = rankModels([cheap, smart], {
      reasoning: 5, coding: 5, preference: 5, agentic: 5, cost: 80,
    } as Weights);
    expect(byCapability[0].name).toBe('smart');
    expect(byValue[0].name).toBe('cheap');
  });

  it('puts models with overlapping uncertainty in the same tie group', () => {
    const out = rankModels([model('a', full), model('b', { ...full, reasoning: 89.9 })], DEFAULT_WEIGHTS);
    expect(out[0].tieGroup).toBe(out[1].tieGroup);
  });

  it('separates models that are genuinely far apart', () => {
    const out = rankModels([model('a', full), model('b', { reasoning: 5, coding: 5, preference: 5, agentic: 5, cost: 5 })], DEFAULT_WEIGHTS);
    expect(out[0].tieGroup).not.toBe(out[1].tieGroup);
  });

  it('penalises thin coverage with a wider band', () => {
    const wide = rankModels([model('thin', { reasoning: 90 })], DEFAULT_WEIGHTS)[0];
    const tight = rankModels([model('full', full)], DEFAULT_WEIGHTS)[0];
    expect(wide.scoreUncertainty).toBeGreaterThan(tight.scoreUncertainty);
    expect(wide.coverage).toBeLessThan(tight.coverage);
  });

  it('is deterministic, including for exact score ties', () => {
    const models = [model('zebra', full), model('alpha', full)];
    const a = rankModels(models, DEFAULT_WEIGHTS).map((m) => m.name);
    const b = rankModels([...models].reverse(), DEFAULT_WEIGHTS).map((m) => m.name);
    expect(a).toEqual(b);
    expect(a[0]).toBe('alpha');
  });

  it('handles an empty model list', () => {
    expect(rankModels([], DEFAULT_WEIGHTS)).toEqual([]);
  });
});

describe('round', () => {
  it('rounds to the requested precision', () => {
    expect(round(1.23456, 2)).toBe(1.23);
    expect(round(1.005, 2)).toBe(1.0);
  });
});

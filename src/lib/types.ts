export type PillarId = 'reasoning' | 'coding' | 'agentic' | 'preference' | 'cost';

export interface Pillar {
  id: PillarId;
  label: string;
  blurb: string;
  defaultWeight: number;
}

/** Weights are percentages that sum to 100. */
export type Weights = Record<PillarId, number>;

export interface BenchmarkScore {
  /** Benchmark id, e.g. "gpqa_diamond". */
  id: string;
  label: string;
  pillar: PillarId;
  /** Raw value exactly as published by the source. */
  raw: number;
  /** Raw value rendered for humans, with the source's own units. */
  display: string;
  /** 0-100 after normalisation across the eligible set. */
  normalised: number;
  /** Standard error where the source publishes one. */
  stderr: number | null;
  sourceUrl: string;
}

export interface ArenaScore {
  board: string;
  elo: number;
  ci: number | null;
  votes: number | null;
  rank: number;
}

export interface Pricing {
  /** USD per million tokens. */
  inputPerM: number;
  outputPerM: number;
  /** 3:1 input:output weighted blend, the shape of most real workloads. */
  blendedPerM: number;
}

export interface ModelRecord {
  slug: string;
  name: string;
  vendor: string;
  country: string | null;
  releaseDate: string | null;
  /** "API access", "Open weights", etc., as stated by Epoch. */
  accessibility: string | null;
  contextLength: number | null;
  modalities: string[];
  supportsReasoning: boolean;
  pricing: Pricing | null;
  benchmarks: BenchmarkScore[];
  arena: ArenaScore[];
  /** Epoch's own composite, kept as an independent cross-check on our index. */
  eci: number | null;
  /** Which of the three feeds contributed to this row. */
  sources: string[];
  pillarScores: Partial<Record<PillarId, number>>;
  /** How many benchmarks backed each pillar — thin pillars are shown as low-confidence. */
  pillarCoverage: Partial<Record<PillarId, number>>;
  score: number;
  rank: number;
  /** Half-width of the score's uncertainty band, used for tie detection. */
  scoreUncertainty: number;
}

export interface SourceMeta {
  id: string;
  label: string;
  url: string;
  licence: string;
  fetchedAt: string;
  /** Records contributed by this source. */
  records: number;
  /** True when the run fell back to a previously committed snapshot. */
  stale: boolean;
}

export interface UnmatchedEntry {
  source: string;
  raw: string;
  slug: string;
  reason: string;
}

export interface IndexMeta {
  generatedAt: string;
  sources: SourceMeta[];
  eligibleModels: number;
  totalModelsSeen: number;
  unmatched: UnmatchedEntry[];
  matchRate: number;
  benchmarkCount: number;
}

export interface IndexPayload {
  meta: IndexMeta;
  pillars: Pillar[];
  models: ModelRecord[];
}

export interface TrendPoint {
  date: string;
  elo: number;
}

export interface TrendSeries {
  slug: string;
  name: string;
  vendor: string;
  board: string;
  points: TrendPoint[];
}

export interface TrendsPayload {
  generatedAt: string;
  firstDate: string;
  lastDate: string;
  series: TrendSeries[];
}

export const PILLARS: Pillar[] = [
  {
    id: 'reasoning',
    label: 'Reasoning & knowledge',
    blurb:
      'Hard problems with verifiable answers: graduate science, competition maths, research-level maths, and whether the model knows what it does not know.',
    defaultWeight: 25,
  },
  {
    id: 'coding',
    label: 'Coding',
    blurb:
      'Resolving real GitHub issues, multi-language edits, scientific code and competitive programming — measured by running the code, not by asking a judge.',
    defaultWeight: 25,
  },
  {
    id: 'preference',
    label: 'Human preference',
    blurb:
      'Blind head-to-head votes from people using the models on their own prompts. Captures the qualities benchmarks miss, and the taste benchmarks cannot score.',
    defaultWeight: 20,
  },
  {
    id: 'agentic',
    label: 'Agentic capability',
    blurb:
      'Long-horizon work with tools: terminals, real computers, and how long a task can run before the model loses the plot.',
    defaultWeight: 15,
  },
  {
    id: 'cost',
    label: 'Cost efficiency',
    blurb:
      'Blended price per million tokens on a log scale, because the gap between $1 and $10 matters far more than the gap between $60 and $70.',
    defaultWeight: 15,
  },
];

export const DEFAULT_WEIGHTS: Weights = Object.fromEntries(
  PILLARS.map((p) => [p.id, p.defaultWeight]),
) as Weights;

export interface Preset {
  id: string;
  label: string;
  blurb: string;
  weights: Weights;
}

/** Editorial stances. Each is a real way of choosing a model, not a random weight tweak. */
export const PRESETS: Preset[] = [
  {
    id: 'balanced',
    label: 'Best overall',
    blurb: 'My default opinion: capability first, but price is never free.',
    weights: DEFAULT_WEIGHTS,
  },
  {
    id: 'coding-agent',
    label: 'Best for coding agents',
    blurb: 'What matters when a model is writing and running code unattended for hours.',
    weights: { reasoning: 15, coding: 40, preference: 5, agentic: 30, cost: 10 },
  },
  {
    id: 'value',
    label: 'Best value',
    blurb: 'Strong enough for real work, priced for running it at volume.',
    weights: { reasoning: 15, coding: 20, preference: 15, agentic: 10, cost: 40 },
  },
  {
    id: 'frontier',
    label: 'Raw capability',
    blurb: 'Hardest problems only. Price and popularity ignored entirely.',
    weights: { reasoning: 40, coding: 30, preference: 5, agentic: 25, cost: 0 },
  },
  {
    id: 'chat',
    label: 'Best for chat & writing',
    blurb: 'Everyday assistant work, where human judgement beats benchmark scores.',
    weights: { reasoning: 20, coding: 5, preference: 50, agentic: 5, cost: 20 },
  },
];

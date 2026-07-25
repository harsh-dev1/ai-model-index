import type { PillarId } from '../../src/lib/types.ts';

export interface BenchmarkConfig {
  /** Stable id, also the Epoch CSV filename without the extension. */
  id: string;
  file: string;
  label: string;
  pillar: PillarId;
  /** Column holding the score. */
  scoreColumn: string;
  /** Column holding the standard error, where the source publishes one. */
  stderrColumn?: string;
  /** How the raw number should be read. */
  unit: 'fraction' | 'percent' | 'elo' | 'minutes';
  /** Long-tailed metrics are log-transformed before normalisation. */
  logScale?: boolean;
  blurb: string;
}

/**
 * The benchmarks that feed the index.
 *
 * Selection rules, applied deliberately:
 *  - the benchmark must still be scoring current models (2026 releases present),
 *  - it must be objectively scored (code that runs, answers that are checkable) or a
 *    large-sample human vote — no single-judge LLM scoring,
 *  - and it must add signal a benchmark already in the list does not.
 *
 * Saturated classics (MMLU, GSM8K, HellaSwag) are excluded on purpose: every frontier
 * model scores ~the same, so including them would compress real differences to noise.
 */
export const BENCHMARKS: BenchmarkConfig[] = [
  // ---- Reasoning & knowledge -------------------------------------------------
  {
    id: 'gpqa_diamond',
    file: 'gpqa_diamond.csv',
    label: 'GPQA Diamond',
    pillar: 'reasoning',
    scoreColumn: 'mean_score',
    stderrColumn: 'stderr',
    unit: 'fraction',
    blurb: 'Graduate-level science questions written by PhDs to be Google-proof.',
  },
  {
    id: 'frontiermath',
    file: 'frontiermath.csv',
    label: 'FrontierMath',
    pillar: 'reasoning',
    scoreColumn: 'mean_score',
    stderrColumn: 'stderr',
    unit: 'fraction',
    blurb: 'Unpublished research-level mathematics. Nowhere near saturated.',
  },
  {
    id: 'otis_mock_aime',
    file: 'otis_mock_aime_2024_2025.csv',
    label: 'AIME (mock)',
    pillar: 'reasoning',
    scoreColumn: 'mean_score',
    stderrColumn: 'stderr',
    unit: 'fraction',
    blurb: 'Olympiad-style competition mathematics.',
  },
  {
    id: 'hle',
    file: 'hle_external.csv',
    label: "Humanity's Last Exam",
    pillar: 'reasoning',
    scoreColumn: 'Accuracy',
    stderrColumn: 'Accuracy Standard Error',
    unit: 'fraction',
    blurb: 'Expert-written questions across every field, designed to resist saturation.',
  },
  {
    id: 'arc_agi_2',
    file: 'arc_agi_2_external.csv',
    label: 'ARC-AGI-2',
    pillar: 'reasoning',
    scoreColumn: 'Score',
    unit: 'fraction',
    blurb: 'Novel visual reasoning puzzles that resist memorisation.',
  },
  {
    id: 'simpleqa_verified',
    file: 'simpleqa_verified.csv',
    label: 'SimpleQA Verified',
    pillar: 'reasoning',
    scoreColumn: 'mean_score',
    stderrColumn: 'stderr',
    unit: 'fraction',
    blurb: 'Short factual questions — effectively a hallucination test.',
  },

  // ---- Coding ----------------------------------------------------------------
  {
    id: 'swe_bench_verified',
    file: 'swe_bench_verified.csv',
    label: 'SWE-bench Verified',
    pillar: 'coding',
    scoreColumn: 'mean_score',
    stderrColumn: 'stderr',
    unit: 'fraction',
    blurb: 'Real GitHub issues from real repos, graded by whether the tests pass.',
  },
  {
    id: 'aider_polyglot',
    file: 'aider_polyglot_external.csv',
    label: 'Aider Polyglot',
    pillar: 'coding',
    scoreColumn: 'Percent correct',
    unit: 'fraction',
    blurb: 'Editing exercises across six languages, graded by running the tests.',
  },
  {
    id: 'scicode',
    file: 'scicode_external.csv',
    label: 'SciCode',
    pillar: 'coding',
    scoreColumn: 'Score',
    unit: 'fraction',
    blurb: 'Research-grade scientific programming problems.',
  },
  {
    id: 'ale_bench',
    file: 'ale_bench_external.csv',
    label: 'ALE-Bench',
    pillar: 'coding',
    scoreColumn: 'Performance',
    unit: 'fraction',
    blurb: 'Long-horizon optimisation problems from competitive programming contests.',
  },
  {
    id: 'webdev_arena',
    file: 'webdev_arena_external.csv',
    label: 'WebDev Arena',
    pillar: 'coding',
    scoreColumn: 'Arena Score',
    unit: 'elo',
    blurb: 'Head-to-head votes on which model builds the better web app.',
  },

  // ---- Agentic ---------------------------------------------------------------
  {
    id: 'terminalbench',
    file: 'terminalbench_external.csv',
    label: 'Terminal-Bench',
    pillar: 'agentic',
    scoreColumn: 'Accuracy mean',
    stderrColumn: 'Accuracy SE',
    unit: 'fraction',
    blurb: 'Real tasks in a real terminal, graded on whether the end state is correct.',
  },
  {
    id: 'os_world',
    file: 'os_world_external.csv',
    label: 'OSWorld',
    pillar: 'agentic',
    scoreColumn: 'Score',
    unit: 'percent',
    blurb: 'Driving an actual desktop operating system to complete tasks.',
  },
  {
    id: 'metr_time_horizon',
    file: 'metr_time_horizons_external.csv',
    label: 'METR time horizon',
    pillar: 'agentic',
    scoreColumn: 'Time horizon',
    unit: 'minutes',
    logScale: true,
    blurb:
      'How long a task can be before the model succeeds only half the time. The clearest single measure of autonomy, and it grows exponentially.',
  },
  {
    id: 'the_agent_company',
    file: 'the_agent_company_external.csv',
    label: 'The Agent Company',
    pillar: 'agentic',
    scoreColumn: '% Score',
    unit: 'fraction',
    blurb: 'Multi-step knowledge work inside a simulated software company.',
  },
];

/** Arena boards that feed the human-preference pillar, and their relative weights. */
export const ARENA_BOARDS: Array<{ board: string; weight: number; label: string }> = [
  { board: 'text', weight: 40, label: 'Text' },
  { board: 'code', weight: 25, label: 'Code' },
  { board: 'agent', weight: 15, label: 'Agent' },
  { board: 'vision', weight: 10, label: 'Vision' },
  { board: 'document', weight: 5, label: 'Document' },
  { board: 'search', weight: 5, label: 'Search' },
];

/** Boards fetched for history and detail pages, beyond the ones that feed the score. */
export const ALL_ARENA_BOARDS = [
  'text',
  'code',
  'agent',
  'vision',
  'document',
  'search',
  'text-to-image',
  'image-edit',
  'text-to-video',
  'image-to-video',
  'video-edit',
];

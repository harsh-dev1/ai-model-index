# AI Model Index

**[harsh-dev1.github.io/ai-model-index](https://harsh-dev1.github.io/ai-model-index/)**

An opinionated ranking of AI models, built from three live public sources and published
with the whole formula on show. Everyone publishes a leaderboard; almost nobody says what
they actually think. This one commits to a ranking, then hands you the sliders so you can
watch how much of the result is opinion.

81 models · 15 benchmarks · 3 independent sources · refreshed every 6 hours.

## What makes it different

- **It takes a position.** Five weighted pillars produce one number and a ranked list, not
  a wall of raw benchmark columns for you to interpret.
- **You can disagree in the UI.** Move the weights and the entire page re-ranks live. If
  the ranking collapses under your priorities, that is a real finding about the ranking.
- **Ties are shown as ties.** Every score carries an uncertainty band. Where two bands
  overlap the models are drawn as one tier, because ranking 3rd against 4th across
  overlapping intervals is fake precision.
- **Nothing is hand-entered.** Every number traces to a dated raw snapshot committed in
  this repository, and CI fails the build if the published index cannot be regenerated
  from those snapshots byte for byte.
- **The exclusions are published too.** 341 models were seen and left out; the methodology
  page lists every one with the reason. Silently dropping what you cannot handle is how a
  leaderboard lies by omission.

## Sources

| Source | Provides | Licence |
|---|---|---|
| [Epoch AI Benchmarking Hub](https://epoch.ai/data/ai-benchmarking-dashboard) | 15 capability benchmarks, release dates, standard errors | CC-BY 4.0 |
| [Arena AI](https://arena.ai/leaderboard) | Human head-to-head preference votes across 6 boards, plus 124 days of history | Public leaderboard data |
| [OpenRouter](https://openrouter.ai/api/v1/models) | Pricing, context windows, modality | Public API |

Artificial Analysis is deliberately absent despite having excellent data: their free tier
is licensed for internal use only, and republishing it here would breach that.

## The formula

```
score = Σ(weightᵢ × pillarᵢ) ÷ Σ(weightᵢ for pillars with data)
```

| Pillar | Default weight |
|---|---|
| Reasoning & knowledge | 25% |
| Coding | 25% |
| Human preference | 20% |
| Agentic capability | 15% |
| Cost efficiency | 15% |

Raw values are mapped to 0–100 with winsorised min-max scaling (Tukey fences snapped to
the nearest real observation), then each pillar is standardised to a common mean and
spread before weighting — otherwise being measured on a harsher pillar acts as a penalty.
Full reasoning, including what this index is bad at, is on the
[methodology page](https://harsh-dev1.github.io/ai-model-index/methodology).

## Running it yourself

```bash
pnpm install
pnpm data:fetch      # pull today's snapshot from all three sources
pnpm data:backfill   # extend the Arena history from the public archive
pnpm normalize       # join the sources onto canonical model identities
pnpm score           # produce public/data/index.json and trends.json
pnpm dev             # http://localhost:5173
```

`pnpm normalize && pnpm score` on a fresh clone reproduces the published files exactly;
the timestamps in the output come from the source snapshots, not the wall clock, so the
build is deterministic. CI enforces this on every push.

```bash
pnpm test        # 31 unit tests over identity matching and scoring
pnpm typecheck
pnpm lint
```

## How it stays current

`.github/workflows/refresh.yml` runs every 6 hours: fetch, backfill, join, score, and
commit only if something changed. It fails loudly if the data has not moved in two days,
because a scheduled job that quietly stops is worse than one that never ran.

`.github/workflows/deploy.yml` runs on every push: typecheck, lint, test, verify the index
reproduces byte for byte, build, and deploy to Pages.

## Layout

```
scripts/          data pipeline: fetch → normalize → score (all deterministic)
scripts/config/   which benchmarks and boards are in, and which pillar each feeds
src/lib/          identity matching, scoring engine, shared types
src/components/   layout, UI primitives, 7 chart components
src/pages/        index, model detail, compare, trends, methodology
data/raw/         dated source snapshots, 60-day retention
data/history/     compact Arena Elo history
public/data/      the generated index the site reads
plan/             goals and the append-only decision register
```

## Caveats

Benchmarks are proxies, not your workload. Coverage is uneven, so newly released models
carry wide bands. The blended price is a 3:1 input:output approximation at list price and
ignores caching and batch discounts. Arena measures preference, not correctness. Benchmark
contamination cannot be measured from outside. And the weights are mine — which is exactly
why they are adjustable.

Think the ranking is wrong? [Open an issue](https://github.com/harsh-dev1/ai-model-index/issues).
Corrections get made visibly.

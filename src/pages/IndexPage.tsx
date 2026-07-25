import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { AsyncState } from '../lib/data.ts';
import type { IndexPayload, Weights } from '../lib/types.ts';
import { DEFAULT_WEIGHTS, PRESETS } from '../lib/types.ts';
import { rankModels } from '../lib/scoring.ts';
import type { ScoredModel } from '../lib/scoring.ts';
import { usd } from '../lib/format.ts';
import { Card, Page, ScoreChip, Section, Tag } from '../components/ui.tsx';
import { StateGate } from '../components/ui.tsx';
import WeightControls from '../components/WeightControls.tsx';
import IndexTable from '../components/IndexTable.tsx';
import ScoreRankChart from '../components/charts/ScoreRankChart.tsx';
import ParetoChart from '../components/charts/ParetoChart.tsx';
import ContextBubbleChart from '../components/charts/ContextBubbleChart.tsx';
import PillarRadar from '../components/charts/PillarRadar.tsx';

function Pick({
  label,
  model,
  reason,
}: {
  label: string;
  model: ScoredModel | undefined;
  reason: string;
}) {
  if (!model) return null;
  return (
    <Card className="flex flex-col">
      <p className="text-xs font-medium tracking-wide text-accent uppercase">{label}</p>
      <Link
        to={`/model/${model.slug}`}
        className="mt-1.5 text-lg leading-tight font-semibold text-white hover:text-accent"
      >
        {model.name}
      </Link>
      <p className="mt-0.5 text-xs text-ink-400">{model.vendor}</p>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-400">{reason}</p>
      <div className="mt-3 flex items-center gap-2">
        <ScoreChip score={model.score} size="sm" />
        <span className="font-mono text-xs text-ink-400">
          {usd(model.pricing?.blendedPerM)}/M
        </span>
      </div>
    </Card>
  );
}

export default function IndexPage({ state }: { state: AsyncState<IndexPayload> }) {
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [preset, setPreset] = useState<string | null>('balanced');

  return (
    <StateGate state={state}>
      {(data) => {
        // Called during StateGate's render, so this must stay hook-free: StateGate
        // returns early while loading, and a hook here would change hook count between
        // renders. Ranking 80-odd models is microseconds, so memoising buys nothing.
        const ranked = rankModels(data.models, weights);
        const isDefault = preset === 'balanced';

        const best = ranked[0];
        const bestValue = [...ranked]
          .filter((m) => m.pricing && m.pricing.blendedPerM > 0 && m.score > 45)
          .sort(
            (a, b) =>
              b.score / Math.log10(b.pricing!.blendedPerM + 2) -
              a.score / Math.log10(a.pricing!.blendedPerM + 2),
          )[0];
        const bestCoding = [...ranked].sort(
          (a, b) => (b.pillarScores.coding ?? -1) - (a.pillarScores.coding ?? -1),
        )[0];
        const bestOpen = [...ranked].filter((m) =>
          /open/i.test(m.accessibility ?? ''),
        )[0];

        return (
          <Page>
            {/* ---- Hero ---- */}
            <div className="max-w-3xl">
              <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">
                {data.meta.eligibleModels} models · {data.meta.benchmarkCount} benchmarks · 3 independent sources
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Which AI model is actually best?
              </h1>
              <p className="mt-4 text-lg leading-relaxed text-ink-400">
                Everyone publishes a leaderboard; almost nobody says what they think. This one
                does. It pulls live results from three independent sources, combines them into
                one opinionated score — and then hands you the sliders, so you can see exactly
                how much that opinion is doing.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink-400">
                Nothing here is hand-entered. Every number traces back to a raw snapshot
                committed in the repo, refreshed every six hours, and the whole ranking
                regenerates byte-for-byte from those files.{' '}
                <Link to="/methodology" className="text-accent hover:underline">
                  How it is calculated →
                </Link>
              </p>
            </div>

            {/* ---- The verdict ---- */}
            <Section
              title={isDefault ? 'My picks' : 'Your picks, under these weights'}
              subtitle={
                isDefault
                  ? 'The short answer, under my default weights. Move the sliders below and these change with the ranking — which is rather the point.'
                  : 'You changed the weights, so these are now your conclusions rather than mine.'
              }
            >
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Pick
                  label="Best overall"
                  model={best}
                  reason={
                    best
                      ? `Top of the board at ${best.score.toFixed(1)}, and the only model in its tier — the one result on this page that is not a statistical tie.`
                      : ''
                  }
                />
                <Pick
                  label="Best value"
                  model={bestValue}
                  reason={
                    bestValue
                      ? `Scores ${bestValue.score.toFixed(1)} at ${usd(bestValue.pricing?.blendedPerM)} per million tokens. Most of the capability of the leaders for a fraction of the bill.`
                      : ''
                  }
                />
                <Pick
                  label="Best at coding"
                  model={bestCoding}
                  reason={
                    bestCoding
                      ? `Strongest coding pillar in the index, measured by benchmarks that run the code rather than asking a model to grade it.`
                      : ''
                  }
                />
                {bestOpen ? (
                  <Pick
                    label="Best open weights"
                    model={bestOpen}
                    reason="The strongest model you can download and run yourself, rather than rent."
                  />
                ) : (
                  <Pick
                    label="Longest context"
                    model={[...ranked].sort((a, b) => (b.contextLength ?? 0) - (a.contextLength ?? 0))[0]}
                    reason="The largest context window among models near the top of the index."
                  />
                )}
              </div>
            </Section>

            {/* ---- Controls ---- */}
            <Section
              title="Disagree with me"
              subtitle="These five pillars and their weights are my editorial judgement, not a fact. Change them and the entire page re-ranks instantly."
            >
              <WeightControls
                weights={weights}
                onChange={(w) => {
                  setWeights(w);
                  const match = PRESETS.find((p) =>
                    Object.entries(p.weights).every(([k, v]) => w[k as keyof Weights] === v),
                  );
                  setPreset(match?.id ?? null);
                }}
                activePreset={preset}
                onPreset={(id) => {
                  const p = PRESETS.find((x) => x.id === id);
                  if (p) {
                    setWeights(p.weights);
                    setPreset(id);
                  }
                }}
              />
            </Section>

            {/* ---- The ranking ---- */}
            <Section
              title="The full index"
              subtitle={`All ${ranked.length} models that are both measured and purchasable. Sort by any column; search or filter to narrow it down.`}
            >
              <IndexTable models={ranked} />
            </Section>

            <Section
              title="The ranking, with its error bars"
              subtitle="The same result as a chart, showing the uncertainty most leaderboards leave out."
            >
              <ScoreRankChart models={ranked} count={20} />
            </Section>

            <Section
              title="Price against capability"
              subtitle="The chart I would actually use to pick a model for a real workload."
            >
              <ParetoChart models={ranked} />
            </Section>

            <Section
              title="The shape of the leaders"
              subtitle="Top five models overlaid across all five pillars. Where the shapes differ is where the choice actually matters."
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <PillarRadar
                  models={ranked.slice(0, 5)}
                  title="Top five, compared"
                  height={380}
                />
                <ContextBubbleChart models={ranked} />
              </div>
            </Section>

            <div className="mt-12 flex flex-wrap gap-3">
              <Link
                to="/compare"
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-ink-950 hover:bg-accent-dim"
              >
                Compare models side by side
              </Link>
              <Link
                to="/trends"
                className="rounded-md border border-ink-700 px-4 py-2 text-sm font-medium text-ink-200 hover:bg-ink-900"
              >
                See how this changed over four months
              </Link>
            </div>

            {data.meta.unmatched.length > 0 && (
              <p className="mt-8 text-xs text-ink-400">
                <Tag>{data.meta.unmatched.length} models excluded</Tag>{' '}
                Every exclusion is listed with its reason on the{' '}
                <Link to="/methodology" className="text-accent hover:underline">
                  methodology page
                </Link>
                . A leaderboard that silently drops what it cannot handle is lying by omission.
              </p>
            )}
          </Page>
        );
      }}
    </StateGate>
  );
}

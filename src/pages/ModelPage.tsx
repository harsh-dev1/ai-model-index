import { Link, useParams } from 'react-router-dom';
import type { AsyncState } from '../lib/data.ts';
import type { IndexPayload } from '../lib/types.ts';
import { DEFAULT_WEIGHTS, PILLARS } from '../lib/types.ts';
import { rankModels } from '../lib/scoring.ts';
import { compactTokens, shortDate, usd, vendorColour } from '../lib/format.ts';
import { Card, MiniBar, Page, ScoreChip, Section, StateGate, Tag } from '../components/ui.tsx';
import BenchmarkBars from '../components/charts/BenchmarkBars.tsx';
import PillarRadar from '../components/charts/PillarRadar.tsx';

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-400">{label}</dt>
      <dd className="mt-0.5 font-medium text-ink-200">{value}</dd>
    </div>
  );
}

export default function ModelPage({ state }: { state: AsyncState<IndexPayload> }) {
  const { slug } = useParams();

  return (
    <StateGate state={state}>
      {(data) => {
        const ranked = rankModels(data.models, DEFAULT_WEIGHTS);
        const model = ranked.find((m) => m.slug === slug);

        if (!model) {
          return (
            <Page>
              <Card>
                <h1 className="text-lg font-semibold text-white">Model not found</h1>
                <p className="mt-2 text-sm text-ink-400">
                  Nothing in the index matches “{slug}”. It may have been excluded — the{' '}
                  <Link to="/methodology" className="text-accent hover:underline">
                    methodology page
                  </Link>{' '}
                  lists every exclusion and why.
                </p>
                <Link to="/" className="mt-4 inline-block text-sm text-accent hover:underline">
                  ← Back to the index
                </Link>
              </Card>
            </Page>
          );
        }

        const tied = ranked.filter((m) => m.tieGroup === model.tieGroup && m.slug !== model.slug);

        return (
          <Page>
            <Link to="/" className="text-sm text-ink-400 hover:text-accent">
              ← The Index
            </Link>

            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm" style={{ color: vendorColour(model.vendor) }}>
                  {model.vendor}
                  {model.country ? ` · ${model.country}` : ''}
                </p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  {model.name}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Tag tone="accent">Rank #{model.rank}</Tag>
                  {model.supportsReasoning && <Tag>Reasoning modes</Tag>}
                  {model.accessibility && <Tag>{model.accessibility}</Tag>}
                  {model.coverage < 0.8 && <Tag tone="warn">Thin measurement coverage</Tag>}
                </div>
              </div>
              <div className="text-right">
                <ScoreChip score={model.score} />
                <p className="mt-1 font-mono text-xs text-ink-400">
                  ± {model.scoreUncertainty.toFixed(1)}
                </p>
              </div>
            </div>

            {tied.length > 0 && (
              <p className="mt-4 rounded-lg border border-ink-800 bg-ink-900 px-4 py-3 text-sm text-ink-400">
                Statistically tied with{' '}
                {tied.slice(0, 4).map((m, i) => (
                  <span key={m.slug}>
                    {i > 0 && ', '}
                    <Link to={`/model/${m.slug}`} className="text-accent hover:underline">
                      {m.name}
                    </Link>
                  </span>
                ))}
                {tied.length > 4 && ` and ${tied.length - 4} more`}. Their uncertainty bands
                overlap this one's, so the ordering between them is not evidence of anything.
              </p>
            )}

            <Section title="At a glance">
              <Card>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
                  <Fact label="Input / M tokens" value={usd(model.pricing?.inputPerM)} />
                  <Fact label="Output / M tokens" value={usd(model.pricing?.outputPerM)} />
                  <Fact label="Blended / M" value={usd(model.pricing?.blendedPerM)} />
                  <Fact label="Context window" value={compactTokens(model.contextLength)} />
                  <Fact
                    label="Released"
                    value={model.releaseDate ? shortDate(model.releaseDate) : '—'}
                  />
                  <Fact
                    label="Epoch ECI"
                    value={model.eci !== null ? model.eci.toFixed(1) : '—'}
                  />
                </dl>
                {model.modalities.length > 0 && (
                  <p className="mt-4 text-xs text-ink-400">
                    Accepts: {model.modalities.join(', ')}
                  </p>
                )}
                <p className="mt-2 text-xs text-ink-400">
                  Data from: {model.sources.join(', ')}
                </p>
              </Card>
            </Section>

            <Section
              title="Pillar breakdown"
              subtitle="Each pillar is standardised so 50 is the average model in this index. Above 68 is roughly the top sixth."
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <dl className="space-y-4">
                    {PILLARS.map((p) => {
                      const v = model.pillarScores[p.id];
                      const n = model.pillarCoverage[p.id];
                      return (
                        <div key={p.id}>
                          <dt className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="text-ink-200">{p.label}</span>
                            <span className="text-xs text-ink-400">
                              {v === undefined
                                ? 'not measured'
                                : `${n} source${n === 1 ? '' : 's'}`}
                            </span>
                          </dt>
                          <dd className="mt-1.5">
                            {v === undefined ? (
                              <p className="text-xs text-ink-600">
                                No published measurement. Its weight is spread across the
                                pillars that do have data, and the score's uncertainty band is
                                widened to account for the gap.
                              </p>
                            ) : (
                              <MiniBar value={v} />
                            )}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </Card>
                <PillarRadar models={[model]} height={340} />
              </div>
            </Section>

            {model.benchmarks.length > 0 && (
              <Section title="Receipts">
                <BenchmarkBars model={model} />
              </Section>
            )}

            {model.arena.length > 0 && (
              <Section
                title="Human preference"
                subtitle="Blind head-to-head votes on the Arena boards. The ± figure is the published 95% confidence interval."
              >
                <div className="overflow-x-auto rounded-xl border border-ink-800">
                  <table className="w-full text-sm">
                    <thead className="bg-ink-900 text-left text-xs text-ink-400">
                      <tr>
                        <th scope="col" className="px-3 py-2 font-medium">Board</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">Elo</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">Rank</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">Votes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {model.arena.map((a) => (
                        <tr key={a.board} className="border-t border-ink-850">
                          <td className="px-3 py-2 capitalize text-ink-200">{a.board}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-ink-200">
                            {Math.round(a.elo)}
                            {a.ci !== null && (
                              <span className="text-ink-600"> ±{a.ci}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-ink-400">
                            #{a.rank}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-ink-400">
                            {a.votes?.toLocaleString() ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}
          </Page>
        );
      }}
    </StateGate>
  );
}

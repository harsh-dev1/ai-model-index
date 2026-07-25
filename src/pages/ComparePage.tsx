import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { AsyncState } from '../lib/data.ts';
import type { IndexPayload } from '../lib/types.ts';
import { DEFAULT_WEIGHTS, PILLARS } from '../lib/types.ts';
import { rankModels } from '../lib/scoring.ts';
import { compactTokens, shortDate, usd, vendorColour } from '../lib/format.ts';
import { Empty, MiniBar, Page, ScoreChip, Section, StateGate } from '../components/ui.tsx';
import PillarRadar from '../components/charts/PillarRadar.tsx';

const MAX = 4;

export default function ComparePage({ state }: { state: AsyncState<IndexPayload> }) {
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <StateGate state={state}>
      {(data) => {
        const ranked = rankModels(data.models, DEFAULT_WEIGHTS);
        const chosen = selected
          .map((s) => ranked.find((m) => m.slug === s))
          .filter((m): m is (typeof ranked)[number] => m !== undefined);

        // Default to the top three so the page is useful before you touch anything.
        const shown = chosen.length > 0 ? chosen : ranked.slice(0, 3);
        const usingDefault = chosen.length === 0;

        // Benchmarks any shown model has, so the table only has rows with real content.
        const benchmarkIds = [
          ...new Set(shown.flatMap((m) => m.benchmarks.map((b) => b.id))),
        ].sort((a, b) => {
          const la = shown.flatMap((m) => m.benchmarks).find((x) => x.id === a)?.label ?? a;
          const lb = shown.flatMap((m) => m.benchmarks).find((x) => x.id === b)?.label ?? b;
          return la.localeCompare(lb);
        });

        function toggle(slug: string) {
          setSelected((prev) =>
            prev.includes(slug)
              ? prev.filter((s) => s !== slug)
              : prev.length >= MAX
                ? prev
                : [...prev, slug],
          );
        }

        return (
          <Page>
            <div className="max-w-3xl">
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Compare
              </h1>
              <p className="mt-4 text-lg leading-relaxed text-ink-400">
                Put up to {MAX} models side by side across every benchmark, every pillar and
                the price. Blank cells mean nobody has published that measurement — not a zero.
              </p>
            </div>

            <Section
              title="Pick models"
              subtitle={
                usingDefault
                  ? `Showing the current top three by default. Choose your own below (up to ${MAX}).`
                  : `${chosen.length} of ${MAX} selected.`
              }
              actions={
                chosen.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setSelected([])}
                    className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-ink-200 hover:bg-ink-900"
                  >
                    Reset
                  </button>
                ) : undefined
              }
            >
              <div className="flex max-h-64 flex-wrap gap-2 overflow-y-auto rounded-xl border border-ink-800 bg-ink-900 p-3">
                {ranked.map((m) => {
                  const on = selected.includes(m.slug);
                  const full = !on && selected.length >= MAX;
                  return (
                    <button
                      key={m.slug}
                      type="button"
                      onClick={() => toggle(m.slug)}
                      disabled={full}
                      aria-pressed={on}
                      className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                        on
                          ? 'bg-accent text-ink-950'
                          : full
                            ? 'cursor-not-allowed bg-ink-850 text-ink-600'
                            : 'bg-ink-800 text-ink-200 hover:bg-ink-700'
                      }`}
                    >
                      {m.name}
                    </button>
                  );
                })}
              </div>
            </Section>

            {shown.length === 0 ? (
              <div className="mt-8">
                <Empty>Select at least one model above.</Empty>
              </div>
            ) : (
              <>
                <Section title="Head to head">
                  <div className="overflow-x-auto rounded-xl border border-ink-800">
                    <table className="w-full text-sm">
                      <caption className="sr-only">Model comparison</caption>
                      <thead>
                        <tr className="bg-ink-900 text-left">
                          <th scope="col" className="px-3 py-3 text-xs font-medium text-ink-400">
                            Metric
                          </th>
                          {shown.map((m) => (
                            <th key={m.slug} scope="col" className="px-3 py-3 align-bottom">
                              <Link
                                to={`/model/${m.slug}`}
                                className="font-semibold text-white hover:text-accent"
                              >
                                {m.name}
                              </Link>
                              <p
                                className="mt-0.5 text-xs font-normal"
                                style={{ color: vendorColour(m.vendor) }}
                              >
                                {m.vendor}
                              </p>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-ink-850">
                          <th scope="row" className="px-3 py-2.5 text-left font-medium text-ink-200">
                            Index score
                          </th>
                          {shown.map((m) => (
                            <td key={m.slug} className="px-3 py-2.5">
                              <ScoreChip score={m.score} size="sm" />
                              <span className="ml-1.5 font-mono text-[10px] text-ink-600">
                                #{m.rank}
                              </span>
                            </td>
                          ))}
                        </tr>

                        {PILLARS.map((p) => (
                          <tr key={p.id} className="border-t border-ink-850">
                            <th scope="row" className="px-3 py-2.5 text-left font-normal text-ink-400">
                              {p.label}
                            </th>
                            {shown.map((m) => {
                              const v = m.pillarScores[p.id];
                              return (
                                <td key={m.slug} className="px-3 py-2.5">
                                  {v === undefined ? (
                                    <span className="text-xs text-ink-600">not measured</span>
                                  ) : (
                                    <MiniBar value={v} />
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}

                        <tr className="border-t-2 border-ink-700">
                          <th scope="row" className="px-3 py-2.5 text-left font-medium text-ink-200">
                            Blended price / M
                          </th>
                          {shown.map((m) => (
                            <td key={m.slug} className="px-3 py-2.5 font-mono tabular-nums text-ink-200">
                              {usd(m.pricing?.blendedPerM)}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-t border-ink-850">
                          <th scope="row" className="px-3 py-2.5 text-left font-normal text-ink-400">
                            Context window
                          </th>
                          {shown.map((m) => (
                            <td key={m.slug} className="px-3 py-2.5 font-mono tabular-nums text-ink-200">
                              {compactTokens(m.contextLength)}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-t border-ink-850">
                          <th scope="row" className="px-3 py-2.5 text-left font-normal text-ink-400">
                            Released
                          </th>
                          {shown.map((m) => (
                            <td key={m.slug} className="px-3 py-2.5 text-ink-400">
                              {m.releaseDate ? shortDate(m.releaseDate) : '—'}
                            </td>
                          ))}
                        </tr>

                        {benchmarkIds.length > 0 && (
                          <tr className="border-t-2 border-ink-700 bg-ink-900/50">
                            <th
                              scope="row"
                              colSpan={shown.length + 1}
                              className="px-3 py-2 text-left text-xs font-medium tracking-wide text-ink-400 uppercase"
                            >
                              Raw benchmark results
                            </th>
                          </tr>
                        )}
                        {benchmarkIds.map((id) => {
                          const label =
                            shown.flatMap((m) => m.benchmarks).find((b) => b.id === id)?.label ?? id;
                          const values = shown.map((m) => m.benchmarks.find((b) => b.id === id));
                          const best = Math.max(...values.map((v) => v?.normalised ?? -1));
                          return (
                            <tr key={id} className="border-t border-ink-850">
                              <th scope="row" className="px-3 py-2.5 text-left font-normal text-ink-400">
                                {label}
                              </th>
                              {values.map((v, i) => (
                                <td
                                  key={shown[i].slug}
                                  className={`px-3 py-2.5 font-mono tabular-nums ${
                                    v && v.normalised === best && values.filter(Boolean).length > 1
                                      ? 'font-semibold text-accent'
                                      : 'text-ink-200'
                                  }`}
                                >
                                  {v ? v.display : <span className="text-ink-600">—</span>}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Section>

                <Section title="Shapes overlaid">
                  <PillarRadar
                    models={shown}
                    title="Pillar profile"
                    hint="Where the outlines separate is where the choice between these models actually matters. Where they overlap, the decision is a coin flip."
                    height={400}
                  />
                </Section>
              </>
            )}
          </Page>
        );
      }}
    </StateGate>
  );
}

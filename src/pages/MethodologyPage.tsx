import type { AsyncState } from '../lib/data.ts';
import type { IndexPayload } from '../lib/types.ts';
import { PILLARS } from '../lib/types.ts';
import { relativeTime, shortDate } from '../lib/format.ts';
import { Card, Page, Section, StateGate, Tag } from '../components/ui.tsx';

function Prose({ children }: { children: React.ReactNode }) {
  return <div className="max-w-3xl space-y-4 text-sm leading-relaxed text-ink-400">{children}</div>;
}

export default function MethodologyPage({ state }: { state: AsyncState<IndexPayload> }) {
  return (
    <StateGate state={state}>
      {(data) => (
        <Page>
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              How this is calculated
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-ink-400">
              The ranking on this site is an opinion. That is fine — every ranking is — but an
              opinion you cannot check is just an assertion. So here is the whole formula, the
              sources, and the things this index is bad at.
            </p>
          </div>

          <Section title="Sources">
            <div className="overflow-x-auto rounded-xl border border-ink-800">
              <table className="w-full text-sm">
                <thead className="bg-ink-900 text-left text-xs text-ink-400">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">Source</th>
                    <th scope="col" className="px-3 py-2 font-medium">Provides</th>
                    <th scope="col" className="px-3 py-2 font-medium">Licence</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Last fetched</th>
                  </tr>
                </thead>
                <tbody>
                  {data.meta.sources.map((s) => (
                    <tr key={s.id} className="border-t border-ink-850">
                      <td className="px-3 py-2.5">
                        <a href={s.url} className="text-accent hover:underline" target="_blank" rel="noreferrer">
                          {s.label}
                        </a>
                      </td>
                      <td className="px-3 py-2.5 text-ink-400">
                        {s.id === 'epoch' && 'Automated capability benchmarks'}
                        {s.id === 'arena' && 'Human head-to-head preference votes'}
                        {s.id === 'openrouter' && 'Pricing, context windows, modality'}
                      </td>
                      <td className="px-3 py-2.5 text-ink-400">{s.licence}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <span className={s.stale ? 'text-warn' : 'text-ink-400'}>
                          {relativeTime(s.fetchedAt)}
                        </span>
                        {s.stale && <span className="ml-2"><Tag tone="warn">stale</Tag></span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Prose>
              <p className="mt-4">
                These three measure genuinely different things — machines grading answers,
                humans voting on outputs, and a market setting prices — so no single one can
                dominate the result.{' '}
                <strong className="text-ink-200">Artificial Analysis is deliberately absent</strong>{' '}
                despite having excellent data: their free tier is licensed for internal use
                only, and republishing it here would breach that.
              </p>
            </Prose>
          </Section>

          <Section title="The formula">
            <Prose>
              <p>
                Five pillars. Each model's score is the weighted mean of the pillars it has
                data for:
              </p>
            </Prose>
            <Card className="mt-4">
              <p className="font-mono text-sm text-accent">
                score = Σ(weightᵢ × pillarᵢ) ÷ Σ(weightᵢ for pillars with data)
              </p>
            </Card>
            <div className="mt-4 overflow-x-auto rounded-xl border border-ink-800">
              <table className="w-full text-sm">
                <thead className="bg-ink-900 text-left text-xs text-ink-400">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">Pillar</th>
                    <th scope="col" className="px-3 py-2 font-medium">Default weight</th>
                    <th scope="col" className="px-3 py-2 font-medium">What feeds it</th>
                  </tr>
                </thead>
                <tbody>
                  {PILLARS.map((p) => (
                    <tr key={p.id} className="border-t border-ink-850 align-top">
                      <td className="px-3 py-2.5 font-medium whitespace-nowrap text-ink-200">
                        {p.label}
                      </td>
                      <td className="px-3 py-2.5 font-mono tabular-nums text-accent">
                        {p.defaultWeight}%
                      </td>
                      <td className="px-3 py-2.5 text-ink-400">{p.blurb}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Prose>
              <h3 className="pt-4 font-semibold text-ink-200">Four decisions that matter</h3>
              <p>
                <strong className="text-ink-200">1. Winsorised min-max, not percentile rank.</strong>{' '}
                Raw benchmark values are mapped to 0–100 across the eligible set. Percentile
                rank would tell you a model is in the top 5% but throw away by how much, and on
                benchmarks nowhere near saturation the margin is the whole story. Clipping uses
                Tukey fences snapped to the nearest real observation, so one absurd value
                cannot squash the real field.
              </p>
              <p>
                <strong className="text-ink-200">2. Pillars are standardised before weighting.</strong>{' '}
                This one is easy to get wrong. The Arena boards naturally produce lower average
                scores than the benchmark pillars. Left alone, a model that <em>is</em> measured
                on Arena scored worse than an identical model that simply was not listed, whose
                preference weight got redistributed to pillars where it scored higher. Being
                measured must never be a penalty, so every pillar is rescaled to the same mean
                and spread first.
              </p>
              <p>
                <strong className="text-ink-200">3. Ties are reported as ties.</strong> Every
                score carries an uncertainty band, built from published standard errors plus a
                penalty for pillars with no data at all. Where two bands overlap the models are
                shown as tied. Ranking third against fourth across overlapping intervals is
                fake precision, and it is the most common way leaderboards mislead.
              </p>
              <p>
                <strong className="text-ink-200">4. The best configuration counts.</strong> Where
                a source reports several reasoning-effort settings of one model, the strongest
                is used — the same convention every leaderboard uses.
              </p>
            </Prose>
          </Section>

          <Section
            title="Who gets in"
            subtitle={`${data.meta.eligibleModels} models qualified out of ${data.meta.totalModelsSeen} seen across all sources.`}
          >
            <Prose>
              <p>A model is in the index if it has both:</p>
              <ul className="ml-5 list-disc space-y-1">
                <li>
                  a published API price on OpenRouter — if you cannot buy it, it is not a real
                  option; and
                </li>
                <li>
                  either three or more benchmark results across at least two pillars, or a
                  rating on the Arena text board.
                </li>
              </ul>
              <p>
                Cross-source matching is the hard part: the same model is{' '}
                <code className="rounded bg-ink-850 px-1 text-xs">gpt-5.2-2025-12-11_xhigh</code>{' '}
                to one source,{' '}
                <code className="rounded bg-ink-850 px-1 text-xs">gpt-5-2-high</code> to another
                and <code className="rounded bg-ink-850 px-1 text-xs">openai/gpt-5.2</code> to a
                third. A deterministic rule set resolves these, currently matching{' '}
                <strong className="text-ink-200">
                  {(data.meta.matchRate * 100).toFixed(0)}% of the Arena top 50
                </strong>
                . The build fails if that drops below 95%, so a renamed model breaks the site
                loudly instead of quietly vanishing from the ranking.
              </p>
            </Prose>
          </Section>

          <Section
            title="What this index is bad at"
            subtitle="The honest list. Read it before quoting a number from this page at anyone."
          >
            <Card>
              <ul className="space-y-3 text-sm leading-relaxed text-ink-400">
                <li>
                  <strong className="text-ink-200">Benchmarks are not your workload.</strong>{' '}
                  Every measurement here is a proxy. A model that tops SWE-bench may still be
                  wrong for your codebase, and nothing on this page can tell you otherwise.
                </li>
                <li>
                  <strong className="text-ink-200">Coverage is uneven.</strong> Newly released
                  models have few results, so they carry wide bands and can be ranked below
                  where they eventually settle. Models flagged “thin data” are the ones to be
                  most sceptical about.
                </li>
                <li>
                  <strong className="text-ink-200">Price is not cost.</strong> The blended figure
                  is a 3:1 input:output approximation at list price. It ignores caching, batch
                  discounts, and the fact that a model needing fewer retries can be cheaper
                  overall while costing more per token.
                </li>
                <li>
                  <strong className="text-ink-200">Arena measures preference, not correctness.</strong>{' '}
                  Voters reward formatting, confidence and length. That is real signal about
                  what people like, and imperfect signal about what is true.
                </li>
                <li>
                  <strong className="text-ink-200">Benchmark contamination is unquantified.</strong>{' '}
                  Some test sets leak into training data over time. Benchmarks resistant to
                  this are preferred here, but the effect cannot be measured from outside.
                </li>
                <li>
                  <strong className="text-ink-200">The weights are mine.</strong> There is no
                  objectively correct weighting. That is precisely why the sliders exist —
                  if the ranking collapses under your priorities, that is a finding, not a bug.
                </li>
              </ul>
            </Card>
          </Section>

          <Section
            title="Excluded models"
            subtitle={`${data.meta.unmatched.length} models were seen but left out. Listing them is the point: silently dropping what you cannot handle is how a leaderboard lies by omission.`}
          >
            <details className="rounded-xl border border-ink-800 bg-ink-900">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink-200">
                Show all {data.meta.unmatched.length} exclusions
              </summary>
              <div className="max-h-96 overflow-y-auto border-t border-ink-800">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-ink-900 text-left text-xs text-ink-400">
                    <tr>
                      <th scope="col" className="px-4 py-2 font-medium">Model</th>
                      <th scope="col" className="px-4 py-2 font-medium">Seen in</th>
                      <th scope="col" className="px-4 py-2 font-medium">Why it was excluded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.meta.unmatched.map((u) => (
                      <tr key={`${u.slug}-${u.source}`} className="border-t border-ink-850">
                        <td className="px-4 py-2 font-mono text-xs text-ink-200">{u.slug}</td>
                        <td className="px-4 py-2 text-xs text-ink-400">{u.source}</td>
                        <td className="px-4 py-2 text-xs text-ink-400">{u.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </Section>

          <Section title="Reproducing this yourself">
            <Prose>
              <p>
                Every published number regenerates from raw snapshots committed in the
                repository. Continuous integration re-runs the pipeline on every push and fails
                the build if the output differs from what is published by so much as a byte:
              </p>
              <pre className="overflow-x-auto rounded-lg border border-ink-800 bg-ink-900 p-4 font-mono text-xs text-ink-200">
{`git clone https://github.com/harsh-dev1/ai-model-index
cd ai-model-index && pnpm install
pnpm normalize && pnpm score   # rebuilds public/data/index.json`}
              </pre>
              <p>
                Index generated {shortDate(data.meta.generatedAt)} from data fetched{' '}
                {relativeTime(data.meta.generatedAt)}. Found a mistake?{' '}
                <a
                  className="text-accent hover:underline"
                  href="https://github.com/harsh-dev1/ai-model-index/issues"
                >
                  Open an issue
                </a>{' '}
                — corrections get made visibly, not quietly.
              </p>
            </Prose>
          </Section>
        </Page>
      )}
    </StateGate>
  );
}

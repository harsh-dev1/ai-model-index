import { useState } from 'react';
import type { AsyncState } from '../lib/data.ts';
import { useTrends } from '../lib/data.ts';
import type { IndexPayload } from '../lib/types.ts';
import { shortDate } from '../lib/format.ts';
import { Card, Empty, Page, Section, StateGate } from '../components/ui.tsx';
import EloTrendChart from '../components/charts/EloTrendChart.tsx';
import VendorShareChart from '../components/charts/VendorShareChart.tsx';

export default function TrendsPage({ state }: { state: AsyncState<IndexPayload> }) {
  const trends = useTrends();
  const [board, setBoard] = useState('text');

  return (
    <StateGate state={state}>
      {() => {
        const t = trends.data;
        const boards = t ? [...new Set(t.series.map((s) => s.board))].sort() : [];

        return (
          <Page>
            <div className="max-w-3xl">
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                How the ranking moved
              </h1>
              <p className="mt-4 text-lg leading-relaxed text-ink-400">
                A leaderboard tells you who is ahead today. This tells you who has been
                gaining — which is usually the more useful question, because the model you
                pick today has to still be a good choice in three months.
              </p>
              {t && t.firstDate && (
                <p className="mt-3 text-sm text-ink-400">
                  Daily snapshots from {shortDate(t.firstDate)} to {shortDate(t.lastDate)},
                  covering {t.series.length} model-board series. History before we started
                  collecting was backfilled from the public archive; everything since is
                  captured by this repository's own scheduled job.
                </p>
              )}
            </div>

            {trends.loading && (
              <div className="mt-10 h-96 animate-pulse rounded-xl bg-ink-900" aria-busy="true" />
            )}

            {trends.error && (
              <Card className="mt-10">
                <p className="text-sm text-bad">Could not load trend data: {trends.error}</p>
              </Card>
            )}

            {t && t.series.length === 0 && (
              <div className="mt-10">
                <Empty>
                  No history has been collected yet. The trend charts fill in once the
                  scheduled job has run.
                </Empty>
              </div>
            )}

            {t && t.series.length > 0 && (
              <>
                <Section
                  title="Elo over time"
                  subtitle="Head-to-head vote ratings on the Arena boards, day by day."
                >
                  <EloTrendChart
                    series={t.series}
                    board={boards.includes(board) ? board : boards[0]}
                    boards={boards}
                    onBoardChange={setBoard}
                  />
                </Section>

                <Section
                  title="The frontier race"
                  subtitle="Which labs have been holding places in the top ten, and which have been losing them."
                >
                  <VendorShareChart series={t.series} />
                </Section>

                <Section title="How to read these">
                  <Card>
                    <ul className="space-y-3 text-sm leading-relaxed text-ink-400">
                      <li>
                        <strong className="text-ink-200">Lines start and stop.</strong> A model
                        only has points for days it was actually on the board. Gaps are left
                        as gaps rather than interpolated, because drawing through a gap would
                        show a measurement that was never taken.
                      </li>
                      <li>
                        <strong className="text-ink-200">Falling Elo rarely means a model got worse.</strong>{' '}
                        Ratings are relative. A model losing points is usually being compared
                        against stronger new arrivals, not degrading.
                      </li>
                      <li>
                        <strong className="text-ink-200">Watch the gradient, not the position.</strong>{' '}
                        A model climbing steadily from the middle of the pack is often a better
                        signal about a lab than whoever happens to hold first place this week.
                      </li>
                    </ul>
                  </Card>
                </Section>
              </>
            )}
          </Page>
        );
      }}
    </StateGate>
  );
}

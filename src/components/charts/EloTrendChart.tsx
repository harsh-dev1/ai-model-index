import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TrendSeries } from '../../lib/types.ts';
import { shortDate, vendorColour } from '../../lib/format.ts';
import { AXIS, ChartFrame, GRID, TooltipBox } from './theme.tsx';

/**
 * Elo over time. Series are sparse and start on different dates, so every series is
 * plotted against a shared date axis with nulls preserved — connecting across a gap
 * would invent measurements that were never taken.
 */
export default function EloTrendChart({
  series,
  board,
  boards,
  onBoardChange,
}: {
  series: TrendSeries[];
  board: string;
  boards: string[];
  onBoardChange: (b: string) => void;
}) {
  const [limit, setLimit] = useState(10);

  const { rows, shown } = useMemo(() => {
    const forBoard = series.filter((s) => s.board === board);
    // Rank by most recent Elo so the chart opens on the current leaders.
    const ranked = [...forBoard].sort(
      (a, b) => (b.points.at(-1)?.elo ?? 0) - (a.points.at(-1)?.elo ?? 0),
    );
    const top = ranked.slice(0, limit);
    const dates = [...new Set(top.flatMap((s) => s.points.map((p) => p.date)))].sort();
    const rows = dates.map((date) => {
      const row: Record<string, string | number | null> = { date };
      for (const s of top) row[s.slug] = s.points.find((p) => p.date === date)?.elo ?? null;
      return row;
    });
    return { rows, shown: top };
  }, [series, board, limit]);

  if (series.length === 0) return null;

  return (
    <ChartFrame
      title="How the leaderboard actually moved"
      hint="Arena Elo over time, backfilled from the daily archive. Lines break where a model was not on the board that day rather than being connected across the gap."
      height={420}
      footer={
        <span>
          Showing the current top {shown.length} on the {board} board. A rising line means
          the model is winning more head-to-head votes; a flat line at the top usually means
          the model is being compared against newer rivals and holding.
        </span>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-1" role="group" aria-label="Leaderboard">
          {boards.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => onBoardChange(b)}
              aria-pressed={board === b}
              className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                board === b ? 'bg-accent text-ink-950' : 'bg-ink-800 text-ink-200 hover:bg-ink-700'
              }`}
            >
              {b}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-xs text-ink-400">
          Models
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="rounded-md border border-ink-700 bg-ink-850 px-2 py-1 text-ink-200"
          >
            {[5, 10, 15, 25].map((n) => (
              <option key={n} value={n}>
                Top {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ height: 340 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis
              dataKey="date"
              axisLine={{ stroke: AXIS.stroke }}
              tickLine={false}
              tick={AXIS.tick}
              minTickGap={48}
              tickFormatter={(v: string) => shortDate(v).replace(/ \d{4}$/, '')}
            />
            <YAxis
              // Snapped to multiples of 20 so the gridlines are evenly spaced; letting
              // Recharts end the axis on dataMax puts one odd interval at the top.
              domain={[
                (min: number) => Math.floor((min - 15) / 20) * 20,
                (max: number) => Math.ceil((max + 15) / 20) * 20,
              ]}
              axisLine={{ stroke: AXIS.stroke }}
              tickLine={false}
              tick={AXIS.tick}
              width={46}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const sorted = [...payload]
                  .filter((p) => p.value !== null && p.value !== undefined)
                  .sort((a, b) => (b.value as number) - (a.value as number));
                return (
                  <TooltipBox>
                    <p className="mb-1.5 font-semibold text-white">{shortDate(String(label))}</p>
                    {sorted.slice(0, 12).map((p) => {
                      const s = shown.find((x) => x.slug === p.dataKey);
                      return (
                        <div key={String(p.dataKey)} className="flex justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-ink-200">
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: p.color }}
                              aria-hidden="true"
                            />
                            {s?.name ?? String(p.dataKey)}
                          </span>
                          <span className="font-mono tabular-nums text-ink-200">
                            {Math.round(p.value as number)}
                          </span>
                        </div>
                      );
                    })}
                  </TooltipBox>
                );
              }}
            />
            {shown.map((s) => (
              <Line
                key={s.slug}
                type="monotone"
                dataKey={s.slug}
                name={s.name}
                stroke={vendorColour(s.vendor)}
                strokeWidth={1.8}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {shown.map((s) => (
          <li key={s.slug} className="flex items-center gap-1.5 text-xs text-ink-400">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: vendorColour(s.vendor) }}
              aria-hidden="true"
            />
            {s.name}
          </li>
        ))}
      </ul>
    </ChartFrame>
  );
}

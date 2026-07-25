import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TrendSeries } from '../../lib/types.ts';
import { shortDate, vendorColour } from '../../lib/format.ts';
import { AXIS, ChartFrame, GRID, TooltipBox, TooltipRow } from './theme.tsx';

const TOP_N = 10;

/**
 * Share of the Arena top ten held by each lab, over time.
 *
 * This is the frontier race in one picture: not who is ahead today, but who has been
 * holding ground and who has been losing it.
 */
export default function VendorShareChart({ series }: { series: TrendSeries[] }) {
  const { rows, vendors } = useMemo(() => {
    const forBoard = series.filter((s) => s.board === 'text');
    const dates = [...new Set(forBoard.flatMap((s) => s.points.map((p) => p.date)))].sort();
    const vendorSet = new Set<string>();

    const rows = dates.map((date) => {
      const onDate = forBoard
        .map((s) => ({ vendor: s.vendor, elo: s.points.find((p) => p.date === date)?.elo }))
        .filter((x): x is { vendor: string; elo: number } => x.elo !== undefined)
        .sort((a, b) => b.elo - a.elo)
        .slice(0, TOP_N);

      const row: Record<string, string | number> = { date };
      if (onDate.length === 0) return row;
      const counts = new Map<string, number>();
      for (const x of onDate) counts.set(x.vendor, (counts.get(x.vendor) ?? 0) + 1);
      for (const [vendor, n] of counts) {
        vendorSet.add(vendor);
        row[vendor] = (n / onDate.length) * 100;
      }
      return row;
    });

    // Fill absent vendors with 0 so the stack does not tear where a lab drops out.
    const vendors = [...vendorSet].sort();
    for (const row of rows) for (const v of vendors) row[v] ??= 0;

    return { rows: rows.filter((r) => vendors.some((v) => (r[v] as number) > 0)), vendors };
  }, [series]);

  if (rows.length < 2) return null;

  return (
    <ChartFrame
      title="Who holds the frontier"
      hint={`Share of the Arena text top ${TOP_N} held by each lab, day by day. Counts places on the board, not model quality — a lab with three mid-tier entries outranks one with a single champion.`}
      height={320}
      footer="A lab's band shrinking means rivals shipped, not that its models got worse."
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 0 }} stackOffset="expand">
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
            axisLine={{ stroke: AXIS.stroke }}
            tickLine={false}
            tick={AXIS.tick}
            width={42}
            tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const rows = payload
                .filter((p) => (p.value as number) > 0)
                .sort((a, b) => (b.value as number) - (a.value as number));
              const total = rows.reduce((s, p) => s + (p.value as number), 0) || 1;
              return (
                <TooltipBox>
                  <p className="mb-1.5 font-semibold text-white">{shortDate(String(label))}</p>
                  {rows.map((p) => (
                    <TooltipRow
                      key={String(p.dataKey)}
                      label={String(p.dataKey)}
                      value={`${Math.round(((p.value as number) / total) * 100)}%`}
                    />
                  ))}
                </TooltipBox>
              );
            }}
          />
          {vendors.map((v) => (
            <Area
              key={v}
              type="monotone"
              dataKey={v}
              stackId="1"
              stroke={vendorColour(v)}
              fill={vendorColour(v)}
              fillOpacity={0.7}
              strokeWidth={0.5}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {vendors.map((v) => (
          <li key={v} className="flex items-center gap-1.5 text-xs text-ink-400">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: vendorColour(v) }}
              aria-hidden="true"
            />
            {v}
          </li>
        ))}
      </ul>
    </ChartFrame>
  );
}

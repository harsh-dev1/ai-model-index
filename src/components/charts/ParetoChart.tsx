import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  ComposedChart,
} from 'recharts';
import type { ScoredModel } from '../../lib/scoring.ts';
import { usd, vendorColour } from '../../lib/format.ts';
import { AXIS, ChartFrame, GRID, TooltipBox, TooltipRow } from './theme.tsx';

interface Point {
  x: number;
  y: number;
  name: string;
  vendor: string;
  slug: string;
  onFrontier: boolean;
}

/**
 * Price against capability, with the efficient frontier drawn.
 *
 * The frontier is the actual answer to "what should I use": every model above the line
 * is beaten by something cheaper *and* better, so it is never the right pick unless you
 * need something specific from it.
 */
export default function ParetoChart({ models }: { models: ScoredModel[] }) {
  const { points, frontier } = useMemo(() => {
    const pts: Point[] = models
      .filter((m) => m.pricing && m.pricing.blendedPerM > 0)
      .map((m) => ({
        x: m.pricing!.blendedPerM,
        y: m.score,
        name: m.name,
        vendor: m.vendor,
        slug: m.slug,
        onFrontier: false,
      }));

    // Walk cheapest first; a model is on the frontier if nothing cheaper scores as well.
    const byPrice = [...pts].sort((a, b) => a.x - b.x);
    let best = -Infinity;
    const front: Point[] = [];
    for (const p of byPrice) {
      if (p.y > best) {
        best = p.y;
        p.onFrontier = true;
        front.push(p);
      }
    }
    return { points: pts, frontier: front };
  }, [models]);

  if (points.length === 0) return null;

  // Recharts' automatic domains produce ticks like 58.999999995 on a float dataset, and a
  // log axis left to itself picks two arbitrary prices. Both axes are pinned to round
  // numbers instead so the reader can actually place a point by eye.
  const scores = points.map((p) => p.y);
  const yLo = Math.max(0, Math.floor((Math.min(...scores) - 4) / 10) * 10);
  const yHi = Math.min(100, Math.ceil((Math.max(...scores) + 4) / 10) * 10);
  const yTicks: number[] = [];
  for (let v = yLo; v <= yHi; v += 10) yTicks.push(v);

  const prices = points.map((p) => p.x);
  const xLo = Math.min(...prices);
  const xHi = Math.max(...prices);
  const decades = [0.01, 0.03, 0.1, 0.3, 1, 3, 10, 30, 100, 300];
  const xTicks = decades.filter((d) => d >= xLo / 1.6 && d <= xHi * 1.6);

  const byVendor = new Map<string, Point[]>();
  for (const p of points) {
    const list = byVendor.get(p.vendor) ?? [];
    list.push(p);
    byVendor.set(p.vendor, list);
  }

  return (
    <ChartFrame
      title="What you get for what you pay"
      hint="Every eligible model plotted by blended price against its index score. The teal line is the efficient frontier — nothing cheaper scores higher. Models well above the line are paying for something this index does not measure."
      height={420}
      footer={`${frontier.length} of ${points.length} models sit on the frontier. Price axis is logarithmic.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart margin={{ top: 8, right: 16, bottom: 28, left: 4 }}>
          <CartesianGrid {...GRID} />
          <XAxis
            type="number"
            dataKey="x"
            scale="log"
            domain={[xLo * 0.7, xHi * 1.4]}
            ticks={xTicks}
            allowDataOverflow={false}
            axisLine={{ stroke: AXIS.stroke }}
            tickLine={false}
            tick={AXIS.tick}
            tickFormatter={(v: number) => `$${v}`}
            label={{
              value: 'Blended price per million tokens',
              position: 'insideBottom',
              offset: -16,
              fill: '#7c8aa6',
              fontSize: 12,
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[yLo, yHi]}
            ticks={yTicks}
            width={44}
            axisLine={{ stroke: AXIS.stroke }}
            tickLine={false}
            tick={AXIS.tick}
            label={{
              value: 'Index score',
              angle: -90,
              position: 'insideLeft',
              fill: '#7c8aa6',
              fontSize: 12,
            }}
          />
          <ZAxis range={[46, 46]} />
          <Tooltip
            cursor={{ strokeDasharray: '3 3', stroke: '#38425a' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as Point;
              return (
                <TooltipBox>
                  <p className="mb-1 font-semibold text-white">{p.name}</p>
                  <TooltipRow label="Score" value={p.y.toFixed(1)} />
                  <TooltipRow label="Price / M" value={usd(p.x)} />
                  {p.onFrontier && <p className="mt-1 text-accent">On the efficient frontier</p>}
                </TooltipBox>
              );
            }}
          />
          <Line
            data={frontier}
            dataKey="y"
            type="stepAfter"
            stroke="#5eead4"
            strokeWidth={1.5}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
            legendType="none"
          />
          {[...byVendor.entries()].map(([vendor, pts]) => (
            <Scatter
              key={vendor}
              name={vendor}
              data={pts}
              fill={vendorColour(vendor)}
              fillOpacity={0.85}
              isAnimationActive={false}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

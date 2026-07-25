import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import type { ScoredModel } from '../../lib/scoring.ts';
import { compactTokens, usd, vendorColour } from '../../lib/format.ts';
import { AXIS, ChartFrame, GRID, TooltipBox, TooltipRow } from './theme.tsx';

/**
 * Context window against price, sized by capability.
 *
 * Answers the question the headline ranking cannot: if the job is "read something very
 * long", which models can even hold it, and what do they cost?
 */
export default function ContextBubbleChart({ models }: { models: ScoredModel[] }) {
  const points = models
    .filter((m) => m.contextLength && m.pricing && m.pricing.blendedPerM > 0)
    .map((m) => ({
      x: m.contextLength!,
      y: m.pricing!.blendedPerM,
      z: Math.max(1, m.score),
      name: m.name,
      vendor: m.vendor,
      score: m.score,
    }));

  if (points.length === 0) return null;

  const byVendor = new Map<string, typeof points>();
  for (const p of points) {
    const list = byVendor.get(p.vendor) ?? [];
    list.push(p);
    byVendor.set(p.vendor, list);
  }

  return (
    <ChartFrame
      title="Context window against cost"
      hint="Bubble size is the index score. Bottom-right is the good corner: a large context window at a low price. Both axes are logarithmic."
      height={380}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 16, bottom: 28, left: 4 }}>
          <CartesianGrid {...GRID} />
          <XAxis
            type="number"
            dataKey="x"
            scale="log"
            domain={['auto', 'auto']}
            axisLine={{ stroke: AXIS.stroke }}
            tickLine={false}
            tick={AXIS.tick}
            tickFormatter={(v: number) => compactTokens(v)}
            label={{
              value: 'Context window (tokens)',
              position: 'insideBottom',
              offset: -16,
              fill: '#7c8aa6',
              fontSize: 12,
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            scale="log"
            domain={['auto', 'auto']}
            axisLine={{ stroke: AXIS.stroke }}
            tickLine={false}
            tick={AXIS.tick}
            width={54}
            tickFormatter={(v: number) => usd(v)}
            label={{
              value: 'Price / M tokens',
              angle: -90,
              position: 'insideLeft',
              fill: '#7c8aa6',
              fontSize: 12,
            }}
          />
          <ZAxis type="number" dataKey="z" range={[24, 320]} />
          <Tooltip
            cursor={{ strokeDasharray: '3 3', stroke: '#38425a' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as (typeof points)[number];
              return (
                <TooltipBox>
                  <p className="mb-1 font-semibold text-white">{p.name}</p>
                  <TooltipRow label="Context" value={compactTokens(p.x)} />
                  <TooltipRow label="Price / M" value={usd(p.y)} />
                  <TooltipRow label="Score" value={p.score.toFixed(1)} />
                </TooltipBox>
              );
            }}
          />
          {[...byVendor.entries()].map(([vendor, pts]) => (
            <Scatter
              key={vendor}
              name={vendor}
              data={pts}
              fill={vendorColour(vendor)}
              fillOpacity={0.55}
              stroke={vendorColour(vendor)}
              isAnimationActive={false}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

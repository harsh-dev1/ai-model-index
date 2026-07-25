import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ErrorBar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ScoredModel } from '../../lib/scoring.ts';
import { vendorColour } from '../../lib/format.ts';
import { AXIS, ChartFrame, GRID, TooltipBox, TooltipRow } from './theme.tsx';

/**
 * The ranking with its error bars shown, which is the whole point: most of the top of
 * this board is a statistical tie, and a bar chart without the bars would hide that.
 */
export default function ScoreRankChart({ models, count = 20 }: { models: ScoredModel[]; count?: number }) {
  const rows = models.slice(0, count).map((m) => ({
    name: m.name.length > 26 ? `${m.name.slice(0, 25)}…` : m.name,
    fullName: m.name,
    score: m.score,
    error: m.scoreUncertainty,
    vendor: m.vendor,
    rank: m.rank,
    tieGroup: m.tieGroup,
  }));

  if (rows.length === 0) return null;
  const tiers = new Set(rows.map((r) => r.tieGroup)).size;

  return (
    <ChartFrame
      title={`The index — top ${rows.length}`}
      hint="Bars are the composite score under the weights above. The whiskers are the uncertainty band; where two whiskers overlap, the models are tied and the order between them is noise."
      height={Math.max(320, rows.length * 26 + 60)}
      footer={`These ${rows.length} models resolve into ${tiers} genuinely distinct tiers.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
          <CartesianGrid {...GRID} horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            axisLine={{ stroke: AXIS.stroke }}
            tickLine={false}
            tick={AXIS.tick}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={178}
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#c3ccdd', fontSize: 11 }}
            interval={0}
          />
          <Tooltip
            cursor={{ fill: '#ffffff08' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as (typeof rows)[number];
              return (
                <TooltipBox>
                  <p className="mb-1 font-semibold text-white">{r.fullName}</p>
                  <TooltipRow label="Rank" value={`#${r.rank}`} />
                  <TooltipRow label="Score" value={`${r.score.toFixed(1)} ± ${r.error.toFixed(1)}`} />
                  <TooltipRow label="Vendor" value={r.vendor} />
                </TooltipBox>
              );
            }}
          />
          <Bar dataKey="score" radius={[0, 3, 3, 0]} isAnimationActive={false} barSize={15}>
            {rows.map((r) => (
              <Cell key={r.fullName} fill={vendorColour(r.vendor)} />
            ))}
            <ErrorBar dataKey="error" width={4} strokeWidth={1.2} stroke="#c3ccdd99" direction="x" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

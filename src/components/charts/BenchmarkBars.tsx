import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ModelRecord } from '../../lib/types.ts';
import { PILLARS } from '../../lib/types.ts';
import { AXIS, ChartFrame, GRID, TooltipBox, TooltipRow } from './theme.tsx';

const PILLAR_COLOURS: Record<string, string> = {
  reasoning: '#5eead4',
  coding: '#7dd3fc',
  agentic: '#c084fc',
  preference: '#fbbf24',
  cost: '#a3e635',
};

/** Every individual benchmark behind one model, with its raw published value. */
export default function BenchmarkBars({ model }: { model: ModelRecord }) {
  const rows = [...model.benchmarks]
    .sort((a, b) => b.normalised - a.normalised)
    .map((b) => ({
      label: b.label,
      normalised: b.normalised,
      display: b.display,
      pillar: b.pillar,
      stderr: b.stderr,
    }));

  if (rows.length === 0) return null;

  return (
    <ChartFrame
      title="Every benchmark behind the score"
      hint="Bars are the normalised position across the index (0 = weakest measured model, 100 = strongest). Hover for the raw published number."
      height={Math.max(240, rows.length * 30 + 50)}
      footer={
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          {PILLARS.filter((p) => rows.some((r) => r.pillar === p.id)).map((p) => (
            <span key={p.id} className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: PILLAR_COLOURS[p.id] }}
                aria-hidden="true"
              />
              {p.label}
            </span>
          ))}
        </span>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 4 }}>
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
            dataKey="label"
            width={158}
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
                  <p className="mb-1 font-semibold text-white">{r.label}</p>
                  <TooltipRow label="Published score" value={r.display} />
                  <TooltipRow label="Normalised" value={r.normalised.toFixed(0)} />
                  {r.stderr !== null && (
                    <TooltipRow label="Std. error" value={`± ${(r.stderr * 100).toFixed(1)}pp`} />
                  )}
                </TooltipBox>
              );
            }}
          />
          <Bar dataKey="normalised" radius={[0, 3, 3, 0]} isAnimationActive={false} barSize={16}>
            {rows.map((r) => (
              <Cell key={r.label} fill={PILLAR_COLOURS[r.pillar] ?? '#7c8aa6'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

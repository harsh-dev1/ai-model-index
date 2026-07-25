import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { ModelRecord } from '../../lib/types.ts';
import { PILLARS } from '../../lib/types.ts';
import { vendorColour } from '../../lib/format.ts';
import { ChartFrame, TooltipBox, TooltipRow } from './theme.tsx';

/** Shape of a model's strengths. Overlaying several makes trade-offs obvious at a glance. */
export default function PillarRadar({
  models,
  title = 'Where its strength actually is',
  hint,
  height = 340,
}: {
  models: ModelRecord[];
  title?: string;
  hint?: string;
  height?: number;
}) {
  if (models.length === 0) return null;

  const rows = PILLARS.map((p) => {
    const row: Record<string, string | number | null> = { pillar: p.label.replace(' & knowledge', '') };
    for (const m of models) row[m.slug] = m.pillarScores[p.id] ?? null;
    return row;
  });

  return (
    <ChartFrame
      title={title}
      hint={
        hint ??
        'Each axis is a pillar, standardised so 50 is the average model in the index. A spiky shape means a specialist; a round one means an all-rounder.'
      }
      height={height}
      footer={
        models.some((m) => Object.keys(m.pillarScores).length < PILLARS.length)
          ? 'A missing axis means nobody has published that measurement for this model — not that it scored zero.'
          : undefined
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={rows} outerRadius="72%">
          <PolarGrid stroke="#232b3a" />
          <PolarAngleAxis dataKey="pillar" tick={{ fill: '#7c8aa6', fontSize: 11 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#4a5568', fontSize: 9 }} axisLine={false} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <TooltipBox>
                  <p className="mb-1 font-semibold text-white">{String(label)}</p>
                  {payload.map((p) => {
                    const m = models.find((x) => x.slug === p.dataKey);
                    return (
                      <TooltipRow
                        key={String(p.dataKey)}
                        label={m?.name ?? String(p.dataKey)}
                        value={p.value === null ? 'no data' : (p.value as number).toFixed(0)}
                      />
                    );
                  })}
                </TooltipBox>
              );
            }}
          />
          {models.map((m, i) => (
            <Radar
              key={m.slug}
              name={m.name}
              dataKey={m.slug}
              stroke={models.length === 1 ? '#5eead4' : vendorColour(m.vendor)}
              fill={models.length === 1 ? '#5eead4' : vendorColour(m.vendor)}
              fillOpacity={models.length === 1 ? 0.25 : 0.14}
              strokeWidth={1.8}
              isAnimationActive={false}
              // Recharts needs a stable stroke per series when several overlap.
              strokeDasharray={i > 2 ? '4 2' : undefined}
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

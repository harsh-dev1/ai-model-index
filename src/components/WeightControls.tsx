import type { PillarId, Weights } from '../lib/types.ts';
import { PILLARS, PRESETS } from '../lib/types.ts';

/**
 * The sliders are the honesty mechanism of the whole site: they let a visitor discover
 * that the default ranking depends on my choices, and rebuild it under theirs.
 */
export default function WeightControls({
  weights,
  onChange,
  activePreset,
  onPreset,
}: {
  weights: Weights;
  onChange: (w: Weights) => void;
  activePreset: string | null;
  onPreset: (id: string) => void;
}) {
  const total = PILLARS.reduce((s, p) => s + weights[p.id], 0);

  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-white">Weight it your way</h2>
        <p className="text-xs text-ink-400">
          Weights are relative, so they need not add to 100 (currently {total.toFixed(0)}).
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPreset(p.id)}
            title={p.blurb}
            aria-pressed={activePreset === p.id}
            className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              activePreset === p.id
                ? 'bg-accent text-ink-950'
                : 'bg-ink-800 text-ink-200 hover:bg-ink-700'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {activePreset && (
        <p className="mt-2.5 text-xs text-ink-400">
          {PRESETS.find((p) => p.id === activePreset)?.blurb}
        </p>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PILLARS.map((pillar) => (
          <div key={pillar.id}>
            <label
              htmlFor={`weight-${pillar.id}`}
              className="flex items-baseline justify-between gap-2 text-sm"
            >
              <span className="text-ink-200">{pillar.label}</span>
              <span className="font-mono text-xs tabular-nums text-accent">
                {weights[pillar.id].toFixed(0)}
              </span>
            </label>
            <input
              id={`weight-${pillar.id}`}
              type="range"
              min={0}
              max={50}
              step={1}
              value={weights[pillar.id]}
              onChange={(e) =>
                onChange({ ...weights, [pillar.id as PillarId]: Number(e.target.value) })
              }
              className="mt-2 w-full accent-[var(--color-accent)]"
              aria-describedby={`weight-desc-${pillar.id}`}
            />
            <p id={`weight-desc-${pillar.id}`} className="mt-1.5 text-xs leading-snug text-ink-400">
              {pillar.blurb}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

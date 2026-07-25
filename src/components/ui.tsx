import type { ReactNode } from 'react';
import { scoreColour } from '../lib/format.ts';
import type { AsyncState } from '../lib/data.ts';

export function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">{children}</div>;
}

export function Section({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-3xl">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          {subtitle && <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{subtitle}</p>}
        </div>
        {actions}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-ink-800 bg-ink-900 p-4 sm:p-5 ${className}`}>
      {children}
    </div>
  );
}

export function ScoreChip({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' }) {
  const colour = scoreColour(score);
  return (
    <span
      className={`inline-flex items-center rounded-md font-mono font-semibold tabular-nums ${
        size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm'
      }`}
      style={{ backgroundColor: `${colour}1f`, color: colour }}
    >
      {score.toFixed(1)}
    </span>
  );
}

/** Horizontal 0-100 bar used inside dense tables. */
export function MiniBar({ value, colour }: { value: number; colour?: string }) {
  const c = colour ?? scoreColour(value);
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-full max-w-24 overflow-hidden rounded-full bg-ink-800">
        <span
          className="block h-full rounded-full"
          style={{ width: `${Math.max(2, Math.min(100, value))}%`, backgroundColor: c }}
        />
      </span>
      <span className="w-9 shrink-0 text-right font-mono text-xs tabular-nums text-ink-400">
        {value.toFixed(0)}
      </span>
    </span>
  );
}

export function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'warn' }) {
  const tones = {
    neutral: 'bg-ink-800 text-ink-200',
    accent: 'bg-accent/10 text-accent',
    warn: 'bg-warn/15 text-warn',
  };
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

/** Renders loading and error states once so no page has to reinvent them. */
export function StateGate<T>({
  state,
  children,
}: {
  state: AsyncState<T>;
  children: (data: T) => ReactNode;
}) {
  if (state.loading) {
    return (
      <Page>
        <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
          <div className="h-8 w-64 rounded bg-ink-800" />
          <div className="h-4 w-96 max-w-full rounded bg-ink-850" />
          <div className="h-72 rounded-xl bg-ink-900" />
        </div>
      </Page>
    );
  }
  if (state.error || !state.data) {
    return (
      <Page>
        <Card>
          <h1 className="text-lg font-semibold text-bad">Could not load the index</h1>
          <p className="mt-2 text-sm text-ink-400">{state.error ?? 'No data was returned.'}</p>
          <p className="mt-2 text-sm text-ink-400">
            The data files are built by a scheduled job. If this persists, the last run may
            have failed — the run log is public on GitHub.
          </p>
        </Card>
      </Page>
    );
  }
  return <>{children(state.data)}</>;
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-ink-700 p-8 text-center text-sm text-ink-400">
      {children}
    </div>
  );
}

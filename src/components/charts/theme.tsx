import type { ReactNode } from 'react';

export const AXIS = {
  stroke: '#38425a',
  tick: { fill: '#7c8aa6', fontSize: 11 },
} as const;

export const GRID = { stroke: '#1b2231', strokeDasharray: '3 3' } as const;

export function ChartFrame({
  title,
  hint,
  height = 340,
  children,
  footer,
}: {
  title: string;
  hint?: ReactNode;
  height?: number;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <figure className="rounded-xl border border-ink-800 bg-ink-900 p-4 sm:p-5">
      <figcaption className="mb-4">
        <h3 className="font-semibold text-white">{title}</h3>
        {hint && <p className="mt-1 text-sm leading-relaxed text-ink-400">{hint}</p>}
      </figcaption>
      <div style={{ height }}>{children}</div>
      {footer && <div className="mt-3 text-xs text-ink-400">{footer}</div>}
    </figure>
  );
}

export function TooltipBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-xs shadow-xl">
      {children}
    </div>
  );
}

export function TooltipRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-ink-400">{label}</span>
      <span className="font-mono tabular-nums text-ink-200">{value}</span>
    </div>
  );
}

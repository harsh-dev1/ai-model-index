import { NavLink, Outlet } from 'react-router-dom';
import type { SourceMeta } from '../lib/types.ts';
import { relativeTime } from '../lib/format.ts';

const NAV = [
  { to: '/', label: 'The Index', end: true },
  { to: '/trends', label: 'Trends' },
  { to: '/compare', label: 'Compare' },
  { to: '/methodology', label: 'Methodology' },
];

export function FreshnessBadge({ sources }: { sources: SourceMeta[] }) {
  const stale = sources.filter((s) => s.stale);
  const newest = sources.map((s) => s.fetchedAt).sort().at(-1);
  if (stale.length > 0) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-warn/15 px-2.5 py-1 text-xs font-medium text-warn"
        title={`Stale: ${stale.map((s) => s.label).join(', ')}`}
      >
        <span className="size-1.5 rounded-full bg-warn" aria-hidden="true" />
        {stale.length} source{stale.length === 1 ? '' : 's'} stale
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
      <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
      Updated {newest ? relativeTime(newest) : 'recently'}
    </span>
  );
}

export default function Layout({ sources }: { sources: SourceMeta[] }) {
  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-ink-950"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-ink-800 bg-ink-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <NavLink to="/" className="flex items-center gap-2.5 font-semibold text-white">
            <span
              className="grid size-7 place-items-center rounded-md bg-accent font-mono text-sm text-ink-950"
              aria-hidden="true"
            >
              ai
            </span>
            <span>Model Index</span>
          </NavLink>

          <nav aria-label="Main" className="order-3 -mx-1 w-full overflow-x-auto sm:order-none sm:mx-0 sm:w-auto">
            <ul className="flex gap-1">
              {NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `block rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
                        isActive ? 'bg-ink-800 text-white' : 'text-ink-400 hover:text-ink-200'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {sources.length > 0 && <FreshnessBadge sources={sources} />}
            <a
              href="https://github.com/harsh-dev1/ai-model-index"
              className="text-sm text-ink-400 transition-colors hover:text-ink-200"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </div>
        </div>
      </header>

      <main id="main">
        <Outlet />
      </main>

      <footer className="mt-20 border-t border-ink-800 py-10">
        <div className="mx-auto max-w-7xl px-4 text-sm text-ink-400 sm:px-6">
          <p className="max-w-3xl">
            Data from{' '}
            <a className="text-accent hover:underline" href="https://epoch.ai/benchmarks">
              Epoch AI's Benchmarking Hub
            </a>{' '}
            (CC-BY 4.0),{' '}
            <a className="text-accent hover:underline" href="https://arena.ai/leaderboard">
              Arena AI
            </a>{' '}
            and{' '}
            <a className="text-accent hover:underline" href="https://openrouter.ai">
              OpenRouter
            </a>
            . The composite index is my own and is not endorsed by any of them.
          </p>
          <p className="mt-3">
            Every number here is re-derivable from the raw snapshots committed in the
            repository. If you think the ranking is wrong,{' '}
            <a
              className="text-accent hover:underline"
              href="https://github.com/harsh-dev1/ai-model-index/issues"
            >
              say so
            </a>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}

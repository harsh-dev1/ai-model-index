import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ScoredModel } from '../lib/scoring.ts';
import { PILLARS } from '../lib/types.ts';
import { compactTokens, usd, vendorColour } from '../lib/format.ts';
import { MiniBar, ScoreChip, Tag } from './ui.tsx';

type SortKey = 'rank' | 'name' | 'vendor' | 'price' | 'context' | (typeof PILLARS)[number]['id'];

export default function IndexTable({ models }: { models: ScoredModel[] }) {
  const [query, setQuery] = useState('');
  const [vendor, setVendor] = useState('all');
  const [sort, setSort] = useState<SortKey>('rank');
  const [asc, setAsc] = useState(true);

  const vendors = useMemo(
    () => [...new Set(models.map((m) => m.vendor))].sort(),
    [models],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = models.filter(
      (m) =>
        (vendor === 'all' || m.vendor === vendor) &&
        (q === '' || m.name.toLowerCase().includes(q) || m.slug.includes(q)),
    );
    const dir = asc ? 1 : -1;
    const value = (m: ScoredModel): number | string => {
      switch (sort) {
        case 'rank':
          return m.rank;
        case 'name':
          return m.name.toLowerCase();
        case 'vendor':
          return m.vendor.toLowerCase();
        case 'price':
          return m.pricing?.blendedPerM ?? Number.POSITIVE_INFINITY;
        case 'context':
          return -(m.contextLength ?? 0);
        default:
          return -(m.pillarScores[sort] ?? -1);
      }
    };
    return [...filtered].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (typeof va === 'string' || typeof vb === 'string') {
        return String(va).localeCompare(String(vb)) * dir;
      }
      return (va - vb) * dir;
    });
  }, [models, query, vendor, sort, asc]);

  function header(key: SortKey, label: string, className = '') {
    const active = sort === key;
    return (
      <th scope="col" className={`px-3 py-2 font-medium ${className}`}>
        <button
          type="button"
          onClick={() => {
            if (active) setAsc(!asc);
            else {
              setSort(key);
              setAsc(true);
            }
          }}
          className={`inline-flex items-center gap-1 transition-colors hover:text-ink-200 ${
            active ? 'text-accent' : ''
          }`}
          aria-sort={active ? (asc ? 'ascending' : 'descending') : 'none'}
        >
          {label}
          <span aria-hidden="true" className="text-[10px]">
            {active ? (asc ? '▲' : '▼') : '↕'}
          </span>
        </button>
      </th>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="model-search">
          Search models
        </label>
        <input
          id="model-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search models…"
          className="w-full max-w-xs rounded-md border border-ink-700 bg-ink-900 px-3 py-1.5 text-sm text-ink-200 placeholder:text-ink-600"
        />
        <label className="sr-only" htmlFor="vendor-filter">
          Filter by vendor
        </label>
        <select
          id="vendor-filter"
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          className="rounded-md border border-ink-700 bg-ink-900 px-2.5 py-1.5 text-sm text-ink-200"
        >
          <option value="all">All vendors</option>
          {vendors.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <p className="ml-auto text-xs text-ink-400">
          {rows.length} of {models.length} models
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-ink-800">
        <table className="w-full min-w-3xl border-collapse text-sm">
          <caption className="sr-only">
            AI models ranked by the composite index, with pillar scores, price and context window
          </caption>
          <thead className="bg-ink-900 text-left text-xs text-ink-400">
            <tr>
              {header('rank', '#', 'w-14')}
              {header('name', 'Model')}
              {header('vendor', 'Vendor', 'hidden lg:table-cell')}
              <th scope="col" className="px-3 py-2 font-medium">
                Score
              </th>
              {PILLARS.filter((p) => p.id !== 'cost').map((p) =>
                header(p.id, p.label.split(' ')[0], 'hidden xl:table-cell'),
              )}
              {header('price', 'Price / M', 'text-right')}
              {header('context', 'Context', 'hidden sm:table-cell text-right')}
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => {
              const prev = rows[i - 1];
              const newTier = sort === 'rank' && asc && prev && prev.tieGroup !== m.tieGroup;
              return (
                <Fragment key={m.slug}>
                  {newTier && (
                    <tr aria-hidden="true">
                      <td colSpan={10} className="h-px bg-ink-700 p-0" />
                    </tr>
                  )}
                  <tr className="border-t border-ink-850 transition-colors hover:bg-ink-900/60">
                    <td className="px-3 py-2 font-mono text-xs tabular-nums text-ink-400">
                      {m.rank}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        to={`/model/${m.slug}`}
                        className="font-medium text-ink-200 transition-colors hover:text-accent"
                      >
                        {m.name}
                      </Link>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 lg:hidden">
                        <span
                          className="text-xs"
                          style={{ color: vendorColour(m.vendor) }}
                        >
                          {m.vendor}
                        </span>
                      </span>
                      {m.coverage < 0.8 && (
                        <span className="ml-2 align-middle">
                          <Tag tone="warn">thin data</Tag>
                        </span>
                      )}
                    </td>
                    <td className="hidden px-3 py-2 lg:table-cell">
                      <span style={{ color: vendorColour(m.vendor) }}>{m.vendor}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <ScoreChip score={m.score} size="sm" />
                      <span className="ml-1.5 font-mono text-[10px] text-ink-600">
                        ±{m.scoreUncertainty.toFixed(1)}
                      </span>
                    </td>
                    {PILLARS.filter((p) => p.id !== 'cost').map((p) => {
                      const v = m.pillarScores[p.id];
                      return (
                        <td key={p.id} className="hidden px-3 py-2 xl:table-cell">
                          {v === undefined ? (
                            <span className="text-xs text-ink-600" title="Not measured">
                              —
                            </span>
                          ) : (
                            <MiniBar value={v} />
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-ink-200">
                      {usd(m.pricing?.blendedPerM)}
                    </td>
                    <td className="hidden px-3 py-2 text-right font-mono text-xs tabular-nums text-ink-400 sm:table-cell">
                      {compactTokens(m.contextLength)}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {sort === 'rank' && asc && (
        <p className="mt-2.5 text-xs text-ink-400">
          Horizontal rules separate statistical tiers. Models between two rules have
          overlapping uncertainty bands, so their order relative to each other is not
          meaningful.
        </p>
      )}
    </div>
  );
}

/**
 * Build the Arena Elo history that the trend charts run on.
 *
 * The upstream archive keeps one dated folder per day. We pull every day once, fold it
 * into a compact history file, and from then on only fetch days we do not already have —
 * so the 6-hourly job costs a handful of requests, not hundreds.
 *
 * Once folded in, the history lives in this repo. If the upstream archive stops or
 * disappears, the charts keep working and we simply stop gaining new points.
 */
import { join } from 'node:path';
import { canonicalSlug, canonicalVendor } from '../src/lib/identity.ts';
import { HISTORY_DIR, fetchJson, mapLimit, readJson, writeJson } from './lib/io.ts';

const REPO = 'oolong-tea-2026/arena-ai-leaderboards';
const RAW = `https://raw.githubusercontent.com/${REPO}/main/data`;
const CONTENTS = `https://api.github.com/repos/${REPO}/contents/data`;

/** Boards worth a time series. Image and video boards are a different product question. */
const BOARDS = ['text', 'code', 'agent'] as const;

export interface HistoryPayload {
  generatedAt: string;
  boards: Record<
    string,
    {
      dates: string[];
      series: Record<string, { name: string; vendor: string; elo: Array<number | null> }>;
    }
  >;
}

const historyPath = join(HISTORY_DIR, 'arena.json');

let history: HistoryPayload;
try {
  history = readJson<HistoryPayload>(historyPath);
} catch {
  history = { generatedAt: '', boards: {} };
}
for (const b of BOARDS) history.boards[b] ??= { dates: [], series: {} };

const listing = await fetchJson<Array<{ name: string; type: string }>>(CONTENTS);
const allDates = listing
  .filter((e) => e.type === 'dir' && /^\d{4}-\d{2}-\d{2}$/.test(e.name))
  .map((e) => e.name)
  .sort();

const known = new Set(history.boards[BOARDS[0]].dates);
const missing = allDates.filter((d) => !known.has(d));

console.log(`Archive has ${allDates.length} days (${allDates[0]} → ${allDates.at(-1)}).`);
if (missing.length === 0) {
  console.log('History already complete; nothing to fetch.');
} else {
  console.log(`Fetching ${missing.length} new day(s) across ${BOARDS.length} boards...`);
}

interface DayResult {
  date: string;
  board: string;
  models: Array<{ model: string; vendor: string | null; score: number | null }>;
}

const jobs: Array<{ date: string; board: string }> = [];
for (const date of missing) for (const board of BOARDS) jobs.push({ date, board });

let done = 0;
const results = await mapLimit(jobs, 8, async ({ date, board }): Promise<DayResult | null> => {
  try {
    const d = await fetchJson<{ models: DayResult['models'] }>(`${RAW}/${date}/${board}.json`);
    return { date, board, models: d.models ?? [] };
  } catch {
    // A board that did not exist yet on an early date is normal, not an error.
    return null;
  } finally {
    done += 1;
    if (done % 60 === 0) console.log(`  ...${done}/${jobs.length}`);
  }
});

// Fold results in, keeping every board's series aligned to its own date axis.
for (const board of BOARDS) {
  const bucket = history.boards[board];
  const newDates = [...new Set(results.filter((r) => r?.board === board).map((r) => r!.date))].sort();
  if (newDates.length === 0) continue;

  const mergedDates = [...new Set([...bucket.dates, ...newDates])].sort();
  const indexOf = new Map(mergedDates.map((d, i) => [d, i]));

  // Re-lay every existing series onto the merged axis before adding new points.
  const rebuilt: typeof bucket.series = {};
  for (const [slug, s] of Object.entries(bucket.series)) {
    const elo = new Array<number | null>(mergedDates.length).fill(null);
    bucket.dates.forEach((d, i) => {
      const target = indexOf.get(d);
      if (target !== undefined) elo[target] = s.elo[i] ?? null;
    });
    rebuilt[slug] = { ...s, elo };
  }

  for (const r of results) {
    if (!r || r.board !== board) continue;
    const col = indexOf.get(r.date);
    if (col === undefined) continue;
    for (const m of r.models) {
      const slug = canonicalSlug(m.model);
      if (!slug || m.score === null) continue;
      rebuilt[slug] ??= {
        name: m.model,
        vendor: canonicalVendor(m.vendor),
        elo: new Array<number | null>(mergedDates.length).fill(null),
      };
      // Keep the strongest configuration on days where variants both appear.
      const prev = rebuilt[slug].elo[col];
      rebuilt[slug].elo[col] = prev === null ? m.score : Math.max(prev, m.score);
      if (rebuilt[slug].vendor === 'Unknown' && m.vendor) {
        rebuilt[slug].vendor = canonicalVendor(m.vendor);
      }
    }
  }

  bucket.dates = mergedDates;
  bucket.series = Object.fromEntries(Object.entries(rebuilt).sort(([a], [b]) => a.localeCompare(b)));
}

history.generatedAt = new Date().toISOString();
writeJson(historyPath, history);

for (const board of BOARDS) {
  const b = history.boards[board];
  const points = Object.values(b.series).reduce(
    (s, x) => s + x.elo.filter((v) => v !== null).length,
    0,
  );
  console.log(
    `  ${board.padEnd(6)} ${String(b.dates.length).padStart(3)} days · ${String(Object.keys(b.series).length).padStart(3)} models · ${points} data points`,
  );
}

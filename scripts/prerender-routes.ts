/**
 * Give every client-side route a real file on disk.
 *
 * GitHub Pages has no rewrite rule, so the usual SPA trick is to copy index.html to
 * 404.html and let the app boot from the error page. That works for a human, but the
 * response is still an HTTP 404: link previews stay blank and crawlers skip the page.
 * Writing <route>/index.html for each known route makes every URL a genuine 200, and the
 * 404.html copy stays as the fallback for anything not listed here.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const shell = readFileSync(join(dist, 'index.html'), 'utf8');
const index = JSON.parse(readFileSync(join(root, 'public/data/index.json'), 'utf8')) as {
  models: Array<{ slug: string }>;
};

const routes = [
  'trends',
  'compare',
  'methodology',
  ...index.models.map((m) => `model/${m.slug}`),
];

for (const route of routes) {
  const dir = join(dist, route);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), shell);
}

// Anything genuinely unknown — a deleted model, a typo — still boots the app, which
// redirects to the index rather than showing a bare Pages error page.
writeFileSync(join(dist, '404.html'), shell);

console.log(`Wrote ${routes.length} route files plus the 404 fallback.`);

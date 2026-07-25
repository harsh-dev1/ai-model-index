export function usd(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (value === 0) return 'free';
  if (value < 0.01) return `$${value.toFixed(4)}`;
  if (value < 1) return `$${value.toFixed(3)}`;
  if (value < 100) return `$${value.toFixed(2)}`;
  return `$${Math.round(value)}`;
}

export function compactTokens(n: number | null | undefined): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

export function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return 'unknown';
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function shortDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Stable colour per vendor so a lab keeps its colour across every chart on the site. */
const VENDOR_COLOURS: Record<string, string> = {
  Anthropic: '#d97757',
  OpenAI: '#10a37f',
  Google: '#4285f4',
  xAI: '#c084fc',
  Meta: '#0084ff',
  DeepSeek: '#4d6bfe',
  Alibaba: '#ff6a00',
  Moonshot: '#16b8a6',
  'Z.ai': '#f5c542',
  Mistral: '#fa5210',
  MiniMax: '#e8618c',
  Microsoft: '#6ba4e7',
  Amazon: '#ff9900',
  Cohere: '#39594d',
  NVIDIA: '#76b900',
  Perplexity: '#20808d',
  ByteDance: '#325ab4',
  Baidu: '#2932e1',
};
const FALLBACK = ['#94a3b8', '#a3a3a3', '#78716c', '#8b8b8b'];

export function vendorColour(vendor: string): string {
  if (VENDOR_COLOURS[vendor]) return VENDOR_COLOURS[vendor];
  let hash = 0;
  for (let i = 0; i < vendor.length; i += 1) hash = (hash * 31 + vendor.charCodeAt(i)) >>> 0;
  return FALLBACK[hash % FALLBACK.length];
}

/** Teal→amber→red ramp used for score chips. */
export function scoreColour(score: number): string {
  if (score >= 70) return '#5eead4';
  if (score >= 60) return '#7dd3a0';
  if (score >= 50) return '#c7d97a';
  if (score >= 40) return '#fbbf24';
  return '#f87171';
}

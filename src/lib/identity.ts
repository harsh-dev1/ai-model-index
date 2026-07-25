/**
 * Cross-source model identity.
 *
 * The same model is named three different ways by our three sources:
 *   Epoch      "gpt-5.2-2025-12-11_xhigh"   "claude-opus-5_max"
 *   Arena      "gpt-5-2-high"               "claude-fable-5-(high)"
 *   OpenRouter "openai/gpt-5.2"             "anthropic/claude-opus-5-fast"
 *
 * Everything here is pure and deterministic so the join is reproducible and testable.
 * Rules were derived by diffing the three live source lists, not guessed — see
 * plan/DECISION-REGISTER.md and the unmatched report emitted on every run.
 */

/**
 * Suffixes stripped repeatedly until the slug stops changing. Order matters only for
 * speed, not correctness, because the loop runs to a fixed point.
 *
 * Deliberately NOT stripped: -pro, -mini, -nano, -flash, -lite, -chat, -codex, -image.
 * Those denote genuinely different models, and collapsing them would silently merge
 * two models into one row — the exact failure this module exists to prevent.
 */
const STRIP_PATTERNS: RegExp[] = [
  /-\d{4}-\d{2}-\d{2}$/, // ISO release stamp: gpt-5.2-2025-12-11
  /-\d{8}$/, // compact stamp: qwen3-7-max-20260517
  /-(codex-harness|harness|multi-agent)$/, // evaluation harness, not the model
  /-(promax|xhigh|max|high|medium|low|minimal|none|unknown|instant)$/, // reasoning effort
  /-(thinking|reasoning|nonthinking|non)$/, // reasoning mode
  /-(preview|latest|exp|experimental|pre-release|stable|customtools|fast)-?\d{0,4}$/,
  /-beta\d*-?\d{0,4}$/,
  /-(search|grounding)$/, // web-access variant of the same base model
  /-(32k|64k|128k|256k|1m)$/, // context-window variant
];

/** Vendor prefixes that appear on one source but not the others. */
const PREFIX_PATTERNS: RegExp[] = [/^api-/, /^ppl-/];

/**
 * Reduce any source's model string to a canonical slug.
 * Returns '' for empty input so callers can filter cheaply.
 */
export function canonicalSlug(raw: string | null | undefined): string {
  if (!raw) return '';
  let s = raw.toLowerCase().trim();

  for (const p of PREFIX_PATTERNS) s = s.replace(p, '');
  s = s.replace(/^[a-z0-9_.-]+\//, ''); // openrouter's "anthropic/" style namespace
  s = s.replace(/[:@].*$/, ''); // openrouter variant tags such as ":free"
  s = s.replace(/[_.\s]/g, '-').replace(/[()[\]]/g, '');
  s = collapse(s);

  // Run to a fixed point: "gpt-5-5-xhigh-codex-harness" needs two passes.
  for (let guard = 0; guard < 12; guard += 1) {
    let changed = false;
    for (const p of STRIP_PATTERNS) {
      const next = s.replace(p, '');
      if (next !== s && next.length > 0) {
        s = next;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return collapse(s);
}

function collapse(s: string): string {
  return s.replace(/-+/g, '-').replace(/^-|-$/g, '');
}

/** Reasoning effort a source encoded in the model string, if any. */
export function extractEffort(raw: string): string | null {
  const m = raw
    .toLowerCase()
    .match(/[_-]\(?(promax|xhigh|max|high|medium|low|minimal)\)?$/);
  return m ? m[1] : null;
}

/** True when the source string denotes a web-search / grounded variant. */
export function isSearchVariant(raw: string): boolean {
  return /[_-]\(?(search|grounding)\)?$/i.test(raw.trim());
}

/**
 * Sources disagree on organisation names ("Google" vs "Google DeepMind", "Z.ai" vs
 * "Z.ai (Zhipu AI)"). Left alone this splits one vendor into two on every chart that
 * groups by vendor, which is the kind of quiet error nobody notices until the chart is
 * wrong in public.
 */
export function canonicalVendor(raw: string | null | undefined): string {
  if (!raw) return 'Unknown';
  const s = raw.trim();
  const table: Array<[RegExp, string]> = [
    [/^google/i, 'Google'],
    [/^(openai|open ai)/i, 'OpenAI'],
    [/^anthropic/i, 'Anthropic'],
    [/^(z\.?ai|zhipu)/i, 'Z.ai'],
    [/^(x\.?ai)/i, 'xAI'],
    [/^(meta|facebook)/i, 'Meta'],
    [/^(alibaba|qwen)/i, 'Alibaba'],
    [/^(moonshot)/i, 'Moonshot'],
    [/^(deepseek)/i, 'DeepSeek'],
    [/^(mistral)/i, 'Mistral'],
    [/^(microsoft)/i, 'Microsoft'],
    [/^(amazon|aws)/i, 'Amazon'],
    [/^(cohere)/i, 'Cohere'],
    [/^(minimax)/i, 'MiniMax'],
    [/^(perplexity)/i, 'Perplexity'],
    [/^(bytedance)/i, 'ByteDance'],
    [/^(baidu)/i, 'Baidu'],
    [/^(nvidia)/i, 'NVIDIA'],
    [/^(ai21)/i, 'AI21'],
    [/^(tencent)/i, 'Tencent'],
  ];
  for (const [re, name] of table) if (re.test(s)) return name;
  return s.replace(/\s*\(.*?\)\s*$/, '').trim() || 'Unknown';
}

/**
 * Words that describe how a model was *run*, not which model it is: reasoning effort,
 * thinking mode, provider tier. Sources bake these into the label, which is how you end
 * up reading "gpt-oss-120b (unknown thinking)" on a leaderboard.
 */
const RUN_QUALIFIERS = new Set([
  'max',
  'xhigh',
  'high',
  'medium',
  'low',
  'minimal',
  'none',
  'pro',
  'promax',
  'thinking',
  'non-thinking',
  'nonthinking',
  'no thinking',
  'reasoning',
  'unknown',
  'unknown thinking',
  'default',
  'standard',
  'extended thinking',
  'instant',
  // Inference hosts. Which provider served the weights is not which model it is.
  'together',
  'novita',
  'fireworks',
  'deepinfra',
  'groq',
  'hyperbolic',
  'nebius',
]);

/** Thinking budgets: "128k thinking", "64k thinking". Same model, different leash. */
const BUDGET_QUALIFIER = /^\d+k\s+thinking$/;

/**
 * A model label fit to print.
 *
 * Two things get removed: the vendor prefix, because the vendor already has its own
 * column, and a trailing parenthetical made up entirely of run qualifiers. Anything else
 * in parentheses stays — "(Nov 2024)" and "(Preview)" distinguish real, separately
 * ranked models, and dropping those would make two different rows look identical.
 */
export function displayName(raw: string | null | undefined, vendor?: string): string {
  if (!raw) return '';
  let s = raw.trim();

  if (vendor && vendor !== 'Unknown') {
    s = s.replace(new RegExp(`^${vendor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:|-]\\s*`, 'i'), '');
  }
  s = s.replace(/^[A-Za-z0-9.\s]{2,20}:\s+/, '');

  const paren = s.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (paren) {
    const parts = paren[2].split(/[,;]/).map((p) => p.trim().toLowerCase());
    const allRunConfig = parts.every((p) => RUN_QUALIFIERS.has(p) || BUDGET_QUALIFIER.test(p));
    if (parts.length > 0 && allRunConfig && paren[1].trim()) s = paren[1];
  }

  return s.trim();
}

/**
 * Vendor inferred from a canonical slug. Used only as a fallback — Epoch and OpenRouter
 * both state the organisation explicitly, and a stated value always wins.
 */
export function inferVendor(slug: string): string | null {
  const table: Array<[RegExp, string]> = [
    [/^(claude|fable)/, 'Anthropic'],
    [/^(gpt|o[134]|chatgpt|codex)/, 'OpenAI'],
    [/^(gemini|gemma)/, 'Google'],
    [/^(grok)/, 'xAI'],
    [/^(llama)/, 'Meta'],
    [/^(qwen|qwq)/, 'Alibaba'],
    [/^(deepseek)/, 'DeepSeek'],
    [/^(mistral|magistral|codestral|ministral|devstral)/, 'Mistral'],
    [/^(kimi|moonshot)/, 'Moonshot'],
    [/^(glm|chatglm)/, 'Z.ai'],
    [/^(minimax)/, 'MiniMax'],
    [/^(command|cohere)/, 'Cohere'],
    [/^(nova|amazon)/, 'Amazon'],
    [/^(phi)/, 'Microsoft'],
    [/^(sonar)/, 'Perplexity'],
    [/^(ernie)/, 'Baidu'],
    [/^(seed|doubao)/, 'ByteDance'],
  ];
  for (const [re, vendor] of table) if (re.test(slug)) return vendor;
  return null;
}

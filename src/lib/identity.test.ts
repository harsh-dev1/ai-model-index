import { describe, expect, it } from 'vitest';
import { canonicalSlug, extractEffort, inferVendor, isSearchVariant } from './identity.ts';

describe('canonicalSlug', () => {
  it('collapses the three sources onto one slug', () => {
    // Every triple below was taken from the live source lists on 2026-07-24.
    const triples: Array<[string, string, string]> = [
      ['gpt-5.2-2025-12-11_xhigh', 'gpt-5-2-high', 'openai/gpt-5.2'],
      ['claude-opus-5_max', 'claude-opus-5', 'anthropic/claude-opus-5-fast'],
      ['glm-5.2_max', 'glm-5.2-(max)', 'z-ai/glm-5.2'],
      ['gemini-3.1-pro-preview', 'gemini-3.1-pro-grounding', 'google/gemini-3.1-pro-preview'],
      ['gpt-5.5_xhigh', 'gpt-5-5-xhigh-(codex-harness)', 'openai/gpt-5.5'],
    ];
    for (const [epoch, arena, openrouter] of triples) {
      const a = canonicalSlug(epoch);
      expect(canonicalSlug(arena), `${arena} should match ${epoch}`).toBe(a);
      expect(canonicalSlug(openrouter), `${openrouter} should match ${epoch}`).toBe(a);
    }
  });

  it('keeps genuinely different models apart', () => {
    // Over-stripping is the dangerous failure: it silently merges two models into one row.
    const mustDiffer = [
      ['openai/gpt-5.5', 'openai/gpt-5.5-pro'],
      ['openai/gpt-5.4', 'openai/gpt-5.4-mini'],
      ['google/gemini-3.5-flash', 'google/gemini-3.5-flash-lite'],
      ['openai/gpt-5.2', 'openai/gpt-5.2-chat'],
      ['openai/gpt-5.2', 'openai/gpt-5.2-codex'],
      ['anthropic/claude-opus-5', 'anthropic/claude-sonnet-5'],
      ['google/gemini-3-pro', 'google/gemini-3-pro-image'],
    ];
    for (const [a, b] of mustDiffer) {
      expect(canonicalSlug(a), `${a} vs ${b}`).not.toBe(canonicalSlug(b));
    }
  });

  it('strips namespaces, variant tags and punctuation', () => {
    expect(canonicalSlug('meta-llama/llama-4-70b:free')).toBe('llama-4-70b');
    expect(canonicalSlug('ppl-sonar-pro')).toBe('sonar-pro');
    expect(canonicalSlug('api-gpt-4o-search')).toBe('gpt-4o');
    expect(canonicalSlug('  Claude-Fable-5-(High)  ')).toBe('claude-fable-5');
  });

  it('reaches a fixed point on stacked suffixes', () => {
    expect(canonicalSlug('grok-4-20-multi-agent-beta-0309')).toBe('grok-4-20');
    expect(canonicalSlug('claude-opus-4-5-20251101-32k')).toBe('claude-opus-4-5');
  });

  it('never returns an empty slug for a non-empty model name', () => {
    for (const s of ['high', 'max', 'preview', 'gpt-5.5', 'beta']) {
      expect(canonicalSlug(s).length, s).toBeGreaterThan(0);
    }
  });

  it('handles empty input', () => {
    expect(canonicalSlug('')).toBe('');
    expect(canonicalSlug(null)).toBe('');
    expect(canonicalSlug(undefined)).toBe('');
  });

  it('is idempotent', () => {
    for (const s of ['gpt-5.2-2025-12-11_xhigh', 'claude-fable-5-(high)', 'z-ai/glm-5.2']) {
      const once = canonicalSlug(s);
      expect(canonicalSlug(once)).toBe(once);
    }
  });
});

describe('metadata extraction', () => {
  it('reads reasoning effort', () => {
    expect(extractEffort('gpt-5.5_xhigh')).toBe('xhigh');
    expect(extractEffort('claude-fable-5-(high)')).toBe('high');
    expect(extractEffort('openai/gpt-5.2')).toBeNull();
  });

  it('flags search variants', () => {
    expect(isSearchVariant('gpt-5-2-search')).toBe(true);
    expect(isSearchVariant('gemini-3-pro-grounding')).toBe(true);
    expect(isSearchVariant('openai/gpt-5.2')).toBe(false);
  });

  it('infers vendor as a fallback', () => {
    expect(inferVendor('claude-opus-5')).toBe('Anthropic');
    expect(inferVendor('gpt-5-5')).toBe('OpenAI');
    expect(inferVendor('glm-5-2')).toBe('Z.ai');
    expect(inferVendor('some-unknown-model')).toBeNull();
  });
});

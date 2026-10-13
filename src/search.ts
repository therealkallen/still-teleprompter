import type { Block } from './model';

export interface SearchMatch { blockId: string; start: number; end: number }
export const SEARCH_LIMIT = 10_000;

/** Literal Unicode-aware search; offsets refer to the original text, including across emphasis runs. */
export function findMatches(blocks: Block[], query: string): { matches: SearchMatch[]; limited: boolean } {
  const text = query.trim();
  if (!text) return { matches: [], limited: false };
  const expression = new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu');
  const matches: SearchMatch[] = [];
  for (const block of blocks) {
    for (const result of block.text.matchAll(expression)) {
      if (matches.length === SEARCH_LIMIT) return { matches, limited: true };
      matches.push({ blockId: block.id, start: result.index, end: result.index + result[0].length });
    }
  }
  return { matches, limited: false };
}

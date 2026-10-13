import { describe, expect, it } from 'vitest';
import { findMatches, SEARCH_LIMIT } from './search';
import type { Block } from './model';

describe('reading view quick search', () => {
  it('finds repeated occurrences in one paragraph and across block types', () => {
    const blocks: Block[] = [{ id: 'a', type: 'section', text: '季度' }, { id: 'b', type: 'spoken', text: '季度结果，季度计划' }, { id: 'c', type: 'cue', text: '展示季度图表' }];
    expect(findMatches(blocks, '季度').matches).toEqual([
      { blockId: 'a', start: 0, end: 2 }, { blockId: 'b', start: 0, end: 2 },
      { blockId: 'b', start: 5, end: 7 }, { blockId: 'c', start: 2, end: 4 },
    ]);
  });
  it('treats regular expression characters literally and preserves Unicode offsets', () => {
    const blocks: Block[] = [{ id: 'a', type: 'spoken', text: '😀 A+B [cue] a+b' }];
    expect(findMatches(blocks, 'a+b').matches).toEqual([{ blockId: 'a', start: 3, end: 6 }, { blockId: 'a', start: 13, end: 16 }]);
    expect(findMatches(blocks, '[cue]').matches).toEqual([{ blockId: 'a', start: 7, end: 12 }]);
    expect(findMatches(blocks, '   ').matches).toEqual([]);
  });
  it('matches across imported emphasis runs using original text positions', () => {
    const block: Block = { id: 'a', type: 'spoken', text: 'A strong point', runs: [{ text: 'A ' }, { text: 'strong', bold: true }, { text: ' point' }] };
    expect(findMatches([block], 'strong point').matches).toEqual([{ blockId: 'a', start: 2, end: 14 }]);
  });
  it('bounds memory for very frequent terms and reports truncation', () => {
    const result = findMatches([{ id: 'a', type: 'spoken', text: 'a'.repeat(SEARCH_LIMIT + 1) }], 'a');
    expect(result.matches).toHaveLength(SEARCH_LIMIT);
    expect(result.limited).toBe(true);
  });
});

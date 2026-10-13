import { describe, expect, it } from 'vitest';
import { clampPosition, positionAt, restorePosition } from './scroll';

const blocks = [{ id: 'intro', top: 0, height: 180 }, { id: 'middle', top: 220, height: 500 }, { id: 'end', top: 760, height: 200 }];
describe('manual reading position', () => {
  it('clamps short documents and out-of-range targets', () => {
    expect(clampPosition(-100, 1000, 400)).toBe(0);
    expect(clampPosition(9000, 1000, 400)).toBe(600);
    expect(clampPosition(10, 100, 400)).toBe(0);
  });
  it('restores by stable block after earlier content changes', () => {
    const saved = positionAt(280, 1600, 400, blocks);
    expect(saved).toEqual({ blockId: 'middle', offset: 60, ratio: 280 / 1200 });
    const resized = blocks.map(b => b.id === 'intro' ? b : { ...b, top: b.top + 160 });
    expect(restorePosition(saved, resized, 1760, 400)).toBe(440);
  });
  it('falls back to progress when an anchor is removed and clamps offsets after edits', () => {
    expect(restorePosition({ blockId: 'removed', offset: 0, ratio: 0.5 }, blocks, 1600, 400)).toBe(600);
    expect(restorePosition({ blockId: 'intro', offset: 900, ratio: 0 }, blocks, 1600, 400)).toBe(180);
  });
});

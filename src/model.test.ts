import { describe, expect, it } from 'vitest';
import { initialWorkspace } from './demo';
import { validateWorkspace } from './model';

describe('workspace persistence boundary', () => {
  it('round-trips scripts, appearance, cues, bookmarks and anchors', () => {
    const original = initialWorkspace();
    original.scripts[0].bookmarks = [original.scripts[0].blocks[2].id];
    expect(validateWorkspace(JSON.parse(JSON.stringify(original)))).toEqual(original);
  });
  it('refuses unknown versions, duplicate IDs, unsafe settings and orphaned bookmarks', () => {
    const version = initialWorkspace();
    expect(() => validateWorkspace({ ...version, version: 2 })).toThrow();
    const duplicate = initialWorkspace(); duplicate.scripts.push(duplicate.scripts[0]);
    expect(() => validateWorkspace(duplicate)).toThrow();
    const orphaned = initialWorkspace(); orphaned.scripts[0].bookmarks = ['missing'];
    expect(() => validateWorkspace(orphaned)).toThrow();
    const unsafe = initialWorkspace(); unsafe.settings.appearance.background = 'url(https://example.com)';
    expect(() => validateWorkspace(unsafe)).toThrow();
  });
});

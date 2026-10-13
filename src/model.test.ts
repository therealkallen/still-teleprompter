import { describe, expect, it } from 'vitest';
import { initialWorkspace } from './demo';
import { defaultAutoFollow, defaultTimed, validateWorkspace } from './model';

describe('workspace persistence boundary', () => {
  it('adds a default timed pace to beta.1 workspaces and persists Timed mode', () => {
    const old = JSON.parse(JSON.stringify(initialWorkspace())); delete old.settings.timed;
    const updated = validateWorkspace(old);
    expect(updated.settings.timed).toEqual(defaultTimed); expect(updated.scripts).toEqual(old.scripts);
    updated.settings.autoFollow.mode = 'timed'; updated.settings.timed.charactersPerMinute = 360;
    expect(validateWorkspace(JSON.parse(JSON.stringify(updated))).settings.timed.charactersPerMinute).toBe(360);
    expect(validateWorkspace(JSON.parse(JSON.stringify(updated))).settings.autoFollow.mode).toBe('timed');
  });
  it('rejects invalid timed pace without touching the stored workspace', () => {
    for (const speed of [0, 59, 1201, 240.5, Number.NaN]) {
      const value = initialWorkspace(); value.settings.timed.charactersPerMinute = speed;
      expect(() => validateWorkspace(value)).toThrow('定时语速');
    }
  });
  it('migrates the 1.0.2 workspace without changing scripts, appearance or capture protection', () => {
    const old = JSON.parse(JSON.stringify(initialWorkspace()));
    delete old.settings.autoFollow;
    old.settings.hotkeys = old.settings.hotkeys.filter((b: { action: string }) => b.action !== 'follow');
    const migrated = validateWorkspace(old);
    expect(migrated.scripts).toEqual(old.scripts);
    expect(migrated.settings.appearance).toEqual(old.settings.appearance);
    expect(migrated.settings.captureExcluded).toBe(true);
    expect(migrated.settings.autoFollow).toEqual(defaultAutoFollow);
    expect(migrated.settings.hotkeys.at(-1)?.action).toBe('follow');
    expect(old.settings.autoFollow).toBeUndefined();
  });
  it('validates bounded ASR settings and retains opted-in diagnostics and device preferences', () => {
    const value = initialWorkspace(); value.settings.autoFollow.mode = 'auto'; value.settings.autoFollow.deviceId = '1:USB headset';
    expect(validateWorkspace(JSON.parse(JSON.stringify(value)))).toEqual(value);
    value.settings.autoFollow.windowMs = 200000;
    expect(() => validateWorkspace(value)).toThrow('自动跟读');
  });
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

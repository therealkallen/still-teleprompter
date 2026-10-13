import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearMocks, mockIPC, mockWindows } from '@tauri-apps/api/mocks';

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('isTauri', true);
  mockWindows('main');
});
afterEach(() => { clearMocks(); vi.unstubAllGlobals(); });

async function nativeWindow() {
  const capability = JSON.parse(await readFile('src-tauri/capabilities/main.json', 'utf8')) as { permissions: string[] };
  const commands: string[] = [];
  let listener = 0, destroyed = 0;
  mockIPC(async (command, payload) => {
    commands.push(command);
    if (command === 'plugin:event|listen') { listener = (payload as Record<string, unknown>).handler as number; return 1; }
    if (command === 'plugin:window|close') {
      // Use the actual Tauri SDK callback, including its automatic destroy step.
      const internals = (window as unknown as { __TAURI_INTERNALS__: { callbacks: Map<number, (event: unknown) => unknown> } }).__TAURI_INTERNALS__;
      await internals.callbacks.get(listener)!({ event: 'tauri://close-requested', id: 1, payload: null });
    }
    if (command === 'plugin:window|destroy') {
      if (!capability.permissions.includes('core:window:allow-destroy')) throw new Error('window.destroy not allowed');
      destroyed++;
    }
  });
  const native = await import('./native');
  expect(native.desktop).toBe(true);
  return { native, commands, destroyed: () => destroyed };
}

describe('native save-before-close with the real Tauri SDK', () => {
  it('saves once, then closes with the configured capability without another close request', async () => {
    const fixture = await nativeWindow();
    const save = vi.fn(async () => {});
    await fixture.native.onClose(save);
    await fixture.native.closeWindow();
    expect(save).toHaveBeenCalledTimes(1);
    expect(fixture.destroyed()).toBe(1);
    expect(fixture.commands.filter(command => command === 'plugin:window|close')).toHaveLength(1);
  });
  it('waits for save completion and ignores additional close clicks while saving', async () => {
    const fixture = await nativeWindow();
    let finishSave!: () => void;
    const pendingSave = new Promise<void>(resolve => { finishSave = resolve; });
    const save = vi.fn(() => pendingSave);
    await fixture.native.onClose(save);
    const firstClose = fixture.native.closeWindow();
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(fixture.destroyed()).toBe(0);
    await fixture.native.closeWindow();
    expect(save).toHaveBeenCalledTimes(1);
    expect(fixture.destroyed()).toBe(0);
    finishSave();
    await firstClose;
    expect(fixture.destroyed()).toBe(1);
  });
  it('keeps the window after a save error and permits a successful retry', async () => {
    const fixture = await nativeWindow();
    const save = vi.fn().mockRejectedValueOnce(new Error('disk full')).mockResolvedValueOnce(undefined);
    await fixture.native.onClose(save);
    await fixture.native.closeWindow();
    expect(fixture.destroyed()).toBe(0);
    await fixture.native.closeWindow();
    expect(save).toHaveBeenCalledTimes(2);
    expect(fixture.destroyed()).toBe(1);
  });
});

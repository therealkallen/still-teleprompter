import { isTauri, invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { Action, Binding, Workspace } from './model';
import { validateWorkspace } from './model';

export const desktop = isTauri();
export interface CaptureStatus { state: 'enabled' | 'disabled' | 'unsupported' | 'failed'; message: string }
export interface HotkeyStatus { action: Action; shortcut: string; error: string | null }
export async function loadWorkspace(): Promise<Workspace | null> {
  const value = desktop ? await invoke<unknown>('load_workspace') : JSON.parse(localStorage.getItem('still.workspace') ?? 'null');
  return value === null ? null : validateWorkspace(value);
}
export async function saveWorkspace(workspace: Workspace) {
  if (desktop) await invoke('save_workspace', { workspace });
  else localStorage.setItem('still.workspace', JSON.stringify(workspace));
}
export async function captureProtection(enabled: boolean): Promise<CaptureStatus> {
  if (!desktop) return { state: 'unsupported', message: '浏览器预览没有 Windows 捕获排除功能。请运行桌面版。' };
  return invoke('set_capture_protection', { enabled });
}
export async function readingMode(reading: boolean) {
  if (desktop) {
    await invoke('set_reading_mode', { reading });
    if (!reading) await getCurrentWindow().setFocus();
  }
}
export async function configureHotkeys(bindings: Binding[]): Promise<HotkeyStatus[]> {
  if (!desktop) return bindings.map(b => ({ ...b, error: '全局快捷键需要桌面版。' }));
  return invoke('configure_hotkeys', { bindings });
}
export async function manualActions(handler: (action: Action) => void): Promise<() => void> {
  if (!desktop) return () => {};
  return listen<Action>('manual-action', event => handler(event.payload));
}
export async function revealWindow() { if (desktop) await invoke('reveal_window'); }
export async function setWindowTitle(title: string) { if (desktop) await getCurrentWindow().setTitle(title); }
export async function dragWindow() { if (desktop) await getCurrentWindow().startDragging(); }
export async function minimizeWindow() { if (desktop) await getCurrentWindow().minimize(); }
export async function closeWindow() { if (desktop) await getCurrentWindow().close(); }
export async function onClose(handler: () => Promise<void>): Promise<() => void> {
  if (!desktop) return () => {};
  let saving = false;
  return getCurrentWindow().onCloseRequested(async event => {
    if (saving) { event.preventDefault(); return; }
    saving = true;
    // Tauri awaits this handler and destroys the window after success. Calling
    // close() again re-enters the event instead of completing the original close.
    try { await handler(); }
    catch { event.preventDefault(); }
    finally { saving = false; }
  });
}

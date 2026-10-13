import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { desktop } from '../native';
import type { AutoFollowSettings } from '../model';
export interface Microphone { id: string; name: string }
export interface RecognitionEvent { kind: 'ready' | 'transcript' | 'silence' | 'error'; sessionId: number; sequence: number; revision?: number; text?: string; error?: string; inferenceMs?: number; loadMs?: number }
export async function microphones(): Promise<Microphone[]> {
  return desktop ? invoke('list_microphones') : [{ id: '', name: '系统默认麦克风' }];
}
export async function startRecognition(options: AutoFollowSettings): Promise<number> {
  if (!desktop) throw new Error('自动跟读需要 Windows 桌面版，本地语音引擎不在浏览器预览中运行。');
  return invoke('start_auto_follow', { options });
}
export async function stopRecognition(sessionId: number) { if (desktop) await invoke('stop_auto_follow', { sessionId }); }
export async function resetRecognition(sessionId: number): Promise<number> { return invoke('reset_auto_follow', { sessionId }); }
export async function recognitionEvents(handler: (event: RecognitionEvent) => void) {
  return desktop ? listen<RecognitionEvent>('auto-follow-event', event => handler(event.payload)) : () => {};
}

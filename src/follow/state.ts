import type { ReadingMode } from '../model';
export type FollowMode = ReadingMode;
export type FollowState = 'following' | 'holding' | 'paused' | 'error';
export interface FollowSnapshot { mode: FollowMode; state: FollowState; active: boolean; ready: boolean; error: string; reason: string }
export type FollowEvent = { type: 'mode'; mode: FollowMode } | { type: 'start' } | { type: 'ready' } | { type: 'match' } | { type: 'hold'; reason: string } | { type: 'pause' } | { type: 'resume' } | { type: 'stop' } | { type: 'error'; error: string };
export const initialFollow: FollowSnapshot = { mode: 'manual', state: 'paused', active: false, ready: false, error: '', reason: '' };
export function transition(current: FollowSnapshot, event: FollowEvent): FollowSnapshot {
  if (event.type === 'mode') return { ...initialFollow, mode: event.mode };
  if (event.type === 'stop') return { ...initialFollow, mode: current.mode };
  if (event.type === 'start') return { ...current, mode: 'auto', active: true, ready: false, state: 'holding', reason: 'loading', error: '' };
  if (event.type === 'error') return { ...current, state: 'error', active: false, ready: false, error: event.error };
  if (!current.active) return current;
  if (event.type === 'pause') return { ...current, state: 'paused', reason: 'manual' };
  if (event.type === 'resume') return { ...current, state: 'holding', reason: 'confirming' };
  if (event.type === 'ready') return { ...current, ready: true, ...(current.state === 'paused' ? {} : { state: 'holding' as const, reason: 'listening' }) };
  // ASR continues while deliberately paused; it can never resume scrolling itself.
  if (current.state === 'paused') return current;
  if (event.type === 'match') return { ...current, state: 'following', reason: '' };
  if (event.type === 'hold') return { ...current, state: 'holding', reason: event.reason };
  return current;
}

import { describe, expect, it } from 'vitest';
import { initialFollow, transition } from './state';
describe('auto follow lifecycle', () => {
  it('remembers Auto without activating a microphone', () => {
    expect(transition(initialFollow, { type: 'mode', mode: 'auto' })).toMatchObject({ mode: 'auto', active: false });
  });
  it('never resumes a deliberate pause in response to recognition or ready events', () => {
    let state = transition(initialFollow, { type: 'start' });
    state = transition(state, { type: 'pause' });
    for (const event of [{ type: 'ready' }, { type: 'match' }, { type: 'hold', reason: 'uncertain' }] as const) state = transition(state, event);
    expect(state).toMatchObject({ active: true, ready: true, state: 'paused' });
    expect(transition(state, { type: 'resume' }).state).toBe('holding');
  });
  it('holds off-script, recovers on a reliable match, and stops processing in Manual', () => {
    let state = transition(initialFollow, { type: 'start' });
    state = transition(state, { type: 'ready' });
    state = transition(state, { type: 'match' });
    expect(state.state).toBe('following');
    state = transition(state, { type: 'hold', reason: 'uncertain' });
    expect(state.state).toBe('holding');
    state = transition(state, { type: 'mode', mode: 'manual' });
    expect(transition(state, { type: 'match' })).toEqual(state);
    expect(state.active).toBe(false);
  });
  it('exposes errors safely and requires another explicit start', () => {
    const state = transition(transition(initialFollow, { type: 'start' }), { type: 'error', error: 'device disconnected' });
    expect(state).toMatchObject({ active: false, state: 'error' });
    expect(transition(state, { type: 'ready' })).toEqual(state);
    expect(transition(state, { type: 'start' }).error).toBe('');
  });
});

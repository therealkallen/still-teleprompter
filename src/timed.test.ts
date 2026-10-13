import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { countCharacters, paceBlocks, PaceTrack, TimedScrollController, type TimedSnapshot } from './timed';

describe('timed pace conversion', () => {
  it('counts spoken letters/numbers, including Unicode, excluding headings, cues and punctuation', () => {
    expect(countCharacters('中文，A.I. １２３！🙂')).toBe(7);
    expect(countCharacters('𠮷 á')).toBe(2);
    expect(paceBlocks([{ id: 's', type: 'section', text: '章节' }, { id: 'c', type: 'cue', text: '提示' }, { id: 'p', type: 'spoken', text: '正文 AI' }, { id: 'empty', type: 'spoken', text: '… ' }])).toEqual([{ id: 'p', characters: 4 }]);
  });
  it('converts different paragraph lengths and wrapping heights in both directions', () => {
    const track = new PaceTrack([{ start: 50, end: 350, characters: 100 }, { start: 350, end: 1150, characters: 200 }]);
    expect(track.characters).toBe(300);
    expect(track.pixelAt(50)).toBe(200);
    expect(track.pixelAt(200)).toBe(750);
    expect(track.characterAt(750)).toBe(200);
    expect(track.characterAt(0)).toBe(0);
    expect(track.characterAt(9000)).toBe(300);
    expect(track.pixelAt(9000)).toBe(1150);
  });
});

describe('timed scrolling lifecycle', () => {
  let pending: Map<number, FrameRequestCallback>, nextId: number, now: number;
  let view: HTMLElement, controller: TimedScrollController;
  let state: TimedSnapshot;
  const frame = (ms: number) => { now += ms; const callbacks = [...pending.values()]; pending.clear(); for (const callback of callbacks) callback(now); };
  const seconds = (value: number) => { for (let i = 0; i < value * 10; i++) frame(100); };
  beforeEach(() => {
    pending = new Map(); nextId = 0; now = 0;
    vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { pending.set(++nextId, fn); return nextId; });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => pending.delete(id));
    view = { scrollTop: 0, scrollHeight: 5000, clientHeight: 100 } as HTMLElement;
    state = { active: false, running: false, finished: false };
    controller = new TimedScrollController(view, () => new PaceTrack([{ start: 0, end: 1000, characters: 1000 }]), () => 240, value => { state = value; });
  });
  afterEach(() => { controller.dispose(); vi.unstubAllGlobals(); });
  it('advances exactly 240 characters in a minute using measured pixels per character', () => {
    controller.start(); frame(0); seconds(60);
    expect(view.scrollTop).toBeCloseTo(240, 6);
    expect(state.running).toBe(true);
    expect(pending.size).toBe(1);
  });
  it('pauses immediately and resumes at the manually selected position without snapping back', () => {
    controller.start(); frame(0); seconds(5); controller.pause();
    const paused = view.scrollTop; seconds(20); expect(view.scrollTop).toBe(paused); expect(state.running).toBe(false);
    view.scrollTop = 600; controller.resume(); frame(0);
    expect(view.scrollTop).toBe(600);
    seconds(1); expect(view.scrollTop).toBeCloseTo(604, 6);
    controller.stop(); expect(state.active).toBe(false); expect(pending.size).toBe(0);
  });
  it('recalculates wrapping height on resize without changing the current scroll position', () => {
    let height = 1000;
    controller = new TimedScrollController(view, () => new PaceTrack([{ start: 0, end: height, characters: 1000 }]), () => 240, value => { state = value; });
    controller.start(); frame(0); seconds(1); const top = view.scrollTop;
    height = 2000; controller.rebase(); frame(0); frame(0);
    expect(view.scrollTop).toBeCloseTo(top, 6);
    seconds(1); expect(view.scrollTop - top).toBeCloseTo(8, 6);
  });
  it('finishes at the final spoken text and has no remaining animation job', () => {
    view = { scrollTop: 0, scrollHeight: 1000, clientHeight: 0 } as HTMLElement;
    controller = new TimedScrollController(view, () => new PaceTrack([{ start: 0, end: 20, characters: 2 }]), () => 120, value => { state = value; });
    controller.start(); frame(0); seconds(2);
    expect(view.scrollTop).toBe(20);
    expect(state).toEqual({ active: false, running: false, finished: true }); expect(pending.size).toBe(0);
  });
  it('does not jump forward after a long dropped frame and cancels pending resize work on pause', () => {
    controller.start(); frame(0); frame(60000);
    expect(view.scrollTop).toBeCloseTo(0.4, 6);
    controller.rebase(); controller.pause(); frame(100);
    expect(state.running).toBe(false); expect(pending.size).toBe(0); expect(view.scrollTop).toBeCloseTo(0.4, 6);
  });
  it('leaves the viewport unchanged when there is no spoken content', () => {
    controller = new TimedScrollController(view, () => new PaceTrack([]), () => 240, value => { state = value; });
    view.scrollTop = 50; controller.start(); seconds(10);
    expect(view.scrollTop).toBe(50); expect(state.active).toBe(false); expect(pending.size).toBe(0);
  });
});

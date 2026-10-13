import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ScrollController } from './scroll';
import { PaceTrack } from './timed';
import { useTimedScroll } from './useTimedScroll';
const mock = vi.hoisted(() => ({ measure: vi.fn() }));
vi.mock('./timed', async original => ({ ...await original<typeof import('./timed')>(), measurePace: mock.measure }));
let root: Root, timed: ReturnType<typeof useTimedScroll>, view: HTMLElement;
let pending: Map<number, FrameRequestCallback>, now: number, id: number;
const notify = vi.fn();
const frame = async (ms: number) => { now += ms; await act(async () => { const callbacks = [...pending.values()]; pending.clear(); for (const callback of callbacks) callback(now); }); };
beforeEach(() => {
  vi.clearAllMocks(); pending = new Map(); now = 0; id = 0;
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { pending.set(++id, fn); return id; });
  vi.stubGlobal('cancelAnimationFrame', (key: number) => pending.delete(key));
  vi.stubGlobal('performance', { now: () => now });
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  view = document.createElement('div');
  Object.defineProperties(view, { clientHeight: { value: 100 }, scrollHeight: { value: 5000 } });
  mock.measure.mockImplementation(() => new PaceTrack([{ start: 0, end: 1000, characters: 1000 }]));
});
afterEach(async () => { if (root) await act(async () => root.unmount()); vi.unstubAllGlobals(); });
async function mount() {
  const manual = new ScrollController(view), viewport = { current: view };
  const blocks = [{ id: 'b', type: 'spoken' as const, text: '正文内容' }];
  root = createRoot(document.createElement('div'));
  await act(async () => root.render(createElement(() => { timed = useTimedScroll({ mode: 'timed', scriptId: 's', blocks, charactersPerMinute: 240, appearanceKey: '', viewport, cancelScroll: () => manual.cancel(), notify }); return null; })));
  return manual;
}
it('keyboard resume cancels a manual animation before starting the timed frame', async () => {
  const manual = await mount();
  await act(async () => timed.start()); await frame(0);
  await act(async () => timed.pause()); manual.moveBy(100); await frame(50);
  const anchor = view.scrollTop;
  await act(async () => timed.toggle());
  expect(pending.size).toBe(1);
  await frame(0); expect(view.scrollTop).toBe(anchor);
  await frame(100); expect(view.scrollTop - anchor).toBeCloseTo(0.4, 6);
  expect(timed.running).toBe(true);
});
it('shows completion recovery help without moving, then starts after manual navigation up', async () => {
  await mount(); view.scrollTop = 1000;
  await act(async () => timed.start());
  expect(notify).toHaveBeenCalledWith('稿件已读完。请向上定位到要继续的正文，再点击开始滚动。');
  expect(timed.finished).toBe(true); expect(pending.size).toBe(0); expect(view.scrollTop).toBe(1000);
  view.scrollTop = 100; await act(async () => timed.start()); await frame(0);
  expect(timed.running).toBe(true); expect(view.scrollTop).toBe(100);
});

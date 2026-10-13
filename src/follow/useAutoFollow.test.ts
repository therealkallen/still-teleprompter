import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultAutoFollow } from '../model';
import { useAutoFollow } from './useAutoFollow';
import type { RecognitionEvent } from './native';
const mocks = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn(), reset: vi.fn(), listen: vi.fn() }));
vi.mock('./native', () => ({ startRecognition: mocks.start, stopRecognition: mocks.stop, resetRecognition: mocks.reset, recognitionEvents: mocks.listen }));
class FakeWorker {
  static latest: FakeWorker;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  messages: Record<string, unknown>[] = [];
  constructor() { FakeWorker.latest = this; }
  postMessage(value: Record<string, unknown>) { this.messages.push(value); }
  terminate() {}
  reply(value: unknown) { this.onmessage?.({ data: value }); }
}
let follow: ReturnType<typeof useAutoFollow>, root: Root;
let receive: (event: RecognitionEvent) => void;
let anchor = { blockId: 'first', offset: 0 };
const move = vi.fn(), cancelScroll = vi.fn();
const blocks = [{ id: 'first', type: 'spoken' as const, text: '今天我们介绍 Finance AI 帮助财务团队提高效率' }];
async function mount(mode: 'auto' | 'timed' = 'auto') {
  root = createRoot(document.createElement('div'));
  await act(async () => { root.render(createElement(() => { follow = useAutoFollow({ scriptId: 'script', blocks, options: { ...defaultAutoFollow, mode }, anchor: () => anchor, move, cancelScroll }); return null; })); });
}
describe('recognition and manual control races', () => {
  beforeEach(() => {
    vi.stubGlobal('Worker', FakeWorker); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.clearAllMocks(); anchor = { blockId: 'first', offset: 0 };
    mocks.start.mockResolvedValue(7); mocks.stop.mockResolvedValue(undefined); mocks.reset.mockResolvedValue(1);
    mocks.listen.mockImplementation(async (handler: typeof receive) => { receive = handler; return () => {}; });
  });
  afterEach(async () => { if (root) await act(async () => root.unmount()); vi.unstubAllGlobals(); });
  it('never starts a microphone or recognition session in Timed mode', async () => {
    await mount('timed'); await act(async () => follow.start());
    expect(mocks.start).not.toHaveBeenCalled(); expect(follow.active).toBe(false);
  });
  it('does not capture on launch and ignores late alignment after deliberate manual scrolling', async () => {
    await mount(); expect(mocks.start).not.toHaveBeenCalled();
    await act(async () => follow.start());
    await act(async () => { receive({ kind: 'ready', sessionId: 7, sequence: 0 }); receive({ kind: 'transcript', sessionId: 7, revision: 0, sequence: 1, text: blocks[0].text }); });
    const message = FakeWorker.latest.messages.at(-1)!;
    await act(async () => follow.pause());
    await act(async () => FakeWorker.latest.reply({ epoch: message.epoch, state: 'following', confidence: 1, target: { blockId: 'first', offset: 20 } }));
    expect(follow.state).toBe('paused'); expect(move).not.toHaveBeenCalled();
    anchor = { blockId: 'first', offset: 40 };
    await act(async () => follow.resume());
    expect(mocks.reset).toHaveBeenCalledWith(7);
    expect(FakeWorker.latest.messages.at(-1)).toMatchObject({ kind: 'init', offset: 40 });
    const count = FakeWorker.latest.messages.length;
    await act(async () => receive({ kind: 'transcript', sessionId: 7, revision: 0, sequence: 2, text: blocks[0].text }));
    expect(FakeWorker.latest.messages).toHaveLength(count);
  });
  it('keeps an active session when the already-selected Auto mode is clicked', async () => {
    await mount(); await act(async () => follow.start());
    await act(async () => follow.setMode('auto'));
    expect(mocks.stop).not.toHaveBeenCalled(); expect(follow.active).toBe(true);
  });
  it('kills a session that starts after Stop and ignores events from old sessions', async () => {
    await mount(); let finish!: (id: number) => void;
    mocks.start.mockImplementation(() => new Promise<number>(resolve => { finish = resolve; }));
    let starting!: Promise<void>;
    await act(async () => { starting = follow.start(); });
    await act(async () => follow.stop());
    await act(async () => { finish(19); await starting; });
    expect(mocks.stop).toHaveBeenCalledWith(19); expect(follow.active).toBe(false);
    await act(async () => receive({ kind: 'ready', sessionId: 19, sequence: 0 }));
    expect(follow.ready).toBe(false);
  });
  it('does not resume when a new manual intervention happens during buffer reset', async () => {
    await mount(); await act(async () => follow.start());
    let finish!: (revision: number) => void;
    mocks.reset.mockImplementation(() => new Promise<number>(resolve => { finish = resolve; }));
    let resuming!: Promise<void>;
    await act(async () => { resuming = follow.resume(); });
    await act(async () => follow.pause());
    await act(async () => { finish(1); await resuming; });
    expect(follow.state).toBe('paused');
  });
  it('bounds alignment backlog to one computation and one newest result', async () => {
    await mount(); await act(async () => follow.start());
    await act(async () => { for (let n = 1; n <= 100; n++) receive({ kind: 'transcript', sessionId: 7, revision: 0, sequence: n, text: blocks[0].text }); });
    const messages = FakeWorker.latest.messages.filter(m => m.kind === 'recognition');
    expect(messages).toHaveLength(1);
    await act(async () => FakeWorker.latest.reply({ epoch: messages[0].epoch, state: 'holding', confidence: 0, sequence: 1 }));
    expect(FakeWorker.latest.messages.at(-1)?.sequence).toBe(100);
  });
  it('rejects an old alignment result after microphone silence', async () => {
    await mount(); await act(async () => follow.start());
    await act(async () => receive({ kind: 'transcript', sessionId: 7, revision: 0, sequence: 1, text: blocks[0].text }));
    const epoch = FakeWorker.latest.messages.at(-1)?.epoch;
    await act(async () => receive({ kind: 'silence', sessionId: 7, revision: 0, sequence: 2 }));
    await act(async () => FakeWorker.latest.reply({ epoch, state: 'following', target: { blockId: 'first', offset: 30 } }));
    expect(follow.state).toBe('holding'); expect(move).not.toHaveBeenCalled();
  });
});

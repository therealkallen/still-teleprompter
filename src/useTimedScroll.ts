import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { Block, ReadingMode } from './model';
import { initialTimed, measurePace, paceBlocks, TimedScrollController } from './timed';

interface Inputs { mode: ReadingMode; scriptId: string; blocks: Block[]; charactersPerMinute: number; appearanceKey: string; viewport: RefObject<HTMLElement | null>; cancelScroll: () => void; notify: (message: string) => void }
export function useTimedScroll(inputs: Inputs) {
  const [snapshot, setSnapshot] = useState(initialTimed);
  const counted = useMemo(() => paceBlocks(inputs.blocks), [inputs.blocks]);
  const latest = useRef({ ...inputs, counted }); latest.current = { ...inputs, counted };
  const controller = useRef<TimedScrollController | null>(null);
  useLayoutEffect(() => {
    const view = inputs.viewport.current; if (!view) return;
    const instance = new TimedScrollController(view, () => measurePace(view, latest.current.counted), () => latest.current.charactersPerMinute, setSnapshot);
    controller.current = instance;
    const observer = new ResizeObserver(() => instance.rebase()); observer.observe(view);
    return () => { observer.disconnect(); instance.dispose(); controller.current = null; };
  }, [inputs.scriptId, inputs.viewport]);
  useEffect(() => { controller.current?.stop(); }, [inputs.mode, inputs.scriptId]);
  useEffect(() => { controller.current?.pause(); }, [inputs.blocks, inputs.charactersPerMinute, inputs.appearanceKey]);
  useEffect(() => {
    const hide = () => { if (document.hidden) controller.current?.pause(); };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  const start = useCallback(() => { if (latest.current.mode === 'timed') { latest.current.cancelScroll(); if (controller.current?.start() === 'finished') latest.current.notify('稿件已读完。请向上定位到要继续的正文，再点击开始滚动。'); } }, []);
  const pause = useCallback(() => controller.current?.pause(), []);
  const stop = useCallback(() => controller.current?.stop(), []);
  const resume = useCallback(() => { if (latest.current.mode === 'timed') { latest.current.cancelScroll(); controller.current?.resume(); } }, []);
  const toggle = useCallback(() => { if (latest.current.mode === 'timed') { latest.current.cancelScroll(); controller.current?.toggle(); } }, []);
  return { ...snapshot, canStart: counted.length > 0, start, pause, stop, resume, toggle };
}

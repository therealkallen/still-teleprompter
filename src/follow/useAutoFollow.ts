import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AutoFollowSettings, Block } from '../model';
import type { Alignment } from './alignment';
import { recognitionEvents, resetRecognition, startRecognition, stopRecognition, type RecognitionEvent } from './native';
import { initialFollow, transition, type FollowEvent, type FollowMode } from './state';

interface Inputs { scriptId: string; blocks: Block[]; options: AutoFollowSettings; anchor: () => { blockId: string | null; offset: number }; move: (target: NonNullable<Alignment['target']>) => void; cancelScroll: () => void }
export function useAutoFollow(inputs: Inputs) {
  const [snapshot, setSnapshot] = useState(initialFollow);
  const [metrics, setMetrics] = useState({ inferenceMs: 0, confidence: 0, sequence: 0, reason: '' });
  const current = useRef(initialFollow);
  const latest = useRef(inputs); latest.current = inputs;
  const worker = useRef<Worker | null>(null);
  const session = useRef<number | null>(null);
  const generation = useRef(0);
  const epoch = useRef(0);
  const pauseVersion = useRef(0);
  const revision = useRef(0);
  const aligning = useRef(false);
  const pendingRecognition = useRef<RecognitionEvent | null>(null);
  const starting = useRef(false);
  const buffered = useRef<RecognitionEvent[]>([]);
  const listenReady = useRef<Promise<() => void>>(Promise.resolve(() => {}));
  const send = useCallback((event: FollowEvent) => { current.current = transition(current.current, event); setSnapshot(current.current); }, []);
  const resetAnchor = useCallback(() => {
    const input = latest.current; const anchor = input.anchor();
    epoch.current++;
    aligning.current = false; pendingRecognition.current = null;
    worker.current?.postMessage({ kind: 'init', epoch: epoch.current, blocks: input.blocks, threshold: input.options.threshold, ...anchor });
  }, []);
  const stop = useCallback(async () => {
    generation.current++; epoch.current++; starting.current = false; buffered.current = [];
    pendingRecognition.current = null;
    const id = session.current; session.current = null;
    latest.current.cancelScroll(); send({ type: 'stop' });
    if (id !== null) await stopRecognition(id);
  }, [send]);
  const receive = useCallback((event: RecognitionEvent) => {
    if (event.sessionId !== session.current) {
      if (starting.current && buffered.current.length < 8) buffered.current.push(event);
      return;
    }
    if (event.kind === 'error') {
      latest.current.cancelScroll(); epoch.current++;
      send({ type: 'error', error: event.error ?? '本地语音引擎不可用。请检查设置后重新开始。' });
      const id = session.current; session.current = null;
      if (id !== null) void stopRecognition(id).catch(() => {});
    } else if (event.kind === 'ready') send({ type: 'ready' });
    else if (event.kind === 'silence') {
      if (event.revision !== revision.current) return;
      if (current.current.state !== 'paused') {
        epoch.current++; aligning.current = false; pendingRecognition.current = null;
        worker.current?.postMessage({ kind: 'suspend', epoch: epoch.current });
        latest.current.cancelScroll(); send({ type: 'hold', reason: 'silence' });
      }
    } else if (event.kind === 'transcript') {
      if (event.revision !== revision.current) return;
      setMetrics(old => ({ ...old, inferenceMs: event.inferenceMs ?? 0, sequence: event.sequence }));
      if (current.current.active && current.current.state !== 'paused') {
        if (aligning.current) { pendingRecognition.current = event; return; }
        aligning.current = true;
        worker.current?.postMessage({ kind: 'recognition', epoch: epoch.current, text: event.text ?? '', sequence: event.sequence });
      }
    }
  }, [send]);
  useEffect(() => {
    const engine = new Worker(new URL('./alignment.worker.ts', import.meta.url), { type: 'module' });
    worker.current = engine;
    engine.onmessage = (event: MessageEvent<Alignment & { epoch: number; sequence: number }>) => {
      const result = event.data;
      if (result.epoch !== epoch.current || !current.current.active || current.current.state === 'paused') return;
      aligning.current = false;
      setMetrics(old => ({ ...old, confidence: result.confidence, reason: result.reason }));
      if (result.state === 'following' && result.target) { send({ type: 'match' }); latest.current.move(result.target); }
      else { latest.current.cancelScroll(); send({ type: 'hold', reason: result.reason }); }
      const next = pendingRecognition.current; pendingRecognition.current = null;
      if (next) receive(next);
    };
    engine.onerror = () => { latest.current.cancelScroll(); send({ type: 'error', error: '稿件对齐引擎不可用。请停止跟读后重新开始。' }); const id = session.current; if (id !== null) void stopRecognition(id); session.current = null; };
    let disposed = false;
    listenReady.current = recognitionEvents(receive);
    void listenReady.current.then(unlisten => { if (disposed) unlisten(); }).catch(error => send({ type: 'error', error: String(error) }));
    return () => {
      disposed = true; generation.current++; epoch.current++; starting.current = false;
      engine.terminate(); worker.current = null;
      void listenReady.current.then(unlisten => unlisten()).catch(() => {});
      const id = session.current; session.current = null;
      if (id !== null) void stopRecognition(id).catch(() => {});
    };
  }, [receive, send]);
  // Remember the mode, but always require Start after launching the application.
  useEffect(() => { void stop().then(() => send({ type: 'mode', mode: inputs.options.mode })); }, [inputs.options.mode, stop, send]);
  const identity = useMemo(() => JSON.stringify([inputs.scriptId, inputs.blocks, inputs.options.runtimePath, inputs.options.modelPath, inputs.options.deviceId, inputs.options.windowMs, inputs.options.intervalMs, inputs.options.threshold]), [inputs.scriptId, inputs.blocks, inputs.options.runtimePath, inputs.options.modelPath, inputs.options.deviceId, inputs.options.windowMs, inputs.options.intervalMs, inputs.options.threshold]);
  useEffect(() => { if (current.current.active) { latest.current.cancelScroll(); send({ type: 'pause' }); resetAnchor(); } }, [identity, resetAnchor, send]);
  const start = useCallback(async () => {
    if (latest.current.options.mode !== 'auto' || starting.current || current.current.active) return;
    const token = ++generation.current;
    starting.current = true; buffered.current = [];
    revision.current = 0;
    send({ type: 'start' }); resetAnchor();
    try {
      await listenReady.current;
      if (token !== generation.current) return;
      const id = await startRecognition(latest.current.options);
      if (token !== generation.current) { await stopRecognition(id); return; }
      session.current = id; starting.current = false;
      const pending = buffered.current; buffered.current = []; for (const event of pending) receive(event);
    } catch (error) { if (token === generation.current) { starting.current = false; send({ type: 'error', error: String(error).replace(/^Error:\s*/, '') }); } }
  }, [receive, resetAnchor, send]);
  const pause = useCallback(() => { if (!current.current.active) return; pauseVersion.current++; epoch.current++; latest.current.cancelScroll(); send({ type: 'pause' }); }, [send]);
  const resume = useCallback(async () => {
    if (!current.current.active) return;
    const id = session.current, token = generation.current;
    const intervention = pauseVersion.current;
    // Drop microphone history and in-flight recognition from before intervention.
    epoch.current++; latest.current.cancelScroll();
    send({ type: 'pause' });
    try {
      if (id !== null) revision.current = await resetRecognition(id);
      if (token !== generation.current || id !== session.current || intervention !== pauseVersion.current) return;
      resetAnchor(); send({ type: 'resume' });
    } catch (error) { if (token === generation.current) { send({ type: 'error', error: String(error) }); if (id !== null) await stopRecognition(id); session.current = null; } }
  }, [resetAnchor, send]);
  const toggle = useCallback(() => { if (current.current.mode !== 'auto' || !current.current.active) return; if (current.current.state === 'paused') resume(); else pause(); }, [pause, resume]);
  return { ...snapshot, metrics, start, stop, pause, resume, toggle, setMode: (mode: FollowMode) => { if (mode === current.current.mode) return; void stop().then(() => send({ type: 'mode', mode })); } };
}

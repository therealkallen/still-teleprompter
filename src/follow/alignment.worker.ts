import { AlignmentEngine } from './alignment';
import type { Block } from '../model';
let engine: AlignmentEngine | null = null;
let epoch = 0;
self.onmessage = (event: MessageEvent<{ kind: string; epoch: number; blocks?: Block[]; threshold?: number; blockId?: string | null; offset?: number; text?: string; sequence?: number }>) => {
  const message = event.data;
  if (message.kind === 'init') { epoch = message.epoch; engine = new AlignmentEngine(message.blocks ?? [], message.threshold); engine.reanchor(message.blockId ?? null, message.offset); }
  else if (message.kind === 'suspend') { epoch = message.epoch; engine?.suspend(); }
  else if (message.kind === 'recognition' && message.epoch === epoch && engine) self.postMessage({ epoch, sequence: message.sequence, ...engine.update(message.text ?? '', message.sequence ?? 0) });
};

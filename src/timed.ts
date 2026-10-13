import type { Block } from './model';
import { clampPosition } from './scroll';

export interface PaceBlock { id: string; characters: number }
export interface PaceSpan { start: number; end: number; characters: number }
interface Segment extends PaceSpan { first: number; last: number }
export interface TimedSnapshot { active: boolean; running: boolean; finished: boolean }
export const initialTimed: TimedSnapshot = { active: false, running: false, finished: false };

/** One letter or number is one character. Punctuation, whitespace and cues cost no characters. */
export function countCharacters(text: string): number {
  let count = 0;
  for (const _ of text.matchAll(/[\p{L}\p{N}]/gu)) count++;
  return count;
}
export function paceBlocks(blocks: Block[]): PaceBlock[] {
  return blocks.filter(b => b.type === 'spoken').map(b => ({ id: b.id, characters: countCharacters(b.text) })).filter(b => b.characters > 0);
}
/** Layout gaps belong to the preceding spoken paragraph, preserving a continuous scroll. */
export class PaceTrack {
  readonly segments: Segment[];
  readonly characters: number;
  constructor(spans: PaceSpan[]) {
    let count = 0;
    this.segments = spans.filter(s => s.characters > 0).map(s => {
      const result = { ...s, first: count, last: count + s.characters };
      count = result.last; return result;
    });
    this.characters = count;
  }
  pixelAt(characters: number): number {
    const at = Math.max(0, Math.min(characters, this.characters));
    const span = this.segments.find(s => at < s.last) ?? this.segments.at(-1);
    return span ? span.start + (span.end - span.start) * ((at - span.first) / span.characters) : 0;
  }
  characterAt(pixel: number): number {
    const span = this.segments.find(s => pixel < s.end) ?? this.segments.at(-1);
    if (!span) return 0;
    const fraction = span.end > span.start ? Math.max(0, Math.min(1, (pixel - span.start) / (span.end - span.start))) : 1;
    return span.first + fraction * span.characters;
  }
}
export function measurePace(view: HTMLElement, blocks: PaceBlock[]): PaceTrack {
  const counts = new Map(blocks.map(b => [b.id, b.characters]));
  const origin = view.getBoundingClientRect().top;
  const rendered = Array.from(view.querySelectorAll<HTMLElement>('.block-spoken')).flatMap(el => {
    const characters = counts.get(el.dataset.blockId ?? '');
    if (!characters || !el.getClientRects().length) return [];
    const rect = (el.querySelector('p') ?? el).getBoundingClientRect();
    return [{ start: rect.top - origin + view.scrollTop, end: rect.bottom - origin + view.scrollTop, characters }];
  });
  return new PaceTrack(rendered.map((s, index) => ({ ...s, end: rendered[index + 1]?.start ?? s.end })));
}

/** A single animation loop, anchored to the current viewport on every explicit start/resume. */
export class TimedScrollController {
  private frame = 0;
  private resizeFrame = 0;
  private snapshot: TimedSnapshot = { ...initialTimed };
  private track = new PaceTrack([]);
  private units = 0;
  private baseUnits = 0;
  private baseTop = 0;
  private basePixel = 0;
  private lastTime: number | null = null;
  constructor(private view: HTMLElement, private measure: () => PaceTrack, private rate: () => number, private changed: (state: TimedSnapshot) => void) {}
  private publish(patch: TimedSnapshot) { this.snapshot = patch; this.changed({ ...patch }); }
  private cancel() { cancelAnimationFrame(this.frame); cancelAnimationFrame(this.resizeFrame); this.frame = 0; this.resizeFrame = 0; }
  private anchor(): boolean {
    this.track = this.measure();
    if (!this.track.characters) return false;
    this.baseTop = this.view.scrollTop;
    this.baseUnits = this.track.characterAt(this.baseTop + this.view.clientHeight * 0.38);
    this.basePixel = this.track.pixelAt(this.baseUnits); this.units = this.baseUnits;
    this.lastTime = null;
    return true;
  }
  start(): 'started' | 'empty' | 'finished' {
    this.cancel();
    if (!this.anchor()) { this.publish({ ...initialTimed }); return 'empty'; }
    if (this.units >= this.track.characters) { this.publish({ active: false, running: false, finished: true }); return 'finished'; }
    this.publish({ active: true, running: true, finished: false });
    this.frame = requestAnimationFrame(this.tick);
    return 'started';
  }
  private tick = (now: number) => {
    this.frame = 0;
    if (!this.snapshot.running) return;
    // Dropped/background frames must never cause a large catch-up jump.
    const elapsed = this.lastTime === null ? 0 : Math.min(100, Math.max(0, now - this.lastTime));
    this.lastTime = now;
    const rate = this.rate();
    if (!Number.isFinite(rate) || rate <= 0) { this.pause(); return; }
    this.units = Math.min(this.track.characters, this.units + elapsed * rate / 60000);
    this.view.scrollTop = clampPosition(this.baseTop + this.track.pixelAt(this.units) - this.basePixel, this.view.scrollHeight, this.view.clientHeight);
    if (this.units >= this.track.characters) this.publish({ active: false, running: false, finished: true });
    else this.frame = requestAnimationFrame(this.tick);
  };
  pause() { this.cancel(); if (this.snapshot.active) this.publish({ ...this.snapshot, running: false }); }
  resume() { if (this.snapshot.active) this.start(); }
  stop() { this.cancel(); this.publish({ ...initialTimed }); }
  toggle() { if (this.snapshot.running) this.pause(); else this.resume(); }
  rebase() {
    if (!this.snapshot.running) return;
    this.cancel();
    this.resizeFrame = requestAnimationFrame(() => { this.resizeFrame = 0; if (this.snapshot.running) this.start(); });
  }
  dispose() { this.cancel(); }
}

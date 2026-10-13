import type { Position } from './model';

export interface BlockGeometry { id: string; top: number; height: number }
export function clampPosition(top: number, scrollHeight: number, viewportHeight: number): number {
  return Math.max(0, Math.min(top, Math.max(0, scrollHeight - viewportHeight)));
}
export function positionAt(top: number, scrollHeight: number, viewportHeight: number, blocks: BlockGeometry[]): Position {
  const current = blocks.findLast(block => block.top <= top + 1) ?? blocks[0];
  const max = scrollHeight - viewportHeight;
  return { blockId: current?.id ?? null, offset: current ? Math.max(0, top - current.top) : 0, ratio: max > 0 ? Math.min(1, Math.max(0, top / max)) : 0 };
}
export function restorePosition(position: Position, blocks: BlockGeometry[], scrollHeight: number, viewportHeight: number): number {
  const block = blocks.find(b => b.id === position.blockId);
  return clampPosition(block ? block.top + Math.min(position.offset, block.height) : position.ratio * Math.max(0, scrollHeight - viewportHeight), scrollHeight, viewportHeight);
}

/** Position commands are the boundary for a future alignment engine. Manual calls replace pending targets. */
export class ScrollController {
  private frame = 0;
  private target = 0;
  constructor(private viewport: HTMLElement) {}
  moveBy(pixels: number) { this.moveTo((this.frame ? this.target : this.viewport.scrollTop) + pixels); }
  moveTo(top: number, smooth = true) {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.target = clampPosition(top, this.viewport.scrollHeight, this.viewport.clientHeight);
    if (!smooth || matchMedia('(prefers-reduced-motion: reduce)').matches) { this.viewport.scrollTop = this.target; return; }
    const start = this.viewport.scrollTop, destination = this.target, started = performance.now();
    const animate = (time: number) => {
      const fraction = Math.min(1, (time - started) / 260);
      this.viewport.scrollTop = start + (destination - start) * (1 - Math.pow(1 - fraction, 3));
      this.frame = fraction < 1 ? requestAnimationFrame(animate) : 0;
    };
    this.frame = requestAnimationFrame(animate);
  }
  cancel() { cancelAnimationFrame(this.frame); this.frame = 0; }
}

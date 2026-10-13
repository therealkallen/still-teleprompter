export interface FollowScrollInput { location: number; top: number; height: number; now: number; lastMove: number; recovery: boolean }
/** A deadband and rate limit separate ASR cadence from viewport motion. */
export function followScrollTarget({ location, top, height, now, lastMove, recovery }: FollowScrollInput): number | null {
  const relative = location - top;
  if (now - lastMove < 600 || (!recovery && relative >= height * 0.25 && relative <= height * 0.52)) return null;
  const destination = Math.max(0, location - height * 0.38);
  return Math.abs(destination - top) < 20 ? null : destination;
}
/** Map a UTF-16 text offset to the actual line, including formatted text runs. */
export function textLocation(block: HTMLElement, offset: number): number {
  const walker = document.createTreeWalker(block.querySelector('p') ?? block, NodeFilter.SHOW_TEXT);
  let remaining = Math.max(0, offset), node: Node | null;
  let last: Node | null = null;
  while ((node = walker.nextNode())) {
    last = node;
    if (remaining <= (node.textContent?.length ?? 0)) {
      const range = document.createRange();
      const at = Math.max(0, remaining - 1);
      range.setStart(node, at); range.setEnd(node, Math.min(at + 1, node.textContent?.length ?? 0));
      const rect = range.getBoundingClientRect();
      return rect.height ? rect.top : block.getBoundingClientRect().top;
    }
    remaining -= node.textContent?.length ?? 0;
  }
  if (last) { const range = document.createRange(); range.selectNodeContents(last); return range.getBoundingClientRect().bottom; }
  return block.getBoundingClientRect().top;
}

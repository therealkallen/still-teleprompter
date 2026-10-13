import type { Block } from '../model';

export interface Normalized { text: string; offsets: number[] }
const digits: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
function chineseNumber(value: string): string {
  if (!/[十百千]/u.test(value)) return [...value].map(c => digits[c] ?? c).join('');
  let sum = 0, current = 0;
  for (const c of value) { if (c in digits) current = digits[c]; else { sum += (current || 1) * ({ 十: 10, 百: 100, 千: 1000 }[c] ?? 1); current = 0; } }
  return String(sum + current);
}
/** Keep UTF-16 source offsets, including when NFKC changes a character's length. */
export function normalize(text: string): Normalized {
  let value = ''; const offsets: number[] = [];
  for (let index = 0; index < text.length;) {
    const char = String.fromCodePoint(text.codePointAt(index)!);
    for (const c of char.normalize('NFKC').toLowerCase()) { value += c; for (let n = 0; n < c.length; n++) offsets.push(index + char.length); }
    index += char.length;
  }
  const replacements: { start: number; end: number; text: string }[] = [];
  for (const match of value.matchAll(/\b(?:um|uh|erm)\b|嗯|呃|那个|[零〇一二两三四五六七八九十百千]+/gu)) {
    replacements.push({ start: match.index, end: match.index + match[0].length, text: /^[零〇一二两三四五六七八九十百千]+$/u.test(match[0]) ? chineseNumber(match[0]) : '' });
  }
  let result = ''; const mapped: number[] = []; let at = 0;
  const append = (source: string, sourceOffsets: number[]) => {
    for (let i = 0; i < source.length; i++) if (/[\p{L}\p{N}]/u.test(source[i])) { result += source[i]; mapped.push(sourceOffsets[i]); }
  };
  for (const r of replacements) {
    append(value.slice(at, r.start), offsets.slice(at, r.start));
    append(r.text, Array(r.text.length).fill(offsets[r.end - 1])); at = r.end;
  }
  append(value.slice(at), offsets.slice(at));
  return { text: result, offsets: mapped };
}

interface Passage { id: string; index: number; text: string; offsets: number[] }
interface Candidate { blockId: string; index: number; offset: number; confidence: number; end: number }
export interface Alignment { state: 'following' | 'holding'; target?: { blockId: string; offset: number; recovery: boolean }; confidence: number; reason: 'matched' | 'uncertain' | 'confirming' | 'short' | 'duplicate' }
/** Semi-global edit alignment: match the whole utterance against a script substring. */
function substringMatch(query: string, text: string): { score: number; end: number } {
  let previous = new Float64Array(text.length + 1);
  for (let row = 1; row <= query.length; row++) {
    const next = new Float64Array(text.length + 1); next[0] = row;
    for (let col = 1; col <= text.length; col++) next[col] = Math.min(previous[col] + 1, next[col - 1] + 1, previous[col - 1] + (query[row - 1] === text[col - 1] ? 0 : 1));
    previous = next;
  }
  let distance = query.length, end = 0;
  for (let col = 1; col <= text.length; col++) if (previous[col] < distance) { distance = previous[col]; end = col; }
  return { score: 1 - distance / query.length, end };
}

export class AlignmentEngine {
  private passages: Passage[];
  private anchor = 0;
  private anchorOffset = 0;
  private failures = 0;
  private lastSequence = 0;
  private history: string[] = [];
  private pending: { index: number; offset: number; count: number } | null = null;
  constructor(blocks: Block[], private threshold = 0.76) {
    this.passages = blocks.filter(b => b.type === 'spoken').map((b, index) => ({ id: b.id, index, ...normalize(b.text) })).filter(b => b.text.length > 0);
  }
  reanchor(blockId: string | null, offset = 0) {
    const index = this.passages.findIndex(b => b.id === blockId);
    this.anchor = Math.max(0, index); this.anchorOffset = offset; this.failures = 0; this.pending = null; this.history = []; this.lastSequence = 0;
  }
  suspend() { this.pending = null; this.history = []; }
  private candidates(query: string, global: boolean): Candidate[] {
    const output: Candidate[] = [];
    for (let p = 0; p < this.passages.length; p++) {
      if (!global && (p < this.anchor - 2 || p > this.anchor + 4)) continue;
      const passage = this.passages[p];
      // Sliding chunks bound edit-distance cost for large pasted paragraphs.
      let best: Candidate | undefined;
      for (let start = 0; start < passage.text.length; start += 120) {
        if (!global && p === this.anchor && Math.abs((passage.offsets[start] ?? 0) - this.anchorOffset) > 900) continue;
        const own = passage.text.slice(start, start + 240);
        const next = start + own.length >= passage.text.length ? this.passages[p + 1] : undefined;
        const match = substringMatch(query, own + (next?.text.slice(0, Math.min(query.length, 120)) ?? ''));
        const crosses = match.end > own.length;
        const target = crosses && next ? next : passage;
        const end = crosses ? match.end - own.length : start + match.end;
        const candidate = { blockId: target.id, index: crosses ? p + 1 : p, offset: target.offsets[Math.max(0, end - 1)] ?? 0, confidence: match.score, end };
        if (!best || candidate.confidence > best.confidence) best = candidate;
      }
      if (best) output.push(best);
    }
    // Deduplicate cross-paragraph candidates before measuring ambiguity.
    const unique = new Map<string, Candidate>();
    for (const c of output) { const key = `${c.blockId}:${c.offset}`; if (!unique.has(key) || unique.get(key)!.confidence < c.confidence) unique.set(key, c); }
    return [...unique.values()].sort((a, b) => (b.confidence - (global ? 0 : Math.abs(b.index - this.anchor) * 0.012)) - (a.confidence - (global ? 0 : Math.abs(a.index - this.anchor) * 0.012)));
  }
  update(text: string, sequence: number): Alignment {
    if (sequence <= this.lastSequence) return { state: 'holding', confidence: 0, reason: 'duplicate' };
    this.lastSequence = sequence;
    const query = normalize(text).text.slice(-160);
    if (query.length < 10) { this.pending = null; return { state: 'holding', confidence: 0, reason: 'short' }; }
    const duplicate = this.history.includes(query);
    if (!duplicate) { this.history.push(query); if (this.history.length > 3) this.history.shift(); }
    const local = this.candidates(query, false);
    let best = local[0]; let global = false;
    if (!best || best.confidence < this.threshold) {
      this.failures++;
      if (this.failures >= 3) { global = true; best = this.candidates(query, true)[0]; }
      else { this.pending = null; return { state: 'holding', confidence: best?.confidence ?? 0, reason: 'uncertain' }; }
    } else { this.failures = 0; }
    if (!best || best.confidence < (global ? Math.max(this.threshold, 0.86) : this.threshold)) { this.pending = null; return { state: 'holding', confidence: best?.confidence ?? 0, reason: 'uncertain' }; }
    const distant = Math.abs(best.index - this.anchor) > 2 || (best.index === this.anchor && Math.abs(best.offset - this.anchorOffset) > 900);
    const backward = best.index < this.anchor || (best.index === this.anchor && best.offset < this.anchorOffset - 60);
    if (global || distant || backward) {
      const alternatives = this.candidates(query, true).filter(c => c.blockId !== best.blockId);
      if (alternatives[0] && best.confidence - alternatives[0].confidence < 0.08) { this.pending = null; return { state: 'holding', confidence: best.confidence, reason: 'uncertain' }; }
    } else if (local[1] && local[1].blockId !== best.blockId && Math.abs(local[1].index - this.anchor) === Math.abs(best.index - this.anchor) && best.confidence - local[1].confidence < 0.04) {
      this.pending = null; return { state: 'holding', confidence: best.confidence, reason: 'uncertain' };
    }
    const required = global || distant ? 3 : backward ? 2 : 2;
    if (this.pending && Math.abs(this.pending.index - best.index) <= 1 && best.offset >= (best.index === this.pending.index ? this.pending.offset - 60 : 0)) {
      if (!duplicate) this.pending.count++;
      this.pending.index = best.index; this.pending.offset = best.offset;
    } else { this.pending = { index: best.index, offset: best.offset, count: duplicate ? 0 : 1 }; }
    if (this.pending.count < required) return { state: 'holding', confidence: best.confidence, reason: 'confirming' };
    this.anchor = best.index; this.anchorOffset = best.offset; this.failures = 0;
    return { state: 'following', confidence: best.confidence, reason: 'matched', target: { blockId: best.blockId, offset: best.offset, recovery: global || distant || backward } };
  }
}

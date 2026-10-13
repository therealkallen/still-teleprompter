import { marked } from 'marked';
import type { Block, BlockType, TextRun } from './model';

const MAX_TEXT = 2_000_000;
const cueMarker = /^(?:\[(?:cue|提示)\]\s*|::cue\s+)/i;
function makeId(text: string, index: number): string {
  let hash = 2166136261;
  for (const char of `${index}:${text}`) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return `block-${index}-${(hash >>> 0).toString(36)}`;
}
function limits(text: string) {
  if (text.length > MAX_TEXT) throw new Error('稿件超过 200 万字符，请拆分成较小文件。');
}
function block(text: string, index: number, type: BlockType = 'spoken', level?: number, runs?: TextRun[]): Block {
  const cue = cueMarker.test(text);
  const clean = cue ? text.replace(cueMarker, '') : text;
  return { id: makeId(text, index), type: cue && type !== 'section' ? 'cue' : type, text: clean, level, runs: cue ? undefined : runs };
}
export function parseText(source: string): Block[] {
  limits(source);
  const lines = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const flush = () => { if (paragraph.length) { blocks.push(block(paragraph.join('\n').trim(), blocks.length)); paragraph = []; } };
  for (const line of lines) {
    const text = line.trim();
    const heading = /^(#{1,6})\s+(.+)$/.exec(text);
    if (!text) { flush(); continue; }
    if (heading) { flush(); blocks.push(block(heading[2], blocks.length, 'section', heading[1].length)); }
    else if (cueMarker.test(text) || /^([-*•]\s+|\d+[.)]\s+)/.test(text)) { flush(); blocks.push(block(text, blocks.length)); }
    else paragraph.push(line);
  }
  flush();
  return blocks;
}
function extractRuns(node: Node, bold = false, italic = false): TextRun[] {
  if (node.nodeType === Node.TEXT_NODE) return [{ text: node.textContent ?? '', bold, italic }];
  if (!(node instanceof Element)) return [];
  if (['SCRIPT', 'STYLE', 'IMG', 'IFRAME', 'OBJECT', 'SVG'].includes(node.tagName)) return [];
  if (node.tagName === 'BR') return [{ text: '\n', bold, italic }];
  return Array.from(node.childNodes).flatMap(child => extractRuns(child, bold || ['STRONG', 'B'].includes(node.tagName), italic || ['EM', 'I'].includes(node.tagName)));
}
export function parseStructuredHtml(html: string): Block[] {
  limits(html);
  // Imported HTML is never inserted into the UI. Only text and two explicit emphasis flags survive.
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blocks: Block[] = [];
  function visit(parent: Element) {
    for (const el of Array.from(parent.children)) {
      if (['SCRIPT', 'STYLE', 'IMG', 'IFRAME', 'OBJECT', 'SVG'].includes(el.tagName)) continue;
      if (/^H[1-6]$/.test(el.tagName) || ['P', 'LI', 'PRE'].includes(el.tagName)) {
        const source = el.tagName === 'LI' ? el.cloneNode(true) as Element : el;
        if (el.tagName === 'LI') source.querySelectorAll('ul, ol').forEach(list => list.remove());
        let runs = extractRuns(source);
        if (el.tagName === 'LI') {
          const list = el.parentElement!;
          const start = Number(list.getAttribute('start')) || 1;
          const prefix = list.tagName === 'OL' ? `${Array.from(list.children).indexOf(el) + start}. ` : '• ';
          runs = [{ text: prefix }, ...runs];
        }
        const raw = runs.map(r => r.text).join('');
        const text = raw.trim();
        if (text) {
          // Trim whitespace without discarding spans and emphasis.
          let left = raw.length - raw.trimStart().length, right = raw.trimEnd().length;
          runs = runs.flatMap(run => {
            const length = run.text.length;
            const content = run.text.slice(Math.min(left, length), Math.max(0, Math.min(right, length)));
            left = Math.max(0, left - length); right -= length;
            return content ? [{ ...run, text: content }] : [];
          });
          blocks.push(block(text, blocks.length, /^H/.test(el.tagName) ? 'section' : el.classList.contains('presenter-cue') ? 'cue' : 'spoken', /^H/.test(el.tagName) ? Number(el.tagName[1]) : undefined, runs));
        }
        if (el.tagName === 'LI') el.querySelectorAll(':scope > ul, :scope > ol').forEach(visit);
      } else visit(el);
    }
  }
  visit(doc.body);
  // Plain top-level text is unusual but still useful for a pasted Markdown document.
  if (!blocks.length && doc.body.textContent?.trim()) return parseText(doc.body.textContent);
  return blocks;
}
export function parseMarkdown(source: string): Block[] {
  limits(source);
  return parseStructuredHtml(marked.parse(source, { async: false, breaks: true }) as string);
}
function checkDocxSize(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  let total = 0;
  // Check the ZIP central directory before inflating DOCX data.
  for (let offset = 0; offset + 46 <= view.byteLength; offset++) {
    if (view.getUint32(offset, true) !== 0x02014b50) continue;
    total += view.getUint32(offset + 24, true);
    if (total > 32 * 1024 * 1024) throw new Error('DOCX 解压后超过 32 MB，请移除图片或拆分文件。');
    offset += 45 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
  }
}
export async function importFile(file: File): Promise<{ blocks: Block[]; warnings: string[] }> {
  if (file.size > 10 * 1024 * 1024) throw new Error('文件超过 10 MB，请精简或拆分稿件。');
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'docx') {
    const arrayBuffer = await file.arrayBuffer();
    checkDocxSize(arrayBuffer);
    const mammoth = await import('mammoth/mammoth.browser');
    const result = await mammoth.convertToHtml({ arrayBuffer }, { styleMap: ["p[style-name='Presenter Cue'] => p.presenter-cue:fresh"] });
    return { blocks: parseStructuredHtml(result.value), warnings: result.messages.map(m => m.message) };
  }
  if (!['txt', 'md', 'markdown'].includes(extension ?? '')) throw new Error('请选择 DOCX、TXT 或 Markdown 文件。');
  const bytes = await file.arrayBuffer();
  const view = new Uint8Array(bytes);
  const encoding = view[0] === 0xff && view[1] === 0xfe ? 'utf-16le' : view[0] === 0xfe && view[1] === 0xff ? 'utf-16be' : 'utf-8';
  let source: string;
  try { source = new TextDecoder(encoding, { fatal: true }).decode(bytes); }
  catch { throw new Error('文本编码无法识别，请先另存为 UTF-8 或带 BOM 的 UTF-16 文件。'); }
  return { blocks: extension === 'txt' ? parseText(source) : parseMarkdown(source), warnings: [] };
}

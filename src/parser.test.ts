import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { importFile, parseMarkdown, parseStructuredHtml, parseText } from './parser';

describe('deterministic structured import', () => {
  it('recognizes explicit headings, cues and lists without classifying normal text', () => {
    const blocks = parseText('# Opening\r\n\r\nHello\r\nworld\r\n\r\n[cue] Pause\r\n::cue Look up\r\n- One\r\n- Two\r\n\r\nConclusion');
    expect(blocks.map(b => b.type)).toEqual(['section', 'spoken', 'cue', 'cue', 'spoken', 'spoken', 'spoken']);
    expect(blocks[1].text).toBe('Hello\nworld');
    expect(blocks[2].text).toBe('Pause');
    expect(blocks.at(-1)?.type).toBe('spoken');
    expect(new Set(blocks.map(b => b.id)).size).toBe(blocks.length);
    expect(parseText('# Opening\n\nRepeated\n\nRepeated').map(b => b.id)).toEqual(parseText('# Opening\n\nRepeated\n\nRepeated').map(b => b.id));
  });
  it('preserves Markdown emphasis and section levels', () => {
    const blocks = parseMarkdown('## Start\n\nA **strong** and *quiet* point.\n\n1. First\n2. Second\n\n[cue] Wait');
    expect(blocks[0]).toMatchObject({ type: 'section', level: 2, text: 'Start' });
    expect(blocks[1].runs?.find(r => r.text === 'strong')?.bold).toBe(true);
    expect(blocks[1].runs?.find(r => r.text === 'quiet')?.italic).toBe(true);
    expect(blocks.slice(2, 4).map(b => b.text)).toEqual(['1. First', '2. Second']);
    expect(blocks.at(-1)).toMatchObject({ type: 'cue', text: 'Wait' });
  });
  it('never retains executable HTML or image sources and handles nested lists', () => {
    const blocks = parseStructuredHtml('<h1>Title</h1><p onclick="evil()">Safe <b>text</b><img src="https://example.com/pixel"><script>evil()</script></p><ul><li>Parent<ul><li>Child</li></ul></li></ul>');
    expect(blocks.map(b => b.text)).toEqual(['Title', 'Safe text', '• Parent', '• Child']);
    expect(JSON.stringify(blocks)).not.toContain('evil');
    expect(JSON.stringify(blocks)).not.toContain('https://');
  });
  it('retains Word cue style and trims spans without losing emphasis', () => {
    const blocks = parseStructuredHtml('<p class="presenter-cue">  <em>Pause</em>  </p>');
    expect(blocks[0].type).toBe('cue');
    expect(blocks[0].runs?.map(r => r.text).join('')).toBe('Pause');
    expect(blocks[0].runs?.[0].italic).toBe(true);
  });
  it('imports an actual DOCX document with Word heading, emphasis and cue style', async () => {
    const bytes = await readFile('src/fixtures/sample.docx');
    const file = new File([new Uint8Array(bytes)], 'sample.docx');
    const result = await importFile(file);
    expect(result.blocks.map(b => b.type)).toEqual(['section', 'spoken', 'cue']);
    expect(result.blocks.map(b => b.text)).toEqual(['Opening', 'A strong point.', 'Pause and look up.']);
    expect(result.blocks[1].runs?.find(r => r.text === 'strong')?.bold).toBe(true);
  });
  it('decodes UTF-16 TXT and rejects corrupt DOCX with no partial script', async () => {
    const bytes = new Uint8Array([0xff, 0xfe, 0x23, 0, 0x20, 0, 0x41, 0]);
    expect((await importFile(new File([bytes], 'utf16.txt'))).blocks[0]).toMatchObject({ type: 'section', text: 'A' });
    await expect(importFile(new File(['broken archive'], 'broken.docx'))).rejects.toThrow();
  });
});

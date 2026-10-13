import { describe, expect, it } from 'vitest';
import { AlignmentEngine, normalize } from './alignment';
import type { Block } from '../model';
const spoken = (id: string, text: string): Block => ({ id, text, type: 'spoken' });
const script = [spoken('intro', '今天我们介绍 Finance AI 如何帮助财务团队提高工作效率。'), spoken('next', 'Copilot 可以支持 Invoice Registration，并改善 Internal Control 的审核流程。'), ...Array.from({ length: 6 }, (_, i) => spoken(`gap${i}`, `这是第${i}个独立段落，我们讨论不同的业务计划和项目安排。`)), spoken('rag', '接下来介绍 RAG 的知识检索技术，结合 Power Automate 自动执行业务流程。')];
describe('deterministic speech alignment', () => {
  it('normalizes mixed punctuation, width, abbreviations, fillers and basic numbers while mapping source offsets', () => {
    const original = '嗯，Ｆｉｎａｎｃｅ A.I. 增长二十％！';
    const value = normalize(original);
    expect(value.text).toBe('financeai增长20');
    expect(value.offsets).toHaveLength(value.text.length);
    expect(original.slice(0, value.offsets.at(-1))).toContain('二十');
    expect(normalize('R.A.G. and COPILOT').text).toBe(normalize('RAG and Copilot').text);
  });
  it('requires confirmation and follows Chinese-English speech with minor omissions', () => {
    const engine = new AlignmentEngine(script);
    expect(engine.update('今天介绍 Finance AI 如何帮助财务团队', 1).state).toBe('holding');
    const result = engine.update('Finance AI 如何帮助财务团队提高工作效率', 2);
    expect(result.target?.blockId).toBe('intro');
    expect(result.target?.recovery).toBe(false);
    expect(result.confidence).toBeGreaterThan(0.9);
  });
  it('holds unrelated discussion and can recover locally when reading resumes', () => {
    const engine = new AlignmentEngine(script);
    engine.reanchor('next');
    expect(engine.update('请问大家周末去哪里度假我们可以会后再讨论', 1).target).toBeUndefined();
    expect(engine.update('Copilot 可以支持 Invoice Registration', 2).state).toBe('holding');
    expect(engine.update('Invoice Registration 并改善 Internal Control 的审核流程', 3).target?.blockId).toBe('next');
  });
  it('does not match section headings or presenter cues', () => {
    const text = '请停下来问大家是否有任何问题并且切换下一张幻灯片';
    const engine = new AlignmentEngine([{ id: 'heading', type: 'section', text }, { id: 'cue', type: 'cue', text }, spoken('body', '正常的演讲内容完全不同')]);
    for (let n = 1; n < 10; n++) expect(engine.update(text, n).target).toBeUndefined();
  });
  it('requires repeated local failures and three distinct updates to recover a distant section', () => {
    const engine = new AlignmentEngine(script);
    for (let n = 1; n <= 2; n++) expect(engine.update('接下来介绍 RAG 的知识检索技术', n).target).toBeUndefined();
    expect(engine.update('接下来介绍 RAG 的知识检索技术结合 Power', 3).target).toBeUndefined();
    expect(engine.update('RAG 的知识检索技术结合 Power Automate', 4).target).toBeUndefined();
    const result = engine.update('知识检索技术结合 Power Automate 自动执行业务流程', 5);
    expect(result.target).toMatchObject({ blockId: 'rag', recovery: true });
  });
  it('does not turn overlapping identical windows or short generic speech into confirmation', () => {
    const engine = new AlignmentEngine(script);
    for (let n = 1; n < 15; n++) expect(engine.update('接下来介绍 RAG 的知识检索技术', n).target).toBeUndefined();
    expect(engine.update('谢谢大家', 15).reason).toBe('short');
    expect(engine.update('新的识别结果也不能接受乱序事件', 14).reason).toBe('duplicate');
  });
  it('avoids ambiguous repeated distant passages and reanchors after manual movement', () => {
    const repeated = '接下来介绍 RAG 的知识检索技术结合 Power Automate 自动执行业务流程';
    const engine = new AlignmentEngine([...script, spoken('repeat', repeated)]);
    for (let n = 1; n < 7; n++) expect(engine.update(repeated.slice(n), n).target).toBeUndefined();
    engine.reanchor('repeat');
    engine.update('RAG 的知识检索技术结合 Power Automate', 10);
    expect(engine.update('知识检索技术结合 Power Automate 自动执行业务流程', 11).target?.blockId).toBe('repeat');
  });
  it('locates text within a long spoken block and crosses adjacent block boundaries', () => {
    const engine = new AlignmentEngine([spoken('long', '开场白内容。'.repeat(18) + '今天使用 Finance AI 提高财务团队的业务效率。'), spoken('second', '我们继续介绍 Copilot 的实际应用。')]);
    engine.reanchor('long', 100);
    engine.update('今天使用 Finance AI 提高财务团队的业务效率', 1);
    const result = engine.update('Finance AI 提高财务团队的业务效率我们继续介绍 Copilot', 2);
    expect(result.target?.blockId).toBe('second');
  });
});

import { describe, expect, it } from 'vitest';
import { initialWorkspace } from './demo';
import { validateWorkspace } from './model';
import { createTranslator, translateMessage } from './i18n';

describe('interface language and existing data', () => {
  it('migrates older saved workspaces to Chinese without modifying any script data', () => {
    const legacy = JSON.parse(JSON.stringify(initialWorkspace()));
    delete legacy.settings.language;
    const scripts = JSON.stringify(legacy.scripts);
    const restored = validateWorkspace(legacy);
    expect(restored.settings.language).toBe('zh');
    expect(JSON.stringify(restored.scripts)).toBe(scripts);
    expect(legacy.settings.language).toBeUndefined();
  });
  it('persists English and preserves content, bookmarks and reading positions', () => {
    const original = initialWorkspace();
    original.settings.language = 'en';
    original.scripts[0].bookmarks = [original.scripts[0].blocks[2].id];
    const restored = validateWorkspace(JSON.parse(JSON.stringify(original)));
    expect(restored).toEqual(original);
    const invalid = JSON.parse(JSON.stringify(original));
    invalid.settings.language = 'fr';
    expect(() => validateWorkspace(invalid)).toThrow('界面语言设置无效');
  });
  it('interpolates labels without interpreting user script text as translations', () => {
    const t = createTranslator('en');
    expect(t('{p0}书签：{p1}', { p0: 'Add', p1: '设置 <script> {p0}' })).toBe('Add bookmark: 设置 <script> {p0}');
  });
  it('translates nested errors and variable statuses while keeping diagnostic codes', () => {
    const error = '保存失败：Error: 本地数据损坏：code 123。可在设置中导出备份后重试。';
    const english = translateMessage('en', error);
    expect(english).toBe('Save failed: Local data is corrupted: code 123. Export a backup in settings, then retry.');
    expect(translateMessage('zh', english)).toBe('保存失败：本地数据损坏：code 123。可在设置中导出备份后重试。');
    expect(translateMessage('en', 'Windows 返回捕获标记 0x0，预期为 0x11。')).toBe('Windows returned capture flag 0x0; expected 0x11.');
    expect(translateMessage('en', '已导入 25 段，源文件未改动。')).toBe('Imported 25 blocks. The original file was not modified.');
  });
});

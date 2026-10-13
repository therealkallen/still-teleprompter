export type BlockType = 'section' | 'spoken' | 'cue';
export interface TextRun { text: string; bold?: boolean; italic?: boolean }
export interface Block { id: string; type: BlockType; text: string; level?: number; runs?: TextRun[] }
export interface Position { blockId: string | null; offset: number; ratio: number }
export interface Script {
  id: string; title: string; blocks: Block[]; bookmarks: string[];
  position: Position; updatedAt: string;
}
export type Action = 'up' | 'down' | 'previous' | 'next' | 'bookmark';
export interface Binding { action: Action; shortcut: string }
export interface Appearance {
  background: string; backgroundOpacity: number; text: string; textOpacity: number;
  fontFamily: string; fontSize: number; lineHeight: number;
  cueColor: string; cueItalic: boolean; showCues: boolean;
}
export type Language = 'zh' | 'en';
export interface Settings {
  language: Language;
  appearance: Appearance; captureExcluded: boolean; scrollStep: number; hotkeys: Binding[];
}
export interface Workspace { version: 1; scripts: Script[]; activeScriptId: string; settings: Settings }
export const fonts = ['Segoe UI', 'Arial', 'Georgia', 'Microsoft YaHei', 'SimSun'] as const;
export const presets: Record<string, Appearance> = {
  dark: { background: '#202225', backgroundOpacity: 0.96, text: '#f3f1ec', textOpacity: 1, fontFamily: 'Segoe UI', fontSize: 28, lineHeight: 1.7, cueColor: '#aac5b0', cueItalic: true, showCues: true },
  light: { background: '#f5f4ef', backgroundOpacity: 1, text: '#292d2b', textOpacity: 1, fontFamily: 'Segoe UI', fontSize: 28, lineHeight: 1.7, cueColor: '#456b50', cueItalic: true, showCues: true },
  transparent: { background: '#151719', backgroundOpacity: 0.62, text: '#ffffff', textOpacity: 1, fontFamily: 'Segoe UI', fontSize: 30, lineHeight: 1.8, cueColor: '#b2d4bb', cueItalic: true, showCues: true },
};
export const defaultSettings: Settings = {
  language: 'zh',
  appearance: { ...presets.dark }, captureExcluded: true, scrollStep: 100,
  hotkeys: [
    { action: 'up', shortcut: 'Ctrl+Alt+ArrowUp' },
    { action: 'down', shortcut: 'Ctrl+Alt+ArrowDown' },
    { action: 'previous', shortcut: 'Ctrl+Alt+ArrowLeft' },
    { action: 'next', shortcut: 'Ctrl+Alt+ArrowRight' },
    { action: 'bookmark', shortcut: 'Ctrl+Alt+B' },
  ],
};
export const actionLabels: Record<Action, string> = { up: '向上滚动', down: '向下滚动', previous: '上一章节', next: '下一章节', bookmark: '切换当前位置书签' };
export const blockLabels: Record<BlockType, string> = { section: '章节', spoken: '正文', cue: '演讲提示' };
export function createScript(title: string, blocks: Block[]): Script {
  return { id: crypto.randomUUID(), title: title.trim() || '未命名稿件', blocks, bookmarks: [], position: { blockId: blocks[0]?.id ?? null, offset: 0, ratio: 0 }, updatedAt: new Date().toISOString() };
}
export function rgba(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const validColor = (value: unknown): value is string => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
function numeric(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
export function validateWorkspace(value: unknown): Workspace {
  if (!record(value) || value.version !== 1 || !Array.isArray(value.scripts) || !record(value.settings)) throw new Error('本地稿件格式或版本不受支持。原始数据未被覆盖。');
  const ids = new Set<string>();
  for (const script of value.scripts) {
    if (!record(script) || typeof script.id !== 'string' || ids.has(script.id) || typeof script.title !== 'string' || !Array.isArray(script.blocks) || !Array.isArray(script.bookmarks) || !record(script.position)) throw new Error('稿件数据不完整。请保留数据文件并从备份恢复。');
    ids.add(script.id);
    const blockIds = new Set<string>();
    for (const b of script.blocks) {
      if (!record(b) || typeof b.id !== 'string' || blockIds.has(b.id) || !['section', 'spoken', 'cue'].includes(String(b.type)) || typeof b.text !== 'string') throw new Error('稿件段落数据无效。');
      blockIds.add(b.id);
      if (b.level !== undefined && !numeric(b.level, 1, 6)) throw new Error('章节层级数据无效。');
      if (b.runs !== undefined && (!Array.isArray(b.runs) || b.runs.some(r => !record(r) || typeof r.text !== 'string' || (r.bold !== undefined && typeof r.bold !== 'boolean') || (r.italic !== undefined && typeof r.italic !== 'boolean')) || b.runs.map((r: TextRun) => r.text).join('') !== b.text)) throw new Error('文本格式数据无效。');
    }
    if (script.bookmarks.some(id => typeof id !== 'string' || !blockIds.has(id)) || (script.position.blockId !== null && (typeof script.position.blockId !== 'string' || !blockIds.has(script.position.blockId))) || !numeric(script.position.offset, 0, 10000000) || !numeric(script.position.ratio, 0, 1) || typeof script.updatedAt !== 'string') throw new Error('阅读位置或书签数据无效。');
  }
  if (typeof value.activeScriptId !== 'string' || !ids.has(value.activeScriptId)) throw new Error('未找到当前稿件。');
  const s = value.settings, a = s.appearance;
  if (s.language !== undefined && s.language !== 'zh' && s.language !== 'en') throw new Error('界面语言设置无效。');
  if (!record(a) || !validColor(a.background) || !validColor(a.text) || !validColor(a.cueColor) || !numeric(a.backgroundOpacity, 0, 1) || !numeric(a.textOpacity, 0.1, 1) || !numeric(a.fontSize, 16, 60) || !numeric(a.lineHeight, 1.2, 2.4) || !fonts.includes(a.fontFamily as typeof fonts[number]) || typeof a.cueItalic !== 'boolean' || typeof a.showCues !== 'boolean' || typeof s.captureExcluded !== 'boolean' || !numeric(s.scrollStep, 20, 500) || !Array.isArray(s.hotkeys) || s.hotkeys.length > 5 || s.hotkeys.some(b => !record(b) || !Object.hasOwn(actionLabels, String(b.action)) || typeof b.shortcut !== 'string')) throw new Error('设置数据无效。');
  // Existing V1 workspaces have no language setting. Migrate without touching scripts.
  return { ...value, settings: { ...s, language: s.language ?? 'zh' } } as unknown as Workspace;
}

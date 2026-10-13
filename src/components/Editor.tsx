import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, FileUp, Plus, Trash2, Download, ClipboardPaste, Save } from 'lucide-react';
import { blockLabels, createScript, validateWorkspace, type Block, type BlockType, type Script, type Workspace } from '../model';
import { importFile, parseMarkdown, parseText } from '../parser';
import { useI18n } from '../i18n';

interface Props { script: Script; workspace: Workspace; updateScript: (script: Script) => void; addScript: (script: Script) => void; restoreBackup: (workspace: Workspace) => void; notify: (message: string) => void; save: () => void; saving: boolean; saveBlocked: boolean }
export default function Editor({ script, workspace, updateScript, addScript, restoreBackup, notify, save, saving, saveBlocked }: Props) {
  const { t } = useI18n();
  const [paste, setPaste] = useState('');
  const [pasteTitle, setPasteTitle] = useState('');
  const [format, setFormat] = useState('markdown');
  const [pasting, setPasting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const backupInput = useRef<HTMLInputElement>(null);
  const changeBlocks = (blocks: Block[]) => {
    const ids = new Set(blocks.map(b => b.id));
    updateScript({ ...script, blocks, bookmarks: script.bookmarks.filter(id => ids.has(id)), position: ids.has(script.position.blockId ?? '') ? script.position : { blockId: blocks[0]?.id ?? null, offset: 0, ratio: 0 }, updatedAt: new Date().toISOString() });
  };
  const patchBlock = (id: string, patch: Partial<Block>) => changeBlocks(script.blocks.map(b => b.id === id ? { ...b, ...patch } : b));
  const moveBlock = (index: number, delta: number) => { const blocks = [...script.blocks]; [blocks[index], blocks[index + delta]] = [blocks[index + delta], blocks[index]]; changeBlocks(blocks); };
  const importSelected = async (file: File) => {
    setImporting(true);
    try {
      const { blocks, warnings } = await importFile(file);
      if (!blocks.length) throw new Error('文件中没有可读取的段落。');
      addScript(createScript(file.name.replace(/\.[^.]+$/, ''), blocks));
      notify(warnings.length ? `已导入 ${blocks.length} 段。部分 Word 元素可能已简化：${warnings.slice(0, 3).join('；')}` : `已导入 ${blocks.length} 段，源文件未改动。`);
    } catch (error) { notify(String(error)); }
    finally { setImporting(false); }
  };
  const exportText = () => {
    const text = script.blocks.map(b => `${b.type === 'section' ? `${'#'.repeat(b.level ?? 1)} ` : b.type === 'cue' ? '[cue] ' : ''}${b.text}`).join('\n\n');
    download(`${script.title}.txt`, text, 'text/plain;charset=utf-8');
  };
  return <div className="panel-body editor-body">
    <div className="button-row editor-actions">
      <button onClick={() => setPasting(!pasting)} aria-expanded={pasting}><ClipboardPaste size={15} />{t("粘贴稿件")}</button>
      <button disabled={importing} onClick={() => fileInput.current?.click()}><FileUp size={15} />{importing ? t("正在导入…") : t("导入文件")}</button>
      <button disabled={saveBlocked} onClick={save} title={t("立即将稿件和设置保存到本机")}><Save size={15} />{saving ? t("保存中…") : t("保存到本机")}</button>
      <button className="icon-button" title={t("导出当前稿件为 TXT")} aria-label={t("导出当前稿件为 TXT")} onClick={exportText}><Download size={16} /></button>
      <input ref={fileInput} hidden type="file" accept=".txt,.md,.markdown,.docx" onChange={e => { if (e.target.files?.[0]) void importSelected(e.target.files[0]); e.target.value = ''; }} />
    </div>
    <p className="help autosave-note">{t("修改会自动保存在本机，下次打开直接恢复。在「导航 → 当前稿件」中可切换已保存的稿件，无需导出文件。")}</p>
    {pasting && <section className="paste-form">
      <h2>{t("从文本新建稿件")}</h2>
      <label className="field">{t("稿件名称")}<input value={pasteTitle} onChange={e => setPasteTitle(e.target.value)} placeholder={t("例如：季度汇报")} /></label>
      <label className="field">{t("内容")}<textarea rows={7} value={paste} onChange={e => setPaste(e.target.value)} placeholder={t("# 开场\n\n在这里粘贴演讲稿…\n\n[cue] 停顿，看向镜头")} /></label>
      <div className="button-row"><label className="field">{t("解析格式")}<select value={format} onChange={e => setFormat(e.target.value)}><option value="markdown">Markdown</option><option value="text">{t("纯文本")}</option></select></label>
      <button className="primary" disabled={!paste.trim()} onClick={() => {
        try { const blocks = format === 'markdown' ? parseMarkdown(paste) : parseText(paste); if (!blocks.length) throw new Error('没有可读取的文本。'); addScript(createScript(pasteTitle.trim() || t('未命名稿件'), blocks)); setPaste(''); setPasteTitle(''); setPasting(false); notify('稿件已创建。'); }
        catch (e) { notify(String(e)); }
      }}>{t("创建稿件")}</button></div>
      <p className="help">{t("# 标记章节；[cue] 或 ::cue 标记演讲提示。不会自动分类内容。")}</p>
    </section>}
    <label className="field script-name">{t("稿件名称")}<input value={script.title} onChange={e => updateScript({ ...script, title: e.target.value, updatedAt: new Date().toISOString() })} /></label>
    <div className="list-heading"><h2>{t("段落")}</h2><span>{script.blocks.length} {t("段")}</span></div>
    {!script.blocks.length && <p className="empty-note">{t("稿件还是空的。粘贴内容、导入文件，或添加一个段落。")}</p>}
    <div className="block-editor-list">{script.blocks.map((b, index) => <div className="block-editor" key={b.id}>
      <div className="block-editor-toolbar">
        <select aria-label={t("第 {p0} 段类型", { p0: index + 1 })} value={b.type} onChange={e => patchBlock(b.id, { type: e.target.value as BlockType })}>{Object.entries(blockLabels).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select>
        {b.type === 'section' && <select aria-label={t("第 {p0} 段章节层级", { p0: index + 1 })} value={b.level ?? 1} onChange={e => patchBlock(b.id, { level: Number(e.target.value) })}>{[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>H{n}</option>)}</select>}
        <span className="spacer" />
        <button className="icon-button" aria-label={t("上移第 {p0} 段", { p0: index + 1 })} disabled={index === 0} onClick={() => moveBlock(index, -1)}><ArrowUp size={14} /></button>
        <button className="icon-button" aria-label={t("下移第 {p0} 段", { p0: index + 1 })} disabled={index === script.blocks.length - 1} onClick={() => moveBlock(index, 1)}><ArrowDown size={14} /></button>
        <button className="icon-button" aria-label={t("删除第 {p0} 段", { p0: index + 1 })} onClick={() => setConfirmDelete(confirmDelete === b.id ? null : b.id)}><Trash2 size={14} /></button>
      </div>
      <textarea aria-label={t("第 {p0} 段内容", { p0: index + 1 })} rows={Math.min(8, Math.max(2, Math.ceil(b.text.length / 36)))} value={b.text} onChange={e => patchBlock(b.id, { text: e.target.value, runs: undefined })} />
      {confirmDelete === b.id && <div className="delete-confirm"><span>{t("删除这一段？")}</span><button className="danger" onClick={() => { changeBlocks(script.blocks.filter(block => block.id !== b.id)); setConfirmDelete(null); }}>{t("删除")}</button><button onClick={() => setConfirmDelete(null)}>{t("取消")}</button></div>}
    </div>)}</div>
    <button className="add-block" onClick={() => changeBlocks([...script.blocks, { id: crypto.randomUUID(), type: 'spoken', text: '' }])}><Plus size={16} />{t("添加段落")}</button>
    <div className="backup-import"><p className="help">{t("TXT 导出保留章节和提示标记。要保留字体、书签和阅读位置，请在设置中导出完整备份。")}</p><button onClick={() => backupInput.current?.click()}>{t("导入完整备份")}</button>
      <input hidden ref={backupInput} type="file" accept=".json" onChange={async e => {
        const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
        try {
          if (file.size > 40 * 1024 * 1024) throw new Error('备份超过 40 MB。');
          const restored = validateWorkspace(JSON.parse(await file.text()));
          // Merge as new script copies; preserve current library and settings.
          const imported = restored.scripts.map(s => ({ ...s, id: crypto.randomUUID() }));
          restoreBackup({ ...workspace, scripts: [...workspace.scripts, ...imported], activeScriptId: imported.find((_, i) => restored.scripts[i].id === restored.activeScriptId)?.id ?? workspace.activeScriptId });
          notify(`已从备份添加 ${imported.length} 份稿件，保留原有稿件和当前偏好。`);
        } catch (error) { notify(String(error)); }
      }} />
    </div>
  </div>;
}
export function download(name: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name.replace(/[<>:"/\\|?*]/g, '_'); link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

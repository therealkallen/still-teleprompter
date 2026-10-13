import { useMemo, useState } from 'react';
import { Bookmark, ChevronDown, ChevronRight, Plus, Search, Trash2 } from 'lucide-react';
import { blockLabels, type Script, type Workspace } from '../model';
import { useI18n } from '../i18n';

interface Props { workspace: Workspace; script: Script; selectScript: (id: string) => void; jump: (id: string) => void; toggleBookmark: (id: string) => void; newScript: () => void; deleteScript: (id: string) => void }
export default function Navigation({ workspace, script, selectScript, jump, toggleBookmark, newScript, deleteScript }: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'outline' | 'bookmarks'>('outline');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const results = useMemo(() => query.trim() ? script.blocks.filter(b => b.text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) : [], [script.blocks, query]);
  const sections = script.blocks.filter(b => b.type === 'section');
  const visibleSections = sections.filter((section, index) => !sections.slice(0, index).some((parent, parentIndex) => collapsed.has(parent.id) && (parent.level ?? 1) < (section.level ?? 1) && !sections.slice(parentIndex + 1, index).some(b => (b.level ?? 1) <= (parent.level ?? 1))));
  const rows = query.trim() ? results : tab === 'outline' ? visibleSections : script.blocks.filter(b => script.bookmarks.includes(b.id));
  return <div className="panel-body navigation-body">
    <label className="field">{t("当前稿件")}<select value={script.id} onChange={e => { selectScript(e.target.value); setQuery(''); setCollapsed(new Set()); }}>{workspace.scripts.map(s => <option key={s.id} value={s.id}>{s.title || t("未命名稿件")}</option>)}</select></label>
    <div className="button-row library-actions"><button onClick={newScript}><Plus size={15} />{t("新建稿件")}</button><button disabled={workspace.scripts.length <= 1} onClick={() => setDeleteId(script.id)}><Trash2 size={14} />{t("删除稿件")}</button></div>
    {deleteId && <div className="delete-confirm"><span>{t("删除整份稿件和书签？")}</span><button className="danger" onClick={() => { deleteScript(deleteId); setDeleteId(null); }}>{t("删除")}</button><button onClick={() => setDeleteId(null)}>{t("取消")}</button></div>}
    <label className="search-field"><Search size={17} /><input aria-label={t("搜索全文")} placeholder={t("搜索稿件中的文字")} value={query} onChange={e => setQuery(e.target.value)} /></label>
    {!query.trim() && <div className="segment-control" role="tablist" aria-label={t("导航类型")}><button role="tab" aria-selected={tab === 'outline'} className={tab === 'outline' ? 'selected' : ''} onClick={() => setTab('outline')}>{t("章节")} {sections.length}</button><button role="tab" aria-selected={tab === 'bookmarks'} className={tab === 'bookmarks' ? 'selected' : ''} onClick={() => setTab('bookmarks')}>{t("书签")} {script.bookmarks.length}</button></div>}
    {query.trim() && <p className="help">{t('找到 {count} 个段落', { count: results.length })}</p>}
    <div className="nav-list">{rows.map(b => {
      const index = sections.indexOf(b);
      const hasChildren = !query.trim() && tab === 'outline' && sections[index + 1] && (sections[index + 1].level ?? 1) > (b.level ?? 1);
      return <div className={`nav-row ${script.position.blockId === b.id ? 'current' : ''}`} key={b.id} style={{ paddingLeft: !query.trim() && tab === 'outline' ? 8 + ((b.level ?? 1) - 1) * 12 : 8 }}>
        {hasChildren && <button className="icon-button" aria-label={`${collapsed.has(b.id) ? t("展开") : t("折叠")} ${b.text}`} aria-expanded={!collapsed.has(b.id)} onClick={() => setCollapsed(old => { const next = new Set(old); next.has(b.id) ? next.delete(b.id) : next.add(b.id); return next; })}>{collapsed.has(b.id) ? <ChevronRight size={15} /> : <ChevronDown size={15} />}</button>}
        <button className="nav-target" onClick={() => jump(b.id)}><span>{b.text || t("空白段落")}</span>{(query.trim() || tab === 'bookmarks') && <small>{t(blockLabels[b.type])}</small>}</button>
        <button className="icon-button bookmark-control" aria-label={t("{p0}书签：{p1}", { p0: script.bookmarks.includes(b.id) ? t("移除") : t("添加"), p1: b.text.slice(0, 20) })} aria-pressed={script.bookmarks.includes(b.id)} onClick={() => toggleBookmark(b.id)}><Bookmark size={15} fill={script.bookmarks.includes(b.id) ? 'currentColor' : 'none'} /></button>
      </div>;
    })}</div>
    {!rows.length && <div className="empty-note">{query.trim() ? t("没有匹配的段落。试试更短的关键词。") : tab === 'bookmarks' ? t("尚未添加书签。在阅读时点击书签按钮，保存当前位置。") : t("还没有章节。在编辑中将段落类型改为「章节」。")}</div>}
  </div>;
}

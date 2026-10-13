import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Bookmark, Check, ChevronLeft, ChevronRight, List, LoaderCircle, Minus, Pencil, Search, Settings2, ShieldCheck, ShieldOff, TriangleAlert, X } from 'lucide-react';
import { initialWorkspace } from './demo';
import { createScript, rgba, type Action, type Script, type Workspace } from './model';
import { captureProtection, closeWindow, configureHotkeys, desktop, dragWindow, loadWorkspace, manualActions, minimizeWindow, onClose, readingMode, revealWindow, saveWorkspace, setWindowTitle, type CaptureStatus, type HotkeyStatus } from './native';
import { positionAt, restorePosition, ScrollController, type BlockGeometry } from './scroll';
import Editor, { download } from './components/Editor';
import Navigation from './components/Navigation';
import Settings from './components/Settings';
import QuickSearch, { HighlightedText } from './components/QuickSearch';
import { findMatches, type SearchMatch } from './search';
import { LanguageContext, createTranslator, translateMessage } from './i18n';

type Panel = 'read' | 'edit' | 'navigation' | 'settings';
export default function App() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [panel, setPanel] = useState<Panel>('read');
  const [notice, setNotice] = useState('');
  const [capture, setCapture] = useState<CaptureStatus | null>(null);
  const [hotkeys, setHotkeys] = useState<HotkeyStatus[]>([]);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [blocked, setBlocked] = useState(false);
  const [awake, setAwake] = useState(true);
  const [progress, setProgress] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const controller = useRef<ScrollController | null>(null);
  const latest = useRef<Workspace | null>(null);
  const panelRef = useRef(panel);
  const searchOpenRef = useRef(searchOpen);
  const blockedRef = useRef(false);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingJump = useRef<string | null>(null);
  latest.current = workspace;
  panelRef.current = panel;
  searchOpenRef.current = searchOpen;
  blockedRef.current = blocked;
  const script = workspace?.scripts.find(s => s.id === workspace.activeScriptId);
  const language = workspace?.settings.language ?? 'zh';
  const t = useMemo(() => createTranslator(language), [language]);
  const search = useMemo(() => findMatches((script?.blocks ?? []).filter(b => workspace?.settings.appearance.showCues || b.type !== 'cue'), searchQuery), [script?.blocks, workspace?.settings.appearance.showCues, searchQuery]);
  const activeSearchIndex = search.matches.length ? searchIndex % search.matches.length : 0;
  const currentMatch = search.matches[activeSearchIndex];
  const matchesByBlock = useMemo(() => {
    const groups = new Map<string, SearchMatch[]>();
    for (const match of search.matches) { const group = groups.get(match.blockId) ?? []; group.push(match); groups.set(match.blockId, group); }
    return groups;
  }, [search.matches]);

  const notify = useCallback((message: string) => setNotice(message.replace(/^Error:\s*/, '')), []);
  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.title = t('Still · 提词器');
    void setWindowTitle(document.title).catch(notify);
  }, [language, t, notify]);
  const updateScript = useCallback((changed: Script) => setWorkspace(old => old ? { ...old, scripts: old.scripts.map(s => s.id === changed.id ? changed : s) } : old), []);
  const geometry = useCallback((): BlockGeometry[] => {
    const view = viewport.current; if (!view) return [];
    const top = view.getBoundingClientRect().top;
    return Array.from(view.querySelectorAll<HTMLElement>('[data-block-id]')).filter(el => el.getClientRects().length > 0).map(el => ({ id: el.dataset.blockId!, top: Math.max(0, el.getBoundingClientRect().top - top + view.scrollTop - 60), height: el.offsetHeight }));
  }, []);
  const recordPosition = useCallback(() => {
    const current = latest.current, view = viewport.current;
    if (!current || !view) return;
    const active = current.scripts.find(s => s.id === current.activeScriptId); if (!active) return;
    const position = positionAt(view.scrollTop, view.scrollHeight, view.clientHeight, geometry());
    const changed = { ...current, scripts: current.scripts.map(s => s.id === active.id ? { ...s, position } : s) };
    latest.current = changed; setWorkspace(changed); setProgress(position.ratio);
  }, [geometry]);
  const flush = useCallback(async () => {
    if (blockedRef.current) { notify('本地数据未加载成功。为保护原始文件，保存已暂停。请先导出当前内容或恢复备份。'); throw new Error('Storage is blocked'); }
    const current = latest.current; if (!current) return;
    setSaveState('saving');
    const next = saveQueue.current.catch(() => {}).then(() => saveWorkspace(current));
    saveQueue.current = next;
    try { await next; setSaveState(latest.current === current ? 'saved' : 'saving'); }
    catch (error) { setSaveState('error'); notify(`保存失败：${String(error)}。可在设置中导出备份后重试。`); throw error; }
  }, [notify]);

  useEffect(() => {
    let cancelled = false;
    void loadWorkspace().then(value => { if (!cancelled) setWorkspace(value ?? initialWorkspace()); }).catch(error => {
      if (!cancelled) { setBlocked(true); setWorkspace(initialWorkspace()); notify(`读取本地数据失败：${String(error)}。原始文件未覆盖，自动保存已暂停。`); }
    });
    return () => { cancelled = true; };
  }, [notify]);
  useEffect(() => {
    if (!workspace || blocked) return;
    setSaveState('saving');
    const timer = setTimeout(() => { void flush().catch(() => {}); }, 450);
    return () => clearTimeout(timer);
  }, [workspace, blocked, flush]);

  const captureExcluded = workspace?.settings.captureExcluded;
  useEffect(() => {
    if (captureExcluded === undefined) return;
    let cancelled = false; setCapture(null);
    void captureProtection(captureExcluded).then(status => { if (!cancelled) setCapture(status); }).catch(error => { if (!cancelled) setCapture({ state: 'failed', message: String(error) }); }).finally(() => { void revealWindow().catch(notify); });
    return () => { cancelled = true; };
  }, [captureExcluded, notify]);

  const hotkeyKey = workspace ? JSON.stringify(workspace.settings.hotkeys) : null;
  useEffect(() => {
    if (!hotkeyKey) return;
    let cancelled = false;
    void configureHotkeys(JSON.parse(hotkeyKey)).then(status => { if (!cancelled) setHotkeys(status); }).catch(error => { if (!cancelled) notify(`快捷键注册失败：${String(error)}`); });
    return () => { cancelled = true; };
  }, [hotkeyKey, notify]);

  const changePanel = useCallback(async (next: Panel) => {
    try { await readingMode(next === 'read'); setSearchOpen(false); setSearchQuery(''); setSearchIndex(0); setPanel(next); setAwake(true); if (next === 'read') requestAnimationFrame(() => viewport.current?.focus({ preventScroll: true })); }
    catch (error) { notify(`窗口焦点模式切换失败：${String(error)}`); }
  }, [notify]);
  const openQuickSearch = useCallback(async () => {
    try {
      await readingMode(false); setSearchOpen(true); setAwake(true);
      requestAnimationFrame(() => document.querySelector<HTMLInputElement>('.quick-search input')?.focus());
    } catch (error) { notify(`无法打开快速搜索：${String(error)}`); }
  }, [notify]);
  const closeQuickSearch = useCallback(async () => {
    try {
      await readingMode(true); setSearchOpen(false); setSearchQuery(''); setSearchIndex(0);
      requestAnimationFrame(() => viewport.current?.focus({ preventScroll: true }));
    } catch (error) { notify(`窗口焦点模式切换失败：${String(error)}`); }
  }, [notify]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (panelRef.current === 'read' && event.ctrlKey && !event.altKey && !event.metaKey && event.key.toLowerCase() === 'f') {
        event.preventDefault(); void openQuickSearch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openQuickSearch]);
  useLayoutEffect(() => {
    if (!searchOpen || !currentMatch) return;
    const view = viewport.current;
    const mark = view?.querySelector<HTMLElement>('mark[data-current-match="true"]');
    if (view && mark) controller.current?.moveTo(mark.getBoundingClientRect().top - view.getBoundingClientRect().top + view.scrollTop - 60);
  }, [searchOpen, currentMatch]);
  const toggleBookmark = useCallback((id?: string) => {
    setWorkspace(old => {
      if (!old) return old;
      const active = old.scripts.find(s => s.id === old.activeScriptId); if (!active) return old;
      const target = id ?? active.position.blockId; if (!target) return old;
      const bookmarks = active.bookmarks.includes(target) ? active.bookmarks.filter(b => b !== target) : [...active.bookmarks, target];
      return { ...old, scripts: old.scripts.map(s => s.id === active.id ? { ...s, bookmarks } : s) };
    });
  }, []);
  const jumpTo = useCallback((id: string) => {
    const blocks = geometry();
    let location = blocks.find(b => b.id === id);
    if (!location) {
      const current = latest.current;
      const active = current?.scripts.find(s => s.id === current.activeScriptId);
      const index = active?.blocks.findIndex(b => b.id === id) ?? -1;
      if (active && index >= 0) {
        const nearby = active.blocks.slice(index + 1).find(b => blocks.some(g => g.id === b.id)) ?? active.blocks.slice(0, index).findLast(b => blocks.some(g => g.id === b.id));
        location = blocks.find(b => b.id === nearby?.id);
        notify('演讲提示已隐藏，已定位到附近正文。');
      }
    }
    if (location) controller.current?.moveTo(location.top);
  }, [geometry, notify]);
  const handleAction = useCallback((action: Action) => {
    if (panelRef.current !== 'read') return;
    const current = latest.current; if (!current) return;
    const active = current.scripts.find(s => s.id === current.activeScriptId); if (!active) return;
    if (action === 'up' || action === 'down') controller.current?.moveBy(current.settings.scrollStep * (action === 'up' ? -1 : 1));
    else if (action === 'bookmark') { recordPosition(); toggleBookmark(); }
    else {
      const view = viewport.current; if (!view) return;
      const sections = geometry().filter(b => active.blocks.find(block => block.id === b.id)?.type === 'section');
      const target = action === 'next' ? sections.find(b => b.top > view.scrollTop + 5) : sections.findLast(b => b.top < view.scrollTop - 5);
      if (target) controller.current?.moveTo(target.top);
    }
  }, [geometry, recordPosition, toggleBookmark]);
  const actionRef = useRef(handleAction); actionRef.current = handleAction;
  useEffect(() => {
    let disposed = false, stop = () => {};
    void manualActions(action => { if (!searchOpenRef.current) actionRef.current(action); }).then(unlisten => { if (disposed) unlisten(); else stop = unlisten; });
    return () => { disposed = true; stop(); };
  }, []);
  useEffect(() => {
    let disposed = false, stop = () => {};
    void onClose(async () => { if (blockedRef.current) return; recordPosition(); await flush(); }).then(unlisten => { if (disposed) unlisten(); else stop = unlisten; });
    return () => { disposed = true; stop(); };
  }, [flush, recordPosition]);

  const appearanceKey = workspace ? JSON.stringify(workspace.settings.appearance) : null;
  useLayoutEffect(() => {
    const view = viewport.current, current = latest.current;
    if (!view || !current) return;
    controller.current = new ScrollController(view);
    const active = current.scripts.find(s => s.id === current.activeScriptId)!;
    const position = { ...active.position };
    const restore = () => { if (!pendingJump.current) { controller.current?.moveTo(restorePosition(position, geometry(), view.scrollHeight, view.clientHeight), false); setProgress(position.ratio); } };
    restore();
    const observer = new ResizeObserver(() => {
      const mark = searchOpenRef.current ? view.querySelector<HTMLElement>('mark[data-current-match="true"]') : null;
      if (mark) {
        controller.current?.moveTo(mark.getBoundingClientRect().top - view.getBoundingClientRect().top + view.scrollTop - 60, false);
        return;
      }
      const latestScript = latest.current?.scripts.find(s => s.id === latest.current?.activeScriptId);
      if (latestScript) controller.current?.moveTo(restorePosition(latestScript.position, geometry(), view.scrollHeight, view.clientHeight), false);
    });
    observer.observe(view);
    return () => { observer.disconnect(); controller.current?.cancel(); if (scrollTimer.current) clearTimeout(scrollTimer.current); };
  }, [script?.id, appearanceKey, geometry]);
  useLayoutEffect(() => {
    if (panel !== 'read') return;
    if (pendingJump.current) { jumpTo(pendingJump.current); pendingJump.current = null; }
    else {
      const current = latest.current, view = viewport.current;
      const active = current?.scripts.find(s => s.id === current.activeScriptId);
      if (active && view) controller.current?.moveTo(restorePosition(active.position, geometry(), view.scrollHeight, view.clientHeight), false);
    }
  }, [panel, jumpTo, geometry]);
  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);
  const wake = () => {
    setAwake(true); if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setAwake(false), 1800);
  };
  const leave = () => { if (hideTimer.current) clearTimeout(hideTimer.current); hideTimer.current = setTimeout(() => setAwake(false), 700); };

  if (!workspace || !script) return <div className="loading-shell"><LoaderCircle className="spinner" size={20} /><span>{t("正在打开稿件…")}</span></div>;
  const appearance = workspace.settings.appearance;
  const style = {
    '--reading-bg': rgba(appearance.background, appearance.backgroundOpacity),
    '--reading-text': rgba(appearance.text, appearance.textOpacity),
    '--cue-text': rgba(appearance.cueColor, appearance.textOpacity),
    '--reading-font': `"${appearance.fontFamily}", "Microsoft YaHei", sans-serif`,
    '--reading-size': `${appearance.fontSize}px`, '--reading-line-height': appearance.lineHeight,
    '--cue-style': appearance.cueItalic ? 'italic' : 'normal',
  } as CSSProperties;
  const currentBlock = script.blocks.find(b => b.id === script.position.blockId);
  const currentSection = script.blocks.slice(0, Math.max(1, script.blocks.findIndex(b => b.id === script.position.blockId) + 1)).findLast(b => b.type === 'section');
  const captureLabel = t(capture ? ({ enabled: 'Windows 已确认捕获排除', disabled: '捕获排除已关闭', unsupported: '捕获排除不受支持', failed: '捕获排除设置失败' } as Record<string, string>)[capture.state] : '正在设置捕获排除');
  const addScript = (added: Script) => { controller.current?.cancel(); setWorkspace(old => old ? { ...old, scripts: [...old.scripts, added], activeScriptId: added.id } : old); };
  const exportBackup = () => download('Still-backup.json', JSON.stringify(latest.current, null, 2));
  const saveAndClose = async () => {
    recordPosition();
    if (desktop) { await closeWindow(); } else { await flush().catch(() => {}); notify('浏览器预览已保存。关闭此浏览器标签页即可退出。'); }
  };

  return <LanguageContext.Provider value={language}><div className={`app-shell ${panel !== 'read' ? 'panel-open' : ''} ${awake ? 'awake' : ''} ${searchOpen ? 'search-open' : ''}`} style={style} onPointerMove={wake} onPointerLeave={leave}>
    <header className="window-toolbar">
      {panel === 'read' ? <>
        <button className="brand-drag" aria-label={t("拖动窗口")} onPointerDown={e => { if (e.button === 0) void dragWindow().catch(notify); }}><span className="brand-mark"><i /><i /><i /></span><span>Still</span></button>
        <button className={`icon-button capture-icon ${capture?.state === 'enabled' ? 'success' : 'warning'}`} title={captureLabel} aria-label={captureLabel} onClick={() => void changePanel('settings')}>{capture?.state === 'enabled' ? <ShieldCheck size={16} /> : capture?.state === 'disabled' ? <ShieldOff size={16} /> : <TriangleAlert size={16} />}</button>
        <span className="spacer drag-region" onPointerDown={e => { if (e.button === 0) void dragWindow().catch(notify); }} />
        <button className="icon-button" aria-label={t("快速搜索")} title={t("快速搜索（Ctrl+F）")} aria-expanded={searchOpen} onClick={() => void (searchOpen ? closeQuickSearch() : openQuickSearch())}><Search size={17} /></button>
        <button className="icon-button" aria-label={t("导航与搜索")} title={t("导航与搜索")} onClick={() => void changePanel('navigation')}><List size={18} /></button>
        <button className="icon-button" aria-label={t("编辑稿件")} title={t("编辑稿件")} onClick={() => void changePanel('edit')}><Pencil size={16} /></button>
        <button className="icon-button" aria-label={t("设置")} title={t("设置")} onClick={() => void changePanel('settings')}><Settings2 size={17} /></button>
      </> : <>
        <button className="icon-button back-button" aria-label={t("返回阅读")} title={t("返回阅读（Esc）")} onClick={() => void changePanel('read')}><ArrowLeft size={18} /></button>
        <h1>{({ edit: t("编辑稿件"), settings: t("设置"), navigation: t("稿件导航") } as Record<string, string>)[panel]}</h1>
        <span className="spacer drag-region" onPointerDown={e => { if (e.button === 0) void dragWindow().catch(notify); }} />
      </>}
      <span className="toolbar-divider" />
      <button className="icon-button" aria-label={t("最小化")} title={t("最小化")} onClick={() => void minimizeWindow().catch(notify)}><Minus size={16} /></button>
      <button className="icon-button close-button" aria-label={t("关闭应用")} title={t("关闭应用")} onClick={() => void saveAndClose().catch(notify)}><X size={16} /></button>
    </header>
    {!desktop && <div className="preview-label">{t("浏览器预览 · 原生窗口、捕获排除和全局快捷键需桌面版")}</div>}
    {blocked && <div className="storage-blocked">{t("本地数据读取失败，保存已暂停。")}<button onClick={exportBackup}>{t("导出当前内容")}</button></div>}
    <div className="reader-wrap" style={{ visibility: panel === 'read' ? 'visible' : 'hidden' }} aria-hidden={panel !== 'read'}>
      {searchOpen && <QuickSearch query={searchQuery} onQuery={query => { setSearchQuery(query); setSearchIndex(0); }} count={search.matches.length} index={activeSearchIndex} limited={search.limited}
        move={delta => { if (search.matches.length) setSearchIndex((activeSearchIndex + delta + search.matches.length) % search.matches.length); }} close={() => void closeQuickSearch()} />}
      <div className="eye-line" />
      <main ref={viewport} className="reader" aria-label={t("演讲稿阅读区域")} tabIndex={panel === 'read' ? 0 : -1}
        onWheel={() => controller.current?.cancel()}
        onPointerDown={() => controller.current?.cancel()}
        onScroll={() => {
          const view = viewport.current; if (!view) return;
          setProgress(view.scrollHeight > view.clientHeight ? view.scrollTop / (view.scrollHeight - view.clientHeight) : 0);
          if (scrollTimer.current) clearTimeout(scrollTimer.current);
          scrollTimer.current = setTimeout(recordPosition, 160);
        }}
        onKeyDown={e => {
          if (e.ctrlKey || e.altKey || e.metaKey) return;
          if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) {
            e.preventDefault();
            if (e.key === 'Home' || e.key === 'End') controller.current?.moveTo(e.key === 'Home' ? 0 : viewport.current!.scrollHeight);
            else controller.current?.moveBy((e.key === 'PageDown' || e.key === 'PageUp' || e.key === ' ' ? viewport.current!.clientHeight * 0.7 : workspace.settings.scrollStep) * (['ArrowUp', 'PageUp'].includes(e.key) ? -1 : 1));
          }
        }}>
        <div className="script-content">
          {script.blocks.length ? script.blocks.map(b => <div key={b.id} data-block-id={b.id} className={`script-block block-${b.type}`} style={b.type === 'cue' && !appearance.showCues ? { display: 'none' } : undefined}>
            {b.type === 'section' ? <h2><HighlightedText block={b} matches={searchOpen ? matchesByBlock.get(b.id) ?? [] : []} current={searchOpen ? currentMatch : undefined} /></h2> : <p><HighlightedText block={b} matches={searchOpen ? matchesByBlock.get(b.id) ?? [] : []} current={searchOpen ? currentMatch : undefined} /></p>}
            {script.bookmarks.includes(b.id) && <Bookmark className="block-bookmark" size={12} fill="currentColor" />}
          </div>) : <div className="reader-empty"><h2>{t("准备你的第一份稿件")}</h2><p>{t("粘贴文本，或导入 DOCX、TXT、Markdown 文件。")}</p><button className="primary" onClick={() => void changePanel('edit')}>{t("打开编辑")}</button></div>}
          {!!script.blocks.length && <div className="script-end">{t("稿件结束")}</div>}
        </div>
      </main>
      <div className="reading-controls">
        <button className="icon-button" aria-label={t("上一章节")} title={t("上一章节")} onClick={() => handleAction('previous')}><ChevronLeft size={18} /></button>
        <button className="icon-button" aria-label={t("向上滚动")} title={t("向上滚动")} onClick={() => handleAction('up')}><ArrowUp size={18} /></button>
        <button className="icon-button" aria-label={t("向下滚动")} title={t("向下滚动")} onClick={() => handleAction('down')}><ArrowDown size={18} /></button>
        <button className="icon-button" aria-label={t("下一章节")} title={t("下一章节")} onClick={() => handleAction('next')}><ChevronRight size={18} /></button>
        <span className="toolbar-divider" />
        <button className="icon-button" aria-label={t("切换当前位置书签")} title={t("切换当前位置书签")} aria-pressed={currentBlock ? script.bookmarks.includes(currentBlock.id) : false} onClick={() => handleAction('bookmark')}><Bookmark size={16} fill={currentBlock && script.bookmarks.includes(currentBlock.id) ? 'currentColor' : 'none'} /></button>
      </div>
    </div>
    {panel !== 'read' && <div className="panel" onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); void changePanel('read'); } }}>
      {panel === 'edit' && <Editor key={script.id} script={script} workspace={workspace} updateScript={updateScript} addScript={addScript} restoreBackup={setWorkspace} notify={notify} saving={saveState === 'saving'} saveBlocked={blocked} save={() => void flush().then(() => notify('稿件已保存在本机，下次打开可直接继续。')).catch(() => {})} />}
      {panel === 'navigation' && <Navigation key={script.id} workspace={workspace} script={script}
        selectScript={id => { controller.current?.cancel(); setWorkspace(old => old ? { ...old, activeScriptId: id } : old); }}
        jump={id => { pendingJump.current = id; void changePanel('read'); }} toggleBookmark={toggleBookmark}
        newScript={() => { addScript(createScript(t("未命名稿件"), [])); void changePanel('edit'); }}
        deleteScript={id => setWorkspace(old => old && old.scripts.length > 1 ? { ...old, scripts: old.scripts.filter(s => s.id !== id), activeScriptId: old.scripts.find(s => s.id !== id)!.id } : old)} />}
      {panel === 'settings' && <Settings settings={workspace.settings} update={settings => setWorkspace(old => old ? { ...old, settings } : old)} capture={capture} hotkeys={hotkeys} exportBackup={exportBackup} />}
    </div>}
    <footer className="window-footer"><span title={script.title}>{panel === 'read' ? currentSection?.text ?? script.title : script.title}</span>
      {blocked ? <span className="warning">{t("保存暂停")}</span> : saveState === 'error' ? <button onClick={() => void flush().catch(() => {})}>{t("保存失败 · 重试")}</button> : <span className="save-status" role="status">{saveState === 'saving' ? <><LoaderCircle size={11} className="spinner" />{t("保存中")}</> : <><Check size={11} />{t("已保存")}</>}</span>}
      <span className="progress-label">{Math.round(progress * 100)}%</span>
      <div className="progress-track"><div style={{ width: `${Math.round(progress * 100)}%` }} /></div>
    </footer>
    {notice && <div className="notice" role="status"><span>{translateMessage(language, notice)}</span><button className="icon-button" aria-label={t("关闭提示")} onClick={() => setNotice('')}><X size={14} /></button></div>}
  </div></LanguageContext.Provider>;
}

import { useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import type { Block } from '../model';
import type { SearchMatch } from '../search';
import { useI18n } from '../i18n';

interface Props {
  query: string; onQuery: (query: string) => void; count: number; index: number; limited: boolean;
  move: (delta: number) => void; close: () => void;
}
export default function QuickSearch({ query, onQuery, count, index, limited, move, close }: Props) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  return <div className="quick-search" role="search" aria-label={t("阅读页快速搜索")}
    onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
      else if (event.key === 'Enter') { event.preventDefault(); move(event.shiftKey ? -1 : 1); }
    }}>
    <Search size={16} className="quick-search-icon" />
    <input ref={input} aria-label={t("快速搜索讲稿")} placeholder={t("搜索当前讲稿")} value={query} onChange={e => onQuery(e.target.value)} />
    <output className={query.trim() && !count ? 'no-match' : ''} aria-live="polite">{query.trim() ? count ? `${index + 1}/${count}${limited ? '+' : ''}` : t("无匹配") : ''}</output>
    <button className="icon-button" disabled={!count} aria-label={t("上一个搜索结果")} title={t("上一个（Shift+Enter）")} onClick={() => move(-1)}><ChevronUp size={16} /></button>
    <button className="icon-button" disabled={!count} aria-label={t("下一个搜索结果")} title={t("下一个（Enter）")} onClick={() => move(1)}><ChevronDown size={16} /></button>
    <button className="icon-button" aria-label={t("关闭快速搜索")} title={t("关闭（Esc）")} onClick={close}><X size={15} /></button>
  </div>;
}

export function HighlightedText({ block, matches, current }: { block: Block; matches: SearchMatch[]; current?: SearchMatch }) {
  let offset = 0;
  return (block.runs ?? [{ text: block.text }]).map((run, runIndex) => {
    const start = offset, end = offset + run.text.length;
    offset = end;
    const ranges = matches.filter(match => match.start < end && match.end > start);
    const boundaries = Array.from(new Set([start, end, ...ranges.flatMap(match => [Math.max(start, match.start), Math.min(end, match.end)])])).sort((a, b) => a - b);
    return <span key={runIndex} style={{ fontWeight: run.bold ? 600 : undefined, fontStyle: run.italic ? 'italic' : undefined }}>
      {boundaries.slice(0, -1).map((point, index) => {
        const finish = boundaries[index + 1];
        const text = run.text.slice(point - start, finish - start);
        const match = ranges.find(range => range.start <= point && range.end >= finish);
        if (!match) return text;
        const active = current?.blockId === block.id && current.start === match.start;
        return <mark key={point} data-current-match={active ? 'true' : undefined} className={active ? 'current-match' : undefined}>{text}</mark>;
      })}
    </span>;
  });
}

import { Clock3, Mic, Pause, Play, Square } from 'lucide-react';
import type { ReturnTypeFollow } from './AutoFollowSettings';
import type { ReadingMode } from '../model';
import type { useTimedScroll } from '../useTimedScroll';
import { useI18n } from '../i18n';
export default function AutoFollow({ follow, timed, rate, mode, onMode }: { follow: ReturnTypeFollow; timed: ReturnType<typeof useTimedScroll>; rate: number; mode: ReadingMode; onMode: (mode: ReadingMode) => void }) {
  const { t, message } = useI18n();
  const isTimed = mode === 'timed';
  const active = isTimed ? timed.active : follow.active;
  const paused = isTimed ? !timed.running : follow.state === 'paused';
  const status = isTimed ? timed.finished ? '稿件结束' : !timed.canStart ? '没有正文' : !active ? '尚未开始' : paused ? '已暂停' : '滚动中' : !follow.active ? follow.state === 'error' ? '语音错误' : '尚未开始' : follow.state === 'paused' ? '已暂停' : !follow.ready ? '加载模型…' : follow.state === 'following' ? '跟读中' : '等待匹配';
  const help = isTimed ? timed.finished ? t('稿件已读完。请向上定位到要继续的正文，再点击开始滚动。') : t('定时语速：{rate} 字/分钟。不使用麦克风，手动操作后需继续滚动。', { rate }) : follow.state === 'error' ? message(follow.error) : follow.state === 'paused' && follow.active ? t(follow.ready ? '已暂停滚动，麦克风仍在监听。点击停止可关闭麦克风。' : '已暂停滚动；模型加载后将继续监听。点击停止可关闭麦克风。') : t('仅使用本地麦克风；手动滚动后请点击恢复跟读。');
  return <div className="follow-bar">
    <div className="follow-modes" role="group" aria-label={t('提词模式')}>
      <button aria-pressed={mode === 'manual'} onClick={() => { if (mode !== 'manual') onMode('manual'); }}>{t('手动')}</button>
      <button aria-pressed={mode === 'auto'} onClick={() => { if (mode !== 'auto') onMode('auto'); }}>{t('自动')}</button>
      <button aria-pressed={isTimed} onClick={() => { if (!isTimed) onMode('timed'); }}>{t('定时')}</button>
    </div>
    {mode !== 'manual' && <>
      <span className={`follow-status ${isTimed ? timed.running ? 'following' : 'paused' : follow.state}`} role="status" title={help} aria-label={`${t(status)}. ${help}`}>{isTimed ? <Clock3 size={12} /> : <Mic size={12} />}<span>{t(status)}</span></span>
      {!active ? <button className="follow-action" title={isTimed && timed.finished ? help : undefined} disabled={isTimed && !timed.canStart} onClick={() => { if (isTimed) timed.start(); else void follow.start(); }}><Play size={13} />{t(isTimed ? '开始滚动' : follow.state === 'error' ? '重试' : '开始跟读')}</button> : <>
        <button className="follow-action" onClick={isTimed ? paused ? timed.resume : timed.pause : paused ? follow.resume : follow.pause}>{paused ? <Play size={13} /> : <Pause size={13} />}{t(paused ? isTimed ? '继续滚动' : '恢复跟读' : '暂停')}</button>
        <button className="icon-button" title={t(isTimed ? '停止滚动' : '停止跟读')} aria-label={t(isTimed ? '停止滚动' : '停止跟读')} onClick={() => { if (isTimed) timed.stop(); else void follow.stop(); }}><Square size={12} /></button>
      </>}
    </>}
  </div>;
}

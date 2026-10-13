import { useEffect, useState } from 'react';
import type { TimedSettings as Options } from '../model';
import { useI18n } from '../i18n';
export default function TimedSettings({ options, update }: { options: Options; update: (options: Options) => void }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(String(options.charactersPerMinute));
  const [error, setError] = useState(false);
  useEffect(() => { setDraft(String(options.charactersPerMinute)); }, [options.charactersPerMinute]);
  const apply = () => {
    const value = Number(draft);
    if (!Number.isInteger(value) || value < 60 || value > 1200) { setError(true); return; }
    setError(false); update({ charactersPerMinute: value });
  };
  return <section className="setting-section">
    <h2>{t('定时滚动')}</h2>
    <label className="field horizontal">{t('语速（字/分钟）')}<input className="pace-input" type="number" inputMode="numeric" min={60} max={1200} step={10} value={draft} aria-invalid={error} onChange={e => { setDraft(e.target.value); setError(false); }} onBlur={apply} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); apply(); } }} /></label>
    {error && <p className="inline-warning" role="alert">{t('请输入 60–1200 之间的整数语速。')}</p>}
    <p className="help">{t('默认 240 字/分钟。按正文中的文字和数字计数，不计空白、标点、章节标题和演讲提示；英文每个字母计一字。')}</p>
    <p className="help">{t('选择定时模式后点击开始滚动。速度按实际字号、换行和段落间距换算。手动操作会暂停，继续时从当前位置开始；稿件末尾自动停止。')}</p>
    <p className="help">{t('定时模式不使用麦克风。切换模式或重启应用后，需要再次点击开始。')}</p>
  </section>;
}

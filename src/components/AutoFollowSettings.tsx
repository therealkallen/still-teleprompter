import { useEffect, useState } from 'react';
import type { AutoFollowSettings as Options } from '../model';
import { desktop } from '../native';
import { microphones, type Microphone } from '../follow/native';
import { useAutoFollow } from '../follow/useAutoFollow';
import { useI18n } from '../i18n';
export type ReturnTypeFollow = ReturnType<typeof useAutoFollow>;
export default function AutoFollowSettings({ options, update, follow }: { options: Options; update: (options: Options) => void; follow: ReturnTypeFollow }) {
  const { t, message } = useI18n();
  const [devices, setDevices] = useState<Microphone[]>([]);
  const [error, setError] = useState('');
  const refresh = () => { void microphones().then(value => { setDevices(value); setError(''); }).catch(e => setError(String(e))); };
  useEffect(refresh, []);
  const patch = (value: Partial<Options>) => update({ ...options, ...value });
  return <section className="setting-section">
    <h2>{t('自动跟读')}</h2>
    <p className="help">{t('SenseVoice 在本机识别中文、英文和混合语音。只有点击开始跟读后才会启用麦克风，音频不会保存或上传。')}</p>
    {!desktop && <p className="inline-warning">{t('自动跟读需要 Windows 桌面版，本地语音引擎不在浏览器预览中运行。')}</p>}
    <label className="field">{t('麦克风')}<select value={options.deviceId} onChange={e => patch({ deviceId: e.target.value })} disabled={follow.active}>
      {!devices.some(d => d.id === options.deviceId) && <option value={options.deviceId}>{t('选定设备不可用')}</option>}
      {devices.map(d => <option key={d.id} value={d.id}>{d.id === '' ? t(d.name) : d.name}</option>)}
    </select></label>
    <div className="button-row follow-settings-actions"><button onClick={refresh}>{t('刷新设备')}</button>{follow.active && <button onClick={() => void follow.stop()}>{t('停止跟读')}</button>}</div>
    {error && <p role="alert" className="inline-warning">{message(error)}</p>}
    {follow.error && <p role="alert" className="inline-warning">{message(follow.error)}</p>}
    <p className="help">{t('手动滚动、搜索或章节跳转会暂停跟读。回到阅读页，点击恢复跟读，从当前位置重新匹配。更换设备或识别参数前请先停止跟读。')}</p>
    <p className="help">{t('暂停只停止自动滚动，麦克风仍在监听；停止跟读或切回手动才会关闭麦克风。')}</p>
    <details className="test-guide"><summary>{t('语音引擎与高级设置')}</summary>
      <label className="field">{t('运行库目录（留空使用随附资源）')}<input value={options.runtimePath} placeholder="runtime" disabled={follow.active} onChange={e => patch({ runtimePath: e.target.value })} spellCheck={false} /></label>
      <label className="field">{t('模型目录（留空使用随附模型）')}<input value={options.modelPath} placeholder="runtime/asr" disabled={follow.active} onChange={e => patch({ modelPath: e.target.value })} spellCheck={false} /></label>
      <label className="field">{t('识别窗口')}<select value={options.windowMs} disabled={follow.active} onChange={e => patch({ windowMs: Number(e.target.value) })}>{[2000,3000,4000].map(n => <option key={n} value={n}>{n / 1000} s</option>)}</select></label>
      <label className="field">{t('更新间隔')}<select value={options.intervalMs} disabled={follow.active} onChange={e => patch({ intervalMs: Number(e.target.value) })}>{[500,750,1000,1500].map(n => <option key={n} value={n}>{n} ms</option>)}</select></label>
      <label className="range-field"><span>{t('最低匹配置信度')}<output>{Math.round(options.threshold * 100)}%</output></span><input type="range" min={0.65} max={0.95} step={0.01} value={options.threshold} disabled={follow.active} onChange={e => patch({ threshold: Number(e.target.value) })} /></label>
      <label className="toggle-row"><input type="checkbox" checked={options.diagnostics} onChange={e => patch({ diagnostics: e.target.checked })} />{t('显示诊断指标（不包含识别文字或音频）')}</label>
      {options.diagnostics && <output className="follow-metrics">{t('识别耗时')} {follow.metrics.inferenceMs} ms · {t('置信度')} {Math.round(follow.metrics.confidence * 100)}% · #{follow.metrics.sequence} · {follow.metrics.reason}</output>}
    </details>
  </section>;
}

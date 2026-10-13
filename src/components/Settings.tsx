import { useState } from 'react';
import { Check, RotateCcw, ShieldCheck, ShieldOff, TriangleAlert } from 'lucide-react';
import { actionLabels, defaultSettings, fonts, presets, type Appearance, type Binding, type Settings as SettingsModel } from '../model';
import type { CaptureStatus, HotkeyStatus } from '../native';
import { desktop } from '../native';
import { useI18n } from '../i18n';

interface Props {
  settings: SettingsModel; update: (settings: SettingsModel) => void;
  capture: CaptureStatus | null; hotkeys: HotkeyStatus[]; exportBackup: () => void;
}
export default function Settings({ settings, update, capture, hotkeys, exportBackup }: Props) {
  const { t, message } = useI18n();
  const [bindings, setBindings] = useState<Binding[]>(settings.hotkeys);
  const [bindingError, setBindingError] = useState('');
  const appearance = settings.appearance;
  const setAppearance = (patch: Partial<Appearance>) => update({ ...settings, appearance: { ...appearance, ...patch } });
  const applyBindings = () => {
    const seen = new Set<string>();
    for (const binding of bindings) {
      if (!binding.shortcut.split('+').some(v => /^(ctrl|control|alt|super|meta|commandorcontrol)$/i.test(v.trim()))) { setBindingError('每个快捷键至少包含 Ctrl、Alt 或 Win；Shift 单独使用不够。'); return; }
      const normalized = binding.shortcut.replace(/\s/g, '').toLowerCase();
      if (seen.has(normalized)) { setBindingError('快捷键组合重复，请为每个动作选择不同组合。'); return; }
      seen.add(normalized);
    }
    setBindingError(''); update({ ...settings, hotkeys: bindings.map(b => ({ ...b, shortcut: b.shortcut.trim() })) });
  };
  return <div className="panel-body settings-body">
    <section className="setting-section">
      <h2>{t('语言')}</h2>
      <label className="field horizontal">{t('界面语言')}<select value={settings.language} onChange={e => update({ ...settings, language: e.target.value as SettingsModel['language'] })}>
        <option value="zh">中文</option><option value="en">English</option>
      </select></label>
      <p className="help">{t('更改只影响应用界面，讲稿内容不会被翻译。')}</p>
    </section>
    <section className="setting-section">
      <h2>{t("阅读外观")}</h2>
      <div className="preset-row">
        {Object.entries(presets).map(([key, preset]) => <button key={key} className={`preset preset-${key}`} onClick={() => setAppearance(preset)}>
          <span className="preset-sample" style={{ background: preset.background, color: preset.text }}>Aa</span>
          {({ dark: t("深色"), light: t("浅色"), transparent: t("半透明") } as Record<string, string>)[key]}
        </button>)}
      </div>
      <div className="setting-grid">
        <label className="field">{t("背景颜色")}<input type="color" value={appearance.background} onChange={e => setAppearance({ background: e.target.value })} /></label>
        <label className="field">{t("文字颜色")}<input type="color" value={appearance.text} onChange={e => setAppearance({ text: e.target.value })} /></label>
      </div>
      <Range label={t("背景不透明度")} value={appearance.backgroundOpacity} min={0} max={1} step={0.01} suffix="%" display={Math.round(appearance.backgroundOpacity * 100)} onChange={v => setAppearance({ backgroundOpacity: v })} />
      <Range label={t("文字不透明度")} value={appearance.textOpacity} min={0.1} max={1} step={0.01} suffix="%" display={Math.round(appearance.textOpacity * 100)} onChange={v => setAppearance({ textOpacity: v })} />
      <p className="help">{t("两种透明度独立调整。背景越透明，越需要根据底下的窗口检查文字对比度。")}</p>
      <label className="field horizontal">{t("字体")}<select value={appearance.fontFamily} onChange={e => setAppearance({ fontFamily: e.target.value })}>{fonts.map(font => <option key={font}>{font}</option>)}</select></label>
      <Range label={t("字号")} value={appearance.fontSize} min={16} max={60} step={1} suffix=" px" onChange={v => setAppearance({ fontSize: v })} />
      <Range label={t("行距")} value={appearance.lineHeight} min={1.2} max={2.4} step={0.05} suffix={t(" 倍")} display={appearance.lineHeight.toFixed(2)} onChange={v => setAppearance({ lineHeight: v })} />
      <div className="setting-grid">
        <label className="field">{t("提示颜色")}<input type="color" value={appearance.cueColor} onChange={e => setAppearance({ cueColor: e.target.value })} /></label>
        <label className="toggle-row small"><input type="checkbox" checked={appearance.cueItalic} onChange={e => setAppearance({ cueItalic: e.target.checked })} />{t("提示使用斜体")}</label>
      </div>
      <label className="toggle-row"><input type="checkbox" checked={appearance.showCues} onChange={e => setAppearance({ showCues: e.target.checked })} />{t("显示演讲提示")}</label>
    </section>
    <section className="setting-section">
      <h2>{t("窗口与屏幕共享")}</h2>
      <label className="toggle-row"><input type="checkbox" checked={settings.captureExcluded} disabled={!capture} onChange={e => update({ ...settings, captureExcluded: e.target.checked })} />{t("从支持的屏幕捕获中排除")}</label>
      <div className={`capture-detail ${capture?.state === 'enabled' ? 'success' : 'warning'}`}>
        {capture?.state === 'enabled' ? <ShieldCheck size={18} /> : capture?.state === 'disabled' ? <ShieldOff size={18} /> : <TriangleAlert size={18} />}
        <div><strong>{capture ? ({ enabled: t("Windows API 已确认开启"), disabled: t("已关闭"), unsupported: t("当前环境不支持"), failed: t("Windows API 调用失败") } as Record<string, string>)[capture.state] : t("正在设置…")}</strong><p>{message(capture?.message ?? '')}</p></div>
      </div>
      <details className="test-guide"><summary>{t("Teams 与录屏测试方法")}</summary>
        <ol><li>{t("在测试会议中共享整个屏幕，把 Still 放在 PowerPoint 或浏览器上方。")}</li><li>{t("请另一台设备或另一位参会者检查共享画面，并回看会议录制。")}</li><li>{t("分别测试深色、浅色、半透明预设，移动和缩放窗口，再打开编辑与设置。")}</li><li>{t("关闭捕获排除，确认稿件可见；重新开启后再次检查。")}</li><li>{t("再用实际使用的录屏工具测试显示器捕获与窗口捕获。")}</li></ol>
        <p>{t("API 成功不代表所有捕获软件都会隐藏窗口。仅在确认实际结果后用于正式演讲。")}</p>
      </details>
      <p className="help">{t("阅读模式下，点击和滚动不会主动切走 Teams 的焦点。编辑、导航、设置会获取焦点以便输入。窗口始终置顶，可拖动、缩放和最小化。")}</p>
    </section>
    <section className="setting-section">
      <h2>{t("手动控制")}</h2>
      <Range label={t("每次滚动距离")} value={settings.scrollStep} min={20} max={500} step={10} suffix=" px" onChange={scrollStep => update({ ...settings, scrollStep })} />
      <p className="help">{t("全局快捷键可以在其他应用中使用。只触发手动动作，不自动跟随语音。在编辑和设置中暂不执行动作。")}</p>
      {!desktop && <p className="inline-warning">{t("浏览器预览无法注册全局快捷键。")}</p>}
      <div className="hotkey-fields">{bindings.map((binding, index) => <label className="field" key={binding.action}>
        <span>{t(actionLabels[binding.action])}</span>
        <input value={binding.shortcut} spellCheck={false} onChange={e => setBindings(bindings.map((b, i) => i === index ? { ...b, shortcut: e.target.value } : b))} />
        {hotkeys.find(h => h.action === binding.action)?.error && <small className="inline-warning">{message(hotkeys.find(h => h.action === binding.action)?.error ?? '')}</small>}
      </label>)}</div>
      {bindingError && <p className="inline-warning" role="alert">{message(bindingError)}</p>}
      <div className="button-row"><button className="primary" onClick={applyBindings}><Check size={15} />{t("应用快捷键")}</button><button onClick={() => { setBindings(structuredClone(defaultSettings.hotkeys)); setBindingError(''); }}><RotateCcw size={14} />{t("恢复默认组合")}</button></div>
      {hotkeys.length > 0 && hotkeys.every(h => !h.error) && <p className="help success">{t("所有全局快捷键已注册。")}</p>}
    </section>
    <section className="setting-section"><h2>{t("本地数据")}</h2><p className="help">{t("稿件、书签、阅读位置和偏好保存在本机，不改动导入的源文件。可导出完整备份，并在编辑中重新导入。")}</p><button onClick={exportBackup}>{t("导出完整备份")}</button></section>
  </div>;
}
function Range({ label, value, min, max, step, suffix, display, onChange }: { label: string; value: number; min: number; max: number; step: number; suffix: string; display?: string | number; onChange: (value: number) => void }) {
  return <label className="range-field"><span>{label}<output>{display ?? value}{suffix}</output></span><input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} /></label>;
}

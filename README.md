# Still · Windows 桌面提词器

基于 Tauri v2、React、TypeScript 和 Rust 的本地提词器，面向 Teams 长时间演讲。V2 在 Still 1.0.2 基础上增加本地 SenseVoice 自动跟读与定时滚动；阅读窗口、手动导航、稿件和偏好继续保留。

当前版本为 **2.0.0-beta.2**：支持手动、自动跟读和定时三种模式，无账号、云端语音服务或 LLM。真人语音跟读、Teams 麦克风共用和两小时稳定性仍待验收，见 [V2 验证记录](docs/V2-VALIDATION.md)。

## 下载使用

[下载 Windows x64 完整测试包](https://github.com/therealkallen/still-teleprompter/releases/download/v2.0.0-beta.2/Still-2.0.0-beta.2-windows-x64.zip) · [版本说明与校验文件](https://github.com/therealkallen/still-teleprompter/releases/tag/v2.0.0-beta.2)

1. 下载约 180 MB 的 `Still-2.0.0-beta.2-windows-x64.zip`，选择「全部解压」。GitHub 的 Source code ZIP 是源码，使用者应下载带 `windows-x64` 的应用包。
2. 先退出旧版，再进入解压后的文件夹运行 `Still.exe`；同目录的 `runtime` 必须保留。无需安装 Python、Node.js 或 Rust。
3. 需要 Windows 10/11 x64 和 Microsoft Edge WebView2 Runtime。若缺少 WebView2，从 [Microsoft 官方页面](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) 安装 Evergreen Runtime。
4. 手动或定时模式可直接使用；自动模式点击「开始跟读」后才开启麦克风。正式会议前先测试本机语音、Teams 共享和录制效果。

本测试包尚未签名。若 Windows 提示「未知发布者」，先核对下载来源；Release 附带 SHA-256 校验文件。

Still's original source is open source under the [MIT License](LICENSE). Download the full Windows portable ZIP from [Releases](https://github.com/therealkallen/still-teleprompter/releases); extract everything and run `Still.exe`. Speech models and dependencies retain their [own licenses](THIRD_PARTY_NOTICES.md).

## V2 测试包与自动跟读

完整解压 `release/Still-2.0.0-beta.2-windows-x64.zip`，运行目录中的 `Still.exe`。必须保留同目录的 `runtime`，不需要安装系统 Python。需要 Windows 10/11 x64 和 WebView2。先退出旧版再打开新版；仍使用 `com.still.teleprompter` 数据目录，建议升级前保留 `workspace.json` 和 `.bak` 的副本。之前的发布版保留在 release 中。

### 定时模式

在「设置 → 定时滚动」输入语速，支持 **60–1200 字/分钟**，默认 **240 字/分钟**，按 Enter 或离开输入框保存。阅读页选择「定时」，再点击「开始滚动」。

字数只统计正文中的 Unicode 文字与数字，不计标点、空白、章节和提示；英文每个字母算一字。速度按每段正文的字数与实际显示高度换算，段间的标题和提示间距平滑经过。这是段落平均语速，不是逐字高亮或语音跟随。字号、换行和窗口大小变化会重新换算。

滚轮、方向键、工具栏、搜索和导航会暂停；点击「继续滚动」从当前视口继续。Ctrl+Alt+Space 可暂停/继续已开始的定时滚动。稿件末尾自动停止；空正文不能开始。切换模式或重启不会自行启动。最小化/页面隐藏会暂停，返回后需要明确继续。定时模式不启用麦克风和 ASR，浏览器预览也可运行。

### 自动跟读

1. 打开现有稿件，在阅读页选择「自动」，再点击「开始跟读」。记忆模式不会在重启后自动打开麦克风。
2. 在「设置 → 自动跟读」选择系统默认或指定麦克风。资源随包附带；高级目录留空即可。
3. 开始讲话后，可靠匹配时显示「跟读中」；静音、离稿、短句或证据不足时显示「等待匹配」，保持视口。
4. 手动滚动、按键、搜索、章节/书签跳转或进入面板会暂停跟读。点击「恢复跟读」或 Ctrl+Alt+Space，从当前可见位置匹配；旧音频窗口会清空。
5. 「暂停」只暂停自动滚动，仍监听；「停止跟读」或切回「手动」关闭麦克风并释放 ASR 进程。错误后检查设备/资源，再点重试。

只匹配 Spoken Text（正文），不匹配章节标题和演讲提示。支持确定性的大小写、全半角、标点、填词、基本数字和模糊匹配；重大语义改写没有可靠保证。远处段落需要多次确认；重复段落可能保持等待。自动目标按实际文本行定位在视口约 38%，有舒适区、最小移动距离与滚动限频。

所有处理在本机完成。音频只保留 2–4 秒有界内存窗口，通过管道传给独立 Python/ONNX 推理进程，不写录音文件、不上传。匹配在独立 Web Worker 中运行。诊断默认关闭，只显示耗时、置信度与序号，不记录识别文字。未使用系统回环音频，不采集 Teams 远端声音。

### 准备本地模型（开发与重新构建）

模型不放入 Git。复用已兼容的 SenseVoiceSmall INT8 sherpa-onnx runtime，包含 `python/python.exe`、`asr/model.int8.onnx`、`asr/tokens.txt` 和 `sherpa_onnx/lib` 下的原生扩展与 ONNX Runtime。使用路径参数复制到本项目，不改动原项目，不自动下载权重：

公开源码的开发者可先下载上方完整测试包，把解压目录里的 `runtime` 作为 `SourceRuntime`，把其中的 `runtime/licenses` 作为 `SourceLicenses`。这样可复用经过验证的资源与许可，无需另一项目。

```powershell
./scripts/prepare-asr.ps1 -SourceRuntime '你的 ASR-only runtime 目录' -SourceLicenses '对应许可目录'
npm run desktop
```

开发也可在设置指定 runtime 与 model 目录，或设置 `STILL_ASR_RUNTIME` / `STILL_ASR_MODEL`。默认开发路径是项目内 runtime；正式包使用随 exe 分发的 runtime，worker 协议始终使用 Still 自己的实现。无需硬编码 VoiceFlow 路径。

```powershell
# 检查实际 ONNX 架构与量化元数据；只用 Python 标准库
python -B scripts/inspect-model.py runtime/asr/model.int8.onnx
# 真正加载 SenseVoice 并通过二进制 PCM 管道识别静音或指定单声道 PCM16 WAV
python -B scripts/verify-asr.py
python -B scripts/verify-asr.py --wav '测试语音.wav'
# 可选的两秒本机共享麦克风测试，不保存音频
cargo test --manifest-path src-tauri/Cargo.toml --lib shared_microphone_capture_smoke -- --ignored --nocapture
# release 编译 + 包含所有模型、运行库和许可的便携 ZIP 与体积报告
npm run package -- --no-bundle
node scripts/generate-notices.mjs
./scripts/package-v2.ps1
```

`verify-asr.py` 默认仅输出性能指标；`--show-text` 是开发者主动选择输出测试文件的识别文字。英文合成语音和交替语言测试用于管道验证，不能代替真人同句混说验收。

## 运行与构建

开发环境：Windows 10/11 x64、Node.js 22.12+（推荐 24 LTS）、Rust 1.90+ MSVC 工具链、Visual Studio C++ Build Tools 和 Windows SDK、Microsoft Edge WebView2 Runtime。

```powershell
npm ci
npm run desktop
```

首次构建需要下载 npm/Cargo 依赖。Tauri 使用系统 WebView2，不附带 Chromium。

```powershell
# 类型检查与前端测试
npm run check

# 前端生产构建
npm run build

# Rust 检查、测试与格式检查
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml --lib
cargo fmt --manifest-path src-tauri/Cargo.toml --check

# 完整 Windows 应用及 NSIS 安装包
npm run package

# 只生成可运行程序，不下载安装器工具
npm run package -- --no-bundle
```

产物：

- `src-tauri/target/release/still-teleprompter.exe`：可直接运行的 Windows 程序；需要 WebView2。
- `src-tauri/target/release/bundle/nsis/Still_2.0.0-beta.2_x64-setup.exe`：NSIS 安装器构建目标（本次交付为便携 ZIP）。

构建配置包含 release LTO、体积优化、NSIS 中英文安装界面、应用图标和限制外部内容的 CSP。安装包尚未配置签名；正式对外发布时自行提供签名证书。离线机器应预装 WebView2。

1.0.2 历史发布版保留为 `release/Still-1.0.2.exe`，历史验证见 [V1 验证记录](docs/VALIDATION.md)。V2 可执行文件必须与语音 runtime 一同分发；完整验证和限制见 [V2 验证记录](docs/V2-VALIDATION.md)，真人验收见 [V2 手动测试清单](docs/V2-MANUAL-TESTING.md)。

```powershell
# 仅 UI 预览，不具备原生桌面能力
npm run dev
```

浏览器打开 `http://127.0.0.1:1420`。预览明确显示原生功能不可用；预览数据在浏览器 localStorage 中，和桌面数据独立。

## 使用

首次打开提供一份标明为示例的稿件。移动鼠标显示工具栏；停留不操作后自动淡出，键盘焦点位于工具栏时继续显示。

1. 点击编辑，粘贴文本，或导入 `.docx`、`.txt`、`.md`、`.markdown` 文件。导入会新建稿件，不修改源文件。
2. 用 `# 标题` 定义章节，用 `[cue] 提示内容` 或 `::cue 提示内容` 定义不朗读的演讲提示。
3. 在编辑页逐段修改文字、类型、章节层级和顺序。编辑一个段落的文本会将该段转为纯文本，其他段落的导入强调格式继续保留。
4. 返回阅读，以滚轮或工具栏按钮向前/向后移动。在阅读窗口具有焦点时也支持方向键、Page Up/Down、Home/End 和空格。
5. 打开导航可切换稿件、折叠子章节、搜索全文、跳转章节和管理书签。
6. 设置中可选深色、浅色、半透明预设，单独调整背景与文字不透明度、字体、字号、行距、提示样式和滚动距离。

### 稿件保存在提词器内

每次修改会自动保存在本机，窗口底部显示「保存中 / 已保存」。编辑页的「保存到本机」可立即保存。退出后再打开会恢复稿件库、当前稿件、段落类型、书签、外观与阅读位置；通过「导航 → 当前稿件」选择其他已保存的稿件。导出文件是额外备份，不是日常保存的必要步骤。

### 中文 / English 界面

在「设置 → 界面语言」选择「中文」或「English」，即时生效，无需重启。选择会保存在本机，下次打开继续使用。英文界面的入口为 `Settings → Interface language`。

语言选项只改变应用界面、按钮、提示、快捷键说明和窗口标题，不修改或翻译讲稿。升级前保存的数据默认继续使用中文，已有稿件、书签、外观和阅读位置保持不变。第三方文档解析器及操作系统返回的原始诊断细节按原文保留。

### 阅读页快速搜索

在阅读页点击工具栏的放大镜，或在提词器具有焦点时按 Ctrl+F。输入关键词后直接高亮并定位匹配文字，支持同一段内的多个匹配。使用上下按钮、Enter / Shift+Enter 在结果间切换，Esc 或关闭按钮收起搜索并继续阅读，无需进入导航页。

搜索输入时窗口会主动获取焦点以便打字，关闭后恢复阅读模式。隐藏的演讲提示不参与阅读页搜索；导航页全文搜索仍可查找所有段落。极常见关键词最多显示 10,000 个结果，超限显示 `10000+`，可使用更具体的关键词。

默认全局快捷键：

| 组合键 | 动作 |
| --- | --- |
| Ctrl + Alt + ↑ / ↓ | 向上 / 向下滚动 |
| Ctrl + Alt + ← / → | 上一章节 / 下一章节 |
| Ctrl + Alt + B | 切换当前位置书签 |
| Ctrl + Alt + Space | 暂停 / 继续已开始的自动跟读或定时滚动 |

设置中可以修改组合键，并点击「应用快捷键」。注册失败会针对每项显示原因；成功的项正常使用，失败的项保持未注册。组合必须包含 Ctrl、Alt 或 Win，不能使用普通字符或 Shift 单独修饰。编辑、导航和设置中暂不执行阅读动作，但已注册的组合仍被操作系统占用；切回阅读即可继续。

阅读模式使用 `WS_EX_NOACTIVATE` 和 `WM_MOUSEACTIVATE → MA_NOACTIVATE`，避免鼠标操作主动夺走 Teams/PowerPoint 的焦点。编辑、导航和设置需要输入，因此用户打开这些界面时会主动获取焦点。返回阅读不会把焦点自动转移给某个其他应用；再次点击 Teams/PowerPoint 后即可用全局快捷键继续控制提词器。可通过任务栏选中阅读窗口，再使用普通方向键。

拖动左上角 Still 标记或工具栏空白部分移动窗口。使用窗口边缘调整尺寸。尺寸和位置在退出后恢复；窗口最小化状态不恢复。只允许一个实例，第二次启动会显示已有窗口。

## 屏幕捕获排除

默认请求 `WDA_EXCLUDEFROMCAPTURE`。程序读取 Windows 实际版本，并调用 `SetWindowDisplayAffinity`，随后使用 `GetWindowDisplayAffinity` 验证标记。

| 状态 | 含义 |
| --- | --- |
| 已开启 | 设置调用成功，读取的标记为 `0x11` |
| 已关闭 | 设置调用成功，读取的标记为 `0x0` |
| 不支持 | 非 Windows 或 Windows 10 2004 / build 19041 之前的版本 |
| 调用失败 | 句柄、API、状态读取或验证失败，展示错误信息 |

窗口首次显示前先请求排除，再加载用户保存的开关。阅读、编辑和设置在同一个顶级窗口内，使用同一套捕获设置。透明度仅作用于 CSS 背景/文字，不设置整窗 alpha；窗口支持 WebView2 透明背景和自定义边框。

**API 状态只表示操作系统接受了请求，不保证所有共享或录屏工具都隐藏稿件。** 正式使用前，请按 [手动测试清单](docs/MANUAL-TESTING.md) 检查 Teams 接收端、会议录制和实际录屏软件，尤其是半透明外观与窗口缩放后的情况。

参考：[Microsoft SetWindowDisplayAffinity](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowdisplayaffinity)、[Tauri global shortcut](https://v2.tauri.app/plugin/global-shortcut/)、[Tauri window customization](https://v2.tauri.app/learn/window-customization/)。

## 导入规则

- TXT / 粘贴纯文本：空行分段；显式 `#` 到 `######` 生成章节；列表项独立保留；普通段落内的换行保留。不根据文字内容猜测段落类型。
- Markdown：保留标题层级、段落、列表和粗体/斜体。链接只保留文字；不加载图片、HTML 脚本、iframe 或外部资源。
- DOCX：使用 Mammoth 在本机解析，保留 Word 标题、列表和基本强调。名为 `Presenter Cue` 的段落样式生成提示；显式提示标记同样适用。复杂排版、图片、页眉页脚等不属于 V1 精确保真范围，解析警告会显示。
- 所有格式都生成独立的结构化段落 ID。编辑文字、类型、顺序不改变 ID，书签和阅读锚点跟随段落。重复段落有不同 ID。
- 单个文件最大 10 MB；文本最多 200 万字符；DOCX ZIP 声明的解压内容限制为 32 MB。TXT/Markdown 支持 UTF-8 和带 BOM 的 UTF-16；其他编码应先转换为 UTF-8。

## 本地数据与恢复

Windows 数据目录由 Tauri `app_data_dir()` 提供，通常为 `%APPDATA%\com.still.teleprompter\`：

- `workspace.json`：稿件库、段落类型与强调、偏好、书签、全局快捷键和阅读锚点。
- `workspace.json.bak`：上一次成功保存的数据。
- `.window-state.json`：Tauri 插件保存的窗口位置与尺寸。

保存写入临时文件并同步到磁盘，再替换主文件并保留备份；前端按顺序提交保存，退出前等待完成。阅读位置使用「段落 ID + 段内偏移」，找不到锚点时回退到百分比。

若主文件损坏，程序报告错误并暂停自动保存，避免覆盖唯一可恢复内容。当前会话的修改不会自动保存，请先在设置中导出 JSON 备份。关闭程序，保留损坏文件的副本，再将 `workspace.json.bak` 复制为 `workspace.json` 后重启；没有主文件时自动从 `.bak` 恢复。

完整 JSON 备份导入时，会将备份稿件作为新副本添加，保留书签和阅读位置，不删除当前稿件、不覆盖当前偏好。TXT 导出只保留章节、提示和文本。

## 项目结构

```text
src/
  App.tsx                 阅读界面与应用状态协调
  model.ts                段落、稿件、设置与保存格式验证
  parser.ts               TXT / Markdown / DOCX 确定性解析
  scroll.ts               手动滚动与阅读锚点恢复
  native.ts               Tauri 桥接与明确标记的浏览器回退
  i18n.ts                 中英文界面、动态提示翻译与语言上下文
  locales/en.json         英文翻译表（中文源文案为默认界面）
  components/
    Editor.tsx            粘贴、导入、结构编辑与备份导入
    Navigation.tsx        稿件库、章节、搜索与书签
    Settings.tsx          外观、捕获、滚动与全局快捷键
  *.test.ts               解析、位置恢复与数据边界测试
src-tauri/
  src/capture.rs          Win32 捕获与焦点管理
  src/hotkeys.rs          全局组合键验证、注册与冲突报告
  src/persistence.rs      本机 JSON 保存、备份与恢复
  src/lib.rs              插件、命令、窗口初始化
  capabilities/main.json 最小窗口控制权限
  tauri.conf.json         窗口、CSP 与生产安装配置
docs/
  MANUAL-TESTING.md       真实 Windows / Teams 验收清单
  VALIDATION.md           本次构建验证记录
```

`ScrollController.moveTo()` 继续作为滚动入口。V2 新模块为 `src/follow/`（纯对齐算法、Worker、状态机、语音桥接、舒适区滚动及协调 Hook）、`src-tauri/src/asr.rs`（共享麦克风、缓存、独立进程与资源释放）和 `runtime/asr/worker.py`（本地 SenseVoice 推理协议）。它们不依赖云 API。手动输入优先于任何自动结果。

`src/timed.ts` 根据正文及实际布局构建语速映射，以单一动画循环推进；`src/useTimedScroll.ts` 协调模式、字体、缩放、隐藏和暂停生命周期。连续滚动期间定期保存阅读位置，避免一直等待滚动结束才保存。

## 开源许可

Still 原创代码采用 [MIT License](LICENSE)。模型权重、运行环境和第三方库使用各自许可证，出处及完整许可文本见 [第三方说明](THIRD_PARTY_NOTICES.md)。

import { createScript, defaultSettings, type Workspace } from './model';
import { parseText } from './parser';

export function initialWorkspace(): Workspace {
  const script = createScript('开始使用 · 示例稿件', parseText(`# 开场

让稿件留在眼前，
把注意力交给听众。

[cue] 这是一份示例稿件，可在编辑中替换。

Still 是你的手动提词器。它会保持在其他窗口上方，让你在 Teams、PowerPoint 和浏览器之间切换时继续阅读。

# 按自己的节奏

滚动鼠标滚轮，或使用 Ctrl + Alt + ↓ 向下移动。向上回看时，使用 Ctrl + Alt + ↑。

[cue] 停顿。看向镜头。

每次只向前走一点。你可以调整字号、行距，以及每次滚动的距离，找到最适合自己的节奏。

# 准备你的稿件

移动鼠标即可显示工具栏。打开编辑，可以粘贴内容，或导入 DOCX、TXT 与 Markdown 文件。

用 # 标记章节，用 [cue] 标记不需要读出的提示。导入后，也可以逐段修改类型。

[cue] 在正式演讲前，试一次屏幕共享和录制。

# 从容收尾

在导航中查找章节、搜索全文，或给当前位置添加书签。

退出后，稿件与阅读位置会保存在本机。下次打开，从上次的位置继续。

准备好了，就把目光交还给听众。`));
  return { version: 1, scripts: [script], activeScriptId: script.id, settings: structuredClone(defaultSettings) };
}

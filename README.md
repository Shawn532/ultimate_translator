# Ultimate Translator (无敌翻译器) - Chrome Extension

一个强大的网页翻译工具，支持19种语言，拥有精美的UI界面和丰富的快捷键功能。

A powerful web page translation tool supporting 19 languages with beautiful UI and keyboard shortcuts.

## 主要特性 Features

- 🌐 支持19种主流语言 / Support for 19 major languages
- ⌨️ 快捷键支持 / Keyboard shortcuts support
- 📝 可翻译文本框内容 / Translate textarea and contenteditable fields
- 🎨 精美的渐变UI界面 / Beautiful gradient UI
- 📱 移动端适配 / Mobile-friendly responsive design
- 🎯 可拖拽的悬浮球和控制面板 / Draggable floating ball and control panel
- 💾 设置自动保存 / Settings saved automatically
- 🚀 适用于所有网站（绕过CSP限制）/ Works on all websites (bypasses CSP restrictions)

## 安装方法 Installation

### 方法1：加载已解压的扩展

1. 打开 Google Chrome
2. 访问 `chrome://extensions/`
3. 开启右上角的 **开发者模式** (Developer mode)
4. 点击 **加载已解压的扩展程序** (Load unpacked)
5. 选择 `chrome-extension` 文件夹
6. 扩展将出现在扩展列表中

### 方法2：从ZIP文件安装

1. 解压 `ultimate-translator.zip`
2. 按照方法1的步骤加载

### 验证安装

1. 访问任意网页
2. 左上角应该出现一个紫色悬浮球
3. 点击悬浮球打开控制面板

## 使用说明 Usage

### 基本翻译

1. 打开任意外语网页
2. 页面左上角会出现一个紫色悬浮球（翻译图标）
3. 点击悬浮球，打开控制面板
4. 选择源语言（Source Language）和目标语言（Target Language）
5. 点击 **立即翻译** (Translate Now)，即可将网页翻译成目标语言
6. 点击 **恢复原文** (Restore to Original)，即可恢复为原始语言

### 快捷键 Keyboard Shortcuts

无敌翻译器支持以下快捷键（可在 `chrome://extensions/shortcuts` 自定义）：

| 快捷键 | 功能 | 说明 |
|--------|------|------|
| **Alt+T** | 立即翻译 | 使用当前设置翻译页面 |
| **Alt+R** | 恢复原文 | 恢复页面到原始语言 |
| **Alt+E** | 中文→英文 | 自动设置为"中文→英文"并翻译 |
| **Alt+C** | 英文→中文 | 自动设置为"英文→中文"并翻译 |

💡 **提示**：在Mac上，Alt键对应 Option (⌥) 键

### 翻译文本框内容

默认情况下，翻译器会跳过表单输入元素（如textarea、contenteditable区域）。如需翻译这些内容：

1. 打开控制面板
2. 在底部找到 **翻译文本框** (Translate Textareas) 开关
3. 打开开关
4. 点击 **立即翻译**

此功能适用于：
- `<textarea>` 元素
- 设置了 `contenteditable="true"` 的可编辑区域

### 更改语言

1. 点击悬浮球，打开控制面板
2. 在 **源语言** (Source Language) 中选择网页的原始语言
3. 在 **目标语言** (Target Language) 中选择想要翻译成的语言
4. 点击 **立即翻译**
5. 设置会自动保存，下次继续生效

### 更改界面语言

1. 打开控制面板
2. 在 **界面语言** (UI Language) 中选择：
   - **中文** - 中文界面
   - **English** - 英文界面

## 支持的语言 Supported Languages

无敌翻译器当前支持 **19种语言**：

| 语言 | Language | 代码 |
|------|----------|------|
| 简体中文 | Chinese Simplified | zh-CN |
| 繁體中文 | Chinese Traditional | zh-TW |
| English | English | en |
| 日本語 | Japanese | ja |
| 한국어 | Korean | ko |
| Español | Spanish | es |
| Français | French | fr |
| Deutsch | German | de |
| Русский | Russian | ru |
| Português | Portuguese | pt |
| Italiano | Italian | it |
| العربية | Arabic | ar |
| Nederlands | Dutch | nl |
| Polski | Polish | pl |
| Türkçe | Turkish | tr |
| Tiếng Việt | Vietnamese | vi |
| हिन्दी | Hindi | hi |
| עברית | Hebrew | he |
| ไทย | Thai | th |
| Bahasa Indonesia | Indonesian | id |

## 默认设置 Default Settings

- **源语言**: English
- **目标语言**: 简体中文
- **翻译引擎**: Google Translate API
- **界面语言**: 中文
- **翻译文本框**: 关闭

## 自定义快捷键

如果默认快捷键与其他扩展冲突，可以自定义：

1. 访问 `chrome://extensions/shortcuts`
2. 找到 **Ultimate Translator (无敌翻译器)**
3. 点击快捷键旁边的编辑按钮
4. 设置你喜欢的组合键
5. 保存即可

## 常见问题 Troubleshooting

### 扩展不工作

1. 确保扩展在 `chrome://extensions/` 中已启用
2. 尝试重新加载页面
3. 检查浏览器控制台是否有错误 (F12)
4. 尝试重新加载扩展

### 悬浮球不可见

1. 悬浮球可能被拖到屏幕外
2. 刷新页面，悬浮球会重置位置
3. 或者打开控制面板手动调整位置

### 翻译不工作

1. 检查网络连接
2. 某些网站有严格的CSP策略，可能仍会阻止翻译
3. 尝试更改源语言/目标语言
4. 查看浏览器控制台是否有错误信息

### 快捷键不工作

1. 访问 `chrome://extensions/shortcuts` 检查快捷键设置
2. 确保没有与其他扩展冲突
3. 在Mac上使用 Option 键代替 Alt 键
4. 尝试自定义为其他组合键

### 部分文本没有被翻译

可能的原因：
- 文本在Shadow DOM中（TreeWalker无法穿透）
- 文本是动态生成的（需要等待MutationObserver检测）
- 文本在跳过列表中（代码块、SVG、数学公式等）

## 更新扩展 Updating

1. 修改扩展文件
2. 访问 `chrome://extensions/`
3. 点击扩展下方的 **重新加载** 按钮

## 卸载 Uninstalling

1. 访问 `chrome://extensions/`
2. 点击 Ultimate Translator 扩展的 **移除** 按钮

## 技术细节 Technical Details

- **Manifest版本**: V3
- **翻译服务**: Google Translate API
- **存储方式**: Chrome Sync Storage（设置可跨设备同步）
- **权限要求**:
  - `storage` - 保存设置
  - `tabs` - 快捷键功能
  - `<all_urls>` - 翻译所有网站

### 架构说明

扩展采用三层架构：

1. **Content Script** (`content.js`)
   - 在页面中运行
   - 创建UI（悬浮球、控制面板）
   - 使用TreeWalker查找文本节点
   - 管理翻译状态

2. **Background Service Worker** (`background.js`)
   - 处理翻译API请求
   - 绕过CSP限制
   - 监听快捷键

3. **Shadow DOM**
   - 隔离UI样式
   - 防止UI被翻译
   - 避免与页面样式冲突

## 隐私说明 Privacy

本扩展：
- ✅ 不收集任何个人数据
- ✅ 不追踪浏览历史
- ✅ 设置仅保存在本地浏览器
- ✅ 使用Google Translate API进行翻译
- ✅ 开源透明

## 与Userscript版本的区别

Chrome扩展版相比Tampermonkey脚本版的优势：

1. **绕过CSP限制** - 可在严格CSP策略的网站上工作
2. **更好的性能** - 原生运行，无userscript管理器开销
3. **更简洁的安装** - 无需Tampermonkey等脚本管理器
4. **设置同步** - 可通过Chrome Sync跨设备同步
5. **快捷键支持** - 原生快捷键API，更可靠

## 开发计划

- [ ] 添加更多语言支持
- [ ] 支持自定义翻译引擎
- [ ] 添加翻译历史记录
- [ ] 支持选中文本翻译
- [ ] 添加双语对照模式

## 许可证 License

本项目开源，可自由修改和分发。

## 支持 Support

如有问题、建议或功能请求，欢迎提交Issue。
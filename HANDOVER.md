# Ultimate Translator 开发交接文档

版本：v1.3.0 | 最后更新：2025-10-31

---

## 核心文件说明

### 主要文件

**manifest.json**
- 扩展配置文件
- 定义权限、快捷键、版本号
- 修改版本或权限时需要编辑此文件

**content.js**
- 核心翻译引擎（最重要的文件）
- 负责遍历网页DOM，查找文本节点
- 实现文本去重、翻译应用、动态内容监听
- 包含三个核心类：
  - ConfigManager - 配置管理
  - Translator - 翻译逻辑
  - UIManager - 用户界面管理

**background.js**
- 后台服务工作进程
- 处理翻译API请求（绕过CSP限制）
- 支持两个翻译引擎：
  - Microsoft Edge Translator（推荐，免费无限制）
  - Google Translate（备选）
- 监听快捷键并转发消息

**popup.html**
- 扩展弹出界面的HTML结构
- 包含语言选择器、翻译按钮、设置选项

**popup.js**
- 弹出界面的交互逻辑
- 处理用户设置变更
- 与content.js通信

**popup.css**
- 弹出界面的样式
- 定义按钮、表单、布局等视觉效果

### Excel翻译相关

**excel-translator.html**
- Excel文件翻译界面
- 提供文件上传、列选择、翻译控制

**excel-translator.js**
- Excel翻译逻辑
- 使用SheetJS库读写Excel文件
- 支持批量翻译、列选择、表头处理

**excel-translator.css**
- Excel翻译页面样式
- 包含"无敌"书法水印背景

### 依赖库

**libs/xlsx.full.min.js**
- SheetJS Excel处理库
- 用于读取和写入.xlsx/.xls文件

### 资源文件

**icons/** 文件夹
- icon16.png - 扩展小图标
- icon48.png - 扩展中图标
- icon128.png - Chrome商店展示图标

---

## 翻译流程

```
用户点击"立即翻译"或按 Alt+T
    ↓
popup.js 发送消息到 content.js
    ↓
content.js 的 Translator 类开始工作：
    1. 使用 TreeWalker 遍历DOM，找到所有文本节点
    2. 跳过代码块、SVG、脚本等不需要翻译的内容
    3. 文本去重（1000个节点可能只有200个唯一文本）
    ↓
发送翻译请求到 background.js
    ↓
background.js 调用翻译API：
    - Edge Translator：先获取auth token，再调用翻译API
    - Google Translate：直接调用公开API
    ↓
返回翻译结果到 content.js
    ↓
content.js 将翻译应用到所有对应节点
    ↓
启动 MutationObserver 监听动态内容
    ↓
完成
```

---

## 常见开发任务

### 修改代码后如何测试
1. 打开 `chrome://extensions/`
2. 找到 Ultimate Translator，点击刷新按钮
3. 重新测试功能

### 添加新语言
1. 编辑 `content.js`，找到 `LANGUAGE_MAP` 和 `EDGE_LANGUAGE_MAP`
2. 添加新语言代码，例如：
   ```javascript
   'french': 'fr',  // Google代码
   ```
   ```javascript
   'french': 'fr',  // Edge代码
   ```
3. 编辑 `popup.html`，在源语言和目标语言的 `<select>` 中添加：
   ```html
   <option value="french">法语 French</option>
   ```
4. 同样在 `excel-translator.html` 中添加
5. 保存，重新加载扩展

### 修改快捷键
编辑 `manifest.json`：
```json
"commands": {
  "translate-now": {
    "suggested_key": {
      "default": "Alt+T",
      "mac": "Alt+T"
    }
  }
}
```

### 修改界面样式
- 弹出界面：编辑 `popup.css`
- Excel页面：编辑 `excel-translator.css`
- 悬浮球：编辑 `content.js` 中 UIManager.createFloatBall() 的样式

### 修改默认配置
编辑 `content.js` 中 ConfigManager 的 defaultConfig：
```javascript
this.defaultConfig = {
  localLanguage: 'chinese_simplified',  // 默认源语言
  targetLanguage: 'english',            // 默认目标语言
  translationService: 'edge',           // 默认翻译服务
  showFloatBall: false,                 // 是否显示悬浮球
  // ...
};
```

---

## 调试技巧

### 查看日志

**网页翻译日志**
- 在网页上按 F12，打开开发者工具
- 切换到 Console 标签
- 查看 `[TRANSLATE]` - 翻译进度
- 查看 `[SKIP]` - 被跳过的节点

**后台日志**
- 打开 `chrome://extensions/`
- 找到 Ultimate Translator
- 点击"service worker"链接
- 查看 `[Edge Translator]` - API调用日志
- 查看 `[Hotkey]` - 快捷键触发日志

**Popup日志**
- 右键点击扩展图标
- 选择"检查弹出内容"
- 查看Console


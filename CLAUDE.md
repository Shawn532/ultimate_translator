# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ultimate Translator (无敌翻译器) is a Chrome Extension (Manifest V3) that translates web pages in real-time using Google Translate API. It features a draggable floating ball UI, keyboard shortcuts, and works on all websites by bypassing CSP restrictions through a background service worker.

## Development Commands

### Loading the Extension
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked" and select the project directory
4. Reload extension after making changes via the reload button

### Testing Keyboard Shortcuts
- Navigate to `chrome://extensions/shortcuts` to verify or customize shortcuts
- Test: Alt+T (translate), Alt+R (restore), Alt+E (CN→EN), Alt+C (EN→CN)
- On Mac, use Option key instead of Alt

### Debugging
- Content script: Right-click page → Inspect → Console tab
- Background worker: `chrome://extensions/` → click "service worker" under extension
- Check console logs for translation flow (findTextNodes, translation batching, MutationObserver)

## Architecture

### Three-Layer Design

The extension uses a clean separation between UI, translation logic, and API handling:

**1. Content Script (`content.js`)**
- Runs in ISOLATED world (has access to Chrome APIs and page DOM)
- **ConfigManager**: Manages settings with Chrome Sync Storage
- **Translator**: Core translation engine
  - Uses `TreeWalker` to find all text nodes in DOM
  - Implements deduplication (groups identical texts to reduce API calls)
  - Stores original texts in a `Map<Node, string>` for restoration
  - `MutationObserver` watches for dynamically added content and auto-translates
  - Skip logic for code blocks, SVG, math elements, form inputs
  - Configurable textarea/contenteditable translation via `translateTextareas` flag
- **UIManager**: Creates floating ball and control panel using Shadow DOM
  - Shadow DOM isolates styles to prevent conflicts with page styles
  - Prevents translation of UI elements (IDs start with `translate-`)
  - Handles dragging, positioning, and responsive design

**2. Background Service Worker (`background.js`)**
- Handles all API requests to bypass CSP restrictions
- Implements batch translation (`TRANSLATE_BATCH` message type)
- Sends parallel requests to Google Translate API
- Listens to keyboard commands and forwards to active tab

**3. Shadow DOM Isolation**
- All UI elements (floating ball, control panel) use Shadow DOM
- Prevents page styles from affecting UI
- Prevents translator from translating its own UI elements

### Translation Flow

1. User clicks "Translate Now" or presses Alt+T
2. `Translator.translatePage()` calls `findTextNodes()` using TreeWalker
3. Texts are deduplicated (Map: text → array of nodes)
4. Content script sends `TRANSLATE_BATCH` message to background worker
5. Background worker makes parallel `fetch()` calls to Google Translate API
6. Results are applied to all nodes in each group
7. `MutationObserver` starts watching for new DOM content
8. Original texts stored in `Map<Node, string>` for restoration

### Key Implementation Details

**Text Node Discovery**
- `TreeWalker` with `NodeFilter.SHOW_TEXT` finds all text nodes
- Skip logic checks parent elements recursively:
  - Always skip: CODE, PRE, KBD, SVG, MATH, SCRIPT, STYLE
  - Conditionally skip: TEXTAREA, contenteditable (based on `translateTextareas` config)
  - Skip URLs and email patterns via regex
- Only processes nodes still connected to DOM (`node.isConnected`)

**Deduplication Strategy**
- Groups identical texts together before API call
- Reduces API calls significantly (e.g., 1000 nodes → 200 unique texts)
- Maps translation result back to all nodes in group
- Logged with `[TRANSLATE]` showing text, translation, and node count

**Dynamic Content Handling**
- `MutationObserver` monitors `document.body` with `childList: true, subtree: true`
- Processes both text nodes and element nodes (walks their subtrees)
- Only translates if page is in translated state (`isTranslated` flag)
- Uses same skip logic and deduplication as initial translation

**State Management**
- `isTranslating`: Prevents concurrent translation requests
- `isTranslated`: Tracks if page is currently translated (enables MutationObserver)
- `currentSourceLang`/`currentTargetLang`: Used for auto-translating new content
- `originalTexts`: Map storing original text for each node (cleared on restore)

## Language Support

19 languages supported via `LANGUAGE_MAP` object:
- Maps friendly names (e.g., 'chinese_simplified') to ISO codes (e.g., 'zh-CN')
- Used for both source and target language selection
- Google Translate API supports 'auto' for source language detection

## UI Features

**Bilingual UI (Chinese + English)**
- Controlled by `uiLanguage` config ('zh' or 'en')
- `UI_TRANSLATIONS` object contains all UI strings
- `UIManager.updateUILanguage()` updates all labels dynamically

**Floating Ball**
- Draggable on desktop (mousedown/mousemove/mouseup)
- Click to toggle panel on mobile
- Position saved to Chrome Sync Storage
- Uses `isDragging` flag with threshold (5px) to distinguish click vs drag

**Control Panel**
- Positioned near floating ball (desktop) or centered (mobile)
- Contains language selectors, translate/restore buttons, textarea toggle
- All settings auto-save to `chrome.storage.sync`

## Configuration

Settings stored in `chrome.storage.sync` under key `translateConfig`:
- `uiLanguage`: 'zh' or 'en' (interface language)
- `localLanguage`: Source language (default: 'english')
- `targetLanguage`: Target language (default: 'chinese_simplified')
- `translateTextareas`: Boolean controlling textarea/contenteditable translation
- `floatBallPosition`: {x, y} coordinates
- `floatBallSize`, `floatBallOpacity`, `showFloatBall`: UI customization
- `autoTranslate`: Auto-translate on page load (default: false)

## Important Notes

**CSP Bypass**
- Background service worker can fetch any URL (has `<all_urls>` permission)
- Content script sends translation requests to background worker
- Background worker makes actual API calls, avoiding CSP restrictions

**Shadow DOM Usage**
- All UI elements must be accessed via shadowRoot references
- Event listeners must be attached to shadow DOM elements
- Example: `this.panelShadow.getElementById('translate-now-btn')`

**Node Validation**
- Always check `node.isConnected` before modifying text content
- Clean up disconnected nodes from `originalTexts` Map
- Prevents errors when DOM changes during translation

**Element ID Convention**
- All translator UI elements have IDs starting with `translate-`
- TreeWalker and MutationObserver check for this prefix to skip own UI
- Never create elements with IDs starting with `translate-` outside the translator

## Keyboard Shortcuts

Defined in `manifest.json` commands:
- `translate-now`: Alt+T
- `restore-original`: Alt+R
- `set-cn-to-en`: Alt+E (sets Chinese→English, then translates)
- `set-en-to-cn`: Alt+C (sets English→Chinese, then translates)

Background worker listens to `chrome.commands.onCommand` and sends messages to active tab.

## Common Development Tasks

**Adding a New Language**
1. Add to `LANGUAGE_MAP` in content.js (friendly name → ISO code)
2. Add `<option>` elements to both source and target `<select>` in panel HTML

**Modifying Skip Logic**
- Edit `Translator.shouldSkipNode()` method
- Add tag name checks or regex patterns
- Always log with `console.log` for debugging

**Changing UI Styles**
- Edit style `textContent` in `UIManager.createPanel()` or `createFloatBall()`
- Shadow DOM styles are scoped, won't affect page

**Adding UI Translations**
- Add keys to both 'zh' and 'en' in `UI_TRANSLATIONS` object
- Update `updateUILanguage()` to bind new elements

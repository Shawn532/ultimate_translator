// Ultimate Translator - Chrome Extension
// Clean, simple implementation with background API

// Storage wrapper using chrome.storage.sync
const storage = {
    get: (key, defaultValue) => {
        return new Promise(resolve => {
            chrome.storage.sync.get([key], result => {
                resolve(result[key] !== undefined ? result[key] : defaultValue);
            });
        });
    },
    set: (key, value) => {
        return chrome.storage.sync.set({[key]: value});
    }
};

(function() {
    'use strict';

    // Helper functions
    function isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            || window.innerWidth <= 768;
    }

    function isDarkMode() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    // Configuration Manager
    class ConfigManager {
        constructor() {
            this.defaultConfig = {
                enabled: true,
                uiLanguage: 'zh',  // Default to Chinese
                localLanguage: 'chinese_simplified',
                targetLanguage: 'english',
                translationService: 'edge',  // Default to Edge Translator (edge or google)
                floatBallSize: isMobile() ? 45 : 50,
                floatBallPosition: { x: 20, y: 100 },
                floatBallOpacity: 0.8,
                autoTranslate: false,
                showFloatBall: false,  // Default to hidden (controlled from popup)
                allowHalfBall: true,
                panelPosition: null,
                panelSize: isMobile() ? 0.9 : 1,
                panelOpacity: 1,
                translateTextareas: false  // Simple boolean to control textarea translation
            };
            this.config = null;
        }

        async loadConfig() {
            const saved = await storage.get('translateConfig', null);
            this.config = saved ? { ...this.defaultConfig, ...saved } : this.defaultConfig;
            return this.config;
        }

        async saveConfig() {
            await storage.set('translateConfig', this.config);
        }

        get(key) {
            return this.config[key];
        }

        async set(key, value) {
            this.config[key] = value;
            await this.saveConfig();
        }
    }

    // UI Translations - Chinese (default) and English
    const UI_TRANSLATIONS = {
        'zh': {
            title: '🌐 无敌翻译器',
            basicSettings: '基本设置',
            uiLanguage: '界面语言',
            uiLanguageHelp: '选择界面显示语言',
            sourceLanguage: '源语言',
            sourceLanguageHelp: '当前网页语言',
            targetLanguage: '目标语言',
            targetLanguageHelp: '翻译到的语言',
            translateNow: '立即翻译 (Alt+T)',
            restoreOriginal: '恢复原文 (Alt+R)',
            translateTextareas: '翻译文本框',
            translateTextareasHelp: '开启后翻译textarea和contenteditable可编辑区域内的内容',
            tipText: '💡 提示：点击悬浮球打开此面板。拖动悬浮球可以重新定位。所有设置会自动保存。'
        },
        'en': {
            title: '🌐 Ultimate Translator',
            basicSettings: 'Basic Settings',
            uiLanguage: 'UI Language',
            uiLanguageHelp: 'Choose interface language',
            sourceLanguage: 'Source Language',
            sourceLanguageHelp: 'Current page language',
            targetLanguage: 'Target Language',
            targetLanguageHelp: 'Language to translate to',
            translateNow: 'Translate Now (Alt+T)',
            restoreOriginal: 'Restore to Original (Alt+R)',
            translateTextareas: 'Translate Textareas',
            translateTextareasHelp: 'Enable to translate content in textarea and contenteditable fields',
            tipText: '💡 Tip: Click the floating ball to open this panel. Drag the ball to reposition it. All settings are saved automatically.'
        }
    };

    // Language mapping for Google Translate
    const LANGUAGE_MAP = {
        'chinese_simplified': 'zh-CN',
        'chinese_traditional': 'zh-TW',
        'english': 'en',
        'spanish': 'es',
        'french': 'fr',
        'german': 'de',
        'japanese': 'ja',
        'korean': 'ko',
        'russian': 'ru',
        'arabic': 'ar',
        'portuguese': 'pt',
        'italian': 'it',
        'dutch': 'nl',
        'polish': 'pl',
        'turkish': 'tr',
        'vietnamese': 'vi',
        'hindi': 'hi',
        'hebrew': 'he',
        'thai': 'th',
        'indonesian': 'id'
    };

    // Language mapping for Microsoft Edge Translator (uses different codes)
    const EDGE_LANGUAGE_MAP = {
        'chinese_simplified': 'zh-Hans',
        'chinese_traditional': 'zh-Hant',
        'english': 'en',
        'spanish': 'es',
        'french': 'fr',
        'german': 'de',
        'japanese': 'ja',
        'korean': 'ko',
        'russian': 'ru',
        'arabic': 'ar',
        'portuguese': 'pt',
        'italian': 'it',
        'dutch': 'nl',
        'polish': 'pl',
        'turkish': 'tr',
        'vietnamese': 'vi',
        'hindi': 'hi',
        'hebrew': 'he',
        'thai': 'th',
        'indonesian': 'id'
    };

    // Translator - Handles page translation
    class Translator {
        constructor(configManager) {
            this.configManager = configManager;
            this.originalTexts = new Map();
            this.isTranslating = false;
            this.isTranslated = false; // Track if page is currently translated
            this.observer = null; // MutationObserver for dynamic content
            this.currentSourceLang = null;
            this.currentTargetLang = null;
        }

        // Check if a node should be skipped from translation
        shouldSkipNode(node) {
            const text = node.textContent.trim();

            // Skip URLs (simple pattern)
            if (/^https?:\/\//i.test(text) || /^www\./i.test(text)) {
                console.log(`[SKIP] URL: "${text}"`);
                return true;
            }

            // Skip email addresses
            if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(text)) {
                console.log(`[SKIP] Email: "${text}"`);
                return true;
            }

            let element = node.parentElement;
            while (element) {
                const tagName = element.tagName;

                // Always skip code blocks, preformatted text
                if (tagName === 'CODE' || tagName === 'PRE' || tagName === 'KBD' ||
                    tagName === 'SAMP' || tagName === 'VAR') {
                    console.log(`[SKIP] Code block: "${text}" (parent: ${tagName})`);
                    return true;
                }

                // Always skip SVG elements
                if (tagName === 'SVG') {
                    console.log(`[SKIP] SVG: "${text}"`);
                    return true;
                }

                // Always skip math elements
                if (tagName === 'MATH') {
                    console.log(`[SKIP] Math: "${text}"`);
                    return true;
                }

                // Skip form inputs (but check config for textarea)
                if (tagName === 'INPUT' || tagName === 'SELECT' ||
                    tagName === 'OPTION' || tagName === 'BUTTON') {
                    console.log(`[SKIP] Form element: "${text}" (parent: ${tagName})`);
                    return true;
                }

                // Only skip TEXTAREA if config says so
                if (tagName === 'TEXTAREA') {
                    const shouldTranslate = this.configManager.get('translateTextareas');
                    console.log(`[TEXTAREA] "${text}" - translateTextareas: ${shouldTranslate}`);
                    return !shouldTranslate;
                }

                // Skip contenteditable elements (controlled by same config as textarea)
                if (element.getAttribute('contenteditable') === 'true') {
                    const shouldTranslate = this.configManager.get('translateTextareas');
                    console.log(`[CONTENTEDITABLE] "${text}" - translateTextareas: ${shouldTranslate}`);
                    return !shouldTranslate;
                }

                element = element.parentElement;
            }

            console.log(`[ACCEPT] "${text}"`);
            return false;
        }

        findTextNodes() {
            console.log('=== Starting findTextNodes() ===');
            const textNodes = [];
            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: (node) => {
                        const parent = node.parentElement;
                        if (!parent) return NodeFilter.FILTER_REJECT;

                        // Skip script, style, etc.
                        const tagName = parent.tagName;
                        if (tagName === 'SCRIPT' || tagName === 'STYLE' || tagName === 'NOSCRIPT') {
                            return NodeFilter.FILTER_REJECT;
                        }

                        // Skip our own UI elements
                        if (parent.id && parent.id.startsWith('translate-')) {
                            return NodeFilter.FILTER_REJECT;
                        }

                        // Skip all non-translatable elements
                        if (this.shouldSkipNode(node)) {
                            return NodeFilter.FILTER_REJECT;
                        }

                        // Only accept non-empty text
                        if (node.textContent.trim()) {
                            return NodeFilter.FILTER_ACCEPT;
                        }
                        return NodeFilter.FILTER_REJECT;
                    }
                }
            );

            let node;
            while (node = walker.nextNode()) {
                textNodes.push(node);
            }
            console.log(`=== Found ${textNodes.length} text nodes ===`);
            return textNodes;
        }

        async translatePage(sourceLang, targetLang) {
            if (this.isTranslating) {
                console.log('Translation already in progress');
                return;
            }

            this.isTranslating = true;

            try {
                const textNodes = this.findTextNodes();

                console.log(`Found ${textNodes.length} text nodes to translate`);

                // Get translation service and use appropriate language map
                const translationService = this.configManager.get('translationService') || 'edge';
                const langMap = translationService === 'edge' ? EDGE_LANGUAGE_MAP : LANGUAGE_MAP;

                // Convert language codes
                const sourceCode = langMap[sourceLang] || sourceLang;
                const targetCode = langMap[targetLang] || targetLang;

                // Collect all texts and save originals with deduplication
                const textsToTranslate = [];
                const nodeGroups = new Map(); // Map text -> array of nodes

                textNodes.forEach((node) => {
                    // Validate node is still in DOM
                    if (!node.isConnected) {
                        return;
                    }

                    const originalText = node.textContent.trim();
                    if (!originalText || originalText.length > 5000) {
                        return;
                    }

                    // Save original
                    if (!this.originalTexts.has(node)) {
                        this.originalTexts.set(node, originalText);
                    }

                    // Group identical texts together (deduplication)
                    if (!nodeGroups.has(originalText)) {
                        nodeGroups.set(originalText, []);
                        textsToTranslate.push(originalText); // Only add unique texts
                    }
                    nodeGroups.get(originalText).push(node);
                });

                if (textsToTranslate.length === 0) {
                    console.log('No eligible text content found for translation');
                    this.isTranslating = false;
                    return;
                }

                console.log(`Translating ${textsToTranslate.length} unique texts (from ${textNodes.length} nodes)...`);
                console.log('Texts to translate:', textsToTranslate);

                // Determine message type based on translation service
                const messageType = translationService === 'edge' ? 'TRANSLATE_BATCH_EDGE' : 'TRANSLATE_BATCH';
                console.log(`Using translation service: ${translationService} (type: ${messageType})`);

                // Send all texts at once to background for batch translation
                const response = await chrome.runtime.sendMessage({
                    type: messageType,
                    texts: textsToTranslate,
                    sourceLang: sourceCode,
                    targetLang: targetCode
                });

                if (response && response.success && response.translations) {
                    console.log('Received translations:', response.translations.length);
                    // Apply translations to all nodes in each group
                    response.translations.forEach((result, index) => {
                        if (!result.success || !result.translation) {
                            console.log(`[FAILED] Translation ${index}: ${textsToTranslate[index]}`);
                            return;
                        }

                        const originalText = textsToTranslate[index];
                        const nodes = nodeGroups.get(originalText);
                        console.log(`[TRANSLATE] "${originalText}" => "${result.translation}" (${nodes ? nodes.length : 0} nodes)`);

                        if (nodes) {
                            nodes.forEach(node => {
                                // Only apply if node still in DOM
                                if (node.isConnected) {
                                    node.textContent = result.translation;
                                }
                            });
                        }
                    });
                    console.log('Translation complete - all texts translated!');

                    // Save current languages and start observing for new content
                    this.currentSourceLang = sourceLang;
                    this.currentTargetLang = targetLang;
                    this.isTranslated = true;
                    this.startObserving();
                } else {
                    console.error('Batch translation failed');
                }
            } catch (error) {
                console.error('Translation error:', error);
            } finally {
                this.isTranslating = false;
            }
        }

        restoreOriginal() {
            this.stopObserving(); // Stop watching for new content

            // Restore text nodes - only if still connected to DOM
            const nodesToRemove = [];
            for (const [node, originalText] of this.originalTexts) {
                if (node.isConnected) {
                    try {
                        node.textContent = originalText;
                    } catch (error) {
                        console.warn('Failed to restore node:', error);
                        nodesToRemove.push(node);
                    }
                } else {
                    // Node no longer in DOM, mark for removal
                    nodesToRemove.push(node);
                }
            }

            // Clean up disconnected nodes from Map
            nodesToRemove.forEach(node => this.originalTexts.delete(node));
            this.originalTexts.clear();

            this.isTranslated = false;
            this.currentSourceLang = null;
            this.currentTargetLang = null;
            console.log('Restored original text');
        }

        startObserving() {
            if (this.observer) {
                return; // Already observing
            }

            this.observer = new MutationObserver((mutations) => {
                // Collect all new text nodes from mutations
                const newTextNodes = [];

                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        // If it's a text node
                        if (node.nodeType === Node.TEXT_NODE) {
                            const parent = node.parentElement;
                            if (parent && !parent.id?.startsWith('translate-') &&
                                parent.tagName !== 'SCRIPT' && parent.tagName !== 'STYLE' &&
                                !this.shouldSkipNode(node) &&
                                node.textContent.trim()) {
                                newTextNodes.push(node);
                            }
                        }
                        // If it's an element node, find text nodes within it
                        else if (node.nodeType === Node.ELEMENT_NODE) {
                            // Skip our own UI elements
                            if (node.id?.startsWith('translate-')) {
                                return;
                            }

                            const walker = document.createTreeWalker(
                                node,
                                NodeFilter.SHOW_TEXT,
                                {
                                    acceptNode: (textNode) => {
                                        const parent = textNode.parentElement;
                                        if (!parent) return NodeFilter.FILTER_REJECT;

                                        const tagName = parent.tagName;
                                        if (tagName === 'SCRIPT' || tagName === 'STYLE' || tagName === 'NOSCRIPT') {
                                            return NodeFilter.FILTER_REJECT;
                                        }

                                        if (parent.id?.startsWith('translate-')) {
                                            return NodeFilter.FILTER_REJECT;
                                        }

                                        // Skip all non-translatable elements
                                        if (this.shouldSkipNode(textNode)) {
                                            return NodeFilter.FILTER_REJECT;
                                        }

                                        if (textNode.textContent.trim()) {
                                            return NodeFilter.FILTER_ACCEPT;
                                        }
                                        return NodeFilter.FILTER_REJECT;
                                    }
                                }
                            );

                            let textNode;
                            while (textNode = walker.nextNode()) {
                                newTextNodes.push(textNode);
                            }
                        }
                    });
                });

                // Translate new nodes if any found
                if (newTextNodes.length > 0 && this.isTranslated) {
                    this.translateNodes(newTextNodes, this.currentSourceLang, this.currentTargetLang);
                }
            });

            // Start observing the document body for changes
            this.observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            console.log('Started observing DOM for new content');
        }

        stopObserving() {
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
                console.log('Stopped observing DOM');
            }
        }

        async translateNodes(textNodes, sourceLang, targetLang) {
            if (textNodes.length === 0) return;

            try {
                // Get translation service and use appropriate language map
                const translationService = this.configManager.get('translationService') || 'edge';
                const langMap = translationService === 'edge' ? EDGE_LANGUAGE_MAP : LANGUAGE_MAP;

                const sourceCode = langMap[sourceLang] || sourceLang;
                const targetCode = langMap[targetLang] || targetLang;

                const textsToTranslate = [];
                const nodeGroups = new Map(); // Map text -> array of nodes

                textNodes.forEach((node) => {
                    const originalText = node.textContent.trim();
                    if (!originalText || originalText.length > 5000) {
                        return;
                    }

                    // Save original if not already saved
                    if (!this.originalTexts.has(node)) {
                        this.originalTexts.set(node, originalText);
                    }

                    // Group identical texts together (deduplication)
                    if (!nodeGroups.has(originalText)) {
                        nodeGroups.set(originalText, []);
                        textsToTranslate.push(originalText);
                    }
                    nodeGroups.get(originalText).push(node);
                });

                if (textsToTranslate.length === 0) return;

                console.log(`Auto-translating ${textsToTranslate.length} unique new texts (from ${textNodes.length} total nodes)...`);

                // Determine message type based on translation service
                const messageType = translationService === 'edge' ? 'TRANSLATE_BATCH_EDGE' : 'TRANSLATE_BATCH';

                const response = await chrome.runtime.sendMessage({
                    type: messageType,
                    texts: textsToTranslate,
                    sourceLang: sourceCode,
                    targetLang: targetCode
                });

                if (response && response.success && response.translations) {
                    response.translations.forEach((result, index) => {
                        if (result.success && result.translation) {
                            const originalText = textsToTranslate[index];
                            const nodes = nodeGroups.get(originalText);

                            if (nodes) {
                                nodes.forEach(node => {
                                    node.textContent = result.translation;
                                });
                            }
                        }
                    });
                }
            } catch (error) {
                console.error('Auto-translation error:', error);
            }
        }

    }

    // UI Manager - Handles floating ball and control panel
    class UIManager {
        constructor(configManager, translator) {
            this.configManager = configManager;
            this.translator = translator;
            this.floatBall = null;
            this.panel = null;
            this.isDragging = false;
            this.dragOffset = { x: 0, y: 0 };
            this.removalObserver = null;

            this.init();
        }

        async init() {
            await this.createFloatBall();
            await this.createPanel();
            this.bindEvents();
            this.watchForRemoval();
        }

        watchForRemoval() {
            // Watch for removal of floating ball or panel from DOM
            this.removalObserver = new MutationObserver(() => {
                // Check if our elements still exist in DOM
                const ballInDom = document.body.contains(this.floatBallContainer);
                const panelInDom = document.body.contains(this.panelContainer);

                if (!ballInDom || !panelInDom) {
                    console.log('UI elements removed from DOM, re-injecting...');

                    // Disconnect observer temporarily to avoid infinite loop
                    this.removalObserver.disconnect();

                    // Re-create missing elements
                    if (!ballInDom) {
                        this.createFloatBall().then(() => {
                            console.log('Float ball re-injected');
                        });
                    }
                    if (!panelInDom) {
                        this.createPanel().then(() => {
                            console.log('Panel re-injected');
                        });
                    }

                    // Re-bind events after a short delay to ensure elements are ready
                    setTimeout(() => {
                        this.bindEvents();
                        // Restart watching
                        this.watchForRemoval();
                    }, 100);
                }
            });

            // Observe document.body for child removals
            this.removalObserver.observe(document.body, {
                childList: true,
                subtree: false  // Only watch direct children of body
            });

            console.log('Started watching for UI element removal');
        }

        async createFloatBall() {
            const config = this.configManager.config;

            // Create container for shadow DOM
            const ballContainer = document.createElement('div');
            ballContainer.id = 'translate-float-ball-container';

            // Attach shadow DOM
            const shadowRoot = ballContainer.attachShadow({ mode: 'open' });

            // Create styles inside shadow DOM
            const style = document.createElement('style');
            style.textContent = `
                .float-ball {
                    position: fixed;
                    width: ${config.floatBallSize}px;
                    height: ${config.floatBallSize}px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                    cursor: ${isMobile() ? 'pointer' : 'move'};
                    z-index: 2147483647;
                    display: ${config.showFloatBall ? 'flex' : 'none'};
                    align-items: center;
                    justify-content: center;
                    opacity: ${config.floatBallOpacity};
                    left: ${config.floatBallPosition.x}px;
                    top: ${config.floatBallPosition.y}px;
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                    user-select: none;
                    touch-action: none;
                }
                .float-ball svg {
                    width: ${isMobile() ? '24px' : '28px'};
                    height: ${isMobile() ? '24px' : '28px'};
                    fill: white;
                    pointer-events: none;
                }
            `;

            // Create ball element
            const ball = document.createElement('div');
            ball.className = 'float-ball';
            ball.innerHTML = `
                <svg viewBox="0 0 24 24">
                    <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
                </svg>
            `;

            shadowRoot.appendChild(style);
            shadowRoot.appendChild(ball);
            document.body.appendChild(ballContainer);

            this.floatBall = ball;
            this.floatBallContainer = ballContainer;
            this.floatBallShadow = shadowRoot;
        }

        async createPanel() {
            const config = this.configManager.config;
            const mobile = isMobile();

            // Create container for shadow DOM
            const panelContainer = document.createElement('div');
            panelContainer.id = 'translate-panel-container';

            // Attach shadow DOM
            const shadowRoot = panelContainer.attachShadow({ mode: 'open' });

            // Create comprehensive styles inside shadow DOM
            const style = document.createElement('style');
            style.textContent = `
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                .panel {
                    position: fixed;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
                    z-index: 2147483646;
                    display: none;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                    overflow: hidden;
                    width: ${mobile ? '90vw' : '400px'};
                    max-height: ${mobile ? '80vh' : '600px'};
                }
                .panel-header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: ${mobile ? '15px' : '20px'};
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: move;
                }
                .panel-title {
                    font-size: ${mobile ? '16px' : '18px'};
                    font-weight: 600;
                }
                .panel-close {
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.2);
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 18px;
                    color: white;
                }
                .panel-close:hover {
                    background: rgba(255,255,255,0.3);
                }
                .panel-body {
                    padding: ${mobile ? '15px' : '20px'};
                    max-height: ${mobile ? '60vh' : '500px'};
                    overflow-y: auto;
                }
                .section-title {
                    font-size: ${mobile ? '15px' : '16px'};
                    font-weight: 600;
                    color: #333;
                    margin-bottom: 15px;
                    padding-bottom: 10px;
                    border-bottom: 2px solid #f0f0f0;
                }
                .form-group {
                    margin-bottom: ${mobile ? '15px' : '20px'};
                }
                label {
                    display: block;
                    margin-bottom: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    color: #333;
                }
                .help-text {
                    font-size: 12px;
                    color: #666;
                    margin-top: 4px;
                    font-weight: normal;
                }
                select {
                    width: 100%;
                    padding: ${mobile ? '12px' : '10px'};
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    font-size: ${mobile ? '16px' : '14px'};
                    background: white;
                    color: #333;
                    cursor: pointer;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                }
                .button-primary {
                    width: 100%;
                    padding: ${mobile ? '15px' : '14px'};
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 10px;
                    font-size: ${mobile ? '16px' : '15px'};
                    font-weight: 500;
                    cursor: pointer;
                    text-align: center;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                    margin-top: 8px;
                    transition: all 0.2s ease;
                    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.25);
                }
                .button-primary:hover {
                    opacity: 0.9;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.35);
                }
                .button-primary:active {
                    transform: translateY(0);
                }
                .button-danger {
                    width: 100%;
                    padding: ${mobile ? '15px' : '14px'};
                    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
                    color: white;
                    border: none;
                    border-radius: 10px;
                    font-size: ${mobile ? '16px' : '15px'};
                    font-weight: 500;
                    cursor: pointer;
                    text-align: center;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                    margin-top: 12px;
                    transition: all 0.2s ease;
                    box-shadow: 0 2px 8px rgba(255, 107, 107, 0.25);
                }
                .button-danger:hover {
                    opacity: 0.9;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(255, 107, 107, 0.35);
                }
                .button-danger:active {
                    transform: translateY(0);
                }
                .tip-box {
                    background: #f8f9fa;
                    padding: 14px;
                    border-radius: 10px;
                    font-size: ${mobile ? '12px' : '13px'};
                    color: #666;
                    margin-top: 20px;
                    line-height: 1.6;
                }
                .toggle-container {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-top: 20px;
                    padding-top: 15px;
                    border-top: 1px solid #e0e0e0;
                }
                .toggle-switch {
                    position: relative;
                    display: inline-block;
                    width: 50px;
                    height: 24px;
                }
                .toggle-switch input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }
                .toggle-slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: #ccc;
                    transition: 0.4s;
                    border-radius: 24px;
                }
                .toggle-slider:before {
                    position: absolute;
                    content: "";
                    height: 18px;
                    width: 18px;
                    left: 3px;
                    bottom: 3px;
                    background-color: white;
                    transition: 0.4s;
                    border-radius: 50%;
                }
                .toggle-switch input:checked + .toggle-slider {
                    background-color: #667eea;
                }
                .toggle-switch input:checked + .toggle-slider:before {
                    transform: translateX(26px);
                }
            `;

            // Create panel element
            const panel = document.createElement('div');
            panel.className = 'panel';

            panel.innerHTML = `
                <div class="panel-header">
                    <div class="panel-title" id="ui-title">🌐 Ultimate Translator</div>
                    <button class="panel-close" id="translate-panel-close">✕</button>
                </div>
                <div class="panel-body">
                    <div class="form-group" style="border-bottom: 1px solid #e0e0e0; padding-bottom: 15px; margin-bottom: 15px;">
                        <label>
                            <span id="ui-lang-label">UI Language</span>
                            <div class="help-text" id="ui-lang-help">Choose interface language</div>
                        </label>
                        <select id="translate-ui-lang">
                            <option value="zh">中文</option>
                            <option value="en">English</option>
                        </select>
                    </div>

                    <div class="section-title" id="section-title">Basic Settings</div>

                    <div class="form-group">
                        <label>
                            <span id="source-lang-label">Source Language</span>
                            <div class="help-text" id="source-lang-help">Current page language</div>
                        </label>
                        <select id="translate-local-lang">
                            <option value="english">English</option>
                            <option value="chinese_simplified">简体中文</option>
                            <option value="chinese_traditional">繁體中文</option>
                            <option value="japanese">日本語</option>
                            <option value="korean">한국어</option>
                            <option value="spanish">Español</option>
                            <option value="french">Français</option>
                            <option value="german">Deutsch</option>
                            <option value="russian">Русский</option>
                            <option value="portuguese">Português</option>
                            <option value="italian">Italiano</option>
                            <option value="arabic">العربية</option>
                            <option value="dutch">Nederlands</option>
                            <option value="polish">Polski</option>
                            <option value="turkish">Türkçe</option>
                            <option value="vietnamese">Tiếng Việt</option>
                            <option value="hindi">हिन्दी</option>
                            <option value="hebrew">עברית</option>
                            <option value="thai">ไทย</option>
                            <option value="indonesian">Bahasa Indonesia</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>
                            <span id="target-lang-label">Target Language</span>
                            <div class="help-text" id="target-lang-help">Language to translate to</div>
                        </label>
                        <select id="translate-target-lang">
                            <option value="chinese_simplified">简体中文</option>
                            <option value="english">English</option>
                            <option value="chinese_traditional">繁體中文</option>
                            <option value="japanese">日本語</option>
                            <option value="korean">한국어</option>
                            <option value="spanish">Español</option>
                            <option value="french">Français</option>
                            <option value="german">Deutsch</option>
                            <option value="russian">Русский</option>
                            <option value="portuguese">Português</option>
                            <option value="italian">Italiano</option>
                            <option value="arabic">العربية</option>
                            <option value="dutch">Nederlands</option>
                            <option value="polish">Polski</option>
                            <option value="turkish">Türkçe</option>
                            <option value="vietnamese">Tiếng Việt</option>
                            <option value="hindi">हिन्दी</option>
                            <option value="hebrew">עברית</option>
                            <option value="thai">ไทย</option>
                            <option value="indonesian">Bahasa Indonesia</option>
                        </select>
                    </div>

                    <button id="translate-now-btn" class="button-primary">Translate Now</button>

                    <div class="form-group">
                        <button id="translate-restore-btn" class="button-danger">Restore to Original</button>
                    </div>

                    <div class="toggle-container">
                        <label style="margin-bottom: 0; flex: 1;">
                            <span id="textarea-label">Translate Textareas</span>
                            <div class="help-text" id="textarea-help">Enable to translate content in textarea fields</div>
                        </label>
                        <label class="toggle-switch">
                            <input type="checkbox" id="translate-textareas" ${config.translateTextareas ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>

                    <div class="tip-box" id="tip-box">
                        💡 Tip: Click the floating ball to open this panel. Drag the ball to reposition it. All settings are saved automatically.
                    </div>
                </div>
            `;

            // Set position if saved
            if (config.panelPosition) {
                panel.style.left = `${config.panelPosition.x}px`;
                panel.style.top = `${config.panelPosition.y}px`;
            }

            // Append to shadow DOM
            shadowRoot.appendChild(style);
            shadowRoot.appendChild(panel);
            document.body.appendChild(panelContainer);

            this.panel = panel;
            this.panelContainer = panelContainer;
            this.panelShadow = shadowRoot;

            // Set initial values - access elements from shadow DOM
            shadowRoot.getElementById('translate-local-lang').value = config.localLanguage;
            shadowRoot.getElementById('translate-target-lang').value = config.targetLanguage;

            // Initialize UI language
            const uiLang = config.uiLanguage || 'zh';
            shadowRoot.getElementById('translate-ui-lang').value = uiLang;
            this.updateUILanguage(uiLang);
        }

        // Update all UI text based on selected language
        updateUILanguage(lang) {
            const t = UI_TRANSLATIONS[lang];

            // Update panel title
            this.panelShadow.getElementById('ui-title').textContent = t.title;

            // Update section title
            this.panelShadow.getElementById('section-title').textContent = t.basicSettings;

            // Update UI language labels
            this.panelShadow.getElementById('ui-lang-label').textContent = t.uiLanguage;
            this.panelShadow.getElementById('ui-lang-help').textContent = t.uiLanguageHelp;

            // Update source/target language labels
            this.panelShadow.getElementById('source-lang-label').textContent = t.sourceLanguage;
            this.panelShadow.getElementById('source-lang-help').textContent = t.sourceLanguageHelp;
            this.panelShadow.getElementById('target-lang-label').textContent = t.targetLanguage;
            this.panelShadow.getElementById('target-lang-help').textContent = t.targetLanguageHelp;

            // Update buttons
            this.panelShadow.getElementById('translate-now-btn').textContent = t.translateNow;
            this.panelShadow.getElementById('translate-restore-btn').textContent = t.restoreOriginal;

            // Update textarea toggle
            this.panelShadow.getElementById('textarea-label').textContent = t.translateTextareas;
            this.panelShadow.getElementById('textarea-help').textContent = t.translateTextareasHelp;

            // Update tip box
            this.panelShadow.getElementById('tip-box').textContent = t.tipText;
        }

        bindEvents() {
            // Float ball drag (desktop)
            if (!isMobile()) {
                let startX, startY;
                const DRAG_THRESHOLD = 5; // pixels to move before considering it a drag

                this.floatBall.addEventListener('mousedown', (e) => {
                    e.preventDefault(); // Prevent text selection
                    this.isDragging = false;
                    startX = e.clientX;
                    startY = e.clientY;
                    this.dragOffset.x = e.clientX - this.floatBall.offsetLeft;
                    this.dragOffset.y = e.clientY - this.floatBall.offsetTop;

                    const mouseMoveHandler = (e) => {
                        const deltaX = Math.abs(e.clientX - startX);
                        const deltaY = Math.abs(e.clientY - startY);

                        // Only start dragging if moved more than threshold
                        if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
                            this.isDragging = true;
                            const newX = e.clientX - this.dragOffset.x;
                            const newY = e.clientY - this.dragOffset.y;
                            this.floatBall.style.left = `${newX}px`;
                            this.floatBall.style.top = `${newY}px`;
                        }
                    };

                    const mouseUpHandler = () => {
                        document.removeEventListener('mousemove', mouseMoveHandler);
                        document.removeEventListener('mouseup', mouseUpHandler);

                        if (this.isDragging) {
                            // Save position if dragged
                            this.configManager.set('floatBallPosition', {
                                x: parseInt(this.floatBall.style.left),
                                y: parseInt(this.floatBall.style.top)
                            });
                            // Reset flag after a short delay
                            setTimeout(() => { this.isDragging = false; }, 100);
                        } else {
                            // If not dragged, open panel immediately
                            this.togglePanel();
                        }
                    };

                    document.addEventListener('mousemove', mouseMoveHandler);
                    document.addEventListener('mouseup', mouseUpHandler);
                });
            } else {
                // Mobile: simple click to toggle
                this.floatBall.addEventListener('click', () => {
                    this.togglePanel();
                });
            }

            // Panel close button - access from shadow DOM
            this.panelShadow.getElementById('translate-panel-close').addEventListener('click', () => {
                this.togglePanel();
            });

            // UI Language selector - access from shadow DOM
            this.panelShadow.getElementById('translate-ui-lang').addEventListener('change', (e) => {
                const lang = e.target.value;
                this.configManager.set('uiLanguage', lang);
                this.updateUILanguage(lang);
            });

            // Language selectors - access from shadow DOM
            this.panelShadow.getElementById('translate-local-lang').addEventListener('change', (e) => {
                this.configManager.set('localLanguage', e.target.value);
            });

            this.panelShadow.getElementById('translate-target-lang').addEventListener('change', (e) => {
                this.configManager.set('targetLanguage', e.target.value);
            });

            // Translate button - access from shadow DOM
            this.panelShadow.getElementById('translate-now-btn').addEventListener('click', async () => {
                const sourceLang = this.configManager.get('localLanguage');
                const targetLang = this.configManager.get('targetLanguage');
                this.togglePanel();
                await this.translator.translatePage(sourceLang, targetLang);
            });

            // Restore button - access from shadow DOM
            this.panelShadow.getElementById('translate-restore-btn').addEventListener('click', () => {
                this.togglePanel();
                this.translator.restoreOriginal();
            });

            // Textarea toggle - access from shadow DOM
            this.panelShadow.getElementById('translate-textareas').addEventListener('change', (e) => {
                this.configManager.set('translateTextareas', e.target.checked);
            });
        }

        togglePanel() {
            if (this.panel.style.display === 'none') {
                this.panel.style.display = 'block';
                this.positionPanel();
            } else {
                this.panel.style.display = 'none';
            }
        }

        positionPanel() {
            const mobile = isMobile();
            const config = this.configManager.config;

            if (config.panelPosition) {
                this.panel.style.left = `${config.panelPosition.x}px`;
                this.panel.style.top = `${config.panelPosition.y}px`;
            } else if (mobile) {
                // Center on mobile
                const left = (window.innerWidth - this.panel.offsetWidth) / 2;
                const top = (window.innerHeight - this.panel.offsetHeight) / 2;
                this.panel.style.left = `${left}px`;
                this.panel.style.top = `${top}px`;
            } else {
                // Position next to ball on desktop
                const ballRect = this.floatBall.getBoundingClientRect();
                let left = ballRect.right + 10;
                let top = ballRect.top;

                if (left + this.panel.offsetWidth > window.innerWidth) {
                    left = ballRect.left - this.panel.offsetWidth - 10;
                }

                this.panel.style.left = `${left}px`;
                this.panel.style.top = `${top}px`;
            }
        }
    }

    // Initialize
    async function init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }

        try {
            // Initialize components
            const configManager = new ConfigManager();
            await configManager.loadConfig();

            const translator = new Translator(configManager);
            const uiManager = new UIManager(configManager, translator);

            chrome.runtime.onMessage.addListener((message) => {
                if (!message || !message.type) {
                    return;
                }

                if (message.type === 'HOTKEY_TRANSLATE') {
                    // Use language from message if provided, otherwise use config
                    const sourceLang = message.sourceLang || configManager.get('localLanguage');
                    const targetLang = message.targetLang || configManager.get('targetLanguage');
                    translator.translatePage(sourceLang, targetLang);
                } else if (message.type === 'HOTKEY_RESTORE') {
                    translator.restoreOriginal();
                } else if (message.type === 'HOTKEY_CN_TO_EN') {
                    // Set Chinese to English and translate
                    configManager.set('localLanguage', 'chinese_simplified');
                    configManager.set('targetLanguage', 'english');
                    translator.translatePage('chinese_simplified', 'english');
                } else if (message.type === 'HOTKEY_EN_TO_CN') {
                    // Set English to Chinese and translate
                    configManager.set('localLanguage', 'english');
                    configManager.set('targetLanguage', 'chinese_simplified');
                    translator.translatePage('english', 'chinese_simplified');
                } else if (message.type === 'UPDATE_CONFIG') {
                    // Handle config updates from popup
                    const { key, value } = message;
                    configManager.set(key, value);

                    // Special handling for showFloatBall
                    if (key === 'showFloatBall') {
                        const floatBall = uiManager.floatBallShadow.querySelector('.float-ball');
                        if (floatBall) {
                            floatBall.style.display = value ? 'flex' : 'none';
                        }
                    }

                    // Special handling for UI language
                    if (key === 'uiLanguage') {
                        uiManager.updateUILanguage(value);
                    }
                }
            });

            console.log('Ultimate Translator loaded successfully');

            // Auto-translate if enabled
            if (configManager.get('autoTranslate')) {
                setTimeout(() => {
                    const sourceLang = configManager.get('localLanguage');
                    const targetLang = configManager.get('targetLanguage');
                    translator.translatePage(sourceLang, targetLang);
                }, 1000);
            }
        } catch (error) {
            console.error('Ultimate Translator initialization failed:', error);
        }
    }

    // Start initialization
    init();
})();

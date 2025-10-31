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
                localLanguage: 'english',
                targetLanguage: 'chinese_simplified',
                translationAPI: 'google',  // 'google' or 'baidu'
                baiduAppId: '',
                baiduKey: '',
                floatBallSize: isMobile() ? 45 : 50,
                floatBallPosition: { x: 20, y: 100 },
                floatBallOpacity: 0.8,
                autoTranslate: false,
                showFloatBall: true,
                allowHalfBall: true,
                panelPosition: null,
                panelSize: isMobile() ? 0.9 : 1,
                panelOpacity: 1
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

    // Language mapping for Baidu Translate (uses different codes)
    const BAIDU_LANGUAGE_MAP = {
        'chinese_simplified': 'zh',
        'chinese_traditional': 'cht',
        'english': 'en',
        'spanish': 'spa',
        'french': 'fra',
        'german': 'de',
        'japanese': 'jp',
        'korean': 'kor',
        'russian': 'ru',
        'arabic': 'ara',
        'portuguese': 'pt',
        'italian': 'it',
        'dutch': 'nl',
        'polish': 'pl',
        'turkish': 'tr',
        'vietnamese': 'vie',
        'hindi': 'hi',
        'hebrew': 'he',
        'thai': 'th',
        'indonesian': 'id'
    };

    // Language mapping for ZVO Translate (uses the 'id' field, not serviceId!)
    const ZVO_LANGUAGE_MAP = {
        'chinese_simplified': 'chinese_simplified',
        'chinese_traditional': 'chinese_traditional',
        'english': 'english',
        'spanish': 'spanish',
        'french': 'french',
        'german': 'deutsch',
        'japanese': 'japanese',
        'korean': 'korean',
        'russian': 'russian',
        'arabic': 'arabic',
        'portuguese': 'portuguese',
        'italian': 'italian',
        'dutch': 'dutch',
        'polish': 'polish',
        'turkish': 'turkish',
        'vietnamese': 'vietnamese',
        'hindi': 'hindi',
        'hebrew': 'hebrew',
        'thai': 'thai',
        'indonesian': 'indonesian'
    };

    // Language mapping for Microsoft Edge Translator (from translate.js client.edge)
    const EDGE_LANGUAGE_MAP = {
        'chinese_simplified': 'zh-CHS',
        'chinese_traditional': 'zh-CHT',
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
                return true;
            }

            // Skip email addresses
            if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(text)) {
                return true;
            }

            let element = node.parentElement;
            while (element) {
                const tagName = element.tagName;

                // Skip code blocks, preformatted text
                if (tagName === 'CODE' || tagName === 'PRE' || tagName === 'KBD' ||
                    tagName === 'SAMP' || tagName === 'VAR') {
                    return true;
                }

                // Skip form inputs
                if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' ||
                    tagName === 'OPTION' || tagName === 'BUTTON') {
                    return true;
                }

                // Skip SVG elements
                if (tagName === 'SVG') {
                    return true;
                }

                // Skip math elements
                if (tagName === 'MATH') {
                    return true;
                }

                // Skip contenteditable elements
                if (element.getAttribute('contenteditable') === 'true') {
                    return true;
                }

                element = element.parentElement;
            }

            return false;
        }

        findTextNodes() {
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

                // Check which API will be used
                const api = this.configManager.get('translationAPI');
                console.log(`[DEBUG] Using API: ${api}`); // Debug log

                // Select appropriate language map
                let langMap, defaultTarget;
                if (api === 'baidu') {
                    langMap = BAIDU_LANGUAGE_MAP;
                    defaultTarget = 'zh';
                } else if (api === 'zvo') {
                    langMap = ZVO_LANGUAGE_MAP;
                    defaultTarget = 'zh-CN';
                } else if (api === 'edge') {
                    langMap = EDGE_LANGUAGE_MAP;
                    defaultTarget = 'zh-CHS';
                } else {
                    langMap = LANGUAGE_MAP;
                    defaultTarget = 'zh-CN';
                }

                // Convert language codes
                const sourceCode = langMap[sourceLang] || 'auto';
                const targetCode = langMap[targetLang] || defaultTarget;

                // Collect all texts and save originals with deduplication
                const textsToTranslate = [];
                const nodeGroups = new Map(); // Map text -> array of nodes

                textNodes.forEach((node) => {
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

                console.log(`Translating ${textsToTranslate.length} unique texts (from ${textNodes.length} total nodes)...`);

                // Use the API already determined above
                let response;

                if (api === 'baidu') {
                    // Use Baidu Translate API
                    const appId = this.configManager.get('baiduAppId');
                    const appKey = this.configManager.get('baiduKey');
                    console.log(`[DEBUG] Baidu credentials - APP ID: ${appId ? 'SET' : 'MISSING'}, Key: ${appKey ? 'SET' : 'MISSING'}`);

                    if (!appId || !appKey) {
                        alert('Please configure Baidu API credentials in the settings panel.');
                        this.isTranslating = false;
                        return;
                    }

                    console.log(`[DEBUG] Calling Baidu API with ${textsToTranslate.length} texts`);
                    response = await chrome.runtime.sendMessage({
                        type: 'TRANSLATE_BATCH_BAIDU',
                        texts: textsToTranslate,
                        sourceLang: sourceCode,
                        targetLang: targetCode,
                        appId: appId,
                        appKey: appKey
                    });
                    console.log(`[DEBUG] Baidu API response:`, response);
                } else if (api === 'libretranslate') {
                    // Use LibreTranslate API
                    console.log(`[DEBUG] Calling LibreTranslate API with ${textsToTranslate.length} texts`);
                    response = await chrome.runtime.sendMessage({
                        type: 'TRANSLATE_BATCH_LIBRETRANSLATE',
                        texts: textsToTranslate,
                        sourceLang: sourceCode,
                        targetLang: targetCode
                    });
                    console.log(`[DEBUG] LibreTranslate API response:`, response);
                } else if (api === 'zvo') {
                    // Use ZVO Translate API
                    console.log(`[DEBUG] Calling ZVO Translate API with ${textsToTranslate.length} texts`);
                    response = await chrome.runtime.sendMessage({
                        type: 'TRANSLATE_BATCH_ZVO',
                        texts: textsToTranslate,
                        sourceLang: sourceCode,
                        targetLang: targetCode
                    });
                    console.log(`[DEBUG] ZVO API response:`, response);
                } else if (api === 'edge') {
                    // Use Microsoft Edge Translator API (free, unlimited!)
                    console.log(`[DEBUG] Calling Microsoft Edge Translator with ${textsToTranslate.length} texts`);
                    response = await chrome.runtime.sendMessage({
                        type: 'TRANSLATE_BATCH_EDGE',
                        texts: textsToTranslate,
                        sourceLang: sourceCode,
                        targetLang: targetCode
                    });
                    console.log(`[DEBUG] Edge Translator API response:`, response);
                } else {
                    // Use Google Translate API (default)
                    console.log(`[DEBUG] Calling Google API with ${textsToTranslate.length} texts`);
                    response = await chrome.runtime.sendMessage({
                        type: 'TRANSLATE_BATCH',
                        texts: textsToTranslate,
                        sourceLang: sourceCode,
                        targetLang: targetCode
                    });
                }

                if (response && response.success && response.translations) {
                    // Count successful and failed translations
                    let successCount = 0;
                    let failCount = 0;

                    // Apply translations to all nodes in each group
                    response.translations.forEach((result, index) => {
                        if (result.success && result.translation) {
                            const originalText = textsToTranslate[index];
                            const nodes = nodeGroups.get(originalText);

                            if (nodes) {
                                // Apply same translation to all nodes with identical text
                                console.log(`[DEBUG] Applying translation: "${originalText}" -> "${result.translation}" to ${nodes.length} nodes`);
                                nodes.forEach(node => {
                                    node.textContent = result.translation;
                                });
                                successCount++;
                            }
                        } else {
                            failCount++;
                            console.error(`[DEBUG] Translation failed for text ${index}:`, result.error || 'Unknown error', result);
                        }
                    });

                    console.log(`Translation complete - ${successCount} succeeded, ${failCount} failed`);

                    if (failCount > 0) {
                        alert(`Translation completed with errors: ${successCount} succeeded, ${failCount} failed.\n\nCheck console for details. If using Baidu API, verify your credentials are correct.`);
                    }

                    // Save current languages and start observing for new content
                    this.currentSourceLang = sourceLang;
                    this.currentTargetLang = targetLang;
                    this.isTranslated = true;
                    this.startObserving();
                } else {
                    console.error('Batch translation failed', response);
                    alert('Translation failed. Check console for details.');
                }
            } catch (error) {
                console.error('Translation error:', error);
            } finally {
                this.isTranslating = false;
            }
        }

        restoreOriginal() {
            this.stopObserving(); // Stop watching for new content
            for (const [node, originalText] of this.originalTexts) {
                try {
                    node.textContent = originalText;
                } catch (error) {
                    // Node might have been removed from DOM
                }
            }
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
                const api = this.configManager.get('translationAPI');

                // Select appropriate language map
                let langMap, defaultTarget;
                if (api === 'baidu') {
                    langMap = BAIDU_LANGUAGE_MAP;
                    defaultTarget = 'zh';
                } else if (api === 'zvo') {
                    langMap = ZVO_LANGUAGE_MAP;
                    defaultTarget = 'zh-CN';
                } else if (api === 'edge') {
                    langMap = EDGE_LANGUAGE_MAP;
                    defaultTarget = 'zh-CHS';
                } else {
                    langMap = LANGUAGE_MAP;
                    defaultTarget = 'zh-CN';
                }

                const sourceCode = langMap[sourceLang] || 'auto';
                const targetCode = langMap[targetLang] || defaultTarget;

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

                // Use the API already determined above
                let response;

                if (api === 'baidu') {
                    // Use Baidu Translate API
                    const appId = this.configManager.get('baiduAppId');
                    const appKey = this.configManager.get('baiduKey');

                    if (!appId || !appKey) {
                        console.error('Baidu API credentials not configured');
                        return;
                    }

                    response = await chrome.runtime.sendMessage({
                        type: 'TRANSLATE_BATCH_BAIDU',
                        texts: textsToTranslate,
                        sourceLang: sourceCode,
                        targetLang: targetCode,
                        appId: appId,
                        appKey: appKey
                    });
                } else if (api === 'libretranslate') {
                    // Use LibreTranslate API
                    response = await chrome.runtime.sendMessage({
                        type: 'TRANSLATE_BATCH_LIBRETRANSLATE',
                        texts: textsToTranslate,
                        sourceLang: sourceCode,
                        targetLang: targetCode
                    });
                } else if (api === 'zvo') {
                    // Use ZVO Translate API
                    response = await chrome.runtime.sendMessage({
                        type: 'TRANSLATE_BATCH_ZVO',
                        texts: textsToTranslate,
                        sourceLang: sourceCode,
                        targetLang: targetCode
                    });
                } else if (api === 'edge') {
                    // Use Microsoft Edge Translator API
                    response = await chrome.runtime.sendMessage({
                        type: 'TRANSLATE_BATCH_EDGE',
                        texts: textsToTranslate,
                        sourceLang: sourceCode,
                        targetLang: targetCode
                    });
                } else {
                    // Use Google Translate API (default)
                    response = await chrome.runtime.sendMessage({
                        type: 'TRANSLATE_BATCH',
                        texts: textsToTranslate,
                        sourceLang: sourceCode,
                        targetLang: targetCode
                    });
                }

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
            `;

            // Create panel element
            const panel = document.createElement('div');
            panel.className = 'panel';

            panel.innerHTML = `
                <div class="panel-header">
                    <div class="panel-title">🌐 Ultimate Translator</div>
                    <button class="panel-close" id="translate-panel-close">✕</button>
                </div>
                <div class="panel-body">
                    <div class="section-title">Basic Settings</div>

                    <div class="form-group">
                        <label>
                            Source Language
                            <div class="help-text">Current page language</div>
                        </label>
                        <select id="translate-local-lang">
                            <option value="english">English</option>
                            <option value="chinese_simplified">简体中文</option>
                            <option value="chinese_traditional">繁體中文</option>
                            <option value="spanish">Español</option>
                            <option value="french">Français</option>
                            <option value="german">Deutsch</option>
                            <option value="japanese">日本語</option>
                            <option value="korean">한국어</option>
                            <option value="russian">Русский</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>
                            Target Language
                            <div class="help-text">Language to translate to</div>
                        </label>
                        <select id="translate-target-lang">
                            <option value="chinese_simplified">简体中文</option>
                            <option value="english">English</option>
                            <option value="chinese_traditional">繁體中文</option>
                            <option value="spanish">Español</option>
                            <option value="french">Français</option>
                            <option value="german">Deutsch</option>
                            <option value="japanese">日本語</option>
                            <option value="korean">한국어</option>
                            <option value="russian">Русский</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>
                            Translation API
                            <div class="help-text">Choose translation service</div>
                        </label>
                        <select id="translate-api">
                            <option value="edge">Microsoft Edge Translator (Free, works in China, recommended)</option>
                            <option value="google">Google Translate (Fast, reliable)</option>
                            <option value="zvo">ZVO Translate (Requires API setup)</option>
                            <option value="libretranslate">LibreTranslate (Requires API setup)</option>
                            <option value="baidu">Baidu Translate (Requires API setup)</option>
                        </select>
                    </div>

                    <div id="baidu-credentials" class="form-group" style="display: none;">
                        <label>
                            Baidu API Credentials
                            <div class="help-text">Get from <a href="https://fanyi-api.baidu.com" target="_blank" style="color: #667eea;">fanyi-api.baidu.com</a></div>
                        </label>
                        <input type="text" id="baidu-app-id" placeholder="APP ID" style="margin-bottom: 8px; width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                        <input type="password" id="baidu-key" placeholder="Key (Secret)" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                    </div>

                    <button id="translate-now-btn" class="button-primary">Translate Now</button>

                    <div class="form-group">
                        <button id="translate-restore-btn" class="button-danger">Restore to Original</button>
                    </div>

                    <div class="tip-box">
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
            shadowRoot.getElementById('translate-api').value = config.translationAPI;
            shadowRoot.getElementById('baidu-app-id').value = config.baiduAppId;
            shadowRoot.getElementById('baidu-key').value = config.baiduKey;

            // Show/hide Baidu credentials based on API selection
            if (config.translationAPI === 'baidu') {
                shadowRoot.getElementById('baidu-credentials').style.display = 'block';
            }
        }

        bindEvents() {
            // Float ball click
            this.floatBall.addEventListener('click', () => {
                if (!this.isDragging) {
                    this.togglePanel();
                }
            });

            // Float ball drag (desktop)
            if (!isMobile()) {
                this.floatBall.addEventListener('mousedown', (e) => {
                    this.isDragging = false;
                    this.dragOffset.x = e.clientX - this.floatBall.offsetLeft;
                    this.dragOffset.y = e.clientY - this.floatBall.offsetTop;

                    const mouseMoveHandler = (e) => {
                        this.isDragging = true;
                        const newX = e.clientX - this.dragOffset.x;
                        const newY = e.clientY - this.dragOffset.y;
                        this.floatBall.style.left = `${newX}px`;
                        this.floatBall.style.top = `${newY}px`;
                    };

                    const mouseUpHandler = () => {
                        document.removeEventListener('mousemove', mouseMoveHandler);
                        document.removeEventListener('mouseup', mouseUpHandler);

                        if (this.isDragging) {
                            this.configManager.set('floatBallPosition', {
                                x: parseInt(this.floatBall.style.left),
                                y: parseInt(this.floatBall.style.top)
                            });
                        }

                        setTimeout(() => { this.isDragging = false; }, 100);
                    };

                    document.addEventListener('mousemove', mouseMoveHandler);
                    document.addEventListener('mouseup', mouseUpHandler);
                });
            }

            // Panel close button - access from shadow DOM
            this.panelShadow.getElementById('translate-panel-close').addEventListener('click', () => {
                this.togglePanel();
            });

            // Language selectors - access from shadow DOM
            this.panelShadow.getElementById('translate-local-lang').addEventListener('change', (e) => {
                this.configManager.set('localLanguage', e.target.value);
            });

            this.panelShadow.getElementById('translate-target-lang').addEventListener('change', (e) => {
                this.configManager.set('targetLanguage', e.target.value);
            });

            // API selector - access from shadow DOM
            this.panelShadow.getElementById('translate-api').addEventListener('change', (e) => {
                const api = e.target.value;
                this.configManager.set('translationAPI', api);

                // Show/hide Baidu credentials
                const baiduCredentials = this.panelShadow.getElementById('baidu-credentials');
                if (api === 'baidu') {
                    baiduCredentials.style.display = 'block';
                } else {
                    baiduCredentials.style.display = 'none';
                }
            });

            // Baidu credentials - access from shadow DOM
            this.panelShadow.getElementById('baidu-app-id').addEventListener('input', (e) => {
                this.configManager.set('baiduAppId', e.target.value.trim());
            });

            this.panelShadow.getElementById('baidu-key').addEventListener('input', (e) => {
                this.configManager.set('baiduKey', e.target.value.trim());
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
            new UIManager(configManager, translator);

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

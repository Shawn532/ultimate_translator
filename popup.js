// Popup script for Ultimate Translator

// UI Translations
const UI_TRANSLATIONS = {
    'zh': {
        uiLangLabel: '界面语言',
        sourceLangLabel: '源语言',
        targetLangLabel: '目标语言',
        translateBtn: '🚀 立即翻译',
        restoreBtn: '↩️ 恢复原文',
        textareaLabel: '翻译文本框内容',
        floatBallLabel: '显示悬浮球',
        excelBtn: 'Excel文件翻译'
    },
    'en': {
        uiLangLabel: 'UI Language',
        sourceLangLabel: 'Source Language',
        targetLangLabel: 'Target Language',
        translateBtn: '🚀 Translate Now',
        restoreBtn: '↩️ Restore Original',
        textareaLabel: 'Translate Textareas',
        floatBallLabel: 'Show Floating Ball',
        excelBtn: 'Excel Translation'
    }
};

// Storage wrapper
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

// Initialize popup
async function init() {
    // Load config from storage
    const config = await storage.get('translateConfig', {
        uiLanguage: 'zh',
        localLanguage: 'chinese_simplified',
        targetLanguage: 'english',
        translateTextareas: false,
        showFloatBall: false
    });

    // Set UI values
    document.getElementById('ui-lang').value = config.uiLanguage;
    document.getElementById('source-lang').value = config.localLanguage;
    document.getElementById('target-lang').value = config.targetLanguage;
    document.getElementById('translate-textareas').checked = config.translateTextareas;
    document.getElementById('show-float-ball').checked = config.showFloatBall;

    // Update UI language
    updateUILanguage(config.uiLanguage);

    // Bind event listeners
    bindEvents(config);
}

function updateUILanguage(lang) {
    const t = UI_TRANSLATIONS[lang];

    document.getElementById('ui-lang-label').textContent = t.uiLangLabel;
    document.getElementById('source-lang-label').textContent = t.sourceLangLabel;
    document.getElementById('target-lang-label').textContent = t.targetLangLabel;
    document.getElementById('translate-btn-text').textContent = t.translateBtn;
    document.getElementById('restore-btn-text').textContent = t.restoreBtn;
    document.getElementById('textarea-label').textContent = t.textareaLabel;
    document.getElementById('float-ball-label').textContent = t.floatBallLabel;
    document.getElementById('excel-btn-text').textContent = t.excelBtn;
}

function bindEvents(config) {
    // UI Language change
    document.getElementById('ui-lang').addEventListener('change', async (e) => {
        const lang = e.target.value;
        config.uiLanguage = lang;
        await storage.set('translateConfig', config);
        updateUILanguage(lang);

        // Notify content script
        sendMessageToCurrentTab({ type: 'UPDATE_CONFIG', key: 'uiLanguage', value: lang });
    });

    // Source Language change
    document.getElementById('source-lang').addEventListener('change', async (e) => {
        config.localLanguage = e.target.value;
        await storage.set('translateConfig', config);
    });

    // Target Language change
    document.getElementById('target-lang').addEventListener('change', async (e) => {
        config.targetLanguage = e.target.value;
        await storage.set('translateConfig', config);
    });

    // Translate button
    document.getElementById('translate-btn').addEventListener('click', () => {
        const sourceLang = document.getElementById('source-lang').value;
        const targetLang = document.getElementById('target-lang').value;

        sendMessageToCurrentTab({
            type: 'HOTKEY_TRANSLATE',
            sourceLang: sourceLang,
            targetLang: targetLang
        });
    });

    // Restore button
    document.getElementById('restore-btn').addEventListener('click', () => {
        sendMessageToCurrentTab({ type: 'HOTKEY_RESTORE' });
    });

    // Translate textareas checkbox
    document.getElementById('translate-textareas').addEventListener('change', async (e) => {
        const checked = e.target.checked;
        config.translateTextareas = checked;
        await storage.set('translateConfig', config);

        // Notify content script
        sendMessageToCurrentTab({ type: 'UPDATE_CONFIG', key: 'translateTextareas', value: checked });
    });

    // Show float ball checkbox
    document.getElementById('show-float-ball').addEventListener('change', async (e) => {
        const checked = e.target.checked;
        config.showFloatBall = checked;
        await storage.set('translateConfig', config);

        // Notify content script to show/hide float ball
        sendMessageToCurrentTab({ type: 'UPDATE_CONFIG', key: 'showFloatBall', value: checked });
    });

    // Excel button
    document.getElementById('excel-btn').addEventListener('click', () => {
        chrome.tabs.create({
            url: chrome.runtime.getURL('excel-translator.html')
        });
        window.close();
    });
}

function sendMessageToCurrentTab(message) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
                if (chrome.runtime.lastError) {
                    console.warn('Message failed:', chrome.runtime.lastError.message);
                }
            });
        }
    });
}

// Initialize when popup opens
init();

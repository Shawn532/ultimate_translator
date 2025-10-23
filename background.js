// Background service worker - handles translation API requests (bypasses CSP!)

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'TRANSLATE_BATCH') {
        // Translate multiple texts at once
        const promises = request.texts.map(text => {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${request.sourceLang || 'auto'}&tl=${request.targetLang}&dt=t&q=${encodeURIComponent(text)}`;
            return fetch(url)
                .then(response => response.json())
                .then(data => {
                    const translation = data[0].map(item => item[0]).join('');
                    return { success: true, translation: translation };
                })
                .catch(error => {
                    console.error('Translation API error:', error);
                    return { success: false, error: error.message, original: text };
                });
        });

        Promise.all(promises)
            .then(results => {
                sendResponse({ success: true, translations: results });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });

        return true;
    }
});

chrome.commands.onCommand.addListener((command) => {
    let messageType = null;

    if (command === 'translate-now') {
        messageType = 'HOTKEY_TRANSLATE';
    } else if (command === 'restore-original') {
        messageType = 'HOTKEY_RESTORE';
    } else if (command === 'set-cn-to-en') {
        messageType = 'HOTKEY_CN_TO_EN';
    } else if (command === 'set-en-to-cn') {
        messageType = 'HOTKEY_EN_TO_CN';
    }

    if (!messageType) {
        return;
    }

    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        const [tab] = tabs;
        if (!tab || tab.id === undefined) {
            return;
        }

        chrome.tabs.sendMessage(tab.id, { type: messageType }, () => {
            if (chrome.runtime.lastError) {
                console.warn('Ultimate Translator hotkey message failed:', chrome.runtime.lastError.message);
            }
        });
    });
});
